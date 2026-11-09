# iPhone Shortcut setup for Beta

Set these up on the iPhone that receives RENPHO measurements. In RENPHO, enable Apple Health sharing for weight and body fat if available. Check Apple Health for a known sample before building the Shortcut.

1. In Momentum Beta, sign in under **Progress → Body composition → Apple Health & AI connections**. Select **Create Shortcut credential**. Copy the endpoint and token. The token can upload only to your account and is displayed once. Keep it in a private Shortcut, and revoke it in Momentum if it is exposed.
2. Create a personal Shortcut called **Sync Momentum Health**. Add **Find Health Samples** for Weight over the past seven days. Repeat for Body Fat Percentage if the action and samples are available on your iPhone. Grant read permission. When other apps also write those types, filter to RENPHO when the source is available.
3. For each sample, use its **Start Date** as `measured_at`. Format as ISO 8601 with a timezone. Convert weight to pounds. Send body fat as a percentage from 0 to 100. Verify against Apple Health so a 21.5% reading is sent as `21.5`, including conversion if the action returns `0.215`.
4. Make one Dictionary for each sample and add it to a List. Set `sample_key` to a type prefix such as `weight:` or `fat:` plus the Health sample identifier, if exposed. Otherwise hash the source, type, normalized sample timestamp and value with SHA-256 and use the hex hash after the type prefix. Keep the key the same on every run. Send one metric per sample so readings with different times retain their own timestamps.
5. Add **Get Contents of URL** with the endpoint from Momentum. Select POST and JSON request body. Add an `Authorization` header with `Bearer <your Shortcut token>`. Set the body key `samples` to your List. For a run without readable samples, send an empty list. The reply reports how many new rows were inserted and the successful upload time.
6. In Momentum tap **Sync now** to launch the Shortcut you created. Return to Momentum after the Shortcut runs. Tap **Refresh measurements** if the dashboard has not updated. Repeat once to test duplicate prevention. Confirm the sample values and dates, no duplicates, and a recorded successful sync. If body fat is missing, confirm the sample exists in Apple Health and is exposed to Shortcuts. The Shortcut can still upload weight alone.
7. In Shortcuts, go to **Automation → New Automation → Time of Day**. Set **7:00 a.m.**, **Daily**, and **Run Immediately**. Choose **Sync Momentum Health**. Weigh in on Fridays. If you weigh in after 7 a.m., run the Shortcut manually after RENPHO writes the samples. Device lock and Health permissions can affect unattended runs. Check the first scheduled run on your iPhone.

Example request body with illustrative measurements:

```json
{
  "samples": [
    {
      "source": "apple_health",
      "sample_key": "weight:example-sample-1",
      "measured_at": "2026-11-06T07:01:04-05:00",
      "weight_lb": 180.2
    },
    {
      "source": "apple_health",
      "sample_key": "fat:example-sample-2",
      "measured_at": "2026-11-06T07:01:05-05:00",
      "body_fat_pct": 21.5
    }
  ]
}
```

The API accepts up to 500 samples per request and derives the account from the token. Send weight and body fat as JSON numbers. A repeated sample key for the same account and source keeps the original row. A revoked token returns HTTP 401. Existing measurements remain visible to the account after revocation.
