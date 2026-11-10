# Momentum Fusion Beta

[Open Beta](https://mstanton30.github.io/Momentum-fusion-test/) · [Apple Health setup](health-sync/SHORTCUT_SPEC.md)

## Try the dashboard

1. Open Beta in Safari. If you installed it on your Home Screen, open that copy and use **Home → Check for updates** if it still shows 9.9.3.
2. Confirm the bottom tabs read **Home, Workout, Nutrition, Benefits, Progress**. Under Benefits, use **Supplements** and **Perks** to reach the existing logs.
3. Under Progress, open **Body composition**, **Fitness**, and **Nutrition**. Change the range between 30 days, 90 days, six months, and one year. Open **Show data** on a populated graph to see the readings.
4. In Body composition, test manual and CSV weigh-ins and compare a new DEXA scan with an older scan. DEXA comparisons show all recorded scans so annual visits can be compared even with the 30-day view selected.
5. In Fitness, log the same lift and rep count at two different loads to test the strength chart. The Activity Score uses the existing adult activity rubric. In Nutrition, review quality, days logged, and daily macro averages against your current targets.

The first Beta launch copies legacy records available in that browser into Beta-specific storage. The original storage keys stay intact. A browser or Home Screen installation with its own storage container can only copy records visible in that container.

## Recover a Beta account

From the **AI connections** panel, open **Forgot password?** in Safari. Request the reset using the Beta account email. Open the newest reset email on the same iPhone in the same Safari browser, set a new password, then use it in the Home Screen app. This keeps the PKCE verification state in one browser.

The hosted Supabase project's **Authentication → URL Configuration → Site URL** must be the exact Beta app root, `https://mstanton30.github.io/Momentum-fusion-test/`, including the trailing slash. New confirmation and password-reset emails use this URL. Previously sent links can still contain the previous address.

## Deploy the optional Beta connections

GitHub Pages hosts the Beta app. Its separate Supabase project serves Apple Health uploads, OAuth and MCP. The migration preserves the existing health sample schema and can also create it in an empty Beta database. Do not point Beta at the production database.

1. Apply the migration in `supabase/migrations/` to the isolated project. Enable email/password sign-in and set the Beta Pages URL as the site URL and an allowed confirmation redirect in Supabase Auth.
2. Deploy the `momentum-beta` Edge Function with `verify_jwt = false`. It validates account JWTs against Supabase Auth and verifies its own Shortcut and OAuth tokens. Keep `MOMENTUM_BETA_API_URL` on the existing Beta Edge Function URL. Supabase supplies its URL, anon key and service-role key.
3. Verify that `GET /mcp` under the Edge Function URL returns `401` with a `WWW-Authenticate` discovery URL. The protected resource document names the Edge Function as the issuer. The Supabase gateway reserves origin-level discovery paths, so the function serves OAuth metadata at the issuer-relative `/.well-known/openid-configuration` discovery path. Momentum issues opaque OAuth access tokens and advertises only the `momentum:log` scope.
4. After verifying the hosted endpoints, set `aiEnabled` to true in Beta’s `beta-config.js`, bump the app version and publish to GitHub Pages. The app derives the connector URL from the existing `apiUrl`.

## Try external AI

Requires the OAuth configuration above.

1. Sign in to your Beta account in **Progress → Body composition → AI connections**. Choose **Set up AI sharing**. This creates an account workspace and, for a new workspace, copies the current device’s supported records after approval.
2. In ChatGPT on the web, open **Plugins → Add custom MCP server** and enter the displayed connector URL with OAuth and dynamic client registration. In Claude, open **Customize → Connectors → Add custom connector**, enter the same URL and choose **Register automatically** for the OAuth client. This build allows the exact stable ChatGPT callback and the Claude callback. Check the actual callback shown by each client during enrollment. Connector availability and write prompts depend on the platform and workspace.
3. Sign in and approve the connection on the Momentum consent screen. Log a test breakfast, workout and supplement through the assistant. Repeat a write with the same request ID and confirm it creates one record. Open Momentum to pull the entries and review **AI activity history**.
4. Ask for saved meals and workouts, a progress summary, and an edit to today’s entry. Ask to delete the entry or change an entry more than seven days old. Confirm the data changes only after approving in Momentum. Revoke the assistant and confirm it can no longer read or write.
5. Repeat with a separate account. Check that the second account cannot edit, read, or approve a first-account record.

The REST surface accepts `POST /api/tools` with an authorized OAuth bearer token and JSON `{"name":"saved_items","arguments":{}}`. Use `tools/list` over MCP for schemas. The API returns measurements and summaries for assistants to explain. Weekly Momentum scores update after the browser syncs. Newly logged counts are read directly from the account. Sync covers entries, saved buttons, supplements and selected progress data. Profile details, photos, DEXA notes, meal recipe notes, and unrelated settings stay on the device. Sign out to switch back to the original local workspace.

## Pilot the ChatGPT meal inbox

This pilot uses a project-authorized Supabase connection to queue meals and the
signed-in Beta app's existing workspace sync to import them. Apply the inbox
migration before deploying the Edge Function. The inbox has no public client
access. It is intended for a trusted operator who already has access to the Beta
project, so installing a custom ChatGPT connector is not part of this pilot.

1. Sign in to the Beta app and open the cloud workspace under **Progress → Body composition → AI connections**. Set up AI sharing if the workspace has not been enabled.
2. Using the authorized Beta project connection, resolve the recipient's verified Beta sign-in to its workspace owner. Use that owner only after verifying the recipient. Insert a row in `public.momentum_beta_meal_inbox` with `user_id` and a `payload` such as `{"date":"YYYY-MM-DD","description":"Breakfast smoothie","mealSlot":"b"}`, substituting the user's local date. Optional fields are `p`, `c`, `f`, `fiber`, `calories`, and `qualityChoice`. Include nutrition only when known.
3. Use a fresh UUID for a distinct write, and reuse that UUID with `ON CONFLICT (id) DO NOTHING` when retrying the insert. Report the meal as queued until the inbox row is marked `logged` or `duplicate`. A `rejected` row needs correction and a new request ID.
4. Reopen Beta to trigger the usual workspace sync and confirm the entry under **Nutrition**. Only the signed-in workspace owner can trigger its import through the app. Use an isolated test account for synthetic entries.

Availability of the Supabase connection in ordinary ChatGPT Voice on iPhone is a separate acceptance test.

## Developer checks

Run `node --test tests/connections.test.mjs` for the isolated HTTP, OAuth, MCP and workflow checks. Install `@electric-sql/pglite@0.5.15` and `linkedom@0.18.15` in a temporary Node directory and point `NODE_PATH` to its `node_modules`. Then run `node --test tests/schema.test.cjs tests/progress.test.cjs` for the PostgreSQL and browser DOM checks. See [activity regression instructions](tests/README.md) for the existing Playwright suite.

Hosted Auth, real iPhone Health permissions and 7 a.m. automation, and live ChatGPT and Claude connections are separate acceptance checks.
