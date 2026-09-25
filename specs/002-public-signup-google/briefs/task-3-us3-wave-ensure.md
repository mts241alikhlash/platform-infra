# Task Brief — Phase 3 US3: active wave, ensure, locked form (T016–T028)

## What this is

Three linked changes that together make "I am signed in but I have no
application" resolve itself, and make the wave visible-but-locked in the form:

1. **admission-service** resolves the active wave server-side at registration
   (no more client `waveId`), exposes `findActiveWave`, and gains an idempotent
   `POST /admissions/my-application/ensure`.
2. **admission-service** stamps the wave's academic-year name onto the
   application detail so the form can render it.
3. **admission-web** gets an `ensureMyApplication()` call and a locked
   "Gelombang Pendaftaran" display.

This is User Story 3. It is built before US1 and US2 because both sign-up paths
call what it creates.

## Binding designs

- `D:\Project\241 Apps\specs\002-public-signup-google\contracts\register-auto-wave.md`
- `D:\Project\241 Apps\specs\002-public-signup-google\contracts\ensure-application.md`
- `D:\Project\241 Apps\specs\002-public-signup-google\data-model.md` (Active wave)
- `D:\Project\241 Apps\specs\002-public-signup-google\research.md` R6, R8, R9

## Part A — admission-service

### A1. Port (`src/admission/applicant/domain/repositories/admission-applicant-repository.ts`)

Add, next to `findOpenWave`, with input types in the **same file** (Principle IV):

```ts
export interface EnsureApplicationInput {
  userId: string
  waveId: string
  waveCode: string
  registrationFee: DecimalValue
}
```

and on the abstract class:

```ts
abstract findActiveWave(): Promise<AdmissionWaveEntity | null>
abstract ensureApplication(input: EnsureApplicationInput): Promise<ApplicationWithParentsAndUser>
```

Reuse the existing `DecimalValue` import. `AdmissionWaveEntity` is already
imported.

### A2. Reader (`prisma-admission-applicant.reader.ts`)

`findActiveWave()` — the earliest-open active wave, or `null`:

```ts
const today = new Date()
return this.prisma.admissionWave.findFirst({
  where: {
    isActive: true,
    deletedAt: null,
    startDate: { lte: today },
    endDate: { gte: today },
  },
  orderBy: { startDate: 'asc' },
})
```

This mirrors `findOpenWave` (already in the reader) minus the id filter, plus the
ordering. Do not add an include.

### A3. Writer (`prisma-admission-applicant.writer.ts`)

`ensureApplication(input)`:

1. **Read first** — the existence check must run before wave resolution and
   before any create (Principle VIII, `research.md` R9):
   ```ts
   const existing = await this.prisma.admissionApplication.findFirst({
     where: { userId: input.userId, deletedAt: null },
     include: applicationDetailInclude,
   })
   if (existing) return attachParentReferences(existing, this.referenceLookup)
   ```
2. **Then create** inside one transaction using the T006 helper already in
   `prisma-admission-applicant.draft.ts`:
   ```ts
   const created = await this.prisma.$transaction((tx) =>
     createDraftApplication(tx, {
       waveId: input.waveId,
       waveCode: input.waveCode,
       registrationFee: input.registrationFee,
       userId: input.userId,
       fullName: '',
       identifier: '',
       phone: null,
     }),
   )
   ```
   `createDraftApplication` returns the raw `AdmissionApplication` (no includes),
   so re-read it by id with `applicationDetailInclude` and return
   `attachParentReferences(...)` — the method's declared return type is
   `ApplicationWithParentsAndUser` (serialized detail).

Do **not** create the active wave here; the use case resolves it (A4) so the
"no wave" decision is testable without the database.

### A4. Use cases

**`register-applicant.input.ts`**: `waveId?: string` (everything else unchanged).

**`register-applicant.use-case.ts`**: replace the single `findOpenWave` call:

```ts
const wave = input.waveId
  ? await this.admissionApplicantRepository.findOpenWave(input.waveId)
  : await this.admissionApplicantRepository.findActiveWave()
if (!wave) {
  throw new BadRequestException('registration is not open')
}
```

The admin path still sends `waveId`, so its behavior is unchanged
(`register-auto-wave.md`).

**New** `application/use-cases/ensure-my-application/ensure-my-application.input.ts`:
```ts
export interface EnsureMyApplicationInput {
  userId: string
}
```

**New** `application/use-cases/ensure-my-application/ensure-my-application.use-case.ts`:

