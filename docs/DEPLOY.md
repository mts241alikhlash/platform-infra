# First deployment

Staging and production have never run. This is the order for the first
install, which brings every service up together, so the "deploy X before Y"
notes written for upgrades do not apply: what matters is publish, then
migrate, then seed, then smoke-test. Every step that touches GitHub or the VPS
is done by a person; nothing here runs on its own.

## 1. Decisions and accounts (before anything is pushed)

- [ ] On 2026-10-04 every repository and package in the `mts241alikhlash`
      organisation was deleted and recreated from one initial commit, with
      every package and app at version 0.1.0 and one init migration per
      service (see `OVERVIEW.md`, "Migrations folded before the first
      deployment").
- [ ] Decide whether the service images stay public. If they turn private,
      create a classic PAT with `read:packages` for `docker login ghcr.io` on
      the VPS. The same PAT runs `scripts/latest-digests.mjs` (`GITHUB_TOKEN`).
- [ ] Create an organisation Dependabot secret `DEPENDABOT_PACKAGES_TOKEN`
      (classic PAT with `read:packages`, visible to the eight web app
      repositories). Their `.github/dependabot.yml` reads the
      `@mts241alikhlash/*` packages from GitHub Packages with it. Dependabot
      alerts and security updates are already on in every repository.
- [x] Traffic path, decided 2026-10-04: Cloudflare (proxied, SSL mode Full
      (strict)) → host nginx with a Cloudflare Origin Certificate → gateway on
      `127.0.0.1:8081` → services. `TRUST_PROXY=3` (`compose/env/README.md`).

## 2. Publish, in this order

1. **web-packages.** Push. With no pending changeset the release workflow
   publishes `@mts241alikhlash/ui` and `@mts241alikhlash/web-shared` 0.1.0.
2. **services.** Push. The release workflow publishes the nine `*-api` client
   packages and the nine service images, all 0.1.0.
3. **Package visibility.** A package that names its public repository in
   `repository` is public; check every image in the organisation's package
   settings and make it public there when it is not (GitHub has no API for
   it). The web apps' CI and Docker builds install the packages anonymously.
4. **Web apps** (all eight, `account-web` included): `pnpm up
   "@mts241alikhlash/*"` so the lockfile names the published 0.1.0 packages,
   `pnpm run validate`, commit, push. Each release publishes the image and its
   routing manifest.
5. **platform-infra.** Copy each app's published routing manifest into
   `gateway/manifests/<app>.json`; `GITHUB_TOKEN=<PAT> node scripts/latest-digests.mjs --write staging`
   (replaces every `REPLACE_BEFORE_DEPLOYMENT`); `node gateway/generate.mjs`;
   `node gateway/generate.self-check.mjs`; commit, push. The release publishes
   the gateway image.

## 3. The VPS

- [ ] PostgreSQL 13 or later (`gen_random_uuid()` in the migrations); one
      database per service: `identity`, `academic`, `admission`, `hr`,
      `inventory`, `presence`, `portal`, `student`, `assessment`.
- [ ] `docker network create mts241alikhlash-net`.
- [ ] 2 GB of swap (`free -m`); each NestJS service is capped at 320m.
- [ ] Cloudflare, in the dashboard:
  - proxied `A` records to the VPS for `dev-accounts`, `dev-academic`,
    `dev-admission`, `dev-admin`, `dev-assessment`, `dev-hr`, `dev-inventory`
    and `dev-portal` (`.mts241alikhlash.sch.id`);
  - SSL/TLS mode **Full (strict)** and **Always Use HTTPS**;
  - an Origin Certificate for `*.mts241alikhlash.sch.id` and
    `mts241alikhlash.sch.id`.
- [ ] Host nginx terminates TLS:
  - the Origin Certificate and key in `/etc/ssl/cloudflare/` (key `chmod 600`);
  - one `listen 443 ssl` server for the eight hosts with
    `proxy_pass http://127.0.0.1:8081`, `proxy_set_header Host $host`,
    `X-Forwarded-For $proxy_add_x_forwarded_for` and
    `X-Forwarded-Proto https`; port 80 redirects to https.
- [ ] `compose/docker-compose.override.yml` copied from
      `docker-compose.override.example.yml` (binds the gateway to
      `127.0.0.1:8081`), and `compose/.env` with `TRUST_PROXY=3`.
- [ ] Firewall: ports 80 and 443 only from Cloudflare's ranges
      (`https://www.cloudflare.com/ips-v4`, `ips-v6`); keep SSH open.
- [ ] `compose/env/<service>.env` for the nine services, from each service's
      `.env.example` (`compose/env/README.md`):
  - `NODE_ENV=production` everywhere;
  - `JWT_SECRET` and `PROVISIONING_SERVICE_TOKEN` identical in all nine,
    fresh, at least 32 random characters (`openssl rand -base64 48`); never
    the values of a local `.env`;
  - every `*_SERVICE_URL` is the container address (`http://identity-service:3000`
    and so on), never a public domain;
  - identity: `SSO_ACCOUNTS_ORIGIN=https://dev-accounts.mts241alikhlash.sch.id`,
    `SSO_APPS` with every app's `https://<host>/oauth/callback` (`account`
    required), `GOOGLE_CALLBACK_URL` the admission callback, the Google client
    id and secret;
  - S3 or MinIO credentials where the service stores files.
