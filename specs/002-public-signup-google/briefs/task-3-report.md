# Task 3 Report — US3: active wave, ensure, locked form (T016–T028)

**Status:** DONE

## Files changed

### admission-service

- `src/admission/applicant/domain/repositories/admission-applicant-repository.ts`
  — added `EnsureApplicationInput` (same file, Principle IV) and the abstract
  `findActiveWave` / `ensureApplication` next to `findOpenWave`.
- `src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.reader.ts`
  — added `findActiveWave()` (earliest-open active wave or `null`, no include);
  applied `attachWaveAcademicYear` after `attachParentReferences` in
  `findMyDetail` and `findDetailById`.
- `src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.writer.ts`
  — added `ensureApplication(input)` (read-first idempotency, then one
  `createDraftApplication` transaction, re-read by id with
  `applicationDetailInclude`, then refs + academic year); applied
  `attachWaveAcademicYear` to `updateMyApplication` and `submitApplication`.
- `src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.repository.ts`
  — two delegations only (`findActiveWave` → reader, `ensureApplication` →
  writer). 154 → 165 lines, under the 200 budget.
- `src/admission/application/infrastructure/persistence/prisma/prisma-admission.refs.ts`
  — added `attachWaveAcademicYear`.
- `src/admission/applicant/application/use-cases/register-applicant/register-applicant.input.ts`
  — `waveId?: string`.
- `src/admission/applicant/application/use-cases/register-applicant/register-applicant.use-case.ts`
  — wave resolution `waveId ? findOpenWave : findActiveWave`, `400
  'registration is not open'`.
- `src/admission/applicant/application/use-cases/ensure-my-application/ensure-my-application.input.ts` (new)
- `src/admission/applicant/application/use-cases/ensure-my-application/ensure-my-application.use-case.ts` (new)
- `src/admission/applicant/application/use-cases/ensure-my-application/ensure-my-application.use-case.spec.ts` (new)
- `src/admission/applicant/application/use-cases/admission-applicant.use-cases.spec.ts`
  — `findActiveWave` on the mock repo, three new `RegisterApplicantUseCase`
  cases.
- `src/admission/applicant/presentation/http/dto/request/public-register-applicant.dto.ts` (new)
- `src/admission/applicant/presentation/http/admission-public.controller.ts`
  — uses `PublicRegisterApplicantDto`, drops `waveId`.
- `src/admission/applicant/presentation/http/admission-applicant.controller.ts`
  — `POST my-application/ensure`, typed 200/201 with `ApplicationDetailResponseDto`.
- `src/admission/applicant/applicant.module.ts` — provide/export `EnsureMyApplicationUseCase`.
- `src/admission/applicant/index.ts` — export `EnsureMyApplicationUseCase`.

### admission-web

- `src/features/admission/api/admissionApi.ts` — `ensureMyApplication`.
- `src/features/admission/services/publicAdmissionService.ts` — `ensureMyApplication` with `notifyIfOutage`.
- `src/features/admission/composables/usePublicAdmission.ts` — expose `ensureMyApplication`.
- `src/features/admission/views/ApplicationFormView.vue` — locked
  `Gelombang Pendaftaran` block (plain text, bordered `bg-muted`,
  `text-muted-foreground`, `break-words`); `academicYearName` computed handling
  object and string forms; also assigns the local `application` ref (see
  judgment calls).
- `src/features/admission/views/ApplicationFormView.spec.ts` (new)

`admission-admin-registration.controller.ts` is untouched (still on the
`waveId`-required `RegisterApplicantDto`). `applicationDetailInclude` unchanged.
identity-service untouched. No new dependencies. No git commands run.

## TDD evidence

- Red run (admission-service, new specs only):
  `Test Suites: 2 failed, 2 total` / `Tests: 2 failed, 12 passed, 14 total` —
  `findActiveWave` never called and the null-wave case resolved instead of
  rejecting; the new spec file had no use case to import.
- Red run (admission-web view): with the locked block removed, the spec failed
  with `expected '...' to contain 'Gelombang Pendaftaran'` while the form itself
  rendered (form present, field absent).
- Green after implementation (both suites pass).

## Test summaries

- admission-service: `Test Suites: 25 passed, 25 total` / `Tests: 170 passed, 170 total` (was 163)
- admission-web: `Test Files  11 passed (11)` / `Tests  76 passed (76)` (was 74)

## Verification output

From `D:\Project\241 Apps\admission-service`:

1. `pnpm test` → `Test Suites: 25 passed, 25 total`, `Tests: 170 passed, 170 total`
2. `pnpm lint` → clean (exit 0)
3. `pnpm typecheck` → clean (exit 0)
4. `pnpm lint:strict` → clean (exit 0)
5. `pnpm build` → `nest build` completed (exit 0)

From `D:\Project\241 Apps\admission-web`:

6. `pnpm validate` → `format:check` clean, `lint` clean, `typecheck` clean,
   `lint:strict` clean, `Test Files 11 passed (11)` / `Tests 76 passed (76)`,
   `vite build` `✓ built in 4.98s` (one pre-existing
   `INEFFECTIVE_DYNAMIC_IMPORT` advisory on `src/i18n/locales/en.ts`, unrelated
   to this change).

## Judgment calls

1. **Ratchet spec `api-response-types.spec.ts`.** Adding `POST my-application/ensure`
   pushed untyped handlers from 30 to 31 and failed
   `UNTYPED_CEILING = 30`. I typed the 200/201 responses with the existing
   `ApplicationDetailResponseDto` instead of raising the ceiling. Additive and
   honest: the endpoint returns the same serialized detail shape.
2. **`ApplicationFormView.vue` local `application` ref was never assigned.**
   `fetchMyApplication()` was called and only `hydrate(data)` ran, so
   `application.value` stayed `null` and the form branch (the only place the
   locked field can live) never rendered. B4 is not satisfiable without fixing
   this, so I assign the ref in `onMounted`, `refresh()` and after `saveStep()`.
   This is a small correctness fix, not a feature expansion.
3. **View spec instead of a payload-only assertion.** The brief suggested a
   payload assertion in `useApplicationFormState.spec.ts`, but `buildStepPayload`
   has no wave path, so that assertion would pass immediately and prove nothing.
   I wrote a real `ApplicationFormView.spec.ts` (happy-dom, mocked composables,
   stubs) asserting the label, wave name and academic year render and that the
   wave is never an `<input>` and no `[tabindex]` element exists. I verified it
   goes red when the block is removed.
4. **A7 applied to all four detail returns** (`findMyDetail`, `findDetailById`,
   `updateMyApplication`, `submitApplication`) as the brief's recorded ruling
   directs, so the locked field survives a PATCH/POST re-hydrate.
5. **`attachWaveAcademicYear` return typing.** Implemented exactly as the brief
   specified; `typecheck` and `lint:strict` are clean, so no cast was needed.
6. **antislop gate for the locked field.** No new tokens (border, bg-muted,
   text-muted-foreground only); no em dash in new text; label/value stay at
   `text-muted-foreground` (AA); `break-words` prevents horizontal overflow at
   320px; plain text, not focusable, not in any step payload.
