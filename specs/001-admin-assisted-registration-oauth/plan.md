# Implementation Plan: Admin-Assisted Registration, Google Sign-In, and Auth Form Polish

**Branch**: `001-admin-assisted-registration-oauth` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-admin-assisted-registration-oauth/spec.md`

> **Version 2, 2026-09-14.** Revised after direct repository verification. v1
> proposed an OAuth return-target allowlist in `identity-service`; that decision
> is retained but its mechanism is now pinned to passport `state` (verified
> available on `AuthGuard.getAuthenticateOptions`). v1 listed an
> `ApplicationWithParentsAndUser` id-keyed read that does not exist; v2 names the
> repository methods that must be added. See [research.md](./research.md).

## Summary

Three independent changes across three repositories.

1. **Admin-assisted registration.** `admission-web` gains a "Daftarkan Pendaftar"
   flow on `/admin/applicants`: the administrator creates an applicant account,
   then fills the seven-step admission form on that applicant's behalf.
   `admission-service` gains a sibling admin controller exposing on-behalf write
   endpoints, because every existing form-write endpoint is keyed to the
   authenticated caller's own `user.id`. Each affected write use case gains a
   second, explicit entry point resolved by application id; the body is shared,
   never duplicated.

2. **Google sign-in.** `identity-service` already publishes the full flow and the
   refresh-cookie handoff. Two gaps remain: the callback knows one fixed target
   only, and `admission-web` has no callback route or Google control. The
   return-target mechanism is a passport `state` value validated against a new
   comma-separated origin allowlist.

3. **Empty states and form polish.** `admission-web`'s applicant screens gain the
   missing branch for "this account has no application", and the registration
   screen is migrated onto the shared floating-label field and schema
   validation.

## Technical Context

**Language/Version**: TypeScript 5.9. Backend Node.js on NestJS 12 (ES2023, NodeNext ESM, every relative import ends `.js`). Frontend Vue 3.5 + Vite 8.

**Primary Dependencies**: NestJS + Prisma/PostgreSQL (services); Vue 3.5, reka-ui, vee-validate ^4.15.1, zod ^3.25, Pinia, Tailwind v4 (web). `passport-google-oauth20` already installed in identity-service; `@nestjs/passport`'s `AuthGuard.getAuthenticateOptions` is present in the installed version.

**Storage**: PostgreSQL. No schema change is required by this feature.

**Testing**: Jest in `admission-service` and `identity-service` (`*.spec.ts` beside the unit; `admission-service` maps `@prisma/client` and `file-type` stubs through `jest.moduleNameMapper`). Vitest in `admission-web` (`happy-dom`). The constitution requires a spec for every new use case.

**Target Platform**: Web (desktop-first, responsive), Linux containers behind Nginx.

**Project Type**: Multi-repository platform. This feature touches `admission-service` (backend), `identity-service` (backend), and `admission-web` (frontend). Seven sibling web apps mirror `packages/ui` and `packages/platform`.

**Performance Goals**: No new target. The on-behalf endpoints do the same work as the applicant endpoints.

**Constraints**: Backend uses `class-validator` DTOs, never zod, for request bodies. Global response envelope `{ statusCode, message, data, meta? }`. No `any`; no `unknown` in a declared return type. Use-case files <= 300 lines, controllers <= 150, repositories <= 200. Zero comments in business code. Frontend runs verify/format/lint/test only at the end, on request.

**Scale/Scope**: One intake cycle per wave; a school's worth of applicants (hundreds to low thousands). Admin-assisted registration covers a minority of registrations, not self-service.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution governs the six backend services. `admission-web` follows the workspace's own conventions (`docs/OVERVIEW.md`).

| Principle | Check | Verdict |
| --- | --- | --- |
| I. Layered Dependency Flow | New controller delegates only. New use-case entry points resolve through the existing `IAdmission*Repository` ports; no use case gains `PrismaService`. One entry point per file, body shared privately. | PASS |
| II. Service Boundaries | No service imports another's source. identity-service changes stay in identity-service. | PASS |
| III. Scoped and Authorized Data Access | Every new endpoint carries `@RequirePermissions('admissions.create')`. No role-name comparison. New id-keyed reads filter `deletedAt: null`. | PASS |
| IV. Explicit Contracts | New DTOs in `presentation/http/dto/request/`, new `XxxInput` next to each use case; use cases never import a DTO. Repository port inputs declared next to the port. Response inside the global envelope. | PASS |
| V. Green Quality Gates | New use cases ship with `*.spec.ts`. A sibling controller keeps the admin file budget. No over-budget file is created. | PASS, see note |
| VI. Data Ownership | No new cross-module reads; all reads go through the same module repository that already owns them. | PASS |
| VII. Schema Ownership | No schema change, no migration. | PASS |
| VIII. Cross-Service Failure | Google sign-in fails closed in identity-service; the front end reports an outage as an outage, not as bad credentials. On-behalf account provisioning reuses the existing idempotent-on-identifier lookup. | PASS |

**Note on Principle V and controller size (measured).**
`admission-admin.controller.ts` is **186 lines**, already over the 150 budget
before this feature. Adding five endpoints is not acceptable. Decision: a
**sibling controller** `admission-admin-registration.controller.ts` (same
`admissions` base path, same global guards, `admissions.create` permission),
registered in `ApplicationModule`. The pre-existing file is left byte-identical.

**Note on Principle V and repository size (measured).**
`prisma-admission-applicant.repository.ts` is **280 lines**, already over the 200
budget. One method (`findDetailById`) is proposed, not the split; the split is
pre-existing debt recorded in the constitution's Compliance Baseline and is out
of scope here. Tracked in Complexity Tracking.

**Note on the permission catalogue.** `admissions.create` does not exist
(catalogue holds `decide`, `enroll`, `read`, `verify` only). The catalogue file
is exempt from the file budget; the new entry follows the existing
`{ module, action, code, description }` shape and is granted to `ADMIN` by the
existing seed loop, since its code carries no bypass-exempt prefix.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-assisted-registration-oauth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-registration.md
└── tasks.md
```

