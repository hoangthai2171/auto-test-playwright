# Vietnamese MyTV Auto Test User Guide

**Plan ID:** mytv-user-guide-vi-20260804  
**Status:** Complete  
**Approval:** Approved by user on 2026-08-04  
**Created:** 2026-08-04  
**Updated:** 2026-08-04  
**Owner:** Codex  
**Risk:** Low  
**Branch/worktree:** `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright`

## Status

- [x] Step 1: Capture and annotate the current Electron GUI screenshots. (Completed)
- [x] Step 2: Author the Vietnamese Word guide with a working table of contents. (Completed)
- [x] Step 3: Render, inspect, audit, and hand off the final document. (Completed)

## Goal

### Problem

New users need a Vietnamese guide for the MyTV Auto Test desktop runner. The
guide must explain the visible workspace, first-time setup, the test-start
workflow, and all settings using screenshots of the current GUI.

### Desired outcome

Create one polished `.docx` user guide in Vietnamese with a table of contents,
real GUI screenshots embedded in every required section, a numbered overview of
the main workspace, and practical steps for configuring the host, reviewed
Chromium, Campaign/Folder/Test cases, and Settings.

### Acceptance criteria

- [ ] A final Word document exists at `docs/user-guide/MyTV-Auto-Test-Huong-dan-su-dung.docx`.
- [ ] The document is written in Vietnamese and contains the required sections:
      Introduction/Giới thiệu, First start/Bắt đầu lần đầu, How to start a
      test/Cách bắt đầu một lần kiểm thử, and Settings/Cấu hình.
- [ ] A table of contents is present, populated, and links to Heading 1–3
      sections; headings use real Word heading styles.
- [ ] Every required section contains at least one screenshot from the current
      Electron app. The Introduction screenshot labels each main workspace area
      with numbers and the text below explains the same numbers.
- [ ] First start explains `Settings → GUI → Add host` and
      `Settings → SDK configuration → Browser configuration → Auto configure →
      Install reviewed Chromium`.
- [ ] How to start a test explains optional Campaign selection, Folder
      selection, `Get test cases`, searching/selecting test cases, and
      `Run Selected (N)`; it also notes the local fixture fallback when no API
      folder is available.
- [ ] Settings explains the GUI/connection, Network config, Preview Type, Test
      configuration, Browser configuration, and the LG SDK configuration areas,
      with screenshots for the visible settings panels.
- [ ] The final `.docx` renders to page PNGs without clipped text, overlap,
      broken tables, missing Vietnamese glyphs, or misplaced screenshots.
- [ ] The pre-existing `app/renderer/index.html` working-tree change is
      preserved and no application source is modified.

### Non-goals

- Do not change the Electron app, its labels, API/cache behavior, or test
  execution logic.
- Do not actually run a MyTV test case, submit test results, pair with an LG TV,
  or store credentials while capturing screenshots.
- Do not install Chromium as part of document production; describe the reviewed
  installation flow and show its UI instead.
- Do not publish screenshots or document contents externally.

## Current State and Findings

- The main workspace is defined in `app/renderer/index.html` around the toolbar,
  Run target, Campaigns, Folders, Test cases, action buttons, status bar, and
  browser preview sections (current lines 10–145).
- The Settings modal contains GUI, Test configuration, and SDK configuration
  panels with Connection, Network config, Preview Type, Browser configuration,
  LG SDK, compatibility, and advanced-path controls (current
  `app/renderer/index.html` lines 247–452).
- The project README documents the intended startup and run order in
  `README.md` under `Run With the Electron Case Browser` (current lines 90–111),
  including Campaign/Folder scoping and `Get test cases`.
- `package.json` exposes `npm run app:dev` as the Electron development entry
  point.
- The live Electron GUI was opened successfully after allowing the local GUI
  launch. It currently displays the MyTV Auto Test workspace at 1366×768 with
  local fixture cases already visible and the version label `v1.0.1`.
- The workspace currently has an unrelated user change: `M
  app/renderer/index.html`. Its diff changes the Campaign label from Vietnamese
  to English and adjusts Passphrase markup; it must remain untouched.
