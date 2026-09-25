# 241 Apps

The nine services and seven apps that make up 241. This file lives in
`platform-infra`, and it is the workspace-wide picture.

**The workspace folder is not a git repository.** Since 2026-09-15
(`specs/004-repository-topology`) it holds ten, each with its own remote:

| Repository | Holds |
| --- | --- |
| `services` | all nine NestJS services, one pnpm workspace, plus the generated `packages/api-*` clients and `contracts/` |
| `academic-web`, `admin-web`, `admission-web`, `assessment-web`, `hr-web`, `inventory-web`, `portal-web` | one Vue app each |
| `web-packages` | `@mts241alikhlash/ui` and `@mts241alikhlash/web-shared`, published to GitHub Packages |
| `platform-infra` | the gateway, the Compose stacks, the deployment locks, and this file |

That has one consequence worth internalising before doing anything here:
**anything a repository needs must live inside that repository.** Docs and the
constitution are duplicated into the services on purpose — there is no shared
parent to inherit from.

### Paths in the dated sections below

Sections written before 2026-09-15 describe the old single-folder layout. Read
their paths through this table; the rules they state still hold.

| Before 2026-09-15 | Now |
| --- | --- |
| `infra/nginx/generate.mjs`, `infra/nginx/*.conf` | `platform-infra/gateway/generate.mjs` and `gateway/nginx*.conf`; the old generator survives in `gateway-source/nginx/` for comparison only |
| `infra/postgres/init-databases.sql` | `platform-infra/gateway-source/postgres/init-databases.sql` |
| `docker-compose.prod.yml`, `docker-compose.dev.yml` | `platform-infra/compose/docker-compose.{production,staging,dev}.yml` |
| each app's or service's `CLAUDE.md` | its `docs/OVERVIEW.md`; no `CLAUDE.md` is checked in |
| `.claude/skills/`, `skills-lock.json`, `.specify/` at the root | not checked in anywhere |
| `scripts/release.mjs`, `VERSIONING.md` | Changesets, per repository — see "Versioning and releases" |
| `.github/scripts/changed-folders.mjs` | one `validate.yml` per repository — see "CI" |

## The nine services

The product names were settled on 2026-09-10. The old acronyms — SIAKAD,
SIMAS, SIPRES, PSB — are gone from every `appTitle`, page title and sidebar
fallback; a service's `package.json` description is the single sentence that
names it.

| Service | Product | Owns | Port | Database |
| --- | --- | --- | --- | --- |
| `identity-service` | 241 Console | identity and access: users, roles, permissions, sessions, audit, school profile, **a person's address**, administrative areas | 3000 | `identity_service`, 20 models |
| `academic-service` | 241 Academic | academic structure, curriculum, timetable, classrooms | 3200 | `academic_service`, 21 models |
| `inventory-service` | 241 Inventory | assets, units, circulation, approvals | 3300 | `inventory_service`, 15 models |
| `presence-service` | 241 Presence | gate credentials, devices, scans, daily attendance and leave, **for staff and students** | 3400 | `presence_service`, 14 models |
| `portal-service` | 241 Portal | the public website and the area that manages its content | 3600 | `portal_service`, 15 models |
| `admission-service` | 241 Admission | admission waves, applications, documents, payments, enrolment | 3700 | `admission_service`, 9 models |
| `hr-service` | 241 HR | employee records, positions, employment types, **and payroll** | 3800 | `hr_service`, 10 models |
| `student-service` | 241 Academic | student lifecycle: students, parents, enrolment, graduation, promotion | 3900 | `student_service`, 6 models |
| `assessment-service` | 241 Academic | teaching evaluation: assessment, attendance, report cards, dashboard | 4000 | `assessment_service`, 6 models |

**Every service has its own database, its own `.env`, and its own
`prisma:migrate` / `prisma:deploy`.** All nine point at the shared VPS Postgres
on `postgres:5432`; `gateway-source/postgres/init-databases.sql` creates eight of them
and `identity_service` is the server's `POSTGRES_DB`.

**116 model declarations**, down from 164 on 2026-09-09. **No service declares
a table another one owns.** student-service went from 26 to 7,
assessment-service from 25 to 6, academic-service from 24 to 21 (it gained
`Education`), admission-service from 13 to 9.

### `Teacher` became `Employee` on 2026-09-11

`Teacher` in hr-service was never a teaching record — it held `userId`, NIP,
NUPTK, employment type and structural positions. Who teaches what is
`TeachingAssignment` and `ClassroomSupervisor`, both academic-service's, both
per-semester. So the model was an **employment** record wearing the wrong name,
and a non-teaching staff member had nowhere to exist.

The rename went all the way through: `employees` and `employee_positions` in
the database, `src/employee/`, `/employees` and `/employee-positions` on the
wire, `employees.*` permission codes, and `employeeId` in academic-service,
assessment-service, academic-web and assessment-web — where those columns had
always pointed at an hr-service employee id.

**"Guru" survives as a `Position`,** which is how the code already worked:
`isTeachingStaff()` checks `position.category.code === 'ACADEMIC'`. A teacher
is an employee holding a teaching position, never a separate kind of record.
The `TEACHER` **role** is untouched — a role is not an entity.

One thing stayed `teacher` on purpose: the `TEACHER` role code, in
identity-service and every app that checks it.

`packages/*/features/profile` used to be the second — it parsed a
`/profiles/:id` shape with `teacher` and `student` branches that nothing
served. It was rewritten against identity-service's flat `ProfileDto` on
2026-09-11; see "Fixed — 1" in the audit section.

**Two cross-service contracts broke silently during the rename, and neither
typecheck nor any test caught them:** hr-service began answering
`{ data: { employeeId } }` while academic-service and assessment-service still
read `teacherId`, and the employee response began carrying `positions` while
hr-web still read `employeePositions`. Both were found by diffing the served
routes, query parameters and JSON field names against what callers parse —
by hand. A typed client generated from the OpenAPI document would have turned
both red at `typecheck`; see the audit section's first finding.

### hr-service and presence-service were resplit on 2026-09-10

`employee-service` became `hr-service` and took `payroll/` with it from
presence-service; `presence-service` kept gate presence alone and stayed
person-agnostic. `presence-web` became `hr-web`, and the `employee_service`
database became `hr_service`.

Payroll had been merged *into* presence on 2026-08-30, one day after being
split out, and that merge was right at the time. The new fact is **students**:
gate attendance is going to cover students as well as staff — every presence
model already keys on `userId` and its only distinction is a `subjectType` of
`STUDENT` or `EMPLOYEE` — and once children's daily movements live in that
database, employee salaries must not. The three costs the 2026-08-30 merge was
avoiding were paid off first rather than paid again: the duplicated
`summariseMonth` arithmetic is now a served endpoint, the roster edge
disappeared (payroll sits beside the employment record), and both
FR-055/FR-056 independence sweeps now live in one repository instead of two
that cannot see each other.

Each side's `docs/OVERVIEW.md` has the full arithmetic.

**`Address` moved to identity-service on 2026-09-11, and is now declared
once.** Two names are still declared more than once — `File` and
`FileCategory` — and those are not mirrors: each service keeps its own uploads,
in its own database.

### A person's address belongs to the person

Until 2026-09-11 `addresses` was a polymorphic table with four optional owner
columns (`student_id`, `teacher_id`, `parent_id`, `school_unit_id`), declared
identically by hr-service and student-service, and keyed on the **role record**
rather than on the person. That shape had two failures built in: somebody who
was both a teacher and a parent got two rows in two databases with nothing
keeping them in step, and somebody who was neither — an admin, a TU clerk —
had nowhere to put an address at all.

A home address is a fact about a person, and identity-service owns people: it
already held name, NIK, gender, birth place and date, contact, religion and
blood type. The address was the one personal field left behind on a role table.

`Address` now carries `profileId`, and:

- **hr-service's copy is deleted.** It turned out to be entirely dead —
  `ITeacherAddressRepository` had full CRUD, was provided and exported, and was
  called by no use case; the rows were read into a Prisma include and never
  reached a response DTO.
- **student-service's copy is deleted.** It had two real writers, in
  `createStudentWithRelations` and `enrolExistingAccount`. Both now hand the
  address to identity-service: the first through `POST /accounts`, which writes
  the profile and its address in one local transaction, and the second through
  `POST /addresses`, because that account already exists.
