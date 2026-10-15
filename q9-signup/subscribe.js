// Q9 – reliable newsletter signup: no lost signups, no duplicates.
import { createHash, randomUUID } from 'node:crypto';

export class TimeoutError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Logs get a stable, non-reversible reference instead of the address.
const ref = (email) => createHash('sha256').update(email).digest('hex').slice(0, 12);

/**
 * @param email   raw user input
 * @param deps    { api, db, log, maxAttempts, baseDelayMs }
 *   api.createSubscriber(email, {idempotencyKey}) -> {id} | throws TimeoutError | {status, retryAfter}
 *   api.findSubscriber(email) -> {id} | null
 *   db: our own signups table (Map-like), written BEFORE any network call
 */
export async function subscribe(email, { api, db, log, maxAttempts = 4, baseDelayMs = 200 }) {
  const normalized = String(email ?? '').trim().toLowerCase();

  // 1. Invalid email: reject locally, no network call, nothing to retry.
  if (!EMAIL_RE.test(normalized)) {
    log({ event: 'signup.rejected', reason: 'invalid_email_local' });
    return { status: 'rejected', reason: 'invalid_email' };
  }

  // 2. Record intent first (an "outbox" row). If we crash or give up, the row stays
  //    'pending' and a background job retries it, so the signup is never lost.
  //    One row per email: a double-submit reuses the same row and idempotency key.
  let row = db.get(normalized);
  if (row?.status === 'subscribed') return { status: 'subscribed', id: row.providerId };
  if (!row) {
    row = { email: normalized, status: 'pending', idempotencyKey: randomUUID(), attempts: 0 };
    db.set(normalized, row);
  }

  let outcomeUnknown = false; // true after a timeout: the service MAY have created it

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    row.attempts++;
    try {
      // 3. After a timeout, check before creating again. This prevents duplicates even
      //    if the service ignores the idempotency key.
      if (outcomeUnknown) {
        const existing = await api.findSubscriber(normalized);
        if (existing) return done(row, existing.id, log, attempt, 'reconciled_after_timeout');
      }
      const created = await api.createSubscriber(normalized, { idempotencyKey: row.idempotencyKey });
      return done(row, created.id, log, attempt, 'created');
    } catch (err) {
      if (err instanceof TimeoutError) {
        outcomeUnknown = true;
        log({ event: 'signup.timeout', ref: ref(normalized), attempt });
      } else if (err.status === 409) {
        // Already subscribed (possibly by our own earlier, timed-out request): success.
        const existing = await api.findSubscriber(normalized);
        return done(row, existing?.id, log, attempt, 'already_exists');
      } else if (err.status === 400 || err.status === 422) {
        // The service says the address is invalid: permanent, don't retry.
        row.status = 'rejected';
        log({ event: 'signup.rejected', ref: ref(normalized), reason: 'invalid_email_remote' });
        return { status: 'rejected', reason: 'invalid_email' };
      } else if (err.status === 429 || err.status >= 500) {
        log({ event: 'signup.retryable', ref: ref(normalized), status: err.status, attempt });
      } else {
        throw err; // unexpected (e.g. 401 bad API key): surface it, row stays pending
      }
      if (attempt < maxAttempts) {
        // Respect Retry-After on 429; otherwise exponential backoff with jitter.
        const wait = err.retryAfter != null
          ? err.retryAfter * 1000
          : baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() / 2);
        await sleep(wait);
      }
    }
  }

  // 4. Out of attempts: keep the row 'pending' for the background retry job. Not lost.
  log({ event: 'signup.deferred', ref: ref(normalized), attempts: row.attempts });
  return { status: 'pending' };
}

function done(row, providerId, log, attempt, how) {
  Object.assign(row, { status: 'subscribed', providerId });
  log({ event: 'signup.subscribed', ref: ref(row.email), providerId, attempt, how });
  return { status: 'subscribed', id: providerId };
}
