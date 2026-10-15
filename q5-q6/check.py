"""Q6 behaviour checks in headless Chromium.
Run: python3 q5-q6/check.py   (pip install playwright && playwright install chromium)
P = visible paragraph, p = hidden paragraph, i = has an image, HR = separator.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (Path(__file__).parent / "index.html").resolve().as_uri()
failures = 0

STATE_JS = """() => [...document.querySelector('article').children]
  .filter(el => el.matches('p, hr'))
  .map(el => el.tagName === 'HR' ? 'HR'
       : (el.hidden ? 'p' : 'P') + (el.querySelector('img') ? 'i' : ''))"""

def state(page):
    return page.evaluate(STATE_JS)

def check(label, cond):
    global failures
    failures += not cond
    print(f"  {'PASS' if cond else 'FAIL'}  {label}")

def verify_separators(seq, label):
    """HR exactly after every 2nd paragraph when another paragraph follows; never at the end."""
    paras = [x for x in seq if x != "HR"]
    expected, n = [], len(paras)
    for i, x in enumerate(paras, 1):
        expected.append(x)
        if i % 2 == 0 and i < n:
            expected.append("HR")
    check(f"{label}: separators correct for {n} paragraphs ({seq.count('HR')} HRs)", seq == expected)

def first_texts(page):
    return page.evaluate("""() => [...document.querySelectorAll('article > p')]
        .map(p => p.textContent.trim().slice(0, 5))""")

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)

    print("1. Initial load")
    s = state(page); print("   ", " ".join(s))
    verify_separators(s, "load")
    check("toggle button created by JS, after 'Hit me'",
          page.evaluate("document.getElementById('add-paragraphs').nextElementSibling.id") == "toggle-images")
    check("toggle button not in the HTML source", "toggle-images" not in Path(URL[7:]).read_text())

    print("2. Repeated clicks (toggle not used)")
    for k in range(1, 5):
        page.click("#add-paragraphs")
        s = state(page)
        print(f"    click {k}: {' '.join(s)}")
        verify_separators(s, f"click {k}")
        check(f"click {k}: {3 + 3*k} paragraphs", len([x for x in s if x != 'HR']) == 3 + 3*k)

    print("3. Copies are the three originals, randomised")
    texts = first_texts(page)
    groups = [tuple(texts[i:i+3]) for i in range(3, len(texts), 3)]
    check("every copy group contains exactly the 3 originals", all(sorted(g) == sorted(texts[:3]) for g in groups))
    page2 = browser.new_page(); page2.goto(URL)
    orders = set()
    for _ in range(40):
        page2.click("#add-paragraphs")
    t2 = first_texts(page2)
    orders = {tuple(t2[i:i+3]) for i in range(3, len(t2), 3)}
    check(f"randomised: {len(orders)} distinct orders seen in 40 clicks (6 possible)", len(orders) >= 4)
    page2.close()

    print("4. Toggle AFTER adding paragraphs")
    page.click("#toggle-images")
    s = state(page); print("   ", " ".join(s))
    check("all image paragraphs hidden", "Pi" not in s and s.count("pi") == 5)
    check("non-image paragraphs still visible", s.count("P") == 10)
    verify_separators(s, "after hide (hidden still counted)")
    check("aria-pressed=true", page.get_attribute("#toggle-images", "aria-pressed") == "true")

    print("5. Add while hidden: new image paragraphs stay hidden")
    page.click("#add-paragraphs"); page.click("#add-paragraphs")
    s = state(page); print("   ", " ".join(s))
    check("no visible image paragraphs after 2 more clicks", "Pi" not in s and s.count("pi") == 7)
    verify_separators(s, "add while hidden")

    print("6. Show again")
    page.click("#toggle-images")
    s = state(page)
    check("all 7 image paragraphs visible", s.count("Pi") == 7 and "pi" not in s)
    verify_separators(s, "after show")

    print("7. Toggle BEFORE adding any paragraphs (fresh page)")
    page.reload()
    page.click("#toggle-images")
    s = state(page); print("   ", " ".join(s))
    check("original image paragraph hidden", s == ["P", "P", "HR", "pi"])
    page.click("#add-paragraphs")
    s = state(page); print("   ", " ".join(s))
    check("copy added while hidden is hidden", s.count("pi") == 2 and "Pi" not in s)
    verify_separators(s, "toggle-first then add")
    page.click("#toggle-images"); page.click("#toggle-images"); page.click("#toggle-images")
    s = state(page)
    check("odd number of further toggles → visible again", s.count("Pi") == 2)
    verify_separators(s, "rapid toggles")

    check("no JavaScript errors", not errors)
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if failures == 0 else f'{failures} CHECK(S) FAILED'}")
raise SystemExit(failures)