- **Nothing reads it over HTTP yet.** `POST /addresses/by-user-ids` is served
  for the day hr-web or academic-web wants to show an address beside a person.

The .NET Architecture guidance this follows is precise about the distinction:
duplicating data across bounded contexts is *"a valid design practice"* when a
service stores *"only the specific attributes required for its own domain"* —
what is not valid is a second **writable** copy with no propagation, which is
three writers and no owner.

**Parents are the open case.** `Parent` has no `userId`: a parent is not a
platform user, so identity-service does not know that person at all. No parent
address table was created in student-service either, deliberately — when
parents get accounts, `Parent` stops being a standalone row and becomes a
profile with a role, and the address follows everyone else's.

### Administrative areas are seeded, not fetched

`Region` (identity-service) holds the Kemendagri area tree, keyed on the
official code. One flat table: the level is implied by the shape of the code
and the parent is the code with its last segment removed.

```
32              province
32.04           regency or city
32.04.01        district
32.04.01.2001   village
```

`GET /regions/provinces` and `GET /regions/:code/children` are the whole
cascade — 38 provinces, then roughly 14 regencies per province, 14 districts
per regency, 11 villages per district. Each step is a small payload; only the
full 83,762-row village list would be heavy, and nothing ever asks for it.

Two decisions worth keeping:

- **No third-party call at form time.** The data is seeded from
  [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) (Kepmendagri
  300.2.2-2430/2025) with `pnpm seed:regions`, pointing `SEED_REGIONS_FILE` at
  its `wilayah.sql`. A public API would make somebody else's uptime our uptime
  on the form that is busiest during PPDB.
- **`Address` stores the code beside the name.** Areas are renamed, split and
  merged almost every year — that is why a new Kepmendagri is issued that
  often. The name is what the form showed; the code is what still resolves
  afterwards.

For the world beyond Indonesia: REST Countries carries no subdivisions and its
licence forbids snapshotting the dataset, and GeoNames — the only global
one — is XML-first and rate-limited on its free tier. `country` stays a
defaulted field.

**The init migrations were regenerated on 2026-09-10.** Seven of the nine
still created the tables their schema declared *before* the split — student
26 vs 7, assessment 25 vs 6, admission 13 vs 9, hr 9 vs 6, academic 24 vs
21, presence 20 vs 19, identity 17 vs 19 (that one was short, not long: it
gained `Religion` and `BloodType`). Only inventory and portal were current.
hr-service's and presence-service's were regenerated a second time the same
day, when payroll's five tables moved between them.

They were rebuilt in place, offline, without a database:

```bash
cd <service>
./node_modules/.bin/prisma migrate diff --from-empty --to-schema prisma --script   > prisma/migrations/*_init/migration.sql
```

**Call the binary, not `pnpm exec`.** pnpm prints its supply-chain banner on
stdout, and a redirect captures it: hr-service's migration once began
`✓ Lockfile passes supply-chain policies` and `migrate deploy` died with
`syntax error at or near "✓"`. See "The first live run".

`migrate dev` would need a live shadow database; `migrate diff` reads the
schema and nothing else, which is the whole job for an init migration that has
never been deployed. The folder name was kept: a changed migration under the
same name makes Prisma refuse with a checksum error, which is the accurate
thing to tell anyone who applied the old one — a new folder name would instead
try to apply on top and fail with "relation already exists".

All nine now match their schema exactly, and **no migration contains a foreign
key to a table another service owns** — checked by diffing every `REFERENCES`
against the `CREATE TABLE`s in the same file.

`academic-service` is the reference for **module layering**.
`inventory-service` is the reference for the **service boundary** — it closed
its last identity coupling first. All eight non-identity services now reach
identity-service over HTTP through a byte-identical `src/platform/identity/`
slice (`POST /auth/introspect`, cached, coalesced, fail-closed); none reads
identity's tables through Prisma any more.
`hr-service` (then `employee-service`), `student-service`, and
`assessment-service` were all extracted out of `academic-service` on
2026-09-03, in that order; the last of the three is the only one where
academic-service's side was fully cleaned up (dead modules and now-unused
borrowed slices removed, `pnpm run validate` green) in the same pass rather
than left for a following step.

## Frontend extractions

**Seven apps.** Five existed by 2026-09-10, `admin-web` was split out of
`inventory-web` the same day, and `assessment-web` followed on 2026-09-11.

**Every route in every app is English as of 2026-09-10.** `academic-web` and
`inventory-web` already were; `hr-web` (`/presensi/*` → `/attendance/*`,
`/penggajian/*` → `/payroll/*`), `admission-web` and `portal-web` were
translated, route *names* included, since those are code. portal-web's public
URLs (`/berita`, `/artikel`, `/galeri`, `/pengumuman`) keep **redirects** to
their English replacements: those are bookmarked and indexed, and renaming them
silently breaks both. Each app is its own Vue 3 + Vite app with its own
`packages/{platform,shared,ui}`, narrowed to what it reaches.

| App | Product | Dev port | Gateway `server_name` | Services it needs |
|---|---|---|---|---|
| `academic-web` | 241 Academic | 5173 | `_` (default) | identity, academic, student, hr |
| `inventory-web` | 241 Inventory | 5174 | `simas.localhost` | identity, inventory |
| `admission-web` | 241 Admission | 5175 | `ppdb.localhost` | identity, academic, admission |
| `portal-web` | 241 Portal | 5176 | `portal.localhost` | identity, portal |
| `hr-web` | 241 HR | 5177 | `hr.localhost` | identity, hr, presence, academic, student |
| `admin-web` | 241 Console | 5178 | `admin.localhost` | identity, portal |
| `assessment-web` | 241 Assessment | 5179 | `assessment.localhost` | identity, assessment, academic, student |

**`assessment-web` arrived on 2026-09-11**, and it closes the last hole in the
platform: `assessment-service` had run since 2026-09-03
with no frontend at all — no app routed to it, so the gateway had no upstream
and none of its 38 routes were reachable from a browser. Report cards, student
scores, the class register and the teacher dashboard live there now, and
`/dashboards` finally has a caller.

Its `src/features/lookup/` holds **api and types only** — no views, routes or
stores — for the classes, terms, subjects and teaching assignments a marking
screen names. A read surface, not a second copy of the academic app.

`academic-web` reaches hr-service for `/teachers` alone — a read-only picker
for a timetable row, a subject, a homeroom slot. The staff register itself
moved to `hr-web` on 2026-09-10.

**The student register landed in `academic-web` on 2026-09-11.** student-service
had run since 2026-09-03 with no screens of its own: `/students`, `/parents`,
`/student-parents` and `/student-graduations` were routed in the manifest, the
Vite proxy and the gateway, and nothing in any browser called them. Four
modules were added — `student/`, `parent/`, `student-parent/`,
`student-graduation/` — plus the `import-export`, `import-preview` and
`multi-step-form` helpers the create wizard needs.

They sit under `src/features/academic/`, not a new `src/features/student/`,
and that is deliberate: the folder names the app's domain, not the service
behind it. This app already talks to four services from modules sitting side
by side, and `classroom/` has read `/student-enrollments` since the split — a
folder per upstream service would put it in two places at once. **A service
boundary is a data-ownership rule, enforced in the backend; it is not a
filing scheme for frontends.** These screens belong beside the academic ones
for the reason the school works that way: the people who manage classes are the
people who manage the students in them.

Every payload was diffed by hand against student-service's DTOs first —
`CreateStudentDto`, `CreateParentDto`, `CreateStudentWithRelationsDto`,
`CreateStudentParentDto`, `CreateStudentGraduationDto`, `BulkGraduationDto` —
because the 2026-09-11 rename had already shown that a drifted field name
compiles fine and fails only in production. All matched.

`student-score` stayed behind (assessment-web owns marking) and `/achievement`
was dropped: no service declares `AchievementType` any more.

**`admin-web` was split out of `inventory-web` on 2026-09-10.** The eleven
platform administration screens — users, roles, permissions, audit log, school
unit, the reference lists — had been riding along in the assets app, back when
every app shipped the whole platform. `inventory-web` is now
inventory only, and `admin-web` is the only app whose `UNROUTED_PREFIXES` is
empty.

