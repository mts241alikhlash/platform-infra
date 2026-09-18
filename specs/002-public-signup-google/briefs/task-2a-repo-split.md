# Task Brief — Phase 2a: split admission applicant repository (T004–T008)

## What this is

`admission-service/src/admission/applicant/infrastructure/persistence/prisma/prisma-admission-applicant.repository.ts`
is 290 lines. The constitution's Principle V caps a repository class at 200 lines
and requires an over-budget repository to be split into sibling files, leaving
the class a flat contract → call map. Every later task in this feature adds
methods to it, so split first.

**This is a refactor. Structure only. Zero behavior change. Zero new tests. Zero
comment additions.** Principle V: "A refactor commit changes structure only." and
"Never add a spec to a use case that never had one, and never delete one that
did, during a refactor."

## Reference implementation (the house pattern)

`portal-service/src/portal/post/infrastructure/persistence/` is the model to
copy:
- `post.reader.ts` — read queries
- `post.writer.ts` — write queries
- `post.where.ts` — query construction
- `post.includes.ts` — Prisma include objects
- `prisma-post.repository.ts` — the class, a flat contract → call map

admission-service already has `prisma-admission-application.includes.ts` doing
the includes job for the application repository. Follow the same shape.

## Exact target files

In `admission-service/src/admission/applicant/infrastructure/persistence/prisma/`:

1. **`prisma-admission-applicant.reader.ts`** — a plain `@Injectable()` class
   holding the read methods currently on the repository:
   `findAll`, `findById`, `findByUserId`, `findByRegistrationNumber`,
   `findOpenWave`, `findActiveWaves`, `findActiveDocumentTypes`,
   `findPublishedAnnouncementsForUser`, `findMyApplication`, `findMyDetail`,
   `findDetailById`, `findRequiredActiveDocumentTypes`.
   Constructor takes `PrismaService` and `IReferenceLookupPort` (the same two the
   class uses today for `resolveAcademicYearNames` / `attachParentReferences`).
   Move each method body verbatim.

2. **`prisma-admission-applicant.writer.ts`** — a plain `@Injectable()` class
   holding the write methods: `update`, `remove`, `updateMyApplication`,
   `submitApplication`, `createNotification`.
   Constructor takes `PrismaService` and `IReferenceLookupPort` (`updateMyApplication`
   and `submitApplication` call `attachParentReferences`).
   Move each method body verbatim.

3. **`prisma-admission-applicant.draft.ts`** — the shared DRAFT-creation
   sequence. Extract the body of the current `registerApplicant` transaction
   (lines 107–146) into an exported function that both `registerApplicant`
   (today) and the future `ensureApplication` (T020) call:

   ```ts
   export async function createDraftApplication(
     tx: Prisma.TransactionClient,
     input: { waveId: string; waveCode: string; registrationFee: DecimalValue;
              userId: string; fullName: string; identifier: string;
              phone?: string | null },
   ): Promise<AdmissionApplication>
   ```

   It must do exactly what lines 108–145 do today, in the same order:
   increment `lastRegistrationSeq` on the wave, build
   `registrationNumber = `${waveCode}-${String(seq).padStart(4, '0')}``,
   create the application with `status: 'DRAFT'`, create the `UNPAID` payment
   with `amount: toNumericValue(registrationFee)`, create the welcome
   notification with the exact same Indonesian title and message strings.

   Keep the strings byte-identical. They are user-visible.

4. **`prisma-admission-applicant.repository.ts`** — reduced to a class that
   injects the three new siblings (plus `IAccountProvisioningPort`, still needed
   by `registerApplicant`) and delegates every port method to them. `registerApplicant`
   keeps its two responsibilities in the class: call
   `accountProvisioning.provision`, then `prisma.$transaction(tx => createDraftApplication(tx, ...))`,
   with the existing `catch { deprovision; throw }` compensation. Keep
   `isIdentifierTaken` in the class (it calls `accountProvisioning.lookup`).
   The class must be under 200 lines.

## Hard constraints

- The port `IAdmissionApplicantRepository` in
  `admission-service/src/admission/applicant/domain/repositories/admission-applicant-repository.ts`
  MUST NOT change. Its methods, signatures and types stay exactly as they are.
  Do not add `findActiveWave` or `ensureApplication` in this task — that is T018.
- Do not change any return type. `registerApplicant` returns
  `Promise<ApplicationWithParentsAndUser>` per the port but today returns the raw
  `AdmissionApplication` from the transaction; keep the same shapes and the same
  casts the current file uses. Do not "fix" types.
- Do not touch any file outside the four named above, except the module wiring:
  if `applicant.module.ts` needs the new sibling classes as providers, add them.
  Check how `PrismaAdmissionApplicantRepository` is currently provided first.
- Zero comments. The constitution forbids comments in business code.
- NodeNext ESM: every relative import ends in `.js`.

## Acceptance

1. `pnpm test` in `admission-service` — 24 suites / 163 tests still pass, same
   counts. If the counts change, you did something wrong.
2. `pnpm lint && pnpm typecheck && pnpm lint:strict && pnpm build` all green.
3. `prisma-admission-applicant.repository.ts` is under 200 lines.
4. `git` is NOT available in this workspace. Do not attempt commits.

## Report back

- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- The line count of each of the four files
- The exact test summary line from `pnpm test`
- Any place where you had to make a judgment call