- Baseline checks:
  - `node --check app/main.js` — Pass.
  - `node --check app/preload.js` — Pass.
  - `node --check app/renderer/renderer.js` — Pass.
  - `git diff --check` — Pass (Git also reports an existing fsmonitor IPC warning).
  - `npm run test:unit` — Fails in the pre-existing renderer contract because
    `tests/unit/renderer.test.js:2496` still expects `Chiến dịch` while the
    user's current `app/renderer/index.html` contains `Campaigns`; no test or
    source repair is in scope for this document task.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Deliverable format | Markdown/PDF/HTML | Word `.docx` | Explicit user requirement and easiest handoff for Vietnamese users | Requires render QA with LibreOffice and embedded images |
| Document design | Generic Word defaults; dense SOP table | `compact_reference_guide` preset with `editorial_cover` first-page pattern | Fits a practical launch/operator guide while keeping screenshots readable | Uses explicit Letter geometry, Calibri hierarchy, blue headings, and fixed table widths |
| Screenshot source | Mockups; source-code diagrams; live GUI | Current Electron GUI, captured through Computer Use | Meets the requirement that every section demonstrate the actual app | Screenshot text reflects the current English UI labels |
| TOC behavior | Word field only; manually typed list; `internal_nav.py` post-processing | Static linked TOC generated with equivalent OOXML bookmarks/hyperlinks after the content is assembled | Populates deterministically in headless render and remains clickable | Page numbers may not be dynamic in all Word viewers; headings remain linked |
| Settings coverage | One full modal image; field-by-field crops | Separate GUI, Test configuration, Browser SDK, and LG SDK views with prose | Makes all setting groups legible and explicitly explained | More pages, but better for onboarding |

## Assumptions, Constraints, and Dependencies

- Assumption: The user wants the guide to describe the current English control
  labels even though the explanatory prose is Vietnamese.
- Assumption: A static linked TOC is acceptable for the requested Word guide;
  headings are still real Word Heading styles so Word can update a field later.
- Constraint: Screenshots must not expose credentials or private test output;
  no login/test execution will be performed.
- Constraint: The project is already dirty; only new files under `docs/user-guide`
  and this plan may be added.
- Dependency: Electron must be launchable locally for GUI capture; Chromium
  installation itself is not required.
- Dependency: The bundled document runtime and `render_docx.py` are used for
  DOCX generation and render QA.
- Unresolved material questions: None.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| UI labels or layout change while screenshots are captured | Guide can mismatch the shipped UI | Capture from the current app and state the captured version; keep prose tied to visible labels | Re-capture only the affected PNG and rebuild the DOCX |
| Settings modal is taller than the viewport | Lower LG controls may be unreadable | Capture dedicated scrolled views and inspect them at 100% | Re-capture with a stable scroll position or split the figure |
| Vietnamese glyphs or images render poorly in Word/LibreOffice | Reduced usability | Use a Unicode-capable font, inline images, and mandatory render inspection | Adjust font/image size and re-render |
| Local fixture/API state differs between machines | User may not see the same case list | Explain Campaign optionality and local fallback; avoid naming a specific remote folder as required | Update only the explanatory note if the workflow changes |

## File Impact and Detailed Changes

### `docs/user-guide/assets/*.png`

**Action:** Add  
**Current role and evidence:** Directory does not yet exist; screenshots are
needed to satisfy the user's per-section GUI demonstration requirement.  
**Exact changes:** Add screenshots for the annotated workspace, settings GUI,
Test configuration, Browser SDK setup, LG SDK setup, and the test-case selection
workflow. Use only the local Electron window and do not include credentials or
test result data.  
**Invariants and compatibility:** Keep screenshots at sufficient resolution;
embed them inline in the DOCX.  
**Tests affected:** Manual visual inspection of every source screenshot and
every rendered DOCX page.

### `docs/user-guide/MyTV-Auto-Test-Huong-dan-su-dung.docx`