It was the first app with **`vue-i18n`** (`src/i18n/`) — **`en` is the default
and the fallback, `id` is a translation loaded on demand**, so an untranslated
key renders English rather than blank and a third locale costs nothing at first
paint.

**All seven apps carry it as of 2026-09-11.** The menu is the slice that is
done everywhere: `menuConfig.ts` holds keys, not sentences, `NavMain.vue`
resolves them through `t()`, and `src/config/menuConfig.spec.ts` holds the line
in every app — every label must match `/^[a-z]+(\.[a-zA-Z]+)+$/`, and both
locales must cover every key with `en` as the source. `admin-web` and
`assessment-web` add a third test: every menu URL must resolve to a registered
route.

That URL test earned its keep immediately when it was written: inventory-web's
menu linked to `/pengaturan/kelola-pengguna`, `/pengaturan/roles`,
`/pengaturan/permissions` and `/pengaturan/audit-logs` — **four routes that
never existed**.

`academic-web` gained the same URL test on 2026-09-11, with the student menu.

Beyond the menu, screen text is still Indonesian and moves feature by feature;
a single sweep across thousands of strings is the kind of refactor that ends up
half done.

### A menu entry is an authorization question, never an availability one

Every app's sidebar is gated on `requiredPermission` alone, read out of the
access token. **A screen never disappears because the service behind it is
down** — that would teach the operator the feature does not exist, which is
the one thing an outage must not do. The screen stays, the click works, and
the failure is stated where it happened.

What the failure says was sharpened on 2026-09-11. `serviceUnavailableMessage`
could only name the service when a *running* service reported that one of
**its** dependencies was unreachable, by parsing `The hr service could not be
reached` out of the 503 body. When the service the browser called was itself
the one down, the gateway answered 502 with no such body and the operator got
`Salah satu layanan sedang tidak berjalan` — true, useless.

The request URL knows. `packages/shared/src/utils/service-error.ts` now maps
every routed prefix to its service, so `/students` failing says **"Layanan
Kesiswaan sedang tidak berjalan"**. The body still wins when it has an answer:
academic-service returning 503 for student-service on a `/classrooms` call
names Kesiswaan, not Akademik.

A **500** is now separated from an outage and named too — "Layanan Kesiswaan
mengalami kesalahan" — because the two need different actions: one is start
the process, the other is read that service's log. `isServiceUnavailable`
still answers `false` for a 500, which is what the retry paths key on.

The prefix table lives in `packages/shared`, which is copied byte-identical
into all seven apps, so it is one table for the platform rather than one per
app. A prefix missing from it degrades to the general sentence; it never
misnames a service.

**No health polling was added, deliberately.** `HEALTH_ROUTES` exists in every
manifest and a status page could be built on it, but pinging nine services on
every page load costs nine requests to answer a question only the failing
request actually needs answered.

### Vite 8 config, and three warnings that are future errors

All seven apps run Vite 8. Three deprecation warnings were cleared on
2026-09-11, in `vite.config.ts` and `vitest.config.ts` alike:

- **`__dirname` → `import.meta.dirname`.** Vite's `configLoader: 'native'`
  loads the config as real ESM, where `__dirname` does not exist. It becomes
  the default in a future major.
- **`./api-routes.config` → `./api-routes.config.ts`.** Native ESM does not
  do extensionless resolution. `allowImportingTsExtensions` was already on in
  every app's `tsconfig.node.json`, so nothing else had to change.
- **`vite-tsconfig-paths` → `resolve.tsconfigPaths: true`.** Vite resolves
  tsconfig paths natively now; the plugin was dropped from all seven
  `package.json` files. The explicit `resolve.alias` list stays — it is what
  maps `@/ui/x` onto `components/ui/x`, which is not a plain prefix rewrite.

**The multi-tenant layer is gone as of 2026-09-10.** `organization`, `tenant`
and `achievement-type` were deleted from the frontends after checking the
backends: no service declares `Organization`, `Tenant` or `AchievementType`.
`SchoolUnit` stays — identity-service serves it and assessment-service reads it
for the report card header.

**No import statement had to change in any of the five.** Every import already
went through a path alias (`@/shared/*`, `@/ui/*`, `@/features/platform/*`), so
only the alias targets moved, from `../../packages/*` to `./packages/*`.

Read each app's own `docs/OVERVIEW.md` before working on it — they differ in
what they kept, what they call, and what is still broken. Worth knowing about
from here:

- **`portal-web` renders CMS content through `SafeHtml`**
  (`@mts241alikhlash/ui`), which runs it through DOMPurify with a tag,
  attribute and iframe-host allowlist before it reaches `v-html`. No view uses
  `v-html` directly, and `vue/no-v-html` is switched off for `SafeHtml.vue`
  alone.
- **`/settings` has no owner, and no app calls it.** `platform/settings`'s
  `AppSetting` — logo, title, maintenance mode, per-item menu visibility — was
  an admin screen that did not survive the split. `academic-web`, `admin-web`
  and `assessment-web` deleted the feature first; `admission-web`,
  `portal-web`, `hr-web` and `inventory-web` followed on 2026-09-23. Until then
  those four fetched `GET /settings` on every boot, got a 404, and fell back to
  the static branding in `configureAuth()` — which is all they use now. Those
  four still list the prefix in `UNROUTED_PREFIXES`; the entry is harmless and
  can go with the next routing-manifest change.
- **`/dashboard` singular still has no owner in four apps.** assessment-service
  serves `/dashboards`, plural — a teacher's or student's own slice, a different
  shape — and `assessment-web` is the app that calls it. `inventory-web` and
  `hr-web` still list the singular in `UNROUTED_PREFIXES`, which is correct: no
  service serves it.
- **Two kinds of file, and only one belongs in a library.** portal-service's
  `platform/file` is generic (`POST /files/upload?appKey=`, `GET /files`,
  `DELETE /files/:id`, partitioned by app) — a media library. admission-service
  has its own `core/storage` for documents and payment proofs, which are part of
  an application, not files anyone browses. Only the first kind wants a file
  manager screen, and it is not built yet.

**One gateway serves all seven.** `gateway/generate.mjs` reads every app's
routing manifest and emits one `server` block per app, keyed on `server_name`, sharing
the upstream declarations — seven containers cannot all hold :80, and each
app's SPA still shares an origin with the API it calls, which is what keeps the
`SameSite=strict` refresh cookie working.

## Read these before changing anything

`docs/OVERVIEW.md` is this file. Every app and every service has its own
`docs/OVERVIEW.md` too; no `CLAUDE.md` is checked in anywhere.

Every service carries the same five documents, in this order of precedence:

0. `docs/OVERVIEW.md` — what this service is, what it owns, what it borrows,
   and what is still broken. Start here.

1. `docs/CONSTITUTION.md` — eight binding principles. Everything above its
   SERVICE PROFILE heading is **shared byte-for-byte across all six**; below it
   is that service's own profile.
2. `docs/ARCHITECTURE.md` — where code goes. Part 1: the target layering, the
   measured current state, and the conversion procedure. Part 2: the service
   boundary.
3. `docs/CLEAN-CODE.md` — what a file looks like once it is in the right place,
   worked through that service's real files.
4. `docs/NESTJS-RULES.md` and `docs/IAM.md` — the exhaustive rule list and the
   authorization model.

Work that spans services goes through `specs/` here, one folder per feature
(`spec.md`, `plan.md`, `tasks.md`).

## The rules that bite hardest

**A service may run `prisma migrate` only against a database it owns alone.**
This rule inverted on 2026-09-09. While eight services shared one database and
each declared only part of it, any `migrate` dropped the other services'
tables — so the rule was "never, except inventory-service". Now that schemas
are domain-scoped and each service owns its database alone, migrating is how a
service deploys. **All nine ship `prisma:migrate` / `prisma:deploy`**, and each
one is safe to run: no service declares a table another one owns.

**`start:prod` migrates in none of the nine.** It is `node dist/src/main.js`
everywhere. `inventory-service` was the last still running
`prisma migrate deploy` on boot and stopped on 2026-09-10: migrating on boot
races every extra replica and takes the timing of a schema change away from
whoever is deploying. Migration is an explicit step — `--profile migrate` in
`compose/docker-compose.production.yml`, per service.

