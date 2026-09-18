# Feature Specification: UI Audit Remediation

**Feature Branch**: `003-ui-audit-remediation`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Fix the UI audit 002 findings (1 to 8) across the landing page, form controls, and design direction"

## Context

`anti-slop/audit-002-2026-09-15.md` recorded eight findings against the
surfaces that feature `002-public-signup-google` created or touched in
`admission-web`. The owner approved all eight for remediation on 2026-09-15.
While specifying the work, a repo-wide scan found that finding 2 is far wider
than the audit knew: the audit named five em dashes in `admission-web`, and the
scan found **104 across seven web apps**. The owner widened the scope to all
104 on 2026-09-15.

Finding 5 needed no code change. It recorded that verification evidence now
exists but that two gaps remain. This feature closes what is closable and
states the rest rather than claiming a pass.

**Non-goal, stated rather than hidden:** no app in this workspace ships a dark
theme. `src/style.css` in all seven apps declares one theme and no `.dark`
block, and no theme toggle exists anywhere (`themeToggleRefs=0` across all
seven). Audit R-21 is therefore unaddressed by this feature. Adding a theme
toggle is a product decision with its own design work, not a remediation of an
audit finding. It is recorded here as known and out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The landing page stops promising a choice that does not exist (Priority: P1)

A parent reads the admission landing page to decide whether to register. The
page currently tells them to choose a registration wave, and one button names a
specific wave. Since feature 002 the wave is resolved by the server from the
active period, and the sign-up form has no wave field. Following the instruction
leads to a form that cannot carry out the instruction.

**Why this priority**: This is the only finding the previous feature made
*false*. Registrants act on it. Wrong instruction costs a support contact and
undermines trust in a step that collects personal data.

**Independent Test**: Read the landing page copy in a browser with an active
wave present, then complete sign-up and confirm which wave the created
application belongs to. The copy must match the outcome without the visitor
having chosen anything.

**Acceptance Scenarios**:

1. **Given** the landing page renders with one or more open waves, **When** the
   visitor reads the section heading and the call to action, **Then** no text
   instructs the visitor to choose a wave.
2. **Given** the visitor clicks the call to action on a specific wave card,
   **When** the sign-up dialog opens, **Then** the button text does not claim to
   register for that specific wave.
3. **Given** exactly one wave is open, **When** the visitor completes sign-up
   without choosing anything, **Then** the created application belongs to that
   open wave.
4. **Given** the FAQ answers "how do I start registering", **When** the visitor
   reads it, **Then** it describes what the system does, not a choice the
   visitor must make.

---

### User Story 2 - Every text and control edge passes its contrast bar (Priority: P1)

A low-vision visitor reads the closing call to action and fills in the sign-up
form. Two text runs on the primary background sit below the 4.5:1 bar, and every
form control edge sits far below the 3:1 non-text bar, so the field boundary is
effectively invisible.

**Why this priority**: Accessibility failures are Silent by nature. The visitor
who cannot read the call to action or see the field edge does not file a report,
they leave. Measured values are in the audit: 3.87:1, 4.15:1, and 1.24:1.

**Independent Test**: Measure each flagged pairing in a browser at the computed
color, with no opacity applied to text, and confirm the ratio meets its bar.
Independently testable per pairing.

**Acceptance Scenarios**:

1. **Given** the closing call-to-action section renders, **When** the eyebrow and
   body text are measured against their background, **Then** each is at or above
   4.5:1.
2. **Given** a form control renders on a card, **When** its edge is measured
   against the card, **Then** the ratio is at or above 3:1.
3. **Given** the same control renders on the page background, **When** its edge
   is measured, **Then** the ratio is at or above 3:1.
4. **Given** the token change is applied, **When** a non-control surface is
   inspected, **Then** its appearance is unchanged, so the fix is confined to
   control edges.

---

### User Story 3 - No em dash ships in any interface (Priority: P2)

A user reads any screen in any of the seven web apps. Em dashes appear in prose,
in table placeholder cells, as note prefixes, and in date ranges. The rule is
absolute and the character is a recognizable generated-text tell.

**Why this priority**: Hard Gate, so it cannot be waived, and the surface is
large (104 occurrences, 87 of them user-visible). It ranks below the two P1s
because a dash does not mislead anyone or hide a control, it only reads wrong.

**Independent Test**: Scan every shipped source file in the seven apps for the
em dash character and confirm zero remain outside the documented exemptions.

**Acceptance Scenarios**:

1. **Given** a repo-wide scan of `src/` and `packages/` in all seven apps,
   **When** run after the fix, **Then** no em dash remains in any user-visible
   string.
2. **Given** a date range is displayed, **When** the visitor reads it, **Then**
   the separator is an en dash, matching the two landing files that already use
   one.
3. **Given** a table cell has no value, **When** it renders, **Then** it shows a
   plain hyphen, not an em dash.
