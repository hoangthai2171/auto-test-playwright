# Harden Numeric `play_row` Selection and Fix the Browser Log Panel Layout

**Plan ID:** 20260813_202126_play-row-index-and-fixed-log-panel
**Status:** Complete
**Approval:** Approved by user on 2026-08-13
**Created:** 2026-08-13 20:21 Asia/Ho_Chi_Minh
**Updated:** 2026-08-13 22:19 Asia/Ho_Chi_Minh
**Owner:** Tiny-PM / Tiny-Executor
**Risk:** Medium
**Branch/worktree:** `fix/play_row` / `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright`

## Status

- [x] Step 1: Make numeric Home-row focus viewport-safe and add public-index regression coverage
- [x] Step 2: Lock the Browser Playwright log panel geometry and add CSS contract coverage
- [x] Step 3: Run focused, full, live, visual, and graph verification; record evidence

## Goal

### Problem

The public `play_row(rowIndex=N)` action uses a one-based row index. The
workflow correctly converts it to a zero-based internal index, but the Home-row
resolver tries to focus a matching `homePage2_*` poster even when that poster is
below the current viewport. On the staging page this exhausts remote navigation
and then falls back to visible title enumeration, producing a false row-not-found
failure even though the indexed row exists.

The Browser workspace's lower Playwright log panel is also auto-sized. A large
failed-test log can increase its grid track and push the two preview rows upward,
breaking the fixed six-slot workspace composition.

### Desired outcome

Numeric `play_row` selection must stay positional: it reveals the requested Home
row through remote vertical navigation, focuses its first poster only after the
target is viewport-reachable, and proceeds through the normal playback flow.
The Browser workspace must keep a fixed-height, fixed-position Playwright log
panel whose content scrolls internally; preview rows must retain their layout.

### Acceptance criteria

- [x] Public `play_row(rowIndex=3)` resolves the third non-promotional Home row
  (`homePage2_2_*`) and reaches row playback without title matching.
- [x] An offscreen indexed Home row is revealed by remote navigation before any
  direct focus attempt; existing named-row, row-position, and playback behavior
  remains unchanged.
- [x] Unit coverage protects both the one-based public-to-zero-based mapping and
  the offscreen Home-row regression.
- [x] The Browser log panel has one fixed height and grid position; long failed
  logs scroll inside the panel and cannot change preview-slot geometry.
- [x] The gap between the two preview rows is reduced from the current 14px to
  6px, while the six-slot 3x2 structure and 16:9 holders remain intact.
- [x] Relevant unit, syntax, Playwright-list, live staging, visual layout, and
  graph-update checks are recorded with no new failures.

### Non-goals

- Do not change the `play_row` action schema, count semantics, playback cleanup,
  remote-control primitives, or virtual-keyboard behavior.
- Do not make numeric row selection depend on a row title or dynamic text.
- Do not redesign the six-slot workspace, add responsive breakpoints, or change
  Browser resolutions/concurrency settings.
- Do not change API/cache behavior, LG execution, APP_URL, credentials, or
  deployment scripts.

## Current State and Findings

- `tests/lib/workflows.js:619-624` subtracts one from the public one-based
  `rowIndex` before calling `focusRequestedContentRow`; this is the intended
  public contract, but it is not directly guarded by a behavior test.
- `tests/lib/content-rows.js:630-680` builds the stable `homePage2_<index>_`
  prefix, but `inspectHomePageRowTarget()` originally considered any laid-out
  DOM element a direct target without checking whether its rectangle was
  reachable in the viewport.
- Live diagnostic after the supplied login → Home flow observed
  `homePage2_0`, `_1`, `_2`, ...; the third public non-promotional row is
  `homePage2_2_*`, with its first poster at approximately `y=1217` on the
  `1280x720` logical viewport. It is in the DOM but initially offscreen.
- The exact temporary reproduction of login → Home → `play_row(rowIndex=3)`
  failed live with `Không tìm thấy hàng thứ 3. Các hàng đang thấy: Gameshow,
  Hài`, matching the reported failure. The reproduction fixture and diagnostic
  spec were removed after use; no credentials were saved in the plan.
