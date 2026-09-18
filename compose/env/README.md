# compose/env/

Real per-service secrets for `docker-compose.production.yml` and
`.staging.yml`. Everything in this directory except this file is gitignored
— never commit a real `.env` here.

One file per backend service, named after the service:

```
compose/env/identity-service.env
compose/env/academic-service.env
compose/env/inventory-service.env
compose/env/presence-service.env
compose/env/portal-service.env
compose/env/admission-service.env
compose/env/hr-service.env
compose/env/student-service.env
compose/env/assessment-service.env
```

The 7 web apps don't get a file — they're static builds, nothing reads a
runtime env var.

Fill each one in from that service's own `.env.example` in the `services`
repo (`services/services/<name>/.env.example`) with real values — same
variables, same shape, just real credentials instead of the dev/example
ones. `TRUST_PROXY` is already set by the compose file itself; don't repeat
it here.

**`JWT_SECRET` and `PROVISIONING_SERVICE_TOKEN` must be byte-identical across
all 9 files.** Every service verifies the other's tokens with these; a typo
in one file turns into every cross-service call failing with a 401 that reads
like an expiry, not a config error.

`DATABASE_URL` (and `DIRECT_URL` where the service's `.env.example` has one)
must point at that service's own database — each of the 9 is independent, no
service shares a database with another.
