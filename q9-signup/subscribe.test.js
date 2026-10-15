// Run: node --test q9-signup/subscribe.test.js   (Node 18+, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscribe, TimeoutError } from './subscribe.js';

// Mock newsletter service. It does NOT de-duplicate by itself (worst case),
// and its behaviour per call is scripted: 'ok' | 'accept-then-timeout' |
// 'timeout' | 'rate-limit' | 'invalid' | 'error500'.
function mockService(script = []) {
  const records = [];
  const calls = { create: 0, find: 0 };
  let next = 1;
  const api = {
    async createSubscriber(email) {
      calls.create++;
      const step = script.shift() ?? 'ok';
      if (step === 'rate-limit') throw Object.assign(new Error('429'), { status: 429, retryAfter: 0.01 });
      if (step === 'invalid') throw Object.assign(new Error('422'), { status: 422 });
      if (step === 'error500') throw Object.assign(new Error('500'), { status: 500 });
      if (step === 'timeout') throw new TimeoutError('no response'); // service never got it
      const rec = { id: `sub_${next++}`, email };
      records.push(rec);                                           // service ACCEPTED it…
      if (step === 'accept-then-timeout') throw new TimeoutError('response lost'); // …but we never hear back
      return { id: rec.id };
    },
    async findSubscriber(email) {
      calls.find++;
      return records.find((r) => r.email === email) ?? null;
    },
  };
  return { api, records, calls };
}

function setup(script) {
  const svc = mockService(script);
  const logs = [];
  const deps = { api: svc.api, db: new Map(), log: (e) => logs.push(e), baseDelayMs: 1 };
  return { ...svc, logs, deps };
}

test('baseline: a naive retry after "accepted, then timed out" creates a DUPLICATE', async () => {
  const { api, records } = mockService(['accept-then-timeout', 'ok']);
  try { await api.createSubscriber('a@b.co'); } catch {}
  await api.createSubscriber('a@b.co'); // blind retry
  assert.equal(records.length, 2);      // ← the bug described in the brief
});

test('retry after the service already accepted: no duplicate', async () => {
  const t = setup(['accept-then-timeout']);
  const res = await subscribe('A@B.co ', t.deps);
  assert.equal(res.status, 'subscribed');
  assert.equal(t.records.length, 1, 'exactly one record at the provider');
  assert.equal(t.calls.create, 1, 'second attempt reconciled instead of creating');
  assert.equal(t.deps.db.get('a@b.co').status, 'subscribed');
});

test('timeout before the service received it: retried and created once', async () => {
  const t = setup(['timeout', 'ok']);
  const res = await subscribe('a@b.co', t.deps);
  assert.equal(res.status, 'subscribed');
  assert.equal(t.records.length, 1);
});

test('rate limit: honours Retry-After, then succeeds, one record', async () => {
  const t = setup(['rate-limit', 'rate-limit', 'ok']);
  const res = await subscribe('a@b.co', t.deps);
  assert.equal(res.status, 'subscribed');
  assert.equal(t.records.length, 1);
  assert.equal(t.calls.create, 3);
});

test('rate limited beyond max attempts: kept as pending, not lost', async () => {
  const t = setup(['rate-limit', 'rate-limit', 'rate-limit', 'rate-limit']);
  const res = await subscribe('a@b.co', t.deps);
  assert.equal(res.status, 'pending');
  assert.equal(t.deps.db.get('a@b.co').status, 'pending', 'row survives for the background job');
  // Background job runs later with the same db row → completes without duplicates.
  const later = await subscribe('a@b.co', t.deps);
  assert.equal(later.status, 'subscribed');
  assert.equal(t.records.length, 1);
});

test('invalid email locally: rejected, no network call, no row', async () => {
  const t = setup([]);
  const res = await subscribe('not-an-email', t.deps);
  assert.deepEqual(res, { status: 'rejected', reason: 'invalid_email' });
  assert.equal(t.calls.create + t.calls.find, 0);
  assert.equal(t.deps.db.size, 0);
});

test('invalid email per the service (422): rejected, not retried', async () => {
  const t = setup(['invalid']);
  const res = await subscribe('x@example.invalid', t.deps);
  assert.equal(res.status, 'rejected');
  assert.equal(t.calls.create, 1, 'no retry on a permanent error');
});

test('double submit (user clicks twice): one record', async () => {
  const t = setup(['accept-then-timeout']);
  await subscribe('a@b.co', t.deps);
  const again = await subscribe('a@b.co', t.deps);
  assert.equal(again.status, 'subscribed');
  assert.equal(t.records.length, 1);
});

test('logs never contain the email address', async () => {
  const t = setup(['timeout', 'rate-limit', 'accept-then-timeout']);
  await subscribe('secret.person@example.com', t.deps);
  const text = JSON.stringify(t.logs);
  assert.ok(!text.includes('secret.person'), text);
  assert.ok(t.logs.every((e) => !('email' in e)));
  assert.ok(t.logs.some((e) => e.event === 'signup.subscribed' && e.how === 'reconciled_after_timeout'));
});