```ts
@Injectable()
export class EnsureMyApplicationUseCase {
  constructor(private readonly admissionApplicantRepository: IAdmissionApplicantRepository) {}

  async execute(input: EnsureMyApplicationInput) {
    const existing = await this.admissionApplicantRepository.findMyDetail(input.userId)
    if (existing) {
      return { ...serializeApplicationDetail(existing), documentTypes: await this.admissionApplicantRepository.findActiveDocumentTypes() }
    }

    const wave = await this.admissionApplicantRepository.findActiveWave()
    if (!wave) {
      throw new ConflictException('registration is not open')
    }

    const created = await this.admissionApplicantRepository.ensureApplication({
      userId: input.userId,
      waveId: wave.id,
      waveCode: wave.code,
      registrationFee: wave.registrationFee,
    })

    const documentTypes = await this.admissionApplicantRepository.findActiveDocumentTypes()
    return { ...serializeApplicationDetail(created), documentTypes }
  }
}
```

Both branches return the same shape as `GET /admissions/my-application`
(application fields + `documentTypes`), so the SPA has one shape.

**Ruling (recorded, mine)**: `ensure` takes no request body and seeds the
application with an empty `fullName` and `email`. The `fullName` is resolved by
the web from the account display name (T025) and the email is filled by the
first form step, so an unresolved `fullName` here is a harmless placeholder.
`ensure` is also reached by an existing account with no application under plain
sign-in (FR-013), where no dialog data exists at all, so a body would be a false
contract. Cost if wrong: placeholder text visible until the applicant types
their name in the form.

### A5. Controller (`presentation/http/admission-applicant.controller.ts`)

Add after `getMyApplication`, injecting `EnsureMyApplicationUseCase` (import it
from `../../index.js`; add the export to `applicant/index.ts`):

```ts
@Post('my-application/ensure')
@ApiOperation({ summary: 'Ensure my application exists (idempotent)' })
@ApiResponse({ status: 200, description: 'Application already existed' })
@ApiResponse({ status: 201, description: 'Application created' })
@ApiResponse({ status: 409, description: 'Registration is not open' })
async ensureMyApplication(@CurrentUser() user: AuthenticatedUser) {
  return this.ensureMyApplicationService.execute({ userId: user.id })
}
```

Register `EnsureMyApplicationUseCase` in `applicant.module.ts` providers and
exports, like its siblings.

### A6. New public register DTO (this is where T035 lands — do it here, it is small)

Create `presentation/http/dto/request/public-register-applicant.dto.ts`:
`RegisterApplicantDto` minus `waveId` — same validators, same messages, for
`fullName`, `email`, `phone`, `password`, `passwordConfirm`.

Switch `admission-public.controller.ts` `POST admissions/register` to
`PublicRegisterApplicantDto` and drop `waveId` from the call. Leave
`admission-admin-registration.controller.ts` on the `waveId`-required
`RegisterApplicantDto` untouched.

### A7. Academic year on the detail wave (T024)

`applicationDetailInclude` pulls `wave: true`, which has `academicYearId` but not
the year's name. Add to `prisma-admission.refs.ts`:

```ts
export async function attachWaveAcademicYear<
  T extends { wave?: { academicYearId: string } | null } | null,
>(application: T, referenceLookup: IReferenceLookupPort): Promise<T> {
  if (!application?.wave) return application
  const years = await resolveAcademicYearNames(referenceLookup, [
    application.wave.academicYearId,
  ])
  return {
    ...application,
    wave: {
      ...application.wave,
      academicYear: years.get(application.wave.academicYearId) ?? null,
    },
  }
}
```

Apply it:
- **reader** `findMyDetail` and `findDetailById` — after
  `attachParentReferences`.
- **writer** `updateMyApplication` and `submitApplication` — after
  `attachParentReferences`.

**Ruling (recorded, mine)**: the brief's T024 names `findMyDetail` only, but the
form re-hydrates from the `PATCH`/`POST` responses, so the locked field must
carry the year on those payloads too or it disappears after the first save.
Applying it to all four detail returns is the smallest correct change. Cost if
wrong: none; the field is additive.

Type note: `attachParentReferences` returns `WithParentReferences<T>`; chain
`attachWaveAcademicYear` on its result and let the return types infer. If
TypeScript complains, type the helper's return as `Promise<T & { wave: ... }>`
or cast at the call sites exactly as the existing code casts — do not restructure
the refs file.

### A8. Tests (T016, T017) — write these FIRST, watch them fail

