Activity Score regression checks

From the repository root, start the static app with:

    python3 -m http.server 8000 --bind 0.0.0.0

With Playwright available to Node and Chromium installed, run:

    node tests/activity-score.cjs

Set CHROMIUM_PATH if Chromium is not at /usr/bin/chromium. The test uses an
isolated browser context, blocks service workers, and exposes test helpers only
in an intercepted HTML response; production code has no testing API. It does
not call backend write endpoints or modify real browser user data.

Validated: 19 checks passed, including 150/225/300-minute goals, vigorous
conversion, 5/10/15 strength assessments, two-day and coverage caps, same-day
coverage ordering, mixed activity, planned strength and bootcamp, replacements,
custom day selection, invalid/zero minutes, nutrition consolidation, existing
plans and habit points, saved templates, rule-based AI logging, all eight main
views, and persistence across reload. No JavaScript page errors. git diff --check
also passed.

Link audit: CDC adult recommendations corrected to
https://www.cdc.gov/physical-activity-basics/guidelines/adults.html (HTTP 200).
WHO, both Peloton class links, Headspace, and Waking Up returned HTTP 200.
The five Amazon search links returned HTTP 503 and both YouTube search links
were blocked by the environment (CONNECT 403); these remain unverified and
unchanged. Removed the nonexistent icon.png references, using existing icons.
User-entered links were not modified. Backend endpoints were not invoked.

Scoring conventions: aerobic contributes up to 70; strength uses the two best
days, at most 15 per day and 30 per week. Coverage is combined across all logged
strength sessions that week. Missing upper or lower coverage caps strength at
25. Mixed sessions use half their minutes for aerobic credit, doubled only for
vigorous intensity. Unassessed strength gets provisional 5; new assessment
forms default conservatively to partial/light/single. Storage keys are unchanged.

Release 9.9.3 is prepared for the Momentum-fusion-test GitHub Pages deployment.
Version metadata and service-worker cache are updated together; storage keys
and existing user records are preserved.
