# Apple Health Shortcut — beta setup specification

**Not yet live.** Do not put a Supabase service-role key, shared access code, or permanent login password into a Shortcut.

## Read Apple Health
1. In Shortcuts, request permission for Health data.
2. Find Health Samples of type **Weight** from the past 7 days, sorted newest first. Read each sample's value and start date.
3. Optionally find **Body Fat Percentage** samples; these may be absent if RENPHO is only sharing weight.
4. Convert weight to pounds before upload. Preserve the actual timestamp and use the Health sample's stable identifier if Shortcuts exposes it; otherwise create a deterministic id from source, sample type, timestamp, and value. Do not combine body-fat from a different time with an unrelated weight sample without an explicit pairing rule.
5. Upload only after per-user authentication is implemented and verified. A Shortcut personal automation may run on a schedule but is not guaranteed to run at the exact instant of a weigh-in.

## Planned JSON format
```json
{
  "samples": [
    {
      "source": "apple_health",
      "sample_key": "weight:example-stable-id",
      "measured_at": "2026-11-09T10:00:00-05:00",
      "weight_lb": 180.2,
      "body_fat_pct": null
    }
  ]
}
```

The example is illustrative, not user data. Backend should derive `user_id` from authenticated identity, never trust it from the JSON payload.

## Current blockers
- Beta app's weight store is localStorage; no verified account-authenticated read/pull path has been integrated.
- Need to determine how beta authenticates its current cloud snapshot before connecting the new table.
- Need an authorized per-user Shortcut credential design and revoke workflow.
- Need on-device permission and end-to-end testing with actual RENPHO samples.
