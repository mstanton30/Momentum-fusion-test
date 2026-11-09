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

From the Apple Health panel, open **Forgot password?** in Safari. Request the reset using the Beta account email. Open the newest reset email on the same iPhone in the same Safari browser, set a new password, then use it in the Home Screen app. This keeps the PKCE verification state in one browser.

The hosted Supabase project's **Authentication → URL Configuration → Site URL** must be the exact Beta app root, `https://mstanton30.github.io/Momentum-fusion-test/`, including the trailing slash. New confirmation and password-reset emails use this URL. Previously sent links can still contain the previous address.

## Deploy the optional Beta connections

The published Beta connects to a separate Supabase project for Apple Health uploads. AI connections need additional OAuth configuration. The migration preserves the existing health sample schema and can also create it in an empty Beta database. Do not point Beta at the production database.

1. Apply the migration in `supabase/migrations/` to the isolated project. Enable email/password sign-in and set the Beta Pages URL as the site URL and an allowed confirmation redirect in Supabase Auth.
2. Deploy the `momentum-beta` Edge Function. The function defaults to the Beta Pages URL and its own HTTPS URL for Apple Health. For OAuth, set `MOMENTUM_BETA_APP_URL` to the Beta Pages URL, `MOMENTUM_BETA_API_URL` to the public HTTPS API base, and `MOMENTUM_BETA_OAUTH_KEY` to a random secret of at least 32 characters. Supabase supplies its URL, anon key and service-role key to the function. The function validates account JWTs against Supabase Auth and verifies Shortcut and OAuth tokens itself.
3. For Apple Health-only testing, the Edge Function URL can serve as the API base. For MCP, route a dedicated HTTPS API origin to the Edge Function. The proxy must forward the original method, query, body, Authorization header and response status and headers. For example, route public `/mcp` and `/.well-known/oauth-authorization-server` to `/functions/v1/momentum-beta/mcp` and `/functions/v1/momentum-beta/.well-known/oauth-authorization-server` on the isolated Supabase host. Apply the same prefix to all paths. Do not add a frontend fallback to the OAuth discovery paths. Configure HTTPS and rate limiting at the public ingress before enrolling real users.
4. Set `supabaseUrl`, `publishableKey`, and `apiUrl` in Beta’s `beta-config.js` and publish that update to Beta Pages. Set `aiEnabled` to true only after OAuth is configured. Keep the service-role key and OAuth signing key on the server.
5. Use two test accounts. In **Progress → Body composition → Apple Health & AI connections**, sign in and create a Shortcut credential for account A. Test a manual run, a repeat, a run with no new samples, and revocation. Confirm account B sees zero of A’s measurements. Check that the original Health sample timestamp is displayed and the last successful upload advances on every successful run.

## Try external AI

Requires the OAuth configuration above.

1. Sign in to your Beta account in **Progress → Body composition → Apple Health & AI connections**. Choose **Set up AI sharing**. This creates an account workspace and, for a new workspace, copies the current device’s supported records after approval.
2. In ChatGPT or Claude, add a custom remote MCP connection with the displayed server URL. Use OAuth with automatic client registration if that option is offered. This build allows the exact stable ChatGPT callback and the Claude callback. A client that uses a different callback needs a reviewed allowlist change. Connector availability and write prompts depend on the platform and workspace.
3. Sign in and approve the connection on the Momentum consent screen. Log a test breakfast, workout and supplement through the assistant. Repeat a write with the same request ID and confirm it creates one record. Open Momentum to pull the entries and review **AI activity history**.
4. Ask for saved meals and workouts, a progress summary, and an edit to today’s entry. Ask to delete the entry or change an entry more than seven days old. Confirm the data changes only after approving in Momentum. Revoke the assistant and confirm it can no longer read or write.
5. Repeat with a separate account. Check that the second account cannot edit, read, or approve a first-account record.

The REST surface accepts `POST /api/tools` with an authorized OAuth bearer token and JSON `{"name":"saved_items","arguments":{}}`. Use `tools/list` over MCP for schemas. The API returns measurements and summaries for assistants to explain. Weekly Momentum scores update after the browser syncs. Newly logged counts are read directly from the account. Sync covers entries, saved buttons, supplements and selected progress data. Profile details, photos, DEXA notes, meal recipe notes, and unrelated settings stay on the device. Sign out to switch back to the original local workspace.

## Developer checks

Run `node --test tests/connections.test.mjs` for the isolated HTTP, OAuth, MCP and workflow checks. Install `@electric-sql/pglite@0.5.15` and `linkedom@0.18.15` in a temporary Node directory and point `NODE_PATH` to its `node_modules`. Then run `node --test tests/schema.test.cjs tests/progress.test.cjs` for the PostgreSQL and browser DOM checks. See [activity regression instructions](tests/README.md) for the existing Playwright suite.

Hosted Auth, real iPhone Health permissions and 7 a.m. automation, and live ChatGPT and Claude connections are separate acceptance checks.
