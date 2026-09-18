# Contract: Register with automatic wave

**Feature**: `002-public-signup-google` | **Owner**: admission-service

Two endpoints share one use case. They diverge only in whether the caller may
name the wave.

---

## `POST /admissions/register` (public, password sign-up)

| Property | Value |
| --- | --- |
| Auth | `@Public()` |
| Throttle | the existing `auth` bucket |
| Input | `PublicRegisterApplicantDto` |

**`PublicRegisterApplicantDto`** — `RegisterApplicantDto` minus `waveId`:

| Field | Rules |
| --- | --- |
| `fullName` | required, non-empty, max 100 |
| `email` | required, email, max 255 |
| `phone` | optional, max 15 (still accepted; the dialog simply no longer asks) |
| `password` | required, 8–72 |
| `passwordConfirm` | required, non-empty |

`waveId` is deliberately **absent** from this DTO. A client that sends one is
ignored, because the use case no longer reads it — FR-007 makes the wave a
server decision, not a validation the client can satisfy or fail.

### Behavior

1. Password and confirmation must match → else `400`.
2. Resolve the active wave (earliest-open). None → `400` "registration is not
   open", no account, no application.
3. Identifier taken → `409` (existing).
4. Create the identity account with `APPLICANT` and the `DRAFT` application,
   payment and notification (existing sequence).

### Response (unchanged)

```json
{ "statusCode": 201, "message": "...", "data": {
  "id": "…", "registrationNumber": "PSB2026-0007", "identifier": "a@b.c" } }
```

---

## `POST /admissions/applications` (admin, on-behalf registration)

| Property | Value |
| --- | --- |
| Auth | `JwtAuthGuard` + `RequirePermissions('admissions.create')` |
| Input | `RegisterApplicantDto` — **`waveId` stays required** |

Unchanged. An admin registering on behalf of a parent picks the wave explicitly;
that is a different actor with a different capability. The use case receives an
explicit `waveId` and uses `findOpenWave` as today; it only falls back to
`findActiveWave` when `waveId` is absent.

---

## `RegisterApplicantInput` (use-case input, admission-service)

| Field | Change |
| --- | --- |
| `waveId` | becomes optional (`waveId?: string`) |
| others | unchanged |

Resolution rule: `waveId` present → `findOpenWave(waveId)` (must be open, else
`400`, existing behavior); `waveId` absent → `findActiveWave()` (must exist, else
`400` "registration is not open").

---

## Port addition

`IAdmissionApplicantRepository.findActiveWave(): Promise<AdmissionWaveEntity | null>`
— declared next to `findOpenWave`, returning the earliest-open active wave or
`null`. Repository input and output types are declared in the same file as the
port (Principle IV).
