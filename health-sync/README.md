# Apple Health sync in Momentum Fusion Beta

RENPHO writes eligible readings to Apple Health. An iPhone Shortcut reads the samples and uploads weight and body fat to an isolated Supabase Beta account. Momentum reads them after sign-in. The dashboard displays the measurement timestamp separately from the last successful Shortcut run.

Weight and body-fat readings are stored independently. Missing readings do not affect scoring. Muscle mass and other available RENPHO estimates can be added through CSV. Manual weigh-ins and screenshot imports remain available.

Start with the [Beta deployment instructions](../README.md) and the [iPhone Shortcut instructions](SHORTCUT_SPEC.md).
