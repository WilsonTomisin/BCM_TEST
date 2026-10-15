"""Q4 checks: screenshots, visual order, hidden boxes, tab order, long-heading overflow.
Run: python3 q4-css/check.py   (needs: pip install playwright && playwright install chromium)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
URL = (HERE / "index.html").resolve().as_uri()
OUT = HERE / "evidence"
OUT.mkdir(exist_ok=True)

LONG = ("A very long heading that keeps going to check wrapping: "
        "Supercalifragilisticexpialidocious-internationalisation-responsibilities")

VIEWPORTS = {"desktop": (1280, 800), "mobile": (390, 844)}

def visual_order(page):
    # Visible boxes sorted top-to-bottom, then left-to-right (what a sighted user sees).
    return page.evaluate("""() => [...document.querySelectorAll('.box')]
        .filter(b => getComputedStyle(b).display !== 'none')
        .map(b => ({n: b.querySelector('h2').textContent.trim(), r: b.getBoundingClientRect()}))
        .sort((x, y) => Math.round(x.r.top) - Math.round(y.r.top) || x.r.left - y.r.left)
        .map(x => x.n)""")

def tab_order(page):
    order = []
    for _ in range(10):
        page.keyboard.press("Tab")
        t = page.evaluate("document.activeElement.textContent.trim()")
        if not t.startswith("Link") or t in order:
            break
        order.append(t.replace("Link ", ""))
    return order

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, (w, h) in VIEWPORTS.items():
        page = browser.new_page(viewport={"width": w, "height": h})
        page.goto(URL)
        page.screenshot(path=OUT / f"{name}.png", full_page=True)
        a_width = page.evaluate("Math.round(document.querySelector('.a').getBoundingClientRect().width)")
        c_width = page.evaluate("Math.round(document.querySelector('.c').getBoundingClientRect().width)")
        print(f"[{name} {w}px] visual order: {' '.join(visual_order(page))}")
        print(f"[{name} {w}px] keyboard tab order: {' '.join(tab_order(page))}")
        print(f"[{name} {w}px] width of A = {a_width}px, width of C = {c_width}px")

        # Long heading: replace A's heading text for the test only (the HTML file is unchanged).
        page.evaluate(f"document.getElementById('h-a').textContent = {LONG!r}")
        overflow = page.evaluate("""() => [...document.querySelectorAll('.box')]
            .filter(b => b.scrollWidth > b.clientWidth).length""")
        page_overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        print(f"[{name} {w}px] long heading: boxes overflowing={overflow}, horizontal page scroll={page_overflow}")
        page.screenshot(path=OUT / f"{name}-long-heading.png", full_page=True)
        page.close()
    browser.close()