**A change to a file that exists in more than one repository here must be made
in all of them, in the same session.** There is no sync tooling and no CI
check. That covers `NESTJS-RULES.md`, `IAM.md`, the shared half of
`CONSTITUTION.md`, `src/core/interceptors/response.interceptor.ts`,
`src/platform/identity/`, and `packages/shared/` across the seven apps.

**`gateway/nginx.conf` and `gateway/nginx.ssl.conf` are generated — never
hand-edit them.** The routing table has one source per app — its own
`api-routes.config.ts` — but the gateway never reads app source. Each app's
release runs `pnpm run routes:emit` and publishes a JSON routing manifest with
a SHA-256; that file lands in `gateway/manifests/<app>.json`, and
`deployment/<env>.lock.json` pins its version and checksum beside the app's
image digest. The generator renders both configs from the manifests,
`upstreams/services.json`, and the lock:

```bash
node gateway/generate.mjs              # rewrite both configs
node gateway/generate.mjs --check      # exit 1 if either is stale
node gateway/generate.self-check.mjs
```

Add an endpoint prefix to an app's `api-routes.config.ts` and the Vite proxy
learns it at once; the gateway learns it once that app releases and its new
manifest is pinned here. A prefix a frontend calls but nothing routes is
answered with `index.html` at HTTP 200 in dev and refused in production —
`UNROUTED_PREFIXES` exists to make both 404. Run `pnpm run routes:check` in the
app and `--check` here before a deploy; run `pnpm run smoke:gateway` in
`academic-web` against the deployed origin after one.

Adding an app is: write its `api-routes.config.ts`, add it to `EXPECTED_APPS`
in `gateway/generate.mjs`, add its manifest and lock entry, and add its image to
`compose/docker-compose.{staging,production}.yml`. Adding a service an app calls
is one entry in `upstreams/services.json`. The generator exits 1 naming the app
if a manifest routes a prefix to a service with no upstream declared.

**All nine services are dockerized as of 2026-09-10**, each with a
`Dockerfile` and a `.dockerignore` beside it. Until then only five had one —
identity, academic, admission, hr and student — so the platform ran five
services in Docker and four somewhere else, and `docker-compose.production.yml`
listed only the five. inventory, presence, portal and assessment were added
from the same template; portal's runner also copies `./public`, which
`ServeStaticModule` resolves from the working directory.

Each `Dockerfile` has two stages, `build` and `runner`. There is no separate
`migrator` stage: `pnpm --filter <service> deploy --prod --legacy /out`
already copies the service's full source — schema folder and
`prisma.config.ts` included, since neither is excluded by `.gitignore` and
no `package.json` `files` field narrows what `deploy` packs — so the
`runner` image already holds everything `prisma migrate deploy` needs.
Migration runs against that same image, via a `--profile migrate` sibling
service per backend service in `compose/docker-compose.production.yml` /
`.staging.yml`, overriding the entrypoint to call the `prisma` binary
directly instead of booting the app. `start:prod` migrates in none of the
nine — `inventory-service` was the last one still doing it on boot, which
races every extra replica and takes the timing of a schema change away from
whoever is deploying.

**The build context matters.** The `build` stage copies only
`package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`, then `services/` and
`packages/`, explicitly — never a blanket `COPY . .`. A `COPY . .` would pull
in whatever `node_modules` the host already resolved (Windows-built, wrong
platform) on top of the Linux tree pnpm had just installed, and would bake
`.env` into an image layer; naming each path avoids both.

`.env` staying out has a consequence worth knowing: `prisma.config.ts` throws
unless `DIRECT_URL` or `DATABASE_URL` is set, so the build used to depend on a
file that is gitignored — **it could not build from a clean clone at all**. The
generate step now carries a throwaway URL on the `RUN` line; `prisma generate`
only reads the schema and never connects. Real credentials reach the container
at run time through compose's `env_file:`, from the host, never from the image.

**Never `git add -A` or `git add .` without a path** in any service — and least
of all in `academic-service`, whose working tree currently shows **738 modified
files**, most of them CRLF/LF normalisation with zero content change. Scope to
the module and read `git diff --cached --stat` before committing. To tell a real
change from line-ending noise: `git diff --ignore-cr-at-eol -- <path>` — empty
means no real change. The other five trees are clean.

## NestJS 12, and the bug class it removes

All nine services moved from NestJS 11.2 to **12.0.1 on 2026-09-11**. Three
things changed that are worth knowing before touching a service:

**`routeResolutionStrategy: 'specificity'` is on.** Route matching no longer
depends on declaration order — a literal segment beats a parameter wherever it
is written. `@Delete('bulk')` after `@Delete(':id')` now works. Both options
live in one place, `src/core/config/route-options.ts`, shared byte-for-byte by
`main.ts` and by `src/route-conflicts.spec.ts` so the two cannot drift:

```ts
export const ROUTE_OPTIONS = {
  routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
  routeResolutionStrategy: 'specificity',
} as const satisfies NestApplicationOptions
```

`shadow` is `'warn'`, not `'error'`, and that is deliberate: the detector
reports **every** literal/parameter overlap, including the correct ones. Five
fire in hr-service alone — `/teachers/roster` over `/teachers/:id`,
`/payroll/payslips/me` over `/payroll/payslips/:id` — and all five are the
behaviour you want. `duplicate` stays `'error'`: two handlers claiming the same
route is always a bug.

`src/route-conflicts.spec.ts` boots the real HTTP router in every service —
nothing did that before, since `app.module.boots.spec.ts` only compiles the
module graph — and walks the registered Express stack asserting no parameter is
registered ahead of a literal it would swallow. Removing `specificity` makes it
red with the exact sentence `DELETE /academic-calendars/:id is registered
before /academic-calendars/bulk and swallows it`.

The repo's own `src/route-collisions.spec.ts` stays. It reads source rather than
booting, and it only ever detected *duplicates*: `if (a.file === b.file) continue`
skips same-controller shadowing, and it requires the match to hold in both
directions, which one-way shadowing never does. It implemented half of what
NestJS now names as two separate policies.

**The `@nestjs/*` packages are ESM-only now**, so Jest can no longer `require()`
them. Tests run through `cross-env NODE_OPTIONS=--experimental-vm-modules jest`
— that flag is what exposes `vm.SourceTextModule`, which is how Jest 30 detects
that Node 24.9+ can require ESM natively. Without it every suite fails with
*Must use import to load ES Module*. The `transformIgnorePatterns` allowlist for
`htmlparser2` and friends was deleted in the same move: transpiling a dual
package to CJS and then evaluating it as ESM is what produced
*exports is not defined*.

**Two API breaks had to be fixed by hand.** `@nestjs/terminus` dropped the
`HealthIndicator` base class for `HealthIndicatorService` (`prisma.health.ts`,
identical in all nine), and `ThrottlerAsyncOptions` made `imports` required.

## Running the whole platform locally

Needs Docker (for Postgres and MinIO) and pnpm. Nothing else — there is no
Postgres or Docker installed on the machine this was set up on, so the first
step is real.

```bash
docker compose -f compose/docker-compose.dev.yml up -d
#   postgres  :5433 — 9 databases, created by gateway-source/postgres/init-databases.sql
```

That's Postgres only — MinIO and a compose file that also runs the nine
services against shared infrastructure don't exist yet in this repo. Until
either lands, MinIO (`S3_ENDPOINT`, `S3_BUCKET`) needs to be run and pointed
at separately; see each service's own `.env.example`.

Inside that network the database host is `postgres`, not `localhost`. The two
files are alternatives, not layers: the shared one declares no Postgres and no
MinIO, and joins `dev-network` as `external`, so a wrong name fails at `up`
instead of quietly creating an empty network.

MinIO was added on 2026-09-09. `portal-service` and `admission-service`
**refuse to boot** without `S3_ENDPOINT`, `S3_BUCKET` and the two credentials
— `StorageService` is written for MinIO already (`forcePathStyle: true`) and
neither `.env` had the keys, so both had been unstartable since the split.

Then, once per service (they are independent, order does not matter):

```bash
cd <service> && pnpm install && pnpm prisma:generate && pnpm prisma:deploy && pnpm dev
```

**`.env` is set for the local stack.** All nine point at
`localhost:5433`, and portal/admission at `localhost:9000`; the VPS
`dev-network` pair (`postgres:5432`, `minio:9000`) sits commented beside each.
Swap them to run inside that network.

Two traps the first live run found, both now closed in the files:

