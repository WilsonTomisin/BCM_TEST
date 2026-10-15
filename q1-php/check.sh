#!/usr/bin/env bash
# Q1 checks against a running WordPress with the bcm-test theme active.
# Usage: BASE_URL=http://localhost:8080 bash q1-php/check.sh
set -u
BASE=${BASE_URL:-http://localhost:8080}
OUT="$(dirname "$0")/evidence"; mkdir -p "$OUT"

t() {
  echo "=== GET $1"
  curl -s -o "$OUT/$2.html" -w "HTTP %{http_code}\n" "$BASE$1"
  grep -oz "<h1>.*</h1>" "$OUT/$2.html" | tr -s ' \n\t\0' ' ' | head -c 200; echo
  echo "posts shown: $(grep -c '<h2>' "$OUT/$2.html") | first: $(grep -o '<h2>[^<]*' "$OUT/$2.html" | head -1 | cut -c5-) | last: $(grep -o '<h2>[^<]*' "$OUT/$2.html" | tail -1 | cut -c5-)"
  echo "ad divs: $(grep -o 'class="ad ad-[0-9]*"' "$OUT/$2.html" | tr '\n' ' ')"
  grep -o 'No posts found[^<]*' "$OUT/$2.html"
  echo "PHP warnings in output: $(grep -ciE 'warning|deprecated|notice|fatal' "$OUT/$2.html")"
  echo
}

t "/" 01-no-params
t "/?s=hello" 02-search-page1
t "/?s=hello&page=2" 03-search-page2
t "/?page=3" 04-page3
t "/?s=zzzxqq" 05-no-results
t "/?s=Ads" 06-multiple-ad-markers
t "/?page=abc" 07-invalid-page
t "/?page=%3Cscript%3Ealert(1)%3C/script%3E&s=%3Cimg%20src=x%20onerror=alert(1)%3E" 08-xss-attempt
echo "--- Ads post content block:"
grep -A8 'class="entry-content"' "$OUT/06-multiple-ad-markers.html" | head -8
