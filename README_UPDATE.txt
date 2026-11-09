Momentum Fusion v9.9.1 — Activity Score strength rubric update

Upload index.html to the root of YOUR Momentum Fusion GitHub Pages repository, replacing the previous index.html.
Do not upload to Dan's getripped repository.

This ZIP contains only the changed index.html plus these notes. Keep your existing sw.js, manifest.json, icons, and other files in GitHub.

New:
- Separate weekly Activity Score: aerobic 70 / strength 30.
- Strength scoring: 5 / 10 / 15 points based on effort, working sets and muscle coverage.
- Full 30 strength points requires upper + lower body coverage.
- No double-counting strength sessions on the same day.
- Planned workout strength assessment and custom strength/mixed assessment.
- Legacy habit points and nutrition remain unchanged.
- Renamed Health Score to Activity Score; Overall Health Score deferred.

Notes:
- The 70/30 and 5/10/15 weights are app design conventions, not clinically validated.
- If you use version.json for update detection, update its version to 9.9.1 in your repository after deploying.
- Existing service-worker cache settings may delay update appearance; do not clear browser data.
- Your existing browser storage keys are unchanged.
- Test on a nonproduction branch before replacing the live index.html.
