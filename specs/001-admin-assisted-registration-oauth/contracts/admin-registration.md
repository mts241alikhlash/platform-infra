# Contract: Admin On-Behalf Registration

**Feature**: `001-admin-assisted-registration-oauth`

All routes below are served by the new sibling controller
`AdmissionAdminRegistrationController` (`@Controller('admissions')`,
`@UseGuards(JwtAuthGuard)`, global `PermissionGuard` active). Every route
requires `@RequirePermissions('admissions.create')`.

Every response uses the global envelope `{ statusCode, message, data, meta? }`;
only `data` is described below.

Base: `admission-service`, proxied by admission-web under `/admissions`.

## POST `/admissions/applications`

Creates the applicant account **and** its DRAFT application, then returns the
registration number once.

- Guard: `admissions.create`
- Body: `RegisterApplicantDto` — `fullName` (1..100), `email` (email, <=255),
  `phone?` (<=15), `password` (8..72), `passwordConfirm`, `waveId` (uuid)
- Delegates to: `RegisterApplicantUseCase` (unchanged, reused)
- Rationale: `POST /admissions/register` is already `@Public()` and this exact
  DTO; the admin route differs only in that it is authenticated and
  permission-checked.

| Status | Meaning | `data` |
| --- | --- | --- |
| 201 | Created | `{ id, registrationNumber, identifier }` |
| 400 | Wave closed / invalid, or password mismatch | envelope error |
| 409 | Email already registered | envelope error |
| 403 | Caller lacks `admissions.create` | envelope error |

The plain `password` is not echoed by the API. The calling UI already knows it
and is responsible for showing it once (FR-007).

## GET `/admissions/applications/:id/form`

Reads one application to populate the seven-step host.

- Guard: `admissions.create`
- Param: `id` (uuid, `ParseUUIDPipe`)
- Delegates to: `GetApplicationByIdUseCase` (unchanged, reused)

Documented for completeness: the existing `GET /admissions/applications/:id`
already returns the same payload under `admissions.read`. The front end may call
either; this plan has the wizard call the existing `admissions.read` route, so
this alias is **optional** and should only be added if the reviewer prefers a
single permission surface for the flow. If omitted, no task depends on it.

| Status | Meaning | `data` |
| --- | --- | --- |
| 200 | Detail | serialized application + `duplicateNikCount` + `documentTypes` |
| 404 | No such application | envelope error |

## PATCH `/admissions/applications/:id/form`

Writes one wizard step's fields onto the chosen application.

- Guard: `admissions.create`
- Param: `id` (uuid)
- Body: `UpdateMyApplicationDto` (+ nested `UpdateApplicationParentDto`)
- Delegates to: `UpdateMyApplicationUseCase.executeForApplication`
- Same editability rule as the applicant path: only `DRAFT` / `REVISION_NEEDED`.

| Status | Meaning |
| --- | --- |
| 200 | Updated; `data` is the serialized detail |
| 404 | No such application |
| 409 | Not editable in current status |

## PUT `/admissions/applications/:id/documents/:typeCode`

Uploads (or replaces) a required document against the chosen application.

- Guard: `admissions.create`
- Consumes: `multipart/form-data`, field `file` (JPG/PNG/PDF, <=5 MB, enforced by
  `assertValidAdmissionFile`)
- Delegates to: `UploadAdmissionDocumentUseCase.executeForApplication`
- The file's `uploadedBy` is the acting admin's id.

| Status | Meaning |
| --- | --- |
| 200 | Uploaded; `data` is the document |
| 400 | Wrong mime type, or file over 5 MB |
| 404 | No such application, or unknown `typeCode` |
| 409 | Not editable in current status |

## PUT `/admissions/applications/:id/payment`

Uploads the payment proof against the chosen application.

- Guard: `admissions.create`
- Consumes: `multipart/form-data`, field `file` plus `bankName`,
  `senderAccountName`, `transferDate?` (`UploadPaymentProofDto`)
- Delegates to: `UploadPaymentProofUseCase.executeForApplication`
- The file's `uploadedBy` is the acting admin's id.

| Status | Meaning |
| --- | --- |
| 200 | Uploaded; `data` is the serialized payment |
| 404 | No such application or no payment row |
| 409 | Not editable, or payment already `VERIFIED` |

## POST `/admissions/applications/:id/submit`

Submits the chosen application for verification.

- Guard: `admissions.create`
- Param: `id` (uuid)
- Delegates to: `SubmitApplicationUseCase.executeForApplication`
- Runs the same completeness gate as the applicant path: required fields, at
  least one parent, every required document present and not `REJECTED`, payment
  present and not `UNPAID`/`REJECTED`, wave still open. Emits the same
  applicant-facing `STATUS_CHANGE` notification.

| Status | Meaning |
| --- | --- |
| 201 | Submitted; `data` is the serialized detail |
| 400 | Incomplete data (message lists the missing items) |
| 404 | No such application |
| 409 | Transition not allowed (not DRAFT/REVISION_NEEDED), or wave closed |

## Contract rules

- The route verb/path of an on-behalf write mirrors the applicant route for the
  same operation, with `my-application` replaced by `applications/:id`. An
  operator reading both controllers sees one shape, not two.
- No `any`, no `unknown` in a declared return type; no DTO is imported by a use
  case (Principle IV).
- The `admissions.create` grant is what distinguishes this controller from
  `admission-admin.controller.ts`'s `admissions.verify`/`admissions.decide`. A
  verifier does not gain account creation by accident.
