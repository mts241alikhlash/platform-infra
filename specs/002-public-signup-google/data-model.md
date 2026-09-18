# Data Model: Public Sign-Up Dialog with Google Sign-Up

**Feature**: `002-public-signup-google` | **Date**: 2026-09-14

**No database schema change and no migration.** Every field this feature needs
already exists; the work is which fields are inputs, which are resolved, and how
two existing rows are linked at sign-up.

---

## Existing entities, restated for this feature

### AdmissionWave — `admission-service/prisma/admission.prisma:52`

The registration period. Unchanged. Read-only at sign-up; the applicant never
chooses it.

| Field | Type | Role here |
| --- | --- | --- |
| `id` | uuid | internal |
| `name` | varchar(100) | shown on the locked form field |
| `code` | varchar(30), unique | registration-number prefix |
| `academicYearId` | uuid | resolved to a name over HTTP for the form |
| `startDate` / `endDate` | date | the active window, inclusive |
| `isActive` | boolean | must be true |
| `registrationFee` | decimal(12,2) | copied onto the created payment |
| `lastRegistrationSeq` | int | incremented to build the registration number |
| `deletedAt` | timestamp | must be null |

**Active** (unchanged definition): `isActive = true AND deletedAt IS NULL AND
startDate <= today <= endDate`. When more than one matches, the earliest
`startDate` wins (spec Assumption).

### AdmissionApplication — `admission-service/prisma/admission.prisma:76`

Unchanged. One row per applicant; `userId` is unique and is the natural key both
new endpoints are idempotent on.

| Field | Note for this feature |
| --- | --- |
| `userId` | unique; owned by identity-service but stored here |
| `waveId` | set at sign-up from the resolved active wave; never edited afterwards |
| `registrationNumber` | `<wave.code>-<seq padded to 4>` |
| `status` | created as `DRAFT` |
| `fullName`, `email`, `phone` | seeded from the dialog; the rest of the form fills later |

### User / Role / UserRole / OAuthAccount — `identity-service/prisma/*.prisma`

Unchanged. A Google sign-up produces a `User` plus an `OAuthAccount` plus a
`UserRole` row pointing at the `APPLICANT` role, all in one create.

| Model | Note for this feature |
| --- | --- |
| `User` | `identifier` = the Google email, lowercased; no `passwordHash` on the OAuth path |
| `OAuthAccount` | `@@unique([provider, providerUserId])` — the primary lookup |
| `Role` | `APPLICANT` is a structural role, auto-seeded at boot |
| `UserRole` | the new row a sign-up create adds; required for the account to be usable |

---

## Derived and transient concepts

### Active wave (resolved, not stored)

Not an entity. The single `AdmissionWave` a sign-up attaches to, resolved on the
server by `findActiveWave()`. If none matches, sign-up creates no account and no
application.

### Sign-up intent (transient)

Not persisted. Travels Google → identity-service → back through the OAuth
`state` parameter.

| Value | Meaning |
| --- | --- |
| `signin` | the existing behavior (feature `001`); default when absent |
| `signup` | the visitor asked to register; a new account may be created |

### OAuth outcome (transient)

Not persisted. Travels identity-service → browser as the `oauthOutcome` query
parameter on the callback redirect.

| Value | Meaning | Callback behavior |
| --- | --- | --- |
| (absent) | ordinary sign-in | existing behavior |
| `signup-created` | account + APPLICANT role created | ensure application, open form |
| `signup-existing` | Google email already had an account | ensure application, open form |
| `signup-disabled` | unknown email, sign-up flag off | no session change; land on `/?signup=1` |

---

## Validation rules this feature adds

| Rule | Where enforced | Failure |
| --- | --- | --- |
| Sign-up requires an active wave | `RegisterApplicantUseCase` (400), `EnsureMyApplicationUseCase` (409) | "registration is not open" |
| Password and confirmation match | `RegisterApplicantUseCase` (existing) | 400 |
| Email not already registered | `isIdentifierTaken` before create (existing) | 409 |
| Ensure is idempotent on `userId` | existence read before any create | returns existing application |
| A created OAuth sign-up account has APPLICANT | `createUserFromOAuth` with `roleCode` | n/a — same transaction |
| Unknown email + `signup` + flag off creates nothing | `OAuthLoginUseCase` | outcome `signup-disabled` |

---

## State transitions

No new states. The application lifecycle is unchanged
(`DRAFT → SUBMITTED → …`, `admission-service/src/admission/application/domain/policies/admission-status.transitions.ts`).
Sign-up always produces a `DRAFT`, whether by password or by Google.