- A first viewport-intersection guard still allowed a partially visible target
  at `y≈698` to enter direct focus in one timing window. The follow-up retained
  the intersection guard because the TV can expose a usable target at the
  bottom edge, then waits for the stable row IDs/card geometry to settle before
  treating the row as selected.
- `app/renderer/styles.css:857-864` uses an auto-sized third Browser-preview
  grid row; `:876-885` uses a 14px slot-grid gap; and `:996-1008` gives the log
  panel only `min-height:130px`/`max-height:240px`, allowing content-dependent
  growth.
- Baseline `npm run test:unit` passed all 687 tests; the final suite passes 689
  tests after the two regression tests were added.
- Baseline syntax checks for `tests/lib/content-rows.js`,
  `tests/lib/workflows.js`, and `app/renderer/renderer.js` passed.
- Baseline `npx playwright test tests/run-test-case-mytv.spec.js --list`
  passed and listed one Chromium test.
- Baseline `git -c core.fsmonitor=false diff --check` passed. The repository's
  Git fsmonitor daemon emits a pre-existing IPC warning when status-like
  commands query it; no unrelated worktree changes were present before this
  plan.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Indexed Home-row targeting | Keep direct focus of any DOM target; enumerate visible rows by title; navigate only by row titles | Treat an indexed Home poster as a direct-focus target only when it intersects the viewport, then wait for the stable row IDs/card geometry before accepting it; otherwise send remote Down and retry | Preserves stable `homePage2_*` identity while respecting the TV focus model and avoids title dependence; the wait covers lazy title/heading rendering | Offscreen rows may require several existing vertical navigation attempts before focus; no new selector contract is needed |
| Public index contract | Change all callers to zero-based; infer the index again in content rows; leave the conversion implicit | Keep the one-based public contract and name/test the existing `rowIndex - 1` normalization in `workflows.js` | Matches schema, compiler, and AGENTS.md; makes the boundary explicit without changing server data | Internal content-row tests use zero-based indexes; action-level coverage documents the conversion |
| Log-panel sizing | Let content determine panel height; hide overflow on the whole workspace; add a new responsive layout | Use a fixed 240px outer grid track and fixed 240px panel, with internal log scrolling; reduce slot gap to 6px | 240px is the existing upper bound, so this removes only content-driven growth while preserving the established visual scale | The panel is always at its readable maximum; very small windows retain scrollable slot/log regions rather than reflowing the workspace |
| Regression scope | Add a broad Electron snapshot suite; rely on manual inspection only | Add focused unit/static CSS contracts plus one live row-index smoke and one rendered-geometry check | Covers the exact failure and the layout invariant with the smallest durable test surface | Full Electron live smoke remains environment-dependent and is recorded separately |

## Assumptions, Constraints, and Dependencies

- Assumption: `rowIndex` is one-based at the validated action boundary and
  excludes the single `homePage1` promotional row, as documented in AGENTS.md.
- Assumption: The existing `remotePress(..., "ArrowDown")` behavior is the
  correct way to reveal lazy/virtualized Home rows; no new scrolling API is
  needed.
- Constraint: The target page's logical viewport remains one of the existing
  1280x720 or 1920x1080 values.
- Constraint: The user-facing log remains redacted and scrollable; only its
  layout geometry changes.
- Dependency: Live verification needs the configured managed Chromium and the
  authorized staging account. The account values remain runtime-only.
- Dependency: Graphify update writes generated files under `graphify-out/` and
  may require an escalated command on this host.
- Unresolved material questions: None. The fixed panel height is the current
  240px maximum, and the requested reduced row gap is 6px.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| A target row remains offscreen longer than the existing vertical attempt budget | Numeric selection still fails on a slow/lazy Home page | Add a unit fake that reveals the row only after Down; preserve the existing 18-attempt bound and verify on staging | Revert the focused viewport-gating change and investigate the app's focus timing without changing playback semantics |
