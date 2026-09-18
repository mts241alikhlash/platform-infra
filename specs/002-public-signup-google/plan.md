# Implementation Plan: Public Sign-Up Dialog with Google Sign-Up

**Branch**: `002-public-signup-google` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-public-signup-google/spec.md`

## Summary

Move admission-web's public sign-up from the standalone `/register` page into a
dialog on the landing page, shorten it to name / email / password / confirmation,
and add "Daftar dengan Google". The admission wave stops being a user choice:
it is resolved server-side from the active wave, hidden in the dialog, and shown
locked in the application form.

Three repositories change: `admission-web` (dialog, entry points, callback,
locked wave field), `admission-service` (auto-wave resolution, an idempotent
"ensure my application" endpoint), and `identity-service` (a sign-up intent
carried through OAuth, an opt-in deployment flag, and APPLICANT role on a new
OAuth account). No schema change and no migration.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js `>=24.20 <25`, ES2023, NodeNext ESM

**Primary Dependencies**:
- admission-web: Vue 3.5, Vue Router 5, Pinia 3, vee-validate + zod, reka-ui via
  shadcn-vue `@/ui/dialog`, axios, vue-sonner
- admission-service: NestJS 12, Prisma 7 over PostgreSQL, class-validator
- identity-service: NestJS 12, Prisma 7, `passport-google-oauth20`, `@nestjs/config` + zod env

**Storage**: PostgreSQL — admission-service (`admission_waves`,
`admission_applications`, `admission_payments`, `admission_notifications`),
identity-service (`users`, `roles`, `user_roles`, `oauth_accounts`,
`auth_sessions`). No model change; no migration.

**Testing**:
- admission-web: Vitest 4 (`pnpm test`), `@vue/test-utils`, happy-dom
- admission-service / identity-service: Jest (`pnpm test`), `*.spec.ts` next to source

**Target Platform**: Web SPA (admission-web) + two Linux/Node HTTP services

**Project Type**: Web application — one SPA, two backend services

**Performance Goals**: N/A beyond interactive latency; sign-up completes in under
one minute (SC-001)

**Constraints**: no new database tables; Google sign-up opt-in, default off;
existing Google sign-in behavior unchanged (FR-019); mobile tap targets ≥44px
(FR-017)

**Scale/Scope**: one public dialog, two new HTTP endpoints, one OAuth round-trip
extension across three repositories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The workspace constitution (`identity-service/docs/CONSTITUTION.md`, mirrored at
`.specify/memory/constitution.md`) applies.

| Principle | Assessment |
| --- | --- |
| I. Layered Dependency Flow | PASS — new admission use cases go in `application/use-cases/`, controllers stay HTTP-only, the port is `IAdmissionApplicantRepository`. identity-service's `auth` module is not yet layered (0 of 6, per the Compliance Baseline); the change extends existing `application/use-cases/` + `domain/repositories/` files rather than deepening the coupling. |
| II. Service Boundaries | PASS — admission-service reaches identity only through `IAccountProvisioningPort`; identity never reaches admission. No cross-repo imports. |
| III. Scoped and Authorized Data Access | PASS — the ensure endpoint is authenticated and scoped to `userId` from the token; every new query filters `deletedAt: null`; wave lookup uses `gte`/`lte` on dates as the existing code does. |
| IV. Explicit Contracts | PASS — new `*Input` in the use-case folder, new repository input next to the port, new response DTOs in `presentation/http/dto/response/`, global envelope preserved. No `any`/`unknown` return types. |
| V. Green Quality Gates | PASS WITH ACTION — new use cases ship with `*.spec.ts`; `prisma-admission-applicant.repository.ts` is **already 290 lines**, over the 200-line repository budget, and this feature adds methods. A split into sibling reader/writer files is a prerequisite commit. |
| VI. Data Ownership | PASS — only admission-service writes application tables; only identity-service writes users/roles. No shared transaction. |
| VII. Schema Ownership | PASS — no schema or migration change. |
| VIII. Cross-Service Failure | PASS — the new ensure endpoint is idempotent on `userId` and checks idempotency before uniqueness; Google sign-up fails closed; identity unreachable surfaces as an outage, not an auth error. |

No violations require the Complexity Tracking table.

## Design Direction (antislop R-37)

Decision, recorded 2026-09-14: **the sign-up dialog inherits the existing
landing-page and design-system language.** No new `DESIGN.md` is authored; the
direction is the one already shipped in `admission-web`.

- Design Read: *sign-up dialog for parents registering a child, inside
  admission-web's existing design-system language, dial ENERGY 1 / RHYTHM 1 /
  MOTION 1.*
- Identity source: the existing `@/ui` shadcn-vue primitives, the app's color
  tokens, and the landing page's typography. The dialog uses the same
  `Dialog`/`Input`/`Button`/`Form` components as `LoginForm.vue`, so it reads as
  the same product, not a template.
- The one accent is the existing primary color on the submit action. No
  gradients, glows, glassmorphism, or decorative motion are introduced.
- Reason written one line: matching the already-shipped surface is what keeps
  the dialog from reading as a bolt-on and is the smallest correct answer for a
  control that must feel native to the page that opens it.

This satisfies R-37: direction is explicit and cited, not silently defaulted.

### Post-Design Re-evaluation

Re-checked after Phase 1 against the generated contracts:

- The ensure endpoint keeps the idempotency-before-uniqueness order
  (Principle VIII) and creates nothing without an active wave.
- The OAuth intent travels only in `state`, and `state` stays subject to the
  origin allowlist — no new redirect path opens (Principle IV boundary intact).
- No new model, no migration (Principle VII untouched).
- The applicant repository split is called out as a prerequisite commit, so the
  new methods land under budget (Principle V).
- `oauth-login.use-case.ts` and the new ensure use case each ship a `*.spec.ts`
  (Principle V); the callback's new outcome branches go in the existing web spec
  surface.

Still no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-public-signup-google/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── oauth-signup.md
│   ├── ensure-application.md
│   ├── register-auto-wave.md
│   └── signup-dialog-ui.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
admission-web/
├── packages/platform/src/features/auth/
│   ├── api/authApi.ts                       # googleStartUrl gains an intent argument
│   ├── components/LoginForm.vue             # sign-in button unchanged
│   └── views/OAuthCallbackView.vue          # handles signup outcome, ensures application
└── src/features/admission/
    ├── api/admissionApi.ts                  # register (no waveId), ensureMyApplication
    ├── components/landing/
    │   ├── LandingNavbar.vue                # open dialog, not /register
    │   ├── LandingHero.vue                   # open dialog
    │   ├── LandingWaveSection.vue            # open dialog, drop ?wave= deep link
    │   └── LandingCta.vue                    # open dialog
    ├── components/SignUpDialog.vue           # NEW — the single sign-up surface
    ├── composables/useSignUpDialog.ts        # NEW — open/close state shared by landing
    ├── composables/usePublicAdmission.ts     # register payload without waveId; ensure
    ├── routes.ts                             # /register becomes a redirect into the dialog
    ├── services/publicAdmissionService.ts    # register; ensureMyApplication
    ├── types/index.ts                        # RegisterPayload drops waveId; wave year types
    └── views/
        ├── LandingView.vue                   # hosts SignUpDialog; opens on ?signup=1
        ├── ApplicationFormView.vue           # locked wave + academic year field
        └── ApplicantDashboardView.vue        # empty-state link no longer /register

admission-service/src/admission/
├── applicant/
│   ├── application/use-cases/
│   │   ├── admission-applicant.use-cases.spec.ts                    # extend existing (auto-wave)
│   │   ├── register-applicant/register-applicant.use-case.ts        # waveId optional -> resolve active
│   │   └── ensure-my-application/                                   # NEW use case + input + spec
│   ├── domain/repositories/admission-applicant-repository.ts        # findActiveWave, ensureApplication
│   ├── infrastructure/persistence/prisma/
│   │   ├── prisma-admission-applicant.repository.ts                 # thin contract -> call map
│   │   ├── prisma-admission-applicant.reader.ts                     # NEW (split, budget)
│   │   ├── prisma-admission-applicant.writer.ts                     # NEW (split, budget)
│   │   └── prisma-admission-applicant.draft.ts                      # NEW shared DRAFT creation
│   └── presentation/http/
│       ├── admission-public.controller.ts                           # register DTO without waveId
│       ├── admission-applicant.controller.ts                        # POST my-application/ensure
│       └── dto/request/public-register-applicant.dto.ts             # NEW (no waveId)

identity-service/src/
├── auth/
│   ├── application/use-cases/oauth-login/oauth-login.use-case.ts    # intent + flag + role
│   ├── application/use-cases/oauth-login/oauth-login.use-case.spec.ts # NEW
│   ├── domain/repositories/auth.repository.ts                       # roleCode on create input
│   ├── guards/google-auth.guard.ts                                  # intent into state
│   ├── oauth/oauth-redirect.ts                                      # encode/decode state + outcome
│   ├── oauth/oauth-redirect.spec.ts                                 # updated
│   ├── infrastructure/persistence/prisma/prisma-auth.repository.ts  # role on create
│   └── presentation/http/auth.controller.ts                         # decode intent, gate outcome
└── core/config/env.validation.ts                                    # GOOGLE_SIGNUP_ENABLED
```

**Structure Decision**: This is a three-repository web feature. The SPA keeps its
existing `features/admission` + `packages/platform` split. Both services keep
their established layered layout; the only structural change is splitting the
over-budget applicant repository into reader/writer/draft siblings (Principle V).

## Complexity Tracking

No constitutional violations require justification. The repository split is a
required correction of an existing budget breach, not an added violation.