**Action:** Add  
**Current role and evidence:** New user-facing artifact requested by the user;
there is no existing guide in the repository.  
**Exact changes:** Build a Vietnamese guide with a cover/title block, static
linked TOC, real Heading 1–3 hierarchy, numbered workspace legend, step-by-step
setup/run instructions, notes/callouts for safety and prerequisites, captions,
and inline screenshots. Explain all current settings without exposing secrets.
  
**Invariants and compatibility:** Do not alter app source; keep GUI labels as
shown in the current app, preserve a readable Letter portrait layout, and make
all screenshots inline rather than floating.  
**Tests affected:** DOCX structural audits, render-to-PNG inspection, heading/
image/table audits, and final diff review.

### `docs/tinyworkers/20260804_mytv-user-guide-vi.md`

**Action:** Add  
**Current role and evidence:** Canonical Tiny-Workers plan and execution
evidence for this multi-step artifact task.  
**Exact changes:** Track approval, milestone status, verification evidence,
deviations, and final handoff.  
**Invariants and compatibility:** Does not affect application runtime.
  
**Tests affected:** Plan status and evidence review only.

## Execution Sequence

### Step 1 — Capture and annotate current GUI

**Objective:** Capture the live Electron workspace and settings panels at a
readable size, then annotate the main workspace screenshot with numbered callout
markers.  
**Files:** `docs/user-guide/assets/*.png`  
**Implementation details:** Open the app, capture the main workspace, open
Settings and capture GUI, Test configuration, Browser configuration, and the
lower LG SDK configuration. Select one harmless local fixture checkbox only if
needed to demonstrate the enabled `Run Selected (N)` state; do not submit or run
the test. Add concise numbered markers to the workspace image and verify the
legend matches.  
**Dependencies:** Approved plan; local Electron GUI.  
**Verification:** Inspect each source PNG at 100%; expected result: all required
labels and controls are legible and no sensitive value is exposed.  
**Exit criteria:** All planned screenshot files exist and correspond to current
GUI states.  
**Approval gate:** Required before execution.

### Step 2 — Author Vietnamese Word guide

**Objective:** Create the final `.docx` using the captured screenshots and the
approved `compact_reference_guide` token map.  
**Files:** `docs/user-guide/MyTV-Auto-Test-Huong-dan-su-dung.docx`  
**Implementation details:** Use `python-docx` with explicit Letter/margin,
style, heading, list, table, cell-margin, and header/footer tokens. Use real
numbered lists and headings. Add a static linked TOC with equivalent OOXML
bookmarks and hyperlinks after the content is assembled. Add captions and alt
text for each figure.  
**Dependencies:** Step 1 screenshots; workspace document dependencies.  
**Verification:** Run heading/image/style/table/a11y audits; expected result:
TOC is populated, images are inline, and all required sections are present.  
**Exit criteria:** DOCX opens structurally and includes all planned content.  
**Approval gate:** Not required within approved scope.

### Step 3 — Render, inspect, and hand off

**Objective:** Prove the final DOCX is visually usable and hand it off without
claiming unrun checks.  
**Files:** Final DOCX and temporary QA render directory outside the deliverable
  folder.  
**Implementation details:** Render with the bundled `render_docx.py`, inspect
every generated page image at 100%, fix any layout issue, and render again.
Review the final working-tree diff so the pre-existing app change remains the
only unrelated modification.  
**Dependencies:** Step 2 DOCX.  
**Verification:** `render_docx.py`; `heading_audit.py`; `images_audit.py`;
`a11y_audit.py`; `git diff --check`; manual inspection of every page.  
**Exit criteria:** All acceptance criteria have evidence and no known layout
defect remains.  
**Approval gate:** Not required within approved scope.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Required sections and Vietnamese prose | Structural/manual | Extract DOCX text and inspect headings | Four requested sections and Vietnamese instructions present |
| TOC is present and linked | Structural/manual | DOCX OOXML inspection, heading audit, click/inspect links | TOC entries point to Heading 1–3 anchors |
| Every section has GUI screenshot | Manual/image audit | `images_audit.py` + rendered pages | Figure/caption appears in each required section |
| Introduction workspace legend | Manual | Inspect annotated PNG and corresponding list | Marker numbers map one-to-one to explanations |
| First-start workflow | Manual/source alignment | Compare prose to `app/renderer/index.html` labels | Add host and reviewed Chromium path is explicit |
| Test-start workflow | Manual/source alignment | Compare prose to README and workspace screenshot | Campaign optionality, Folder, Get test cases, selection, Run Selected are explained |
| Settings coverage | Manual/source alignment | Compare prose and four settings screenshots to modal markup | GUI, Test configuration, Browser SDK, and LG SDK areas are all explained |
| Render quality | Visual | `env TMPDIR=/private/tmp python render_docx.py ...` then inspect every PNG | No clipping, overlap, glyph loss, or image misplacement |
| No source change | Static | `git status --short`, `git diff -- app/renderer/index.html` | Only pre-existing app change plus planned guide files |