| Fixed 240px log panel consumes too much space on a small window | Preview holders may need internal scrolling | Verify at both supported logical resolutions and retain `minmax(0,1fr)`/overflow safeguards | Restore the previous auto track only through an approved plan amendment; do not add an unplanned responsive redesign |
| CSS contract test is too permissive | A future rule can reintroduce auto growth | Assert the outer 240px track, fixed panel height bounds, internal overflow, and 6px gap together | Tighten the contract test and inspect computed geometry before accepting completion |
| Live staging account/session state changes | Smoke test may fail for account/device reasons unrelated to code | Classify login/device-limit/network failures separately from row-selection failures; never log credentials | Re-run only with an authorized account/session; do not weaken login or focus behavior |

## File Impact and Detailed Changes

### `tests/lib/content-rows.js`

**Action:** Modify

**Current role and evidence:** Owns Home/content-row discovery and remote focus;
`findHomePageRowByIndex()` and `inspectHomePageRowTarget()` are the indexed Home
row boundary.

**Exact changes:**

- Require the target candidate used by `inspectHomePageRowTarget()` to
  intersect the logical viewport. Keep `hasHomePageRows` based on laid-out
  Home rows so the fallback/error behavior remains informative.
- After direct focus, wait for the generic row scanner and then use the stable
  `homePage2_<index>_` row IDs as a titleless/lazy-render fallback before
  sending another ArrowDown.
- Keep the stable `homePage2_<zero-based-index>_` prefix and existing Down
  navigation loop. Invalidate the DOM snapshot after target focus/reveal as the
  current code does.
- Preserve named-row and `rowPosition: "last"` paths unchanged.

**Invariants and compatibility:** Numeric selection remains positional and
  independent of row titles; focus still uses the existing remote-control helper;
  row playback still returns to and advances through the selected row.

**Tests affected:** `tests/unit/content-rows.test.js`.

### `tests/lib/workflows.js`

**Action:** Modify

**Current role and evidence:** Converts the validated public one-based row index
  in `playItemsInRow()` before delegating to the content-row helper.

**Exact changes:** Extract the one-based-to-zero-based conversion into a small
  named internal helper, use it from `playItemsInRow()`, and expose only that
  helper through the existing `__internal` test surface. No runtime semantics
  change is intended.

**Invariants and compatibility:** `rowName` and `rowPosition` paths continue to
  receive `undefined`/their existing values; a valid public `rowIndex=3` reaches
  content-row selection as internal index `2`.

**Tests affected:** Add focused assertions in `tests/unit/test-case-action-runner.test.js` or the existing workflow unit surface.

### `tests/unit/content-rows.test.js`

**Action:** Modify

**Current role and evidence:** Covers indexed poster navigation and a direct
  zero-based Home-row prefix lookup, but the Home fixture currently makes the
  target immediately available and does not model an offscreen target.

**Exact changes:** Add a fake-page regression where `homePage2_2_*` is present
  but offscreen, becomes viewport-visible after an ArrowDown, and is then focused.
  Assert no direct focus is attempted before reveal, the resolved row contains
  `homePage2_2_0`, and no title-based fallback is needed. Retain coverage for
  unreachable row/poster errors.

**Invariants and compatibility:** Tests use only deterministic injected page and
  navigation dependencies; no credentials or staging data are committed.

### `tests/unit/test-case-action-runner.test.js`

**Action:** Modify

**Current role and evidence:** Covers action-handler payloads but does not assert
  the public `playItemsInRow()` normalization boundary.

**Exact changes:** Assert the named normalization helper maps `1`, `3`, and a
  missing index to the expected internal values, while the handler still passes
  the original action value into the workflow helper.

### `app/renderer/styles.css`

**Action:** Modify

**Current role and evidence:** Defines the six-slot Browser grid and lower log
  panel; the Browser preview third row is currently auto-sized.

**Exact changes:**

- Change `.browser-preview` to use an explicit `240px` third grid track.
- Set `.browser-log-panel` to `height`, `min-height`, and `max-height` of
  `240px`; retain `overflow:hidden` on the panel and scrolling on the selected
  log `<pre>`.