**Extend `application/use-cases/admission-applicant.use-cases.spec.ts`**
(add `findActiveWave: jest.fn()` to the mock repo):
- `RegisterApplicantUseCase`: `waveId` absent, `findActiveWave` resolves a wave →
  registers; the repository's `registerApplicant` receives that wave.
- `waveId` absent, `findActiveWave` resolves `null` → `BadRequestException`.
- `waveId` present → `findOpenWave` is called and `findActiveWave` is not.

**New `ensure-my-application/ensure-my-application.use-case.spec.ts`**:
- existing application (`findMyDetail` non-null) → returned, and
  `ensureApplication` is **not** called.
- no application, active wave present → `ensureApplication` called with the
  wave's id/code/fee and the userId; result carries `documentTypes`.
- no application, `findActiveWave` null → `ConflictException`, and
  `ensureApplication` is not called.
- ordering: with no application, `findMyDetail` is asserted to have been called
  **before** `ensureApplication` (idempotency-before-uniqueness).

Reuse the existing spec's fake-repo style (`{ provide: IAdmissionApplicantRepository, useValue: repo }`).

## Part B — admission-web

### B1. API (`src/features/admission/api/admissionApi.ts`)

Add after `getMyApplication`:
```ts
ensureMyApplication: () =>
  api.post<ApiSingleResponse<AdmissionApplication>>(
    '/admissions/my-application/ensure',
  ),
```

### B2. Service + composable

`services/publicAdmissionService.ts` — add:
```ts
ensureMyApplication: async () => {
  try {
    const res = await admissionApi.ensureMyApplication()
    return res.data.data
  } catch (err) {
    notifyIfOutage(err)
    return null
  }
},
```
`composables/usePublicAdmission.ts` — expose `ensureMyApplication`.

### B3. Types (`src/features/admission/types/index.ts`)

`AdmissionWaveSummary` already allows
`academicYear?: { id: string; name: string } | string`. Do not widen it. Nothing
else changes here in this phase — the `RegisterPayload` `waveId` removal is a
US1 task (T034) and belongs with the dialog.

### B4. Locked wave field (`views/ApplicationFormView.vue`)

Read the rest of the file first (lines 139-317). Add a read-only display above
the wizard steps, next to the existing registration number:

- label `"Gelombang Pendaftaran"`
- value: `application.wave.name`, and beneath it the academic-year name when the
  wave carries one (handle both the object and the string form of
  `academicYear`; render nothing extra when it is absent)
- visual treatment: a bordered, muted, clearly non-interactive block. **Not** an
  `<input>`, **not** disabled-input, **not** focusable — plain text, so it can
  never enter a step payload or be tabbed to.
- It must not be added to `buildStepPayload` and must not be part of any step.

**antislop constraints for this field (design direction: inherit the existing
landing/app design system; dial ENERGY 1 / RHYTHM 1 / MOTION 1):**
- reuse existing tokens (`border`, `bg-muted`, `text-muted-foreground`) — no new
  colors, no gradient, no glow, no shadow.
- no em dash (`—`) anywhere in new text. Use a comma, colon, or parentheses.
- contrast must stay at or above WCAG AA: do not use a lighter grey than the
  existing `text-muted-foreground` for the label/value.
- the block must not overflow horizontally at 320px.

### B5. Test (T027)

Add a focused assertion proving the wave is displayed and never submitted. The
cheapest honest place is a new
`composables/useApplicationFormState.spec.ts` case if a spec already exists, or
a small new spec near the view: assert that `buildStepPayload` never contains the
wave or an `academicYear`, and (if a view spec is practical) that the label
renders the wave name. Read
`src/features/admission/composables/useApplicationFormState.spec.ts` first if it
exists and follow its style. If mounting the view needs the whole auth/query
stack, the payload assertion alone is acceptable — say so in the report.

## Hard constraints

- NodeNext ESM in admission-service: relative imports end in `.js`.
- Zero comments in business code (both repos).
- No new dependency.
- Do not change `applicationDetailInclude`.
- Do not touch identity-service.
- No git in this workspace. Do not run git. Do not commit.
- `prisma-admission-applicant.repository.ts` must stay under 200 lines. It is 154
  now; add only the two delegations (`findActiveWave` → reader,
  `ensureApplication` → writer).

## Acceptance

From `D:\Project\241 Apps\admission-service`: `pnpm test` (was 163, plus new),
`pnpm lint`, `pnpm typecheck`, `pnpm lint:strict`, `pnpm build`.
From `D:\Project\241 Apps\admission-web`: `pnpm validate` (was 74 tests).

Report: status, files changed, both test summary lines, and any judgment calls.
