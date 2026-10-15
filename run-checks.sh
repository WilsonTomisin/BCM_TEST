#!/usr/bin/env bash
# Re-runs every offline check. Q1's HTTP checks need WordPress running: see README.
set -e
cd "$(dirname "$0")"

echo "### Q1 PHP syntax";            php -l q1-php/theme/search-listing.php
echo; echo "### Q4 layout checks";   python3 q4-css/check.py
echo; echo "### Q5 HTML validation"; java -jar node_modules/vnu-jar/build/dist/vnu.jar --format text q5-q6/index.html 2>&1 | grep -v JAVA_TOOL
echo; echo "### Q6 JS behaviour";    python3 q5-q6/check.py
echo; echo "### Q9 signup tests";    node --test --test-reporter=spec q9-signup/subscribe.test.js