- Reduce `.browser-slot-grid` `gap` from `14px` to `6px`.
- Keep the 3x2 columns/rows, 16:9 slot aspect ratio, and existing header/status
  overflow rules unchanged.

### `tests/unit/renderer.test.js`

**Action:** Modify

**Current role and evidence:** Contains static renderer/CSS contracts for the
  six-slot dashboard and log panel.

**Exact changes:** Add assertions that the Browser preview has the explicit
  240px log track, the panel has fixed 240px height bounds and internal overflow,
  and the slot grid gap is 6px. Keep the existing six-slot/status/name contracts.

### `AGENTS.md`

**Action:** Modify

**Current role and evidence:** Documents numeric Home-row mapping and the Browser
  workspace invariants for future agents.

**Exact changes:** Add a concise maintenance invariant: indexed Home selection
  must not direct-focus an offscreen `homePage2_*` target; it must reveal the row
  through remote vertical navigation first. Document that the workspace log
  panel is fixed at 240px and its output scrolls internally.

### `docs/tinyworkers/20260813_202126_play-row-index-and-fixed-log-panel.md`

**Action:** Add

**Current role and evidence:** Durable Tiny-Workers plan and execution evidence
  source of truth.

**Exact changes:** Update status checkboxes, completed verification, deviations,
  and final handoff fields during execution.

### `graphify-out/*` generated graph artifacts

**Action:** Modify through `graphify update .`

**Current role and evidence:** Persistent code knowledge graph required by
  AGENTS.md and already present in the repository.

**Exact changes:** Refresh graph outputs after source changes; do not hand-edit
  generated files.

## Execution Sequence

### Step 1 — Harden indexed Home-row focus

**Objective:** Make the existing numeric row resolver wait for an offscreen
Home-row target to become viewport-reachable and make the public index boundary
explicitly testable.

**Files:** `tests/lib/content-rows.js`, `tests/lib/workflows.js`,
`tests/unit/content-rows.test.js`, `tests/unit/test-case-action-runner.test.js`.

**Implementation details:** Apply only the viewport gate and named index helper
described above. Add deterministic regression tests before changing unrelated
focus or playback behavior.

**Dependencies:** Existing remote focus/navigation and DOM snapshot helpers.

**Verification:** `node --test tests/unit/content-rows.test.js tests/unit/test-case-action-runner.test.js`; expected result: all focused tests pass, including the offscreen reveal and public index assertions.

**Exit criteria:** A fake offscreen `homePage2_2_*` row is revealed and focused
without title lookup; no existing focused-row tests regress.

**Approval gate:** Not required after plan approval.

### Step 2 — Stabilize the Browser workspace log panel

**Objective:** Prevent failed-test output from changing the Browser dashboard's
vertical structure and free a small amount of space between preview rows.

**Files:** `app/renderer/styles.css`, `tests/unit/renderer.test.js`, `AGENTS.md`.

**Implementation details:** Set the explicit 240px track/panel bounds and 6px
slot gap. Keep log content scrollable inside the existing `<pre>` and preserve
all six holders.

**Dependencies:** Existing Browser dashboard markup and renderer log handling.

**Verification:** `node --test tests/unit/renderer.test.js`; expected result:
the new geometry contracts and all existing renderer tests pass.

**Exit criteria:** Static contracts reject auto-sized log geometry; computed
layout review at 1280x720 and 1920x1080 shows unchanged panel top/height after
long log text is inserted.

**Approval gate:** Not required after plan approval.

### Step 3 — Integrated regression, live smoke, visual QA, and graph update

**Objective:** Verify the exact user failure is fixed and the workspace remains
stable, then refresh the project graph and record all evidence.

**Files:** Plan document and generated `graphify-out/*`; temporary test fixtures
may be created outside tracked source and removed after use.

