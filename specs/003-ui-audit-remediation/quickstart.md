# Quickstart: UI Audit Remediation

How to prove this feature is done. Each scenario names what to run and what
counts as a pass. This is a validation guide, not an implementation guide.

## Prerequisites

- Node and pnpm installed. Seven app directories present as siblings.
- Baseline captured before any edit, in every app the feature touches:

  ```bash
  pnpm validate
  ```

  Record the test file and test counts per app. `admission-web` is expected to
  show 15 files / 93 tests from feature 002; the other six are unmeasured at the
  time of writing and must be measured, not assumed. SC-006 requires every app at
  or above its own baseline afterwards.

- A running stack for the browser scenarios: Postgres on 5433, and `admission-web`
  on its dev port. Feature 002 used identity 3000, academic 3200, admission 3700,
  web 5175 (or 5176 when 5175 is busy).
- `GOOGLE_CLIENT_ID` is the placeholder `change-me-in-production` in dev, so the
  Google consent round trip cannot be exercised. S4 states that rather than
  claiming a pass.

## S1. The landing page no longer asks the visitor to choose a wave

1. Open the landing page with at least one open wave.
2. Read the wave section heading, the wave card button, and the FAQ answer for
   starting registration.
3. **PASS** when none of the three instructs the visitor to choose, select, or
   pick a wave, and each describes what the system does instead.

Maps to FR-001, FR-002, FR-004, SC-001.

## S2. Sign-up lands in the server-resolved wave

1. Clear cookies and storage so the visitor is genuinely signed out.
2. From the landing page, complete sign-up without choosing a wave anywhere.
3. Read the created application's wave from the database, and confirm the form
   showed the wave as a locked field, not an input.
4. **PASS** when the application belongs to the open wave and the visitor chose
   nothing.

Evidence for feature 002: `POST /admissions/register` carried no `waveId`, and
two `ensure` calls returned the same application number with the table unchanged.
Maps to FR-003, SC-002.

## S3. Both wave-card buttons open the same dialog and mean the same thing

1. Click the section's own register button, then the per-card button.
2. Confirm the same dialog opens both times and the per-card button no longer
   names a specific wave.
3. **PASS** when the two are consistent and neither promises a wave-specific
   outcome.

Maps to FR-002, and the edge case in the spec about duplicate wording.

## S4. Google sign-up

1. Attempt the Google round trip.
2. **PASS or STATE** when the flow reaches Google and returns. With the
   placeholder client ID this cannot pass; record that it was not run and why.
   Do not claim a pass.

Maps to FR-022.

## S5. Contrast, text

1. In a running browser, measure the closing call-to-action eyebrow and body text
   against their rendered background.
2. **PASS** when each is at or above 4.5:1. Expected 5.09:1 for solid white on
   `#2D6FBE`.
3. Also confirm the heading in the same section, which was already compliant, did
   not move.

Maps to FR-005, SC-003.

## S6. Contrast, control edges

1. Measure an input edge against the card it sits on, and against the page
   background.
2. **PASS** when both are at or above 3:1. Expected 3.37:1 and 3.23:1.
3. Measure a non-control surface (a card edge or a table rule).
4. **PASS** when it is unchanged from before the feature, confirming `--border`
   did not move.
5. Look at an unchecked switch and confirm its off-state fill is visibly darker.
   **PASS** when that change is present and matches what
   `docs`/`research.md` R1 records, since it is accepted, not accidental.

Maps to FR-006, FR-007, SC-003.

## S7. The em dash scan returns zero

1. Scan `src/**` and `packages/**` for `*.vue`, `*.ts`, `*.css` in all seven apps
   for U+2014.

   The scan used while specifying this feature is
   `%TEMP%\opencode\classify_em2.ps1`, which reads files as UTF-8 and writes its
   findings to `%TEMP%\opencode\em_rows.json`. Reading with PowerShell's default
   encoding misreads UTF-8 and silently turns an em dash into a hyphen, so a
   verification that uses the default encoding is not evidence.

2. **PASS** when the count is zero in all seven apps.
3. Spot-check one date range, one empty cell, one note, and one prose sentence in a
   running browser, and confirm the dash and the spacing read correctly.
4. **PASS** when a range shows an en dash and an empty cell shows a hyphen.

Maps to FR-009 to FR-015, SC-004.

## S8. The shared files are corrected everywhere

1. Read `ServiceUnavailable.vue` and `useReferenceList.ts` in all seven apps.
2. **PASS** when all seven copies of each are corrected in the same session.
3. Same for `DashboardView.vue` in `assessment-web`, `hr-web`, `inventory-web`.
4. **PASS** when none of the copies is left on the old text, and the copies that
   were byte-identical before are still byte-identical after.

Maps to FR-015.

## S9. Decoration and arrows are gone without loss

1. Open the landing page and inspect the hero and the closing call to action.
2. **PASS** when no blurred orb and no glass capsule badge remains, and the hero
   text that the badge carried is still visible as plain text.
3. Inspect the five register CTAs.
4. **PASS** when none carries an arrow glyph and every label and click action is
   unchanged.
5. Click each CTA.
6. **PASS** when each still opens the sign-up dialog, so removal cost no function.

Maps to FR-016, FR-017, FR-018, SC-007.

## S10. Design direction is findable

1. Look at the workspace root for `DESIGN.md`.
2. **PASS** when it exists, states identity, personality, palette, typography,
   mood, and the three dials, and its content came from the owner.
3. **OPEN** until the owner supplies the answers. Recording this as open is the
   correct outcome; writing the file from guesses is not a pass.

Maps to FR-019, FR-020, SC-005.

## S11. Gates are green in every app touched

1. Run `pnpm validate` in each of the seven apps.
2. **PASS** when all six stages pass in each app and the test count is at or above
   the baseline captured in Prerequisites.

Maps to SC-006.

## S12. The two stated gaps

1. Confirm the Google consent round trip is recorded as not run, with the reason.
2. Investigate the pre-existing 1px `/login` overflow at 320px. Fix it if the
   cause is one line, and state it if not.
3. **PASS** when neither gap is silently omitted from the record.

Maps to FR-021, FR-022.

## Done when

Every scenario is PASS, or explicitly OPEN or STATE with its reason written down.
A run that reports no FAIL but hides an unrun scenario is not done.