4. **Given** a note is attached to a document or a payment, **When** it renders,
   **Then** it is separated from its label by punctuation, not a leading dash.
5. **Given** the shared `ServiceUnavailable.vue` and `useReferenceList.ts`
   components exist byte-identically in seven apps, **When** one is corrected,
   **Then** all seven copies are corrected in the same session.

---

### User Story 4 - Decoration earns its place and the direction is written down (Priority: P3)

A reviewer opens the landing page and the repository. Four blurred orbs and a
glass capsule badge decorate two sections with no recorded reason, five CTAs
carry an arrow with no recorded purpose, and no `DESIGN.md` exists, so the
design direction lives only inside a finished feature's spec folder.

**Why this priority**: Purpose-Gate and Quality-Lock findings. Nothing is broken
for the user, but the rules require either a written reason or removal, and the
direction must outlive the spec folder. Lowest priority because it changes
appearance without changing function or legibility.

**Independent Test**: Inspect the two sections and confirm the decoration is
gone, and confirm a `DESIGN.md` exists at the workspace root whose content came
from the owner.

**Acceptance Scenarios**:

1. **Given** the hero section renders, **When** its decoration is inspected,
   **Then** no blurred orb and no glass capsule badge remains.
2. **Given** the closing call-to-action section renders, **When** its decoration
   is inspected, **Then** no blurred orb remains.
3. **Given** any of the five register CTAs renders, **When** its content is
   inspected, **Then** it carries no arrow glyph.
4. **Given** a reader opens the workspace root, **When** they look for design
   direction, **Then** a `DESIGN.md` states identity, personality, palette,
   typography, mood, and the three dials, and states that it was agent-authored at
   the owner's request.

---

### Edge Cases

- A wave card's call to action becomes identical to the section's own call to
  action once the wave-specific wording is removed. The section must still read
  as deliberate, not as a duplicated button.
- The darkening of control edges is applied to seven apps. A surface that
  currently relies on `--input` for decoration rather than a control boundary
  would change appearance. Such a surface must be found before the change, not
  after.
- An en dash replacing an em dash in a date range must not change the rendered
  spacing.
- Text already at the bar (for example `text-white` at 5.09:1) must not be
  altered while fixing the two that fail, so the fix does not drift.
- The two shared files exist byte-identically in seven apps. Correcting six of
  seven silently leaves one app on the old text, and the constitution names a
  drifted copy as a bug.
- A `DESIGN.md` authored by an agent rather than the owner would satisfy the
  letter of R-37 while reproducing the generic taste R-37 exists to catch. The
  owner is the author; the agent only transcribes.

## Requirements *(mandatory)*

### Functional Requirements

**Copy that matches the product (US1)**

- **FR-001**: The landing page MUST NOT instruct the visitor to choose a
  registration wave. Affected: `LandingFaq.vue:8`,
  `LandingWaveSection.vue:42`.
- **FR-002**: A wave card's call to action MUST NOT claim to register the
  visitor for that card's wave. Affected: `LandingWaveSection.vue:182`.
- **FR-003**: The wave section MUST remain present and MUST still show each open
  wave's schedule, quota, and fee, because that information is real and comes
  from the API.
- **FR-004**: The FAQ answer for "how do I start registering" MUST describe the
  server-resolved wave rather than a visitor choice.

**Contrast (US2)**

- **FR-005**: Text in the closing call-to-action section MUST meet 4.5:1 against
  its background, with no translucent white applied to normal-size text.
  Affected: `LandingCta.vue:21`, `LandingCta.vue:27`.
- **FR-006**: The control-edge token MUST reach at least 3:1 against both the
  card background and the page background. The required value is
  `oklch(0.64 0.006 264.531)`, measured at 3.37:1 against the card and 3.23:1
  against the page background. The value `oklch(0.65 ...)` also passes at
  3.24:1 and 3.10:1; it is rejected for margin, not because it fails.
- **FR-007**: The control-edge change MUST be confined to `--input`. `--border`
  MUST keep its current value of `oklch(0.928 0.006 264.531)`, so non-control
  surfaces are unchanged.
- **FR-008**: The control-edge change MUST be applied to all seven apps in the
  same session: `academic-web`, `admin-web`, `admission-web`, `assessment-web`,
  `hr-web`, `inventory-web`, `portal-web`.

**Em dash removal (US3)**

- **FR-009**: No em dash character (U+2014) MUST remain in any user-visible
  string in any of the seven apps.
- **FR-010**: A displayed date or value range MUST use an en dash (U+2013),
  matching the convention `LandingHero.vue:32` and `LandingWaveSection.vue:25`
  already follow.
- **FR-011**: A prose sentence MUST use a comma, period, colon, or parentheses in
  place of an em dash.
- **FR-012**: An empty table cell or absent value MUST use a plain hyphen (U+002D),
  not an em dash.
