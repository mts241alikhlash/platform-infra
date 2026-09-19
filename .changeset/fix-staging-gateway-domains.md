---
"241-platform-infra": patch
---

Fill in `deployment/staging.lock.json`'s `sslHost` placeholders with real staging domains (`dev-<app>.mts241alikhlash.sch.id`). The staging gateway image running on the VPS was built before any domain was set, so every `dev-*` host fell through to the default academic server block. Regenerated `gateway/nginx.conf`/`nginx.ssl.conf` from the fixed lock.
