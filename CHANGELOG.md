# 241-platform-infra

## 0.1.1

### Patch Changes

- 7fcf38b: Wire real secrets and migrations into production/staging deploy: add `env_file` to every backend service in `docker-compose.production.yml`/`.staging.yml`, add a `--profile migrate` sibling service per backend service (reuses the existing runner image, no new Dockerfile stage), and document the `compose/env/` convention. Corrects `docs/OVERVIEW.md` claims that no longer matched the repo.