## Completed Verification

> Update this section during execution with actual results. Do not prefill claims.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 screenshots | Opened the current Electron app and inspected the six source views plus two annotated workspace views | Pass | `docs/user-guide/assets/00_workspace_annotated.png`, `01_settings_gui.jpg`, `02_first_start_gui.jpg`, `03_settings_test_configuration.jpg`, `04_settings_sdk_browser.jpg`, `05_settings_sdk_lg.jpg`, `06_test_workflow_annotated.png` | 2026-08-04 |
| DOCX build | Built with bundled Python runtime and `python-docx` | Pass | `docs/user-guide/MyTV-Auto-Test-Huong-dan-su-dung.docx` | 2026-08-04 |
| DOCX structure | `heading_audit.py`, `images_audit.py`, `a11y_audit.py`, `section_audit.py`, `style_lint.py` | Pass | 4 Heading 1 + 12 Heading 2; 10 inline images; 0 accessibility findings; 1 Letter portrait section with 1-inch margins | 2026-08-04 |
| TOC links | Inspected `word/document.xml` bookmarks and hyperlinks | Pass | 17 bookmarks, 16 unique TOC hyperlink targets, 0 missing targets, no `[[TOC]]` placeholder or `Back to TOC` heading text | 2026-08-04 |
| Render QA | Rendered with `render_docx.py` to `/private/tmp/mytv-guide-render-4`; inspected pages 1–13 at high detail | Pass | 13 pages; no clipped text, overlap, broken image, or missing Vietnamese glyph observed | 2026-08-04 |
| Source/runtime checks | `node --check app/main.js`; `node --check app/preload.js`; `node --check app/renderer/renderer.js`; `git diff --check` | Pass | All syntax checks and diff check exit 0 | 2026-08-04 |
| Unit baseline | `npm run test:unit` | Known pre-existing failure | Renderer contract at `tests/unit/renderer.test.js:2496` still expects `Chiến dịch`, while the user’s existing `app/renderer/index.html` change uses `Campaigns`; no app source/test change made | 2026-08-04 |

## Deviations and Plan Updates

- Replaced the planned `internal_nav.py` post-processing with equivalent
  in-document OOXML bookmarks and hyperlinks because that helper always inserts
  a new TOC at the document start, ignores an existing placeholder, and adds
  unwanted inline “Back to TOC” text to headings. The replacement keeps the
  cover first and preserves the requested Heading 1–3 navigation.

## Handoff and Completion

- Changed files: `docs/user-guide/MyTV-Auto-Test-Huong-dan-su-dung.docx`,
  `docs/user-guide/assets/*`, and this execution plan. The pre-existing
  `app/renderer/index.html` change was preserved unchanged.
- Checks passed: Screenshot inspection; DOCX build; TOC/bookmark inspection;
  heading/image/accessibility/section audits; 13-page render QA; Node syntax
  checks; `git diff --check`.
- Known limitations: The guide reflects the GUI labels and layout captured on
  2026-08-04; remote API campaign/folder contents can vary by environment.
- Follow-up work: None planned.
- Final acceptance status: Complete. The final DOCX is ready for handoff.
