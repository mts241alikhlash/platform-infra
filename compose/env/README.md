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

The 8 web apps don't get a file — they're static builds, nothing reads a
runtime env var.

Fill each one in from that service's own `.env.example` in the `services`
repo (`services/services/<name>/.env.example`) with real values — same
variables, same shape, just real credentials instead of the dev/example
ones. `TRUST_PROXY` is set by the compose file itself, not here: it is the
number of proxies in front of each service and defaults to `1`, the gateway.
When another proxy sits in front of the gateway (Cloudflare, or the host nginx
from `docker-compose.override.yml`), set `TRUST_PROXY=2` in a `.env` file next
to the compose files or in the shell that runs `docker compose`. With the
wrong count every client looks like the same address, and the login and
registration rate limits are shared by everyone.

**Default every one of these files to `NODE_ENV=production` — including the
ones for `docker-compose.staging.yml`.** Don't leave the example's
`NODE_ENV=development` as-is without knowing what it changes:

- The session cookie only gets the `Secure` flag when
  `NODE_ENV === 'production'` exactly (`auth.controller.ts`). Setting
  `development` anywhere deployed means that environment's cookies lose
  `Secure` — usually not what you want outside a throwaway debug box.
- The logger only prints pretty/colorized console output — instead of
  structured JSON — when `NODE_ENV === 'development'` exactly. Every other
  value (unset, a typo, `production`, anything) gets structured JSON.

**`NODE_ENV=development` is safe to set on a deployed container** — all 9
services ship `pino-pretty` as a real `dependency` now (fixed 2026-09-18), so
it no longer crashes on boot the way it used to. It's a legitimate choice for
verbose staging logs; just know it also drops the cookie `Secure` flag on
whichever service you set it on.

**`JWT_SECRET` and `PROVISIONING_SERVICE_TOKEN` must be byte-identical across
all 9 files.** Every service verifies the other's tokens with these; a typo
in one file turns into every cross-service call failing with a 401 that reads
like an expiry, not a config error.

Every `*_SERVICE_URL` must name the other container on the compose network,
with its port: `IDENTITY_SERVICE_URL=http://identity-service:3000`,
`ACADEMIC_SERVICE_URL=http://academic-service:3200`, and so on (ports in the
workspace `CLAUDE.md`). Never point one at the public gateway domain: the
gateway adds `X-Forwarded-For`, and every route behind
`ProvisioningTokenGuard` answers 404 to a request that carries it, so the
internal routes cannot be reached from the internet even with the token.

`DATABASE_URL` (and `DIRECT_URL` where the service's `.env.example` has one)
must point at that service's own database — each of the 9 is independent, no
service shares a database with another.

## identity-service single sign-on variables

- `SSO_ACCOUNTS_ORIGIN`: the accounts origin, `https://accounts.mts241alikhlash.sch.id`.
- `SSO_APPS`: comma-separated `app=https://<host>/oauth/callback` for every
  registered app (`account`, `academic`, `admin`, `admission`, `assessment`,
  `hr`, `inventory`, `portal`); `account` is required and every URL must be
  `https` in production.
- `SSO_ABSOLUTE_SESSION_DAYS`: absolute session limit, default `30`.

`GOOGLE_CALLBACK_URL` is the admission callback; staff Google sign-in returns to
`SSO_ACCOUNTS_ORIGIN/auth/google/callback`. Both redirect URIs must be listed in
the Google Cloud console.
