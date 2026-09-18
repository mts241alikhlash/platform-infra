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

## Picking versions to deploy

Every app and service versions independently — there's no single platform
version. `scripts/latest-digests.mjs` reports the latest published digest of
all 17 components (7 web apps, 9 services, the gateway) in one shot, and can
pin them straight into `deployment/<env>.lock.json` and
`compose/docker-compose.<env>.yml` at once (both files need the same digest,
and aren't synced automatically otherwise):

```bash
GITHUB_TOKEN=<a PAT with read:packages> node scripts/latest-digests.mjs              # report only
GITHUB_TOKEN=<...>                      node scripts/latest-digests.mjs --write staging
```

See `docs/OVERVIEW.md` for the full picture: which service backs which app,
the cross-service call map, and the operational rules that bite hardest.
