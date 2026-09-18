# 241-platform-infra

## 0.1.2

### Patch Changes

- dc201a7: Pin `deployment/production.lock.json` for real: all `REPLACE_BEFORE_DEPLOYMENT` image digests and `*_DOMAIN` placeholders filled in with the actual production digests and the 7 real subdomains. Root cause of `admission.mts241alikhlash.sch.id` (and every other subdomain but `academic`) serving the wrong app: the running gateway was the GHCR-published image, which is always built from `staging.lock.json` (a known gap), and staging's own `admission` `sslHost` was still a placeholder — so the deployed gateway had no route for it and fell through to the default server block (`academic-web`). Fixing production's lock file doesn't fix that by itself; the gateway still needs to be built locally with `--environment production` per the runbook, using this file.
  
  Also fixes `gateway/generate.self-check.mjs`: one assertion depended on `production.lock.json` staying unpinned forever to prove `loadInputs` rejects an unpinned production lock — the same class of bug fixed for staging's fixture earlier. Replaced with a positive check that `loadInputs` now succeeds for the (genuinely pinned) production environment; the unpinned-rejection path is still covered by the synthetic `unpinnedGateway` check already in the file.

## 0.1.1

### Patch Changes

- 8ebfe96: Wire real secrets and migrations into production/staging deploy: add `env_file` to every backend service in `docker-compose.production.yml`/`.staging.yml`, add a `--profile migrate` sibling service per backend service (reuses the existing runner image, no new Dockerfile stage), and document the `compose/env/` convention. Corrects `docs/OVERVIEW.md` claims that no longer matched the repo.
