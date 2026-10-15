# BCM Developer Test – Oluwatomisin Michael Wilson

All ten questions are answered. Written answers are in **ANSWERS.docx**; code and evidence are in the folders below.

| Q | Topic | Where |
|---|---|---|
| 1 | PHP / WordPress listing | `q1-php/theme/search-listing.php`, evidence in `q1-php/evidence/` |
| 2–3 | WP admin: uploads, performance | `ANSWERS.docx` |
| 4 | CSS layouts | `q4-css/index.html`, `styles.css`, screenshots in `q4-css/evidence/` |
| 5 | HTML corrections | `q5-q6/index.html`, validator output in `q5-q6/evidence/` |
| 6 | JavaScript behaviour | `q5-q6/script.js`, tests in `q5-q6/check.py` |
| 7–8 | Troubleshooting, initiative | `ANSWERS.docx` |
| 9 | Reliable signup | `q9-signup/subscribe.js` + tests |
| 10 | Security review | `ANSWERS.docx` |

## Setup

Requirements: PHP 8.1+, Node 18+, Python 3.10+, Java 11+ (for the HTML validator).

```bash
npm install                                   # installs vnu-jar (W3C Nu HTML validator)
pip install playwright && playwright install chromium
bash run-checks.sh                            # Q1 syntax, Q4, Q5, Q6, Q9
```

### Q1 in WordPress
Any local WordPress works (LocalWP, `wp-env`, XAMPP):
1. Copy `q1-php/theme/` to `wp-content/themes/bcm-test/` and activate **BCM Test**. Its `index.php` renders the Q1 listing on every front-end request.
2. Add posts. For example, `wp post generate --count=25`, plus one post containing three `[ad]` markers on separate lines.
3. Turn on `WP_DEBUG` and `WP_DEBUG_LOG` in `wp-config.php`.
4. Run `BASE_URL=http://your-site bash q1-php/check.sh`.

I tested on WordPress 7.2-alpha (GitHub trunk), using the official SQLite Database Integration plugin instead of MySQL, PHP 8.3's built-in server, and 26 posts.

## Results of my checks
- **Q1:** pagination, search, no-results and multiple `[ad]` markers all correct; no warnings in `debug.log`; XSS input not echoed.
- **Q4:** desktop order A B C D E F G H with A spanning two columns; mobile order A D B C G; no overflow with a long heading.
- **Q5:** corrected file **and** post-JavaScript DOM pass the W3C Nu validator with no errors.
- **Q6:** 27/27 browser checks pass.
- **Q9:** 9/9 tests pass, including "the service accepted, then the request timed out".

## Where AI helped and how I verified it
I used Claude as a pair programmer: it drafted code and written answers, and I reviewed and edited them. I didn't take its output on trust; everything was checked by running it.
- **Q1:** run against a real WordPress install, not just reasoned about. Testing caught a bug in the first AI draft: an empty `s` turned the query into an "any post type" search that listed Pages. Fixed by setting `post_type` and only passing `s` when it isn't empty.
- **Q5:** validity errors come from the W3C Nu validator's output, not from memory. The validator also confirmed that the unquoted `href` and `</a >` are *valid*, which is why they're listed separately.
- **Q4 and Q6:** checked in headless Chromium for visual order, tab order, overflow, separator positions and hidden state; screenshots reviewed by eye.
- **Q9:** behaviour pinned down by tests, including a baseline test that reproduces the duplicate bug.
- **Written answers (2, 3, 7, 8, 10):** AI-assisted drafts, edited to reflect how I'd actually work. The personal example in Q8 is my own.

## If I had more time
- Q1: move to the main query with `pre_get_posts` and `/page/2/` URLs; register `[ad]` as a shortcode or ad block.
- Q6: confirm with design whether hidden paragraphs should count for separators.
- Q9: integration test against the provider's sandbox with a fault-injecting proxy.