### Source Code

**`D:\Project\241 Apps\admission-service`** (on-behalf writes)

```text
src/admission/
├── applicant/
│   ├── application/use-cases/
│   │   ├── register-applicant/                 # existing, reused unchanged
│   │   ├── update-my-application/              # + executeForApplication
│   │   └── submit-application/                 # + executeForApplication
│   ├── domain/repositories/
│   │   └── admission-applicant-repository.ts   # + findDetailById
│   └── infrastructure/persistence/prisma/
│       └── prisma-admission-applicant.repository.ts   # impl of findDetailById
├── document/
│   ├── application/use-cases/upload-admission-document/   # + executeForApplication
│   ├── domain/repositories/admission-document-repository.ts   # + findByApplicationId
│   └── infrastructure/persistence/prisma/prisma-admission-document.repository.ts
├── payment/
│   ├── application/use-cases/upload-payment-proof/        # + executeForApplication
│   ├── domain/repositories/admission-payment-repository.ts    # + findByApplicationId
│   └── infrastructure/persistence/prisma/prisma-admission-payment.repository.ts
└── application/
    ├── application.module.ts                   # registers the new controller
    ├── presentation/http/
    │   ├── admission-admin.controller.ts       # untouched
    │   └── admission-admin-registration.controller.ts   # NEW
    └── application/use-cases/get-application-by-id/     # existing read, reused
```

**`D:\Project\241 Apps\identity-service`** (OAuth return-target allowlist)

```text
src/core/config/env.validation.ts                 # + GOOGLE_OAUTH_REDIRECT_ALLOWLIST
src/auth/presentation/http/auth.controller.ts     # state-carrying start, validated callback
src/auth/presentation/http/auth.controller.spec.ts
.env / .env.example                               # + allowlist; fix success URL to 5175
```

**`D:\Project\241 Apps\admission-web`** (UI)

```text
src/features/admission/
├── api/admissionApi.ts                    # + admin on-behalf calls
├── components/
│   ├── RegisterApplicantDialog.vue        # NEW account step
│   └── AdminApplicationFormDialog.vue     # NEW seven-step wizard host
├── composables/useAdminRegistration.ts    # NEW
├── views/
│   ├── ApplicantDashboardView.vue         # + empty state
│   ├── ApplicationFormView.vue            # + empty state
│   ├── ApplicationListView.vue            # + "Daftarkan Pendaftar" action
│   └── RegisterView.vue                   # migrated to FloatingField + zod
packages/platform/src/features/auth/
├── api/authApi.ts                         # + googleStartUrl helper
├── components/LoginForm.vue               # + Google control
├── routes.ts                              # + /oauth/callback
├── views/OAuthCallbackView.vue            # NEW
```

**Mirroring.** `LoginForm.vue`, `packages/ui/**` and `packages/platform/**`
exist byte-identical in all seven sibling web apps. Auth changes are written
app-agnostic and mirrored to `academic-web`, `admin-web`, `portal-web`,
`assessment-web`, `hr-web`, `inventory-web`. Tasks mark this explicitly.

**Structure Decision**: The new controller is a sibling so the pre-existing
186-line file is neither grown nor refactored. Frontend dialogs live under
`src/features/admission/components/` because they are admission screens. The
OAuth callback lives in `packages/platform/src/features/auth/` because every
sibling app needs it. `RegisterApplicantDialog` and the wizard are separate
components because the dialog closes on success and a wizard opens; one
component with two lives would carry two states.

## Phase 0: Research

See [research.md](./research.md). Resolved: the on-behalf entry-point shape, the
id-keyed port methods to add, the passport `state` return-target mechanism, the
unchanged cookie session handoff, and the roleless-Google-user outcome.

## Phase 1: Design

See [data-model.md](./data-model.md), [contracts/admin-registration.md](./contracts/admin-registration.md)
and [quickstart.md](./quickstart.md).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| A sibling controller rather than extending `admission-admin.controller.ts` | The existing file is 186 lines; the budget is 150 | Extending it would deepen an existing breach and mix verification with registration |
| `admissions.create` added to the permission catalogue and granted to `ADMIN` by the seed loop | On-behalf writes need a grant nobody holds today | Reusing `admissions.verify` would let a verifier create accounts; a role-name check is forbidden by Principle III |
| `prisma-admission-applicant.repository.ts` grows by one method while already over budget (280 / 200) | The read is the same include the applicant path uses, keyed by id | Splitting the repository is pre-existing debt; bundling it here turns a behaviour change into an unreviewable refactor (Development Workflow) |
| identity-service gains a return-target allowlist | One fixed redirect cannot serve seven apps | Letting the caller pass an arbitrary target is an open redirect; a second hard-coded URL does not scale |