- The local `DATABASE_URL` must carry **`&sslmode=disable`**. `pgSslOptions()`
  turns TLS on unless the string disables it, and the local container serves
  none — without the flag every service dies at boot with *"The server does not
  support SSL connections"*.
- `S3_ENDPOINT=http://minio:9000` is the dev-network alias and does not resolve
  from the host. `StorageService` builds its client lazily, so the service
  **boots fine and only uploads fail** — a quiet one.

`.env` is filled in for all nine and gitignored. `JWT_SECRET` and
`PROVISIONING_SERVICE_TOKEN` are byte-identical across every service — token
verification and every service-to-service call fail with a 401 that reads like
an expiry if they drift.

| Service | Port | Database |
| --- | --- | --- |
| identity | 3000 | `identity_service` |
| academic | 3200 | `academic_service` |
| inventory | 3300 | `inventory_service` |
| presence | 3400 | `presence_service` |
| portal | 3600 | `portal_service` |
| admission | 3700 | `admission_service` |
| hr | 3800 | `hr_service` |
| student | 3900 | `student_service` |
| assessment | 4000 | `assessment_service` |

### Which processes you actually need

Nobody runs all sixteen. Bring up the infrastructure once, then start only the
services the app you are testing calls — each app's row in the frontend table
lists them.

```bash
docker compose -f compose/docker-compose.dev.yml up -d   # postgres :5433; MinIO runs separately

cd <service> && pnpm prisma:deploy && pnpm dev      # once per service you need
cd <app> && pnpm dev                                # the app itself
```

`prisma:deploy` is only needed the first time against an empty database, or
after a migration changes.

| Testing | Services to start |
|---|---|
| `academic-web` :5173 | identity, academic, student, hr |
| `inventory-web` :5174 | identity, inventory |
| `admission-web` :5175 | identity, academic, admission |
| `portal-web` :5176 | identity, portal |
| `hr-web` :5177 | identity, hr, presence, academic, student |
| `admin-web` :5178 | identity, portal |
| `assessment-web` :5179 | identity, assessment, academic, student |

identity-service is in every row — start it first, and seed it once:

```bash
cd identity-service
pnpm seed:iam                 # roles + 266 permissions
pnpm seed:profile-references  # religions + blood types
pnpm seed:admin-minimal       # admin / admin123, SUPER_ADMIN
SEED_REGIONS_FILE=path/to/wilayah.sql pnpm seed:regions
```

A service that needs one that is down fails closed with a 503 naming it, so a
missing process is obvious rather than mysterious.