- **FR-013**: A note rendered beside a label MUST be separated by punctuation
  rather than a leading dash character.
- **FR-014**: The 104 occurrences MUST be corrected across all seven apps: 87
  user-visible, 10 in test files, and 7 in code comments.
- **FR-015**: Files that exist byte-identically in more than one app MUST be
  corrected in every copy: `ServiceUnavailable.vue` and `useReferenceList.ts`
  (both all seven apps) and `DashboardView.vue` (three apps).

**Decoration, arrows, and direction (US4)**

- **FR-016**: The four blurred orbs MUST be removed:
  `LandingHero.vue:51`, `LandingHero.vue:54`, `LandingCta.vue:15`,
  `LandingCta.vue:18`.
- **FR-017**: The glass capsule badge MUST be removed from `LandingHero.vue:64`.
  The text it carried MUST remain visible as plain text.
- **FR-018**: The arrow glyph MUST be removed from all five register CTAs:
  `LandingCta.vue:37`, `LandingHero.vue:86`, `LandingWaveSection.vue:54`,
  `LandingWaveSection.vue:183`, `LandingWaveSection.vue:198`.
- **FR-019**: A `DESIGN.md` MUST exist at the workspace root and MUST state
  identity, personality, palette, typography, mood, and the three dials.
- **FR-020**: The content of `DESIGN.md` MUST name its own provenance. The owner
  asked the agent to author it on 2026-09-15 (see Assumptions), so the file MUST
  state that it was agent-authored at the owner's request. The fields that can be
  measured, palette and typography, MUST be measured from the shipped code rather
  than invented, and the judgement fields MUST be presented as the agent's reading
  of the current build and therefore revisable. A file that presented
  agent-authored taste as owner-supplied direction would be the failure R-37
  exists to catch.

**Verification (all stories)**

- **FR-021**: The landing page and the sign-up dialog MUST be exercised in a
  running browser after the changes, and the click-through MUST be recorded
  element by element.
- **FR-022**: The two gaps that cannot be closed MUST be stated rather than
  claimed: the live Google consent round trip needs a real `GOOGLE_CLIENT_ID`,
  and the pre-existing 1px `/login` overflow at 320px is not caused by this
  feature. The overflow MUST be fixed if it is found to be a one-line cause.

### Key Entities

No data model changes. This feature changes presentation text, one design token,
and decorative markup. No database, no migration, no API contract.

The entities that matter are the ones the requirements address:

- **Control edge token** (`--input`): one value, replicated in seven
  `src/style.css` files, consumed as `border-input` by form controls.
- **Em dash occurrence**: 104 instances, each classified as prose, date range,
  empty value, note prefix, test, or comment, and each with one correct
  replacement.
- **Landing copy string**: the wave-choosing sentences that contradict the
  shipped product.
- **`DESIGN.md`**: a new workspace-root document whose content is owner-supplied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero sentences on the landing page instruct a visitor to choose a
  wave. Verified by reading the rendered page, not the source.
- **SC-002**: A visitor who signs up after the change lands in the wave the
  system resolved, with no wave chosen anywhere in the flow. Verified with a
  database read.
- **SC-003**: Every flagged contrast pairing meets its bar: two text pairings at
  4.5:1 or above, two control-edge pairings at 3:1 or above.
- **SC-004**: A repo-wide scan of the seven apps returns zero em dash characters
  in user-visible strings, and the only remaining occurrences are the documented
  test and comment ones if the owner keeps that exemption.
- **SC-005**: A reader can open the workspace root and find the design direction
  without entering any spec folder.
- **SC-006**: `pnpm validate` passes in every app this feature touches, with the
  test count at or above the pre-change count in each.
- **SC-007**: No element in the two decorated sections loses its text or its
  function when the decoration is removed. Verified by clicking through.

## Assumptions

- The owner's approval of all eight audit findings on 2026-09-15 extends to the
  widened em dash scope of 104 occurrences, approved in the same session.
- The agent authored `DESIGN.md` on 2026-09-15, at the owner's explicit request,
  using best practice. This is recorded in the file itself rather than presented
  as owner-supplied direction, because agent-authored direction tends toward the
  generic taste R-37 exists to catch. The palette and typography in it are
  measured from the shipped code; the character claims are the agent's reading of
  the current build and are the owner's to revise.
- The measured contrast values from the audit are reproducible. They were
  re-measured while specifying this feature and agreed to two decimal places.
- Removing decoration is preferred over writing a justification for it, as the
  owner chose on 2026-09-15.
- No dark theme exists in any app, so R-21 and R-34 are out of scope and are
  recorded as such rather than silently skipped.
- The seven web apps are separate repositories with no sync tooling, so a shared
  change is seven edits by hand in one session. This is the constitution's
  stated procedure, not an oversight.
- The em dash in test files and code comments is corrected as well, since the
  owner chose the full 104.
