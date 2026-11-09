# Apple Health → Momentum Fusion (beta integration)

Status: design / implementation staging only. No automatic synchronization is active.

## Current architecture audit (2026-11-09)
- Beta app `index.html` stores weight in `S.weigh` in browser localStorage, with `d`, `wt`, `bf`, `mm` fields.
- Screenshot imports use `F.healthImports` and update `S.weigh` after confirmation.
- Supabase project has a `momentum_accounts` snapshot table and a `momentum_chat_inbox` table. Beta's localStorage data is **not** automatically equivalent to an authenticated Supabase account snapshot.
- Therefore do not post Shortcut measurements to an unauthenticated endpoint or assume they will appear in the beta app.

## Proposed minimal implementation
1. Read Apple Health weight and body-fat samples using an explicitly authorized iOS Shortcut. Convert kilograms to pounds; preserve source sample time, source type and stable id where available. Do not infer muscle mass from body fat.
2. Establish authenticated user-specific ingestion via Supabase. No shared access code, client service-role key, or unprotected endpoint. Prefer short-lived user authorization or a revocable per-user device token stored hashed server-side.
3. Persist samples in a dedicated user-owned table with RLS, idempotent sample identifiers, timestamp and units. Do not write directly into the entire account snapshot from the Shortcut.
4. Add beta app authenticated pull/reconciliation into `S.weigh` and `F.healthImports`, preserving existing manual entries and preventing duplicate samples.
5. Display last sync, permission failures, and missing body-fat samples. Test two distinct accounts and repeated imports before production.

## Acceptance checks
- One weigh-in reaches the correct beta user and displays the same pounds/body-fat as Apple Health.
- Running Shortcut twice does not duplicate measurements.
- One user's token cannot access another user's data.
- Offline, revoked-token and missing-body-fat scenarios are handled.
- Production remains untouched until user approves release.
