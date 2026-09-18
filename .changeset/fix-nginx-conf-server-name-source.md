---
"241-platform-infra": patch
---

Fix the real root cause of admission (and every app but academic) serving the wrong content: `gateway/Dockerfile` only ever `COPY`s `gateway/nginx.conf` into the image — `nginx.ssl.conf` never ships anywhere, in any environment. But `generate.mjs`'s `server_name` for the shipped `nginx.conf` (the `ssl: false` render path) was sourced from each app's `host` field — a local-dev-only value (`ppdb.localhost`, `admin.localhost`, etc.) — instead of `sslHost`, the real public domain. Every earlier fix today regenerated and verified `nginx.ssl.conf`, which was never the file actually deployed; the shipped `nginx.conf` kept routing on dev hostnames regardless.

Now `server_name` in the `ssl: false` path uses `sslHost` too, matching `nginx.ssl.conf`. The `_`/`default_server` detection still keys off `host` (unchanged) since that marker is unrelated to which domain name gets served.

`gateway/generate.self-check.mjs`'s one assertion checking a literal `host`-sourced value (`server_name portal.localhost;`) is updated to the `sslHost`-sourced one for staging's current data (`PORTAL_DOMAIN` — staging's own domains are still placeholders, unrelated to this fix). `gateway/nginx.conf` (staging, committed) is regenerated accordingly.
