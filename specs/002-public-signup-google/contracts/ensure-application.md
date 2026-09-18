# Contract: Ensure my application

**Feature**: `002-public-signup-google` | **Owner**: admission-service

Makes "this applicant has exactly one DRAFT application on the active wave" true,
no matter how the applicant arrived (password sign-up, Google sign-up, or a
Google sign-up whose application write was interrupted).

---

## `POST /admissions/my-application/ensure`

| Property | Value |
| --- | --- |
| Auth | `JwtAuthGuard` (bearer token) |
| Permissions | none beyond authentication — the caller acts on their own record |
| Request body | none |
| Throttle | default authenticated |

### Behavior

1. Read the caller's application by `userId` (`deletedAt: null`).
2. If it exists → return it, unchanged. No write.
3. If it does not exist → resolve the active wave (earliest-open, same filter as
   registration).
   - Active wave found → create a `DRAFT` application for `userId` on it, with
     the same companion rows registration creates (an `UNPAID` payment for the
     wave fee, a welcome notification) and a `registrationNumber`.
   - No active wave → `409 Conflict`, message stating registration is not open.
     Nothing is created.

The existence read happens **before** wave resolution and before any create
(Principle VIII: idempotency on the natural key — here the unique `userId` —
checked before uniqueness is relied upon).

Concurrency: two simultaneous calls both miss the read and both attempt a
create. `userId` is unique on `admission_applications`, so one succeeds and the
other receives a `409`. The caller retries and takes the success path. This is
the same shape as a duplicate registration today and is acceptable for a
double-submit on one dialog.

### Responses

| Status | Body (`data`) | When |
| --- | --- | --- |
| 200 | serialized application detail | application already existed |
| 201 | serialized application detail | application created |
| 409 | — | no active wave, message "registration is not open" |
| 409 | — | lost the create race with a concurrent call |

Both success statuses carry the same `data` shape as
`GET /admissions/my-application` (application fields, `wave`, `payment`,
`documents`, `parents`, `documentTypes`), so the SPA has one shape to handle.

---

## `GET /admissions/my-application` — unchanged

The form's read endpoint. It is not given a create side effect; ensure is the
write, this stays a read.

---

## Interaction with `POST /admissions/register`

`register` (password sign-up) still creates the account and the application in
one go and is unchanged in shape apart from the wave input (see
`register-auto-wave.md`). `ensure` is what the Google path — and any
half-finished applicant — calls afterwards. If `ensure` is called by someone who
just registered by password, it reads back the application it already has.