**Implementation details:** Run the full unit/syntax/list/diff checks. Re-run a
bounded live login → Home → `play_row(rowIndex=3, count=1)` staging smoke using
runtime-only credentials; confirm it reaches the third positional Home row and
starts the normal playback path. Use Playwright visual geometry checks for both
supported logical resolutions with a long failed-log payload. Run `graphify
update .` after source changes.

**Dependencies:** Managed Chromium, staging availability, user-authorized test
account, and graphify executable.

**Verification:** `npm run test:unit`; syntax checks; `npx playwright test tests/run-test-case-mytv.spec.js --list`; bounded live smoke; visual geometry check; `graphify update .`; `git -c core.fsmonitor=false diff --check`.

**Exit criteria:** The exact row-not-found failure no longer occurs; the fixed
panel geometry holds under long log text; no new unit/syntax/list/diff failures;
graph outputs are current.

**Approval gate:** Not required after plan approval; live staging uses the
authorization already provided for this task.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Public row 3 maps to Home row 2 and focuses offscreen content | Unit + live | Focused Node tests; bounded staging smoke | `homePage2_2_*` is focused; no title fallback/error |
| Existing row behavior remains compatible | Regression | `npm run test:unit` | All tests pass with no new failures |
| Fixed log panel geometry | Renderer/static + visual | Renderer unit CSS contracts; Playwright geometry at 1280x720 and 1920x1080 with long log | Panel height/top and preview-grid boundary are unchanged after log growth; selected `<pre>` scrolls |
| Workspace row spacing | Renderer/static + visual | CSS contract and screenshot/geometry review | `.browser-slot-grid` gap is 6px; six holders remain in 3x2 order |
| Project graph current | Static/tooling | `graphify update .` | Update completes and generated graph reflects changed symbols |
| Code hygiene | Static | `node --check ...`; `npx playwright test ... --list`; `git -c core.fsmonitor=false diff --check` | All commands pass |

## Completed Verification

> Update this section during execution with actual results. Do not prefill claims.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 — indexed Home-row focus | `node --test tests/unit/content-rows.test.js tests/unit/test-case-action-runner.test.js` | Pass | 69 tests passed, including `reveals an offscreen numeric Home row before direct focus` and `keeps the public play_row index conversion explicit` | 2026-08-13 20:31 +07 |
| Step 2 — renderer CSS contracts | `node --test tests/unit/renderer.test.js` | Pass | 109 tests passed, including fixed 240px log track/panel, internal log overflow, and 6px slot gap assertions | 2026-08-13 20:32 +07 |
| Step 2 — rendered geometry | Playwright CLI local renderer with 500-line failed log at 1280x720 and 1920x1080 | Pass | Panel remained 240px high and viewport-anchored; selected log overflow was `auto`; grid gap was `6px`; visual screenshot showed stable six-slot 3x2 layout | 2026-08-13 20:34 +07 |
| Full unit suite | `npm run test:unit` | Pass | 689 tests passed, 0 failed | 2026-08-13 20:39 +07 |
| Syntax checks | `node --check tests/lib/content-rows.js && node --check tests/lib/workflows.js && node --check app/renderer/renderer.js && node --check app/main.js && node --check app/preload.js` | Pass | All five files parsed successfully | 2026-08-13 20:39 +07 |
| Playwright test discovery | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | One Chromium test listed | 2026-08-13 20:39 +07 |
| Diff hygiene | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors | 2026-08-13 20:39 +07 |
| Live indexed-row smoke | Bounded staging login → `open_home` → `play_row(rowIndex=3,count=1)` with runtime-only credentials | Pass | Exact row-not-found failure no longer occurred; normal row playback path completed successfully in 1.1 minutes | 2026-08-13 20:46 +07 |
| Resolution matrix — 1280x720 | Same bounded staging login → `open_home` → `play_row(rowIndex=3,count=1)` | Pass | Same action path completed successfully at the default supported logical viewport | 2026-08-13 21:05 +07 |
| Resolution matrix — 1920x1080 | Same bounded staging login → `open_home` → `play_row(rowIndex=3,count=1)` with `MYTV_TEST_RESOLUTION=1920x1080` | Pass | Same action path completed successfully at the alternate supported logical viewport | 2026-08-13 21:07 +07 |
| Resolution-matrix helper regressions | Focused content-row/action-runner/playback/navigation unit tests with `MYTV_TEST_RESOLUTION=1280x720` and `1920x1080` | Pass | 77/77 focused helper tests passed at each supported resolution setting | 2026-08-13 21:08 +07 |
| Graph refresh | `graphify update .` | Pass | AST graph rebuilt: 3054 nodes, 4716 edges, 176 communities; generated graph artifacts updated | 2026-08-13 21:10 +07 |