- [ ] Google Cloud console: authorised redirect URIs
      `https://dev-admission.mts241alikhlash.sch.id/auth/google/callback` and
      `https://dev-accounts.mts241alikhlash.sch.id/auth/google/callback`.

## 4. Migrate and seed

Compose loads `docker-compose.override.yml` on its own only when no `-f` is
given, so every command names it:

```bash
cd platform-infra
dc() { docker compose -f compose/docker-compose.staging.yml -f compose/docker-compose.override.yml "$@"; }
dc --profile migrate pull
for s in identity academic admission hr inventory presence portal student assessment; do
  dc --profile migrate run --rm "$s-service-migrate" || break
done
seed() { dc run --rm --entrypoint ./node_modules/.bin/tsx "$@"; }
seed -e SEED_ADMIN_PASSWORD='<12+ characters>' identity-service prisma/seed-admin-minimal.ts
seed identity-service prisma/seed-permissions.ts
dc up -d
```

The migrations also fill every default list (administrative areas, religions,
blood types, occupations, educations, the PPDB option lists, document types,
employment types, positions, inventory categories, conditions and funding
sources, leave types, portal categories, homepage sections and menu).
`seed-permissions.ts` creates the twenty-five default roles. Run it again after
every later release's migrations.

`seed:reference-data` in academic-service needs an active academic year:
create the year in academic-web first, then
`seed academic-service prisma/seed-reference-data.ts` for calendar types and a
calendar. Never run `seed-timetable.ts` there (it refuses production).

## 5. Smoke test

- [ ] `https://dev-<app>.mts241alikhlash.sch.id/health/<service>` answers for
      every service.
- [ ] `SELECT level, count(*) FROM regions GROUP BY level` in `identity` gives
      38 provinces, 514 regencies, 7,285 districts and 83,762 villages.
- [ ] `curl -m 5 http://<VPS IP>/` from outside Cloudflare times out (the
      firewall holds), and `ss -ltnp` shows the gateway on `127.0.0.1:8081`
      only.
- [ ] A request through Cloudflare logs the client's real address in
      identity-service, not a Cloudflare one (`TRUST_PROXY` is right).
- [ ] Sign in at `dev-accounts` as `admin`; the launcher lists every app.
- [ ] Open three apps from the launcher without a password; sign out of one;
      the other two sign out within about 5 seconds.
- [ ] An applicant account is refused at `dev-accounts`; a staff account is
      refused on the admission sign-in form.
- [ ] Add the school's payment account in admission-web (Admin PSB →
      Rekening Pembayaran); applicants cannot upload a payment proof until one
      is active.
- [ ] Register an applicant in admission-web, upload a document, submit; a
      `STUDENT_AFFAIRS_STAFF` account sees and verifies it.
- [ ] A gate kiosk pairs with a device token and records a scan.

Keep the previous images on the VPS until the smoke test passes: do not
`docker image prune` before then.
