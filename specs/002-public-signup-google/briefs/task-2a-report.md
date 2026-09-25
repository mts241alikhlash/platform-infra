# Task 2a Report — split admission applicant repository (T004–T008)

## Status

DONE

## Files and line counts

| File | Lines |
| --- | --- |
| `prisma-admission-applicant.repository.ts` | 154 |
| `prisma-admission-applicant.reader.ts` | 155 |
| `prisma-admission-applicant.writer.ts` | 83 |
| `prisma-admission-applicant.draft.ts` | 57 |

The repository class is 154 lines, under the 200-line cap.

## Verification (run from `D:\Project\241 Apps\admission-service`)

### `pnpm test`

```
Test Suites: 24 passed, 24 total
Tests:       163 passed, 163 total
```

Counts unchanged from the pre-task baseline (24 suites / 163 tests).

### `pnpm lint`

```
$ eslint "src/**/*.ts" --max-warnings=0
```

Exit 0, no output.

### `pnpm typecheck`

```
$ tsc --noEmit
```

Exit 0, no output.

### `pnpm lint:strict`

```
$ eslint -c eslint.typecheck.config.mjs "src/**/*.ts" --max-warnings=0
```

Exit 0, no output.

### `pnpm build`

```
$ nest build
```

Exit 0.

### `pnpm format:check` (not required, run for safety)

```
Checking formatting...
All matched files use Prettier code style!
```

Exit 0.

## What changed

- Added `prisma-admission-applicant.reader.ts`: `@Injectable()` class with
  `findAll`, `findById`, `findByUserId`, `findByRegistrationNumber`,
  `findOpenWave`, `findActiveWaves`, `findActiveDocumentTypes`,
  `findPublishedAnnouncementsForUser`, `findMyApplication`, `findMyDetail`,
  `findDetailById`, `findRequiredActiveDocumentTypes`. Bodies moved verbatim.
- Added `prisma-admission-applicant.writer.ts`: `@Injectable()` class with
  `update`, `remove`, `updateMyApplication`, `submitApplication`,
  `createNotification`. Bodies moved verbatim.
- Added `prisma-admission-applicant.draft.ts`: exported
  `createDraftApplication(tx, input)` holding the old `registerApplicant`
  transaction body (wave sequence increment, registration number, DRAFT
  application, UNPAID payment, welcome notification). Indonesian strings
  byte-identical.
- Reduced `prisma-admission-applicant.repository.ts` to a flat contract → call
  map. `registerApplicant` keeps `provision` + `$transaction` +
  `catch { deprovision; throw }`; `isIdentifierTaken` stays in the class.
- `applicant.module.ts`: added `PrismaAdmissionApplicantReader` and
  `PrismaAdmissionApplicantWriter` to `providers` (not exported). The binding
  `{ provide: IAdmissionApplicantRepository, useClass: PrismaAdmissionApplicantRepository }`
  is untouched.

The port interface was not modified. No tests added or deleted. No comments
added. Every new relative import ends in `.js`.

## Judgment calls

1. **Draft function is a free function, not an injected provider, so the
   repository injects two sibling classes (reader, writer), not three.** The
   brief says the repository "injects the three new siblings", but the third
   sibling (`createDraftApplication`) is specified as an exported function, not
   an `@Injectable()` class, so it is imported and called directly. `PrismaService`
   and `IAccountProvisioningPort` remain injected as before.
2. **`registerApplicant` transaction body forwarded via a single-arrow
   callback** (`$transaction((tx) => createDraftApplication(tx, {...}))`) instead
   of an `async (tx) => { ... }` block. Semantically identical — the returned
   promise resolves to the created `AdmissionApplication`, the compensation
   `catch` still wraps it, and the method still returns the raw
   `AdmissionApplication` as before. No return type was "fixed".
3. **`create()` delegates to `writer.submitApplication`** (matching the original,
   which called `this.submitApplication`). `findAll` delegates to the reader's
   `findActiveWaves`, and `findByUserId` to the reader's `findMyApplication`,
   preserving the original intra-class delegation graph across the new split.
4. **Import grouping.** `@prisma/client` value imports combined where prettier
   collapsed them; relative import paths preserved exactly. Prettier was run on
   the four files and the module (no behavioral edits).
