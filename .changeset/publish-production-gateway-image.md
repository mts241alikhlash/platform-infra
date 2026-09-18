---
"241-platform-infra": patch
---

Close the "gateway image is staging-flavored" known gap: the release workflow now builds and publishes a second gateway image per release, tagged `platform-gateway:<version>-production`, generated with `--environment production` — alongside the existing (unchanged) `platform-gateway:<version>` staging build. Caused a real incident: the VPS was running the staging-built gateway in production, so 6 of 7 app subdomains (every one but `academic`, whose `host` is the default `_` block) had no matching `server_name` and fell through to serve `academic-web`'s shell.

`scripts/latest-digests.mjs` now resolves `platform-gateway` per target environment (bare `X.Y.Z` tag for staging, `X.Y.Z-production` for production) instead of a single flavor for both, and reports both in its table. Deploying now needs no manual local `docker build` for the gateway — `latest-digests.mjs --write production` pins the correct published image directly.