## Deviations and Plan Updates

- The first implementation used viewport intersection, but the live diagnostic
  showed that a poster barely intersecting the bottom edge (`y≈698`) could
  still fail direct focus. The final implementation tightened this to full
  rectangle containment and reran the live smoke successfully. This stayed
  within the approved indexed-row focus scope.
- 2026-08-13 follow-up: confirmed the same indexed flow at both supported
  resolutions and removed remaining fixed 1920/1080 fallback literals from the
  generic action runner, navigation, content-row helpers, and retained legacy
  keyboard helper. Runtime viewport dimensions now come from the page, with a
  document-client fallback, so no helper assumes one supported resolution.

### 2026-08-13 regression follow-up — cases 2287, 2288, 2290, and view-more

- Case 2287 was reproduced as a cleanup-boundary bug: playback had already
  returned to `homeNewUI`, but focus was temporarily restored to another Home
  row, so the strict original-row predicate sent additional Back presses. The
  row-return boundary now accepts a visible Home content marker when no player
  or detail overlay remains. The isolated 1280x720 case passed end-to-end.
- Cases 2288 and 2290 exposed two additional 1280x720 timing/geometry edges:
  the requested row can intersect the bottom of the viewport before it is fully
  visible, and its title/heading can still be empty after direct focus. Numeric
  Home selection now waits for lazy rendering and can anchor the row by its
  stable `homePage2_<index>_` IDs while the posters intersect the viewport.
  Case 2288 passed in isolation at 1280x720. Case 2290 reached row 8 at both
  1280x720 and 1920x1080; both runs then failed only the independent playback
  check for content 162518 (`Kẻ Vô Danh`), not row selection.
- `play_row` now checks the existing trusted
  `.view_more[item_view_more="1"]` detector before each Enter path and advances
  with remote Right without recording or activating that navigation poster.
  Added a unit regression for this behavior.
- Case 2291 was intentionally not rerun or changed because its deleted login
  session is the expected application behavior.
- Follow-up focused tests passed 21/21; the full local unit suite passed 693/693.
  Syntax, Playwright-list, and diff checks also passed. `graphify update .`
  refreshed the code graph to 3064 nodes, 4737 edges, and 173 communities.

## Handoff and Completion

- Changed files: `tests/lib/content-rows.js`, `tests/lib/workflows.js`,
  `tests/unit/content-rows.test.js`, `tests/unit/test-case-action-runner.test.js`,
  `tests/lib/test-case-action-runner.js`, `tests/lib/navigation.js`,
  `tests/lib/mytv-helpers.legacy.js`, `app/renderer/styles.css`,
  `tests/unit/renderer.test.js`, `AGENTS.md`, this plan, and generated
  `graphify-out/*` artifacts.
- Checks passed: focused tests at both resolution settings, full unit suite,
  syntax checks, Playwright list, live staging row-index smokes at
  1280x720/1920x1080, rendered 1280x720/1920x1080 geometry checks, graph
  refresh, and diff hygiene.
- Known limitations: the live smoke is intentionally bounded to one poster to
  isolate indexed-row selection; it exercises the same normal playback path,
  while the exhaustive no-count row duration remains environment-dependent.
- Follow-up work: None currently identified.
- Final acceptance status: Complete. The numeric row selection no longer falls
  back to title lookup when the stable indexed Home row is initially offscreen,
  and failed logs cannot resize or move the Browser preview slots.