**For `admission-web`** (`:5175`), three must be up: identity (sign-in and the
profile form's dropdowns), admission (everything PPDB) and academic
(`/academic-years`, which a wave belongs to).

```bash
cd admission-web && pnpm install && pnpm dev     # http://localhost:5175
```

**For `academic-web` specifically**, four must be up: identity (sign-in),
academic (most screens), student (`/students`, `/student-enrollments`, and
academic's own enrolment lookups), and hr (`/teachers`, plus every name
academic-service puts beside a timetable row, a subject and a homeroom slot).
Then:

```bash
cd academic-web && pnpm install && pnpm dev     # http://localhost:5173
pnpm run smoke:gateway                          # proves the routing, once they are up
```

**`/teachers` was wired to what is now hr-service on 2026-09-09.** It had sat
in `UNROUTED_PREFIXES` since the extraction, so every teacher picker in the app
404'd — the roster had moved and nothing routed there. hr-service is in
`SERVICE_PREFIXES`, in the Vite proxy, in the generated gateway config, in
`compose/docker-compose.production.yml`, and has a `Dockerfile` (it had none).

**`UNROUTED_PREFIXES` is now empty: every prefix academic-web calls is routed.**
`/religions` and `/blood-types` were the last two, and neither had an owner —
`Religion` was declared only by admission-service, for its own applicants, and
`BloodType` was declared by no service at all, so the profile form's two
dropdowns were reading an endpoint with no table behind it anywhere. Both
describe a person and identity-service owns people, so both live there now:

```bash
cd identity-service && pnpm seed:profile-references   # fills both lists
```

The mechanism stays even though the list is empty. Vite answers an unmatched
GET with `index.html` at HTTP 200, so a prefix that is called but not routed
resolves with an HTML body and `res.data.data` is `undefined` — nothing throws.
Anything added to that list is refused in dev exactly as the gateway refuses
it.

## Cross-service calls that exist today

Every one is `@Public()` + `ProvisioningTokenGuard` on the receiving side,
batched by distinct id where it can be, and failing closed with a 503.

```
all 8 services   ──POST /auth/introspect──────> identity-service
6 services       ──POST /profiles/batch───────> identity-service
admission, hr,   ──POST   /accounts───────────> identity-service
student               GET    /accounts/lookup
                      PATCH  /accounts/:id, /accounts/:id/profile
                      POST   /accounts/:id/roles
                      DELETE /accounts/:id
student-service  ──POST   /addresses───────────> identity-service
admission-service──POST /religions/by-ids─────> identity-service
assessment-service──GET /school-units/profile──> identity-service
6 services       ──POST /audit-logs───────────> identity-service

hr-service       ──GET  /teaching-assignments/employee-ids──> academic-service
hr-service       ──POST /daily-presences/monthly-summary───> presence-service
                   POST /daily-presences/by-users
                   GET  /presence/periods/:year/:month/closed

academic-service ──GET  /employees/{by-user/:id,:id/exists}──> hr-service
                   POST /employees/by-ids
assessment-service──GET /employees/{by-user/:id,:id/exists}──> hr-service

academic-service ──GET  /students/by-user/:id──────────> student-service
                   POST /students/by-ids
                   GET  /parents/count-by-occupation/:id
                   GET  /student-enrollments/active/:id
                   POST /student-enrollments/{count-by-semesters,rollover}
admission-service──POST /students/enrol────────────────> student-service
assessment-service──GET /students/by-user/:id──────────> student-service
                   GET  /student-enrollments/{summary/:id,active/:id,
                        by-classroom/:id}
                   POST /student-enrollments/{by-ids,search,count-active,
                        count-by-classrooms}

student-service  ──GET  /classrooms/{:id/detail,:id/context,──> academic-service
                        by-code/:code,by-academic-year/:id,
                        codes,grade-levels}
                   POST /classrooms/by-ids
                   GET  /semesters/{active,:id/context,:id/summary,
                        by-academic-year/:id}
                   POST /semesters/by-ids
                   GET  /academic-years/{active,:id/summary}
                   POST /academic-years/by-ids
                   GET  /grades/{levels,by-level/:level}
                   POST /grades/by-ids
                   GET  /occupations/:id/summary
                   POST /{occupations,educations}/by-ids
student-service  ──POST /report-cards/averages──────────> assessment-service

assessment-service──GET  /academic-settings/summary─────> academic-service
                      POST /curriculum-subjects/passing-scores
                      GET  /teaching-assignments/{:id/exists,load,by-employee}
                      POST /teaching-assignments/by-ids
                      GET  /classrooms/{supervised,supervises,:id/summary}
                      POST /classrooms/by-ids
                      GET  /schedules/lessons
                      POST /schedules/by-ids
                      GET  /semesters/{active,:id/summary}
                      POST /semesters/by-ids
                      GET  /academic-years/active
assessment-service──POST /daily-presences/{by-users,──────> presence-service
                           monthly-summary}

admission-service──POST /{academic-years,occupations,──> academic-service
                          educations}/by-ids
```

**`POST /students/enrol` is the one that is not a provisioning call.**
admission-service forwards the *operator's own* bearer token, so accepting an
applicant requires that person to hold `students.create` in student-service.
Deliberate — the enrolment is an act by a named human, and the audit row should
name them — but it means an admission operator with no student permission gets
a 403 at the last step of a flow that looked like it would succeed.

**Four internal endpoints have no caller at all** as of 2026-09-11:
`GET /educations/:id/summary` and `GET /classrooms/:id/context` (academic),
`GET /employees/roster` (hr — payroll reads the roster in process now),
`POST /blood-types/by-ids` (identity — `/religions/by-ids` beside it is called
by admission-service, blood types are not) and `POST /addresses/by-user-ids`
(identity — served ahead of the screen that will read it). None is wrong.

**Semester rollover moved to academic-service on 2026-09-09.** It creates next
semester's classrooms, supervisors, teaching assignments and schedules — four
of the five tables it writes are academic-service's — so it runs there in one
local transaction, then calls student-service for the enrolments. That second
step is not in the transaction: if it fails, the classrooms exist and the
enrolments do not, which is visible to the operator and repaired by running it
again (the endpoint skips a student already enrolled in the target semester).
The same shape as `admission-service → POST /students/enrol`.

`/semester-rollovers` moved with it in `academic-web`'s routing manifest.

academic-service became a *provider* on 2026-09-09 as well, for the
assessment-service conversion that is still open:

```
GET  /academic-settings/summary            defaultPassingScore + weeklyHolidays
POST /curriculum-subjects/passing-scores   batch grade/year/subject -> score
GET  /teaching-assignments/:id/exists
```

and student-service gained the enrolment reads assessment-service needs:

```
GET  /student-enrollments/summary/:id
GET  /student-enrollments/by-classroom/:classroomId?semesterId=&limit=
POST /student-enrollments/count-active     { ids }
```

All six are `@Public()` + `ProvisioningTokenGuard`, the same pairing as
`/accounts`. **Nothing consumes them yet** — see "What assessment-service and
student-service still need".

`/auth/introspect` runs through a byte-identical `src/platform/identity/` slice
in all eight — cached for `IDENTITY_CACHE_TTL_MS`, coalesced per token,
timed out at `IDENTITY_TIMEOUT_MS`, and failing closed with 503 rather than
401. Change it in one service and it must be changed in all eight.

`POST /students/enrol` **pointed at academic-service until 2026-09-09**, which
404s: the endpoint moved to student-service with the 2026-09-03 extraction and
the caller was never repointed. The variable is `STUDENT_SERVICE_URL` now.

**identity-service's tables are no longer read by anyone through Prisma.**
Sessions, grants, profiles, accounts and audit rows all go over HTTP.

**Every service now reads only tables it owns.** The last eight foreign reads
closed on 2026-09-09: academic-service's `teachers` and `students`,
hr-service's `semesters` / `teaching_assignments` / `classroom_supervisors`,
and admission-service's `academic_years` / `occupations` / `educations`. Not one of them was a `prisma.x` call — they were
relation includes, relation `where` filters, an `orderBy` through a relation,
and a `_count.select`, which is why three successive scans missed them.

**A boundary scan has to read `include`, `where` relation filters, `orderBy`
and `_count.select`, not just the model accessor.** The scan that found them
compares the models a service declares against the models it accesses, then
reads the relation fields on whatever is left over.

`Education` had no owner at all — declared by admission-service and
student-service, served by neither, so each would have created its own copy on
first migrate. It went to academic-service's `reference-data/`, beside
`Occupation`: the two are the same kind of list, filled in on the same form, by
the same two services.

### Dropping a relation drops its index

Prisma emits an index for a relation scalar as part of the foreign key it
creates. Remove the relation because the model belongs to another service and
the column stays but the index does not. The Prisma docs say this of
`relationMode = "prisma"`, and it is just as true of a relation deleted by
hand:

> Because Prisma relation mode does not use database-level foreign keys, no
> indexes are generated automatically when applying schema changes with Prisma
> Migrate or db push. Indexes must instead be manually defined on relation
> scalar fields.

So an orphaned `xId` gets an explicit `@@index` **if something filters on it**,
and nothing if it is only ever read back out. Three qualified:
`ClassroomSupervisor.teacherId`, `Parent.occupationId` and
`AdmissionWave.academicYearId`. The four class officers on a classroom
structure, an applicant's parent's occupation and education, and every
`verifiedById` / `authorId` audit column did not — indexing those would cost
writes and buy no read.

**`student_enrollments` is written by three services** — student-service owns
it, and academic-service and assessment-service both `create`, `createMany`
and `update` it. That is not a read to convert; it is a question about who
owns enrolment, and it has to be answered before those databases can separate.
academic-service's own CLAUDE.md called its slice "read-only", which is not
what the code does.

**student-service's side closed on 2026-09-09.** Its five borrowed slices
(`classroom`, `grade`, `semester`, `academic-year`, `teaching-assignment`) were
deleted, `prisma/` went from 26 models to the 8 it owns, and every classroom,
term, grade, year and occupation a row is labelled with now arrives over HTTP —
batched by distinct id, one call per entity type per page. Three cross-service
reads that earlier scans had missed turned up in the process, all of them
relation includes and filters rather than `prisma.x` calls: the enrolment
list's `classroom.grade` / `semester.academicYear` join, the student list's
`grade` join and its `orderBy: { grade: { level } }`, and the parent list's
`occupation` join. A scan for foreign tables has to read includes, `orderBy`
and `where` relation filters, not just the model accessor.

Separately from live reads: **duplicated models** — see the note under the
services table. A service still declaring a model another one owns will create
its own copy of that table the moment it migrates, with nothing keeping the two
in step. Each service's `ARCHITECTURE.md` Part 2 lists its own couplings.

## Skills

No agent skills are checked in: `.claude/` is git-ignored in every repository,
so whatever skills a contributor uses live on their own machine.

## Versioning and releases

Per repository, with [Changesets](https://github.com/changesets/changesets).
Every app, `services`, `web-packages` and this repository carry a
`.changeset/` folder:

```bash
pnpm changeset          # record the change and its bump, commit the file
```

A pull request that touches an app's or the services' shipped files fails CI
without a changeset (`.github/scripts/require-changeset.mjs`). On `main`,
`changesets/action` opens a "Release" pull request; merging it bumps the
version, writes `CHANGELOG.md`, and publishes — an app's image to GHCR and its
routing manifest, a service's image, a package to GitHub Packages. Deploying is
a separate step: pin the new digests with `scripts/latest-digests.mjs --write
<env>` (see the README). `main` is the only long-lived branch.

MAJOR here means the **HTTP contract** another service depends on changed — a
breaking change of that kind compiles fine and turns nothing red, so check
`docs/ARCHITECTURE.md` Part 2 for who calls you before choosing the bump.

The 2026-09-11 rename is the standing example: `/teachers/*` became
`/employees/*`, `?teacherId=` became `?employeeId=`, and the response field
`teacherId` became `employeeId`. Nine services and seven apps were green the
whole time; two of those three changes had already broken a caller.

## CI

Each repository runs its own `.github/workflows/validate.yml` on every pull
request and every push to `main`. In an app it is the same commands you run by
hand, as separate steps so the red one names the problem:

```
format:check → lint → typecheck → lint:strict → test → build → routes:check
```

Beyond those:

- **The services** validate only the services a change affects
  (`.github/scripts/affected-services.mjs`). Each runs `prisma generate` first,
  with the same throwaway `DATABASE_URL` the Dockerfile uses — nothing in CI
  connects to a database — then the six checks, then `openapi:emit`, which must
  match `contracts/<service>/openapi.json` byte for byte.
  `scripts/check-contract-compatibility.mjs` refuses a breaking contract change
  that is not versioned as one.
- **This repository** runs `node gateway/generate.mjs --check`, the generator's
  self-check, `nginx -t` against both generated configs, and
  `docker compose config` against the staging and production stacks.

## Pre-push audit, 2026-09-10, and the fixes on 2026-09-11

All **sixteen** folders are green — `format:check`, `lint`, `typecheck`,
`lint:strict`, `test`, `build` — **900 frontend tests across 7 apps** (234 / 80 / 74 / 97 / 184 / 130 / 101),
and on the backend academic-service 568, student-service 388, hr-service 354,
identity-service 251, inventory-service 103, `node gateway/generate.mjs --check` clean,
no comment in any `src/` outside the tool directives, no file over 300 KB that
is not a lockfile, `.env` ignored in all sixteen.

The counts above are the audit's own and were not re-measured since. A full run on
2026-09-25, each repo on its own, found 732 frontend tests (academic-web 215,
admin-web 61, admission-web 61, assessment-web 78, hr-web 152, inventory-web 97,
portal-web 68) and 3,184 backend tests (academic 573, admission 174,
assessment 285, hr 360, identity 297, inventory 411, portal 402, presence 285,
student 397).

The audit of 2026-09-10 found seven things that were not green. None was caused
by the HR/presence split; all predated it and would have shipped on the first
push. Six are fixed; what remains is stated as a decision, not a defect.

### Fixed — 1. `/profiles/*` was called by five apps and served by nobody

identity-service's `profiles.controller.ts` had exactly one route,
`POST /profiles/batch`, the internal one. The **"Profil Saya" screen was dead
in every non-portal app.**

`src/profile/` now serves the identity half — `GET/PATCH /profiles/me` and
`GET/PATCH /profiles/:userId`, with religion, blood type and the avatar file
resolved, NIK/email/phone uniqueness enforced, and an unknown `religionId` or
`bloodTypeId` refused with a 400 rather than written.

**Addresses followed on 2026-09-11** — `GET/POST /profiles/me/addresses`,
`PATCH/DELETE /profiles/me/addresses/:id` and the same four for
`/profiles/:userId/addresses`, plus `POST /addresses/by-user-ids` and
`POST /addresses` for services. See "A person's address belongs to the person".

**Social media links were not ported, and should not be.** No service declares
a `ProfileSocialMedia` model any more and nothing writes one — the feature was
dropped at the split. Reviving it would add surface nobody asked for; if it
comes back, identity-service is the right owner, since it describes the person
the way religion and blood type do.

**The apps were rewritten against it on 2026-09-11.**
`packages/*/features/profile` had gone on parsing `data.profile`,
`data.teacher`, `data.student` and `data.userRoles` — a shape nothing serves —
so "Profil Saya" answered **"Profil tidak ditemukan"** in every app. It now
reads the flat `ProfileDto`, and pulls addresses from `/profiles/me/addresses`.

**Two features were deleted rather than repaired**, because no service serves
them: the avatar upload (`/profiles/me/photo` does not exist, so the button was
a guaranteed 404) and social media links, which the split dropped on purpose.

### The school-identity half, and who is allowed to compose it

A profile screen also shows employment status, structural position, hire date,
taught subjects and class. identity-service owns none of that: employment is
hr-service's, teaching academic-service's, enrolment student-service's.

**identity-service does not fetch them, and must not.** Every service already
calls it for `POST /auth/introspect`; a call back down would make signing in
depend on hr-service being up, and turn the root of the dependency graph into a
cycle. It stays the root.

**Each owner serves its own `/me` slice instead**, guarded by a `*.read-own`
permission — the pattern student-service and academic-service already used.
hr-service gained `GET /employees/me` and the catalogue gained
`employees.read-own` on 2026-09-11; `GET /students/me/classroom` and
`GET /teaching-assignments/me` already existed.

**The app composes.** It holds the caller's own token and knows which services
it routes to, so `profileConfig.schoolIdentityProvider` is a hook each app
fills in — `academic-web` does, asking hr and academic in parallel for staff
and student-service for a student. Every call **fails soft**: a service that is
down drops its rows from the card rather than failing the screen. An app that
routes to none of them supplies no provider and the card does not render, which
is why `portal-web` needs no special case.

### Fixed — 2. `/religions` and `/blood-types` were list-only

Both now carry full CRUD — `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` —
matching `school-unit-types` beside them. A delete is refused with a 409 while
any profile still records that value, and a rename onto another row with a 409.
The permission catalogue already declared all eight codes.

### Fixed — 3. `DELETE /academic-calendars/bulk` did not exist

It does now, and it refuses the whole request with a 404 if any id is unknown
rather than deleting part of the selection silently. It had never been written.

### Fixed — 4. assessment-service had no frontend

`assessment-web` (:5179, `assessment.localhost`) — see the frontend table.

### Fixed — 5. `S3_ENDPOINT` pointed at `localhost` inside a container

`StorageService` in portal-service and admission-service now takes two
endpoints: `S3_ENDPOINT` for its own SDK calls and `S3_PUBLIC_ENDPOINT` for
presigning, falling back to the first when they are the same host. Presigned
URLs are signed **for the endpoint host**, so an internal alias produced a URL
no browser could open. `.env` now uses `minio:9000` internally and
`localhost:9000` publicly.

### Fixed — 6. Rotten seeds, and the exclusion that hid them

`prisma/` was excluded from `tsconfig.json` in all nine services, so seed
scripts never typechecked. Including it exposed six real breaks, two of them
in scripts the runbook tells people to run:

- **`pnpm seed:iam` could not run at all** — `iam.seed.ts` imported
  `src/iam/access-control/...`, a path deleted when the `iam/` folder was
  flattened on 2026-09-03.
- `seed-profile-references.ts` called `pgSslOptions()` with no argument.
- academic-service's `teaching-plan.seed.ts` ranked duplicate teaching
  assignments by `_count.assessmentItems` — a relation that moved to
  assessment-service. The tiebreak is now the planned teacher, then id order;
  academic-service cannot see assessment items any more, and pretending
  otherwise was the bug.

Six academic-era seed scripts touching 23 models academic-service no longer
owns were deleted (`seed-academic-demo`, `seed-student-selfservice`,
`seed-clear-dummy`, `seed-academic-activity`, and the `academic-activity`,
`achievement-type` and `school-life` modules); `seed-school-life.ts` became
`seed-reference-data.ts` with the parts that are genuinely this service's.
`Announcement` and `AnnouncementClassroom` are declared by **no service at
all** — they went with the multi-tenant layer.

`prisma/**/*.ts` is in the typecheck scope of all nine services now, so the
next model that moves turns a build red instead of rotting quietly.

### Still open, by decision — internal endpoints with no caller

`GET /educations/:id/summary`, `GET /employees/roster`,
`POST /blood-types/by-ids` and `POST /addresses/by-user-ids`. Each is one half
of a symmetric pair whose other half is used, or is served ahead of the screen
that will read it; none is wrong.

### Still open, by decision — prefixes with no browser client

Three, down from twelve once `assessment-web` shipped and three more once
`academic-web` took the student register on 2026-09-11: `/sessions` and
`/school-unit-social-medias` (identity) are admin-web screens nobody has
built, and `/educations` (academic) is served for a form that reads it through
`/educations/by-ids` instead. `/parents`, `/student-parents` and
`/student-graduations` now have screens.


## The first live run, 2026-09-11

Docker arrived on the machine that day, and the platform was started against a
real Postgres for the first time. Everything before this had been verified by
`typecheck`, `lint` and 3,519 unit tests — none of which crosses a process
boundary.

Four things were wrong. Three were mine from the same day; the fourth had been
there since the split and would have broken **every service-to-service call in
the platform**.

### The double envelope — every internal endpoint was unreadable

`ResponseInterceptor` wraps a controller's return in
`{ statusCode, message, data }`. It already unwrapped two shapes first: a
paginated `{ data, total, page, limit }`, and `{ data, meta }`. A lone
`{ data }` matched neither, so it was wrapped **again**:

```
controller returns   { data: { employeeId } }
client receives      { statusCode, message, data: { data: { employeeId } } }
ServiceClient.getData unwraps one level  ->  { data: { employeeId } }
field(data, 'employeeId')                ->  undefined  ->  503
```

**22 controllers hand-rolled that envelope** — 21 internal, 1 public — which is
most of the service-to-service surface: `POST /profiles/batch` (six callers),
every `/employees/*` lookup, `/presence/periods/:y/:m/closed`,
`/daily-presences/*`, the academic and student batch reads. A live
`GET /teaching-assignments/me` returned *"The hr service returned an invalid
response"*.

Nothing caught it. Unit tests mock `ServiceClient`; no test crosses real HTTP;
and until Docker existed nothing had run two services at once.

The fix is one condition in the interceptor, byte-identical in all nine
services — unwrap `{ data }` whether or not `meta` is beside it, and omit
`meta` from the envelope when there is none. `response.interceptor.spec.ts`
gained two guards in each service: one asserting a `{ data }` payload is not
double-wrapped, one asserting `meta` is absent when the payload carries none.

The public endpoint in the same shape — `GET /schedules/classroom/:id` — was
broken too: `academic-web` reads `response.data.data`, which was the inner
envelope rather than the array, so the lesson grid silently rendered nothing.

### `migration.sql` had pnpm's banner in it

Regenerating hr-service's init migration with
`pnpm exec prisma migrate diff ... > migration.sql` captured **pnpm's stdout**,
not just Prisma's: the file began `✓ Lockfile passes supply-chain policies`.
`migrate deploy` failed with `syntax error at or near "✓"`.

Run the binary directly — `./node_modules/.bin/prisma migrate diff ...` — or
the banner ends up in the SQL. Of the nine, only hr-service was affected;
the rest had been generated before the banner appeared.

### The documented local database URL could not connect

`pgSslOptions()` turns TLS **on** unless the connection string says
`sslmode=disable`. The commented-out local pair in seven `.env` files read
`postgresql://siakad:siakad@localhost:5433/<db>?schema=public` — no
`sslmode` — so following the local runbook gave
*"The server does not support SSL connections"*. All seven now carry
`&sslmode=disable`.

### Two seeds read a different variable than the other two

`seed-admin-minimal.ts` took `DIRECT_URL ?? DATABASE_URL`; `seed-iam.ts`,
`seed-profile-references.ts` and `seed-regions.ts` took `DATABASE_URL` alone.
Where the two variables point at different hosts — a pooler and a direct
connection, which is exactly why both exist — running the seeds in order wrote
to two different databases without saying so. All four now prefer `DIRECT_URL`,
which is the right connection for a seed.

### What the live run proved

- All nine migrations apply to an empty database, and the table count matches
  the documented model count exactly in every one: 20, 21, 15, 14, 15, 9, 10,
  6, 6.
- `addresses` exists only in `identity_service`, carries `profile_id` and the
  four Kemendagri code columns, and is absent from `hr_service` and
  `student_service`.
- `pnpm seed:iam` runs — it had been unrunnable since the `iam/` folder was
  flattened on 2026-09-03.
- `GET /profiles/me`, `POST /profiles/me/addresses`, `GET /regions/provinces`
  and `GET /regions/:code/children` all answer; a `religionId` that does not
  exist is refused with a 400 rather than written.
- `GET /employees/by-user/:id` answers `{ data: { employeeId } }`, which is
  what academic-service and assessment-service read after the rename.
- academic-service → hr-service → student-service resolves end to end; with
  student-service down the same call fails closed with a 503 naming it.

**The lesson is the one the audit already stated:** a contract that crosses a
process boundary is not covered by anything in this repository's test suite.
Until a typed client is generated from the OpenAPI document, the only thing
that catches these is running it.

## Redeploying one service

Nine services, nine images, nine databases. Only the gateway declares
`depends_on` in `compose/docker-compose.production.yml`, every service has its
own healthcheck, and every image is pinned by digest, so redeploying one is
pinning its new digest and pulling it — the other eight keep running untouched:

```bash
GITHUB_TOKEN=<...> node scripts/latest-digests.mjs --write production
docker compose -f compose/docker-compose.production.yml up -d hr-service
```

That is the whole command. It was not, until 2026-09-11.

### The gateway used to keep the old IP — and could route to the wrong service

`gateway/nginx.conf` declared plain static upstreams
(`server hr-service:3800;`). nginx resolves a name like that **once at
startup** and caches the address for the life of the worker, so a container
recreated on a new IP was never followed.

Measured with a throwaway network, an `http-echo` backend and a one-line conf:

| Step | Static upstream | `zone` + `resolve` |
|---|---|---|
| backend at `172.19.0.3` | `v1` | `v1` |
| recreated at a new IP, another container now holding `.3` | **`filler`** | 502 |
| ~15s later (one `valid=` window) | **`filler`** | `v2` |

The old middle row is the reason this mattered. A stale IP pointing at
*nothing* is a 502 — loud, and somebody fixes it. A stale IP that Docker has
since handed to **a different container** is a gateway quietly proxying to the
wrong service, and nothing in any log says so.

The generator now emits what nginx documents for this:

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;

upstream hr_service {
    zone hr_service 64k;
    server hr-service:3800 resolve;
}
```

`127.0.0.11` is Docker's embedded DNS. `resolve` needs the server group in
shared memory, which is what `zone` provides, and it has been in open-source
nginx since **1.27.3** — the pinned image is `nginx:1.27-alpine`, which is
1.27.5. The upstream is still **named** in `proxy_pass`, never built from a
variable, so nothing about URI handling or the regex locations changes.

`nginx -s reload` still works and closes the ~10s window if a deploy wants it,
but it is no longer required. Migrations stay a separate explicit step
(`--profile migrate`), per service, as they already are.

### The generated config did not parse at all

Found while testing the above: `nginx -t` on the generated `nginx.conf` failed
with `"default_type" directive is not allowed here`. The SPA fallback put
`default_type application/json;` **inside an `if`**, and nginx's rewrite-phase
`if` accepts only `return`, `rewrite`, `set` and `break`. The gateway would
have refused to start on the first deploy, with all seven apps down.

`node gateway/generate.mjs --check` could never have caught it: it proves
the file is in sync with the manifests, not that nginx accepts it. CI now runs
both:

```yaml
- run: node gateway/generate.mjs --check
- run: docker run --rm -v "$PWD/gateway/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.27-alpine nginx -t
```

`default_type` moved up to the `location @spa` level, where it is legal and
changes nothing: `try_files /index.html` serves a static file, which takes its
type from the types map either way.

## A default is a decision, and a hidden default is a wrong one

`/learning/time-slot` in `academic-web` was the standing example until
2026-09-11. Three defaults each decided something on the operator's behalf and
left no trace that they had:

| Was | Now |
|---|---|
| type dropdown preselected whichever type was created first | empty, with a `Pilih tipe...` placeholder |
| every new row started 07:00–07:30 | starts where the previous row ended |
| end time typed by hand | derived from the type's `defaultDurationMinutes` |

The rule the first row breaks is the general one: **a form may not answer a
question the operator has not been asked.** A preselected dropdown produces a
saved row nobody chose, and no validation catches it because the field is
populated. Empty plus a placeholder turns the same mistake into a refusal at
save.

The other two are the opposite failure — making someone retype what the system
already knows. `TimeSlotType` gained `defaultDurationMinutes` in
academic-service (40 by default, 1–600), and it is named `default` because it
fills in a new slot and constrains no saved one. A 35-minute Friday lesson
stays 35 minutes.

Derivation that fights an override is worse than no derivation, so two rules
bound it: changing the **type** re-derives the end, because that is what
picking a type means; moving the **start** carries the end with it, preserving
whatever length the row actually has. Both are pure functions in
`domain/time-of-day.ts`, tested, wrapping past midnight, and returning the
input unchanged when the string is not `HH:MM`.

And what was decided is shown: a **Durasi** column with the row's real length,
and an amber note on any row that leaves a gap or overlaps the one before it —
a warning, not a block, because a gap between morning and afternoon sessions is
legitimate.

`academic-service` migration `20260911000000_time_slot_type_duration` is the
first one after init in that service: one additive `ADD COLUMN ... DEFAULT 40`,
applied and verified against the local database.

## A class is named once

`Classroom.code` is the identity — required, and unique within a grade and
academic year. `Classroom.name` is an optional alias. That is two fields for
two different jobs, not a duplicate, and it is the shape to keep.

What was wrong until 2026-09-11 was everything around it:

- **`withDisplayName()` ignored `code`**, building the label from
  `grade.name + name`. A class with no alias rendered as its grade — `VII` —
  so two classes of one grade were indistinguishable in every dropdown, every
  breadcrumb, and the Kelola Kelas title. It now reads `VII-A`, or
  `VII-A (Awesome)` when an alias exists.
- **The form called `code` "Kode Kelas"** and the alias "Nama Kelas", which is
  backwards from how a school talks: the class *is* called VII A. The labels
  are now **Nama Kelas** (the code) and **Alias**.
- **The DTO example was `VIII-A`**, implying a separator convention nobody
  asked for. It is `VII A` now — the field holds whatever the school writes on
  the door.

**The columns were not renamed**, and that is deliberate: `code` is what the
student import spreadsheet matches on (`classroomCode`), what
`GET /classrooms/by-code/:code` and `POST /classrooms/by-ids` publish, and what
student-service and assessment-service read. Renaming two columns to fix two
labels is a cross-service contract change bought for nothing.

## Verifying a change

Inside the service you touched:

```bash
pnpm run typecheck                      # catches every wrong ../ in a NodeNext move
pnpm run lint && pnpm run lint:strict
pnpm exec jest --testPathPatterns=<module>
pnpm run validate                       # the whole pipeline, including build
```

`pnpm prisma:generate` is required before anything else in a fresh checkout, and
is always safe.
