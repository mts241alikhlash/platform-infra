# 241 Platform Infrastructure

Nginx gateway and Docker Compose deployment definitions for 241 Apps, a
school platform. `gateway/generate.mjs` renders `gateway/nginx.conf` (and the
TLS variant) from every app's routing manifest plus the deployment lock —
never hand-edit the generated files; run `node gateway/generate.mjs` after
changing a manifest, and `--check` before a deploy. `compose/` holds the
staging, production, and local-dev Compose stacks.

```bash
docker compose -f compose/docker-compose.dev.yml up -d   # postgres + minio, local dev
node gateway/generate.mjs --check
```

See `docs/OVERVIEW.md` for the full picture: which service backs which app,
the cross-service call map, and the operational rules that bite hardest.
