# Quickstart Results: UI Audit Remediation

Feature `003-ui-audit-remediation`, run 2026-09-15 against the live dev stack.

Environment: `admission-web` dev server on `http://localhost:5175`,
`identity-service` on 3000, `academic-service` on 3200, `admission-service` on
3700, Postgres on 5433, MinIO on 9000. Browser: Playwright, Chromium.

## Scenario results

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| S1 | Landing page opens with no console error | PASS | `GET /` 200, title "Penerimaan Santri Baru MTs Persis 241 Al-Ikhlash". Two console errors, both pre-existing and unrelated: `401` on `/auth/refresh` (no session) and `404` on `/settings/ADMISSION` (the documented `/settings` gap). |
| S2 | Wave copy no longer promises a choice | PASS | Rendered heading reads "Gelombang pendaftaran yang sedang dibuka"; body reads "Sistem menempatkan akun baru pada gelombang yang sedang dibuka. Lihat jadwal, kuota, dan biaya pendaftaran sebelum membuat akun." The old "Pilih gelombang yang tersedia" is gone. |
| S3 | FAQ answer matches the dialog | PASS | The FAQ answer is a hardcoded string in `LandingFaq.vue`; it now reads "Pilih tombol Daftar Sekarang, lalu buat akun menggunakan email aktif. Sistem menempatkan Anda pada gelombang pendaftaran yang sedang dibuka." No wave field exists in the dialog, so the instruction is now executable. |
| S4 | Google sign-up round trip | **OPEN** | `GOOGLE_CLIENT_ID` is the placeholder `change-me-in-production`, so a real consent redirect cannot be completed. Not run, not claimed. |
| S5 | No CTA names a specific wave | PASS | Rendered labels are "Mulai Pendaftaran" (header and mobile) and "Daftar Sekarang" (hero, per-card, nav, closing CTA). "Daftar pada gelombang ini" appears nowhere in the DOM. |
| S6 | CTA body text contrast | PASS | `text-white/80` and `text-white/85` are both gone from `LandingCta.vue`; the two paragraphs now resolve to `text-white` on `bg-primary`, measured at **5.09:1**. |
| S7 | Control edge token reaches 3:1 | PASS | `--input` computes to `oklch(0.64 0.006 264.531)` in the browser, converting to `#8A8C90`. Against `card` `#FFFFFF` that is **3.37:1**; against `background` `#F9FAFC` it is **3.23:1**. Both clear the 3:1 non-text bar. |
| S8 | `--border` unchanged | PASS | `--border` still computes to `oklch(0.928 0.006 264.531)`, which is **1.24:1** against card, exactly as before. No divider, card edge, or table rule changed. |
| S9 | Zero em dash in the rendered page | PASS | `document.body.innerText` contains **0** U+2014 and **2** U+2013 (the two date ranges in the wave card), which is the intended end state. |
| S10 | `DESIGN.md` exists with the six fields | PASS | `DESIGN.md` at the workspace root has identity, personality, palette, typography, mood, and the three dials (ENERGY 1 / RHYTHM 1 / MOTION 1), and states that it is agent-authored at the owner's request. Palette values are measured, not invented. |
| S11 | Orbs, glass badge, and arrows are gone | PASS | `LandingHero.vue` and `LandingCta.vue` contain **0** `ArrowRight` and **0** `blur-*`. The hero badge is now a plain `<p class="mb-5 text-sm font-semibold text-white">`, so its text stays visible with no capsule, border, glow, or dot. The only `svg` left inside a button is the mobile menu icon, which is a functional affordance, not a register CTA. |
| S12 | `/login` at 320px | PASS | No horizontal overflow at 320, 360, 375, 414, or 768 px: `scrollWidth === clientWidth` at every width, and no element crosses the right edge except the toaster, which is positioned outside the viewport by design. This closes FR-022, which was a pre-existing defect. |

## Click-through, element by element (R-35)

Every interactive element on the landing page was exercised:

| Element | Action | Result |
| --- | --- | --- |
| Navbar "Masuk" | navigates | `/login` renders the login form |
| Navbar "Daftar Sekarang" | click | sign-up dialog opens |
| Hero "Daftar Sekarang" | click | sign-up dialog opens, titled "Daftar Akun Pendaftaran" |
| Hero "Lihat Alur Pendaftaran" | anchor | scrolls to `#alur`, which exists |
| Header "Mulai Pendaftaran" | click | sign-up dialog opens |
| Mobile "Mulai Pendaftaran" | click | sign-up dialog opens |
| Per-card "Daftar Sekarang" | click | sign-up dialog opens |
| Closing CTA "Daftar Sekarang" | click | sign-up dialog opens |
| Dialog Escape key | press | dialog closes |
| `/login` "Lupa Password?" | link | `/forgot-password` |
| `/login` "Daftar" | link | routes to `/` and opens the dialog, confirming the feature 002 follow-up still works |

The dialog contains only Nama Lengkap, Email, Kata Sandi, and Konfirmasi Kata
Sandi, plus "Daftar dengan Google". There is no wave field, which is what makes
the new copy truthful.

## Measured contrast, from the browser

oklch converted to sRGB with the standard OKLab matrices and the WCAG relative
luminance formula, run inside the page rather than in a separate script.

| Pair | sRGB | Ratio | Bar |
| --- | --- | --- | --- |
| `--input` on `card` | `#8A8C90` on `#FFFFFF` | 3.37:1 | 3:1 non-text, PASS |
| `--input` on `background` | `#8A8C90` on `#F9FAFC` | 3.23:1 | 3:1 non-text, PASS |
| `--border` on `card` | `#E5E7EB` on `#FFFFFF` | 1.24:1 | unchanged, decorative |
| white on `primary` | `#FFFFFF` on `#2D6FBE` | 5.09:1 | 4.5:1 text, PASS |
| `primary-foreground` on `primary` | `#F9FAFB` on `#2D6FBE` | 4.87:1 | 4.5:1 text, PASS |
| `muted-foreground` on `card` | `#6A7282` on `#FFFFFF` | 4.84:1 | 4.5:1 text, PASS |

These match the Python measurement in `research.md` R1 to two decimal places,
which is the cross-check the plan called for.

## Work outside the original 104

The Phase 1 inventory script scanned only `src`, `packages\ui\src`,
`packages\platform\src`, and `packages\shared\src`. A full sweep found **63
further occurrences** in each app's `packages\reference-data\src`, `smoke\`,
`CLAUDE.md`, `package.json`, and `docs\`. The owner approved correcting all of
them on 2026-09-15, bringing the true total to 167. All are now zero.

The seven apps are clean. The remaining em dashes in the workspace are outside
this feature: backend services (their own docs and DTO comments), third-party
and project skill folders, and the older `specs/001` and `specs/002` documents.
Those are a separate cleanup, not a finding of `anti-slop/audit-002`.

## Not run

- **S4**, the live Google consent round trip: blocked by the placeholder client
  ID. Recorded as OPEN rather than passed.
- **Backend-app scenarios**: this feature changed no backend code, so the
  service test suites were not re-run for it. They are unchanged and green from
  feature 002.
