# Phase 1 Data Model: Admin-Assisted Registration, Google Sign-In, Auth Form Polish

**Feature**: `001-admin-assisted-registration-oauth`

No database schema changes. This document describes the entities involved, the
new repository port shapes, and the state rules the on-behalf flow obeys. It is
descriptive of the existing model, not prescriptive of a migration.

## Existing entities (unchanged)

### Applicant account

The identity a parent signs in with. Backend: a `users` row in identity-service,
provisioned by admission-service through `IAccountProvisioningPort`. Created with
role `APPLICANT` (`prisma-admission-applicant.repository.ts:97-104`).

| Field | Rule |
| --- | --- |
| `identifier` | Lower-cased email; unique. `register-applicant.use-case.ts:33` |
| `passwordHash` | `hashPassword(plain)`; the plain value is never stored |
| OAuth link | provider + provider user id + email, attached to an existing account. Never standalone. `oauth-login.use-case.ts:90-100` |

**Lifecycle**: created exactly once per email. A failed admission write
deprovisions the just-created user (`prisma-admission-applicant.repository.ts:147-150`).

### Admission application

The record being filled. Belongs to a wave, has a status that decides editability,
and owns documents, payment and notifications.

| Group | Fields |
| --- | --- |
| Identity | `id`, `userId`, `waveId`, `registrationNumber` (`<wave.code>-<seq:04>`) |
| Personal | `fullName`, `nickname`, `gender`, `birthPlace`, `birthDate`, `nik`, `nisn`, `phone`, `email`, `childOrder`, `siblingCount` |
| Address | `street`, `rt`, `rw`, `village`, `district`, `city`, `province`, `postalCode` |
| Previous school | `previousSchoolName`, `previousSchoolNpsn`, `previousSchoolAddress`, `graduationYear` |
| Outcome | `submittedAt`, `revisionNote`, `verifiedAt`, `decidedAt`, `decisionNote`, `enrolledAt` |

**State machine** (`application/domain/policies/admission-status.transitions.ts`):

```
DRAFT ──submit──> SUBMITTED ──verify──> VERIFIED ──accept──> ACCEPTED ──enroll──> ENROLLED
                      │                     │
                      └──request-revision──> REVISION_NEEDED (editable again)
                      └──reject─────────────────> REJECTED
                                            VERIFIED ──reject──> REJECTED
```

**Editable statuses** (`isEditable`): `DRAFT`, `REVISION_NEEDED` only.

### Wave

The intake period. Decides whether registration is open (`isActive`, today within
`startDate..endDate`, `deletedAt: null` — `prisma-admission-applicant.repository.ts:78-89`)
and holds `registrationFee`.

### Admission document and payment

One `AdmissionPayment` per application, created `UNPAID` at registration with the
wave fee. Documents attach a file to a document type; both carry a
`PENDING`/`APPROVED`/`REJECTED` review status and an admin note.

### OAuth return target

The application the browser returns to after the provider callback. Modelled as
a bare string carrying an **origin**, validated against the configured allowlist;
never a full path, so the only path appended is the fixed `/oauth/callback`.

## New port shapes

All are declared next to the port that owns them. None carries a Prisma type.

### `IAdmissionApplicantRepository`

```ts
abstract findDetailById(
  applicationId: string,
): Promise<ApplicationWithParentsAndUser | null>
```

Returns the same `applicationDetailInclude` projection `findMyDetail` returns
(`prisma-admission-applicant.repository.ts:223-229`), keyed by application id and
filtered `deletedAt: null`. Used by the on-behalf submit.

### `IAdmissionDocumentRepository`

```ts
abstract findByApplicationId(
  applicationId: string,
): Promise<AdmissionDocumentApplicationRef | null>
```

Returns `{ id, status }` (the existing `AdmissionDocumentApplicationRef`,
`admission-document-repository.ts:8-11`), filtered `deletedAt: null`. Used by
`UploadAdmissionDocumentUseCase.executeForApplication`.

### `IAdmissionPaymentRepository`

```ts
abstract findByApplicationId(
  applicationId: string,
): Promise<AdmissionPaymentApplicationRef | null>
```

Returns `{ status, payment }` (the existing `AdmissionPaymentApplicationRef`,
`admission-payment-repository.ts:8-11`). Used by
`UploadPaymentProofUseCase.executeForApplication`.

## New use-case entry points

Each shares one private body with the existing public method. The existing
signature and behavior are unchanged, so the existing specs stay green.

| Use case | Existing entry | New entry | Body |
| --- | --- | --- | --- |
| `UpdateMyApplicationUseCase` | `execute(userId, input)` | `executeForApplication(applicationId, input)` | resolve app → assert editable → update |
| `SubmitApplicationUseCase` | `execute(userId)` | `executeForApplication(applicationId)` | resolve app → assert transition → check wave/fields/docs/payment → submit + notify |
| `UploadAdmissionDocumentUseCase` | `execute({ userId, … })` | `executeForApplication({ applicationId, … })` | resolve app → assert editable → save file + document |
| `UploadPaymentProofUseCase` | `execute({ userId, … })` | `executeForApplication({ applicationId, … })` | resolve app+payment → assert editable → save proof |

**Rule**: the "resolve" step is the only difference. The shared body never reads
`userId`, so no rule is duplicated. Where a value must be attributed, the
uploaded file's `uploadedBy` is the **acting admin**, not the applicant id — this
preserves who actually acted (the rejected alternative to impersonation).

## Validation rules (on-behalf)

The existing DTOs apply unchanged, because the payloads are identical:
`RegisterApplicantDto`, `UpdateMyApplicationDto` (+ nested parent DTO),
`UploadPaymentProofDto`. `@IsUUID()` on `waveId` and path params, `@IsEmail`,
`@MinLength(8)` on password, `@Length(16,16)` on NIK, `@MaxLength` on strings.

Client-supplied `applicationId` is validated by `ParseUUIDPipe` at the boundary.
Authorisation is `@RequirePermissions('admissions.create')` on the controller,
never a role comparison.
