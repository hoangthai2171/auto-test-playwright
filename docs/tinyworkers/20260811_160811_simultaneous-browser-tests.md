# Configurable simultaneous Browser test execution with six-slot workspace

**Plan ID:** 20260811_simultaneous_browser_tests
**Status:** In progress
**Approval:** Approved by user on 2026-08-12
**Created:** 2026-08-11 16:08:11 +0700
**Updated:** 2026-08-12 09:23:55 +0700
**Owner:** Tiny-Planner / Tiny-PM
**Risk:** High
**Branch/worktree:** `feature/simultaneously-tests` / `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright`

## Status

- [x] Step 1: Add shared Test resolution/Simultaneous devices contracts, the configurable Browser batch scheduler, and serialized report store. *(Complete)*
- [x] Step 2: Integrate validated resolution/concurrency settings with Electron main/preload IPC, isolated artifacts, stop/close handling, and fullscreen startup. *(Complete)*
- [x] Step 3: Add the Test configuration controls and replace the single Browser preview with the six-slot dashboard and per-case Playwright log panel. *(Complete)*
- [x] Step 4: Preserve result submission, single-case interactive preview, LG behavior, and project documentation. *(Complete)*
- [ ] Step 5: Run regression, static, graph, and approved live Electron verification.

## Goal

### Problem

The Electron Browser runner is serial and owns only one child process, preview
watcher, completion promise, and runner log at a time. Its preview, Playwright
HTML report, result sidecar, and test-results paths are shared. Starting several
cases concurrently without changing these ownership and path contracts would
mix events, overwrite artifacts, race compact-report writes, and make Stop kill
an arbitrary process.

The workspace also has only one large Browser preview and keeps Playwright
output inside the application Logs modal, so it cannot display or select among
six active cases as shown in the supplied 1920x1080 design reference. Browser
execution additionally hardcodes a 1920x1080 viewport and the initial plan
hardcoded six concurrent processes instead of exposing the requested Test
configuration choices.

### Desired outcome

The Browser target runs selected cases through a main-process queue whose active
limit is selected under Test configuration as `1 device`, `2 devices`,
`4 devices`, or `6 devices` (default `6 devices`). The first configured number
of cases start immediately; whenever an active slot finishes, it takes the next
case in original table order. The six-slot workspace remains the fixed maximum-
capacity dashboard: slots above the configured active limit stay `Idle`.

Test configuration also offers a `Test resolution` radio group with
`1280x720` (default) and `1920x1080`. The selected value is validated, persisted,
snapshotted at batch start, and applied to every Playwright browser/context in
that batch rather than relying on a hardcoded viewport. Both choices are 16:9,
so each smaller Electron holder continues to preserve the selected browser
surface's aspect ratio.

Each assigned slot shows the case's live preview and status. Clicking a preview
tile or its testcase table row selects that case's retained, redacted Playwright
log in the workspace panel below the grid. The Electron GUI opens fullscreen.

Every assigned slot header shows the testcase ID in full, the testcase name in
the remaining space with CSS ellipsis when needed, and the status in full. The
status is displayed on a white label whose text color changes semantically with
the testcase state.

Each case remains an isolated Playwright process with one worker and the batch's
selected logical viewport. LG remains a separately confirmed serial real-device
workflow; the two new controls affect Browser runs only.

### Acceptance criteria

- [ ] Test configuration contains a `Test resolution` radio group with exactly `1280x720` and `1920x1080`; `1280x720` is selected when no valid saved value exists.
- [ ] Test configuration contains a `Simultaneous devices` select with exactly `1 device`, `2 devices`, `4 devices`, and `6 devices`; `6 devices` is selected when no valid saved value exists.
- [ ] Both settings use shared allowlist validation in renderer and main. Missing/invalid persisted values migrate to their defaults, invalid runtime input cannot create an arbitrary viewport or concurrency, and saving/restoring the settings preserves the canonical values.
- [ ] A Browser batch snapshots the normalized settings at start. Every child in that batch receives the same selected resolution, and later setting changes apply only to the next batch.
- [ ] The selected Test resolution controls Playwright's context viewport, Chromium window size, screenshot/live-preview surface, interactive CDP device metrics, and Interactive BrowserView scaling. No Electron Browser run retains a hardcoded 1920x1080 execution viewport.
- [ ] A Browser batch starts at most the selected simultaneous-device count, and never more than six, Playwright child processes at once.
- [ ] Queue order is deterministic for every allowed limit: the first `N` selected IDs occupy slots 1 through `N` in table order, where `N` is the normalized simultaneous-device value, and later IDs are assigned in table order to the next freed active slot. Dashboard slots `N+1` through 6 remain `Idle`.
- [ ] A case failure or launch failure releases only its own slot and does not prevent other active or queued cases from continuing.
- [ ] Every Browser case has unique preview, case-result, test-results, and Playwright HTML-report paths under an opaque batch directory; simultaneous cases cannot overwrite one another.
- [ ] `playwright.config.js` remains `workers: 1`. Its viewport/window-size defaults resolve to 1280x720 and accept only the two configured resolutions; only the Electron preview holder scales the selected logical browser surface down.
- [ ] The Browser workspace renders six persistent 16:9 holders in a 3x2 fullscreen grid. Empty holders show `Idle`; assigned cases support `Running`, `Passed`, `Failed`, and `Stopped`, with queued/skipped state retained in the testcase table where applicable.
- [ ] Every assigned preview-slot header shows the testcase ID, name, and status. The ID and status are never truncated; only the name may shrink and use `overflow: hidden`, `white-space: nowrap`, and `text-overflow: ellipsis` when it exceeds the available width.
- [ ] Every preview-slot status uses a white background and fully visible text. Its text color reflects the exact state: Running amber, Passed green, Failed red, Stopped neutral gray, and Idle muted gray; queued/skipped colors remain table-only unless those states are later assigned to a slot.
- [ ] Live preview frames are routed by batch ID, case ID, and slot ID. A frame from one case never replaces another case's image, and a recycled slot clears the previous case's frame before showing the next assignment.
- [ ] Clicking a slot or testcase row selects that case. The lower workspace panel shows only that case's redacted Playwright output, keeps logs available after a slot is recycled, and does not mix chunks from concurrent cases.
- [ ] Per-case log buffers are bounded and show an explicit truncation marker if the oldest output is discarded; application/API logs remain available in the existing Logs modal.
- [ ] Stop is idempotent: it prevents new queue assignments, terminates every owned active Browser child, marks active cases `Stopped`, leaves never-started cases skipped, and allows a fresh later batch to start normally.
- [ ] Window-close stopping waits for the Browser batch to drain its owned children and preserves the existing one-way `request-stop-run` behavior without an IPC feedback loop.
- [ ] The compact user report contains every completed Browser case exactly once in original selection order even when cases finish out of order. Concurrent completions cannot lose report entries.
- [ ] Existing flow-case result behavior is preserved: one batch submission occurs only after scheduling has settled; on manual stop, only cases that fully completed before the stop are eligible, and stopped/unstarted/launch-failed cases are excluded.
- [ ] `Live` and `None` preview modes work for multi-case Browser batches. Existing interactive CDP/BrowserView preview remains available for exactly one selected Browser case; selecting multiple cases in Interactive mode is rejected with a clear instruction to use Live or None.
- [ ] LG selection, confirmation, preview, recovery, report, and result-submission contracts remain serial and unchanged.
- [ ] The BrowserWindow is created fullscreen while retaining delayed first-paint reveal and current minimum-size safeguards.
- [ ] Structured renderer events and logs expose no login password, service token, private cache contents, or unmanaged filesystem paths beyond the existing safe report-opening contract.

### Non-goals

- Do not change `playwright.config.js` to use multiple workers or redesign the legacy terminal suite's shared-session ownership.
- Do not run LG cases concurrently, add multiple LG slots, or resume paused LG compatibility work.
- Do not create six interactive BrowserViews or six CDP-controlled Electron pages; multi-case previews are observation-only live frames.
- Do not change testcase action schemas, TV remote/virtual-keyboard behavior, APP_URL, API endpoints, result payload shape, or test semantics.
- Do not allow custom resolution dimensions or arbitrary concurrency values; the two resolution values and four simultaneous-device values are fixed allowlists.
- Do not make Test resolution or Simultaneous devices affect LG runs, LG Appium screenshots, or LG device selection.
- Do not add dependencies, deploy builds, publish reports, or run destructive scripts under `bash-script/`.
- Do not fix unrelated current renderer-label test failures except where an assertion must be replaced because this approved UI contract deliberately changes it.

## Current State and Findings

- Electron main owns one global `runningProcess`, one `previewWatcher`, and one `interactiveView`; `stopActiveTest()` kills only that process and clears only that watcher — evidence: `app/main.js:66-76`, `app/main.js:131-140`.
- The `run-test` IPC rejects a second run whenever `runningProcess` is set, and it spawns one generic Playwright process — evidence: `app/main.js:778-787`, `app/main.js:866-916` (`ipcMain.handle("run-test")`).
- All Browser cases currently share `<userData>/playwright-report`, `<userData>/test-results`, and `<userData>/browser-preview/current.png`; only the case-result filename contains a case ID — evidence: `app/main.js:788-823`, `app/main.js:826-842`.
- Playwright stdout and stderr are credential-redacted but sent on unkeyed `test-log`; live preview and finish events are also unkeyed, so the renderer can associate them only with its single active completion — evidence: `app/main.js:872-914`, `app/preload.js:51-54`.
- `finishTestProcess()` reads and rewrites the shared compact report without serialization. Parallel executions of that code could read the same old JSON and lose one completion — evidence: `app/main.js:919-962`.
- The renderer has one `activeCompletion`, one `activeRunnerLog`, one Browser preview image, and one active case ID — evidence: `app/renderer/renderer.js:235-255`, `app/renderer/renderer.js:2104-2161`.
- `runSelectedCases()` uses a `for ... of` loop and awaits `runSingleCase()` before moving to the next ID, which is the current serial behavior — evidence: `app/renderer/renderer.js:2164-2209`.
- The current preview markup is one stage with one image/BrowserView boundary, and CSS scales it with `object-fit: contain` — evidence: `app/renderer/index.html:153-165`, `app/renderer/styles.css:857-904`.
- Playwright runner output is appended to the same Logs-modal DOM used for API/application logs — evidence: `app/renderer/renderer.js:423-477`, `app/renderer/index.html:236-247`.
- The generic Playwright fixture creates a new Browser context per desktop child, holds the page at `VIEWPORT = {width: 1920, height: 1080}`, and writes preview screenshots atomically to `MYTV_PREVIEW_PATH` — evidence: `tests/fixtures/mytv-session-fixture.js:7-31`, `tests/fixtures/mytv-session-fixture.js:63-99`.
- `playwright.config.js` separately hardcodes both the viewport and Chromium `--window-size` to 1920x1080, while `app/main.js:setInteractiveViewBounds()` separately assumes the same dimensions. All three boundaries must resolve one validated selection to prevent context/window/Interactive preview mismatch — evidence: `playwright.config.js:3-4`, `playwright.config.js:19-32`, `app/main.js:setInteractiveViewBounds`.
- Project configuration deliberately keeps `workers: 1`; concurrency must therefore be implemented as separately owned single-case processes — evidence: `playwright.config.js:3-10`, `AGENTS.md` section `Shared browser session`.
- Test configuration currently contains only testcase maximum time and player-check timeout controls. `app/test-configuration.js` owns their defaults/normalizers; renderer localStorage loads and canonicalizes them, `set-test-configuration` synchronizes them through preload to main, and each Browser run passes them to child environment variables — evidence: `app/renderer/index.html` panel `[data-settings-content="test-configuration"]`, `app/test-configuration.js`, `app/renderer/renderer.js:DEFAULT_SETTINGS`, `app/renderer/renderer.js:loadSettings`, `app/renderer/renderer.js:syncTestConfiguration`, `app/preload.js:setTestConfiguration`, `app/main.js` handler `set-test-configuration`.
- Current Test configuration unit/renderer/preload tests cover normalizer fallbacks, localStorage save/restore, main synchronization failure, and the narrow IPC payload. They need additive resolution/concurrency coverage rather than a separate persistence subsystem — evidence: `tests/unit/test-configuration.test.js`, `tests/unit/renderer.test.js` test `saves and sanitizes Test configuration timeouts with an auto-hide success toast`, `tests/unit/preload.test.js` test `exposes the test configuration synchronization call`.
- Current renderer tests already define business-failure continuation, stop/restart, skipped queued cases, all-results submission, and completed-before-stop submission behavior. These tests must be migrated to batch events rather than discarded — evidence: `tests/unit/renderer.test.js` tests around lines 1447-1632 and 1694-1793.
- The supplied reference is a 1920x1080 fullscreen layout with a 460px sidebar, six preview holders in a 3x2 grid, status text in each holder, and a full-width log panel beneath the grid — evidence: `/Users/thainguyen/Desktop/Screenshot 2026-08-11 at 15.34.27.png`.
- The user refined the slot header contract after the initial plan: each assigned holder must display full testcase ID and full status, truncate only an overlong testcase name with ellipsis, and render the semantic status text on a white background.
- `README.md` still documents sequential execution, one ID per main-process call, and one shared Playwright report directory — evidence: `README.md:112-139`, `README.md:401-415`.
- Worktree baseline: `git status --short --branch` reported `feature/simultaneously-tests...origin/feature/simultaneously-tests` with no changed files. Git emitted a pre-existing fsmonitor IPC warning but returned the branch state.
- Recent history baseline: branch HEAD is `3089789` (`add clear logs button`), equal to `origin/main` and `origin/feature/simultaneously-tests` at discovery time.
- AgentMemory recall found the current resolution/concurrency request and earlier concurrent-run discovery, but no durable implementation decision beyond this plan; current code remains authoritative.
- Graphify query connected Test configuration, `renderer.js`, `app/test-configuration.js`, `app/main.js`, `playwright.config.js`, and `mytv-session-fixture.js`. The traversal was broad, so the exact persistence, IPC, viewport, and BrowserView boundaries above were verified directly against source.
- Baseline `node --check app/main.js`, `node --check app/preload.js`, and `node --check app/renderer/renderer.js` passed.
- Baseline `npx playwright test tests/run-test-case-mytv.spec.js --list` passed and listed one generic Chromium test.
- Baseline `git diff --check` passed, with the same fsmonitor warning.
- Baseline `npm run test:unit` failed only in `tests/unit/renderer.test.js`. A focused dot-reporter run recorded two pre-existing failures: `renders test cases as selectable table rows with a disabled empty batch action` expects `Run Selected (0)` but receives an empty mock label; `index markup contains the case browser and no API-key or mode controls` expects `Chiến dịch` while current markup contains `Campaigns`. All other renderer tests in that run passed.
- Live Electron/staging execution was not run during planning because it needs configured Chromium, valid sensitive testcase accounts, and an explicit live-test approval boundary.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Concurrency owner | Renderer-side `Promise` pool calling `run-test` repeatedly; Playwright workers; main-process batch coordinator | Add a main-only Browser batch runner with a validated per-batch limit | Main already owns child processes, filesystem paths, redaction, Stop, and close handling. Central ownership avoids global-state races and keeps credentials/cache resolution out of the renderer | Renderer sends one narrow selected-ID batch plus normalized settings and consumes keyed events |
| Playwright concurrency model | Set Playwright `workers` dynamically; one process per case | Keep one worker per process and run up to the selected 1/2/4/6 process limit | Preserves the intentional shared-context rule inside every process and isolates case credentials/sessions/artifacts | CPU and memory scale with the selected limit, which is snapshotted per batch and capped at six |
| Queue algorithm | `Promise.all` over all cases; arbitrary semaphore; fixed six worker loops | Create `N` stable slot loops from the normalized simultaneous-device value, where `N ∈ {1,2,4,6}`, drawing from one ordered queue | Directly models the active dashboard holders and makes slot reuse deterministic | Slots above `N` remain Idle; active slot IDs remain stable while assigned cases change |
| Test-setting contract | Duplicate renderer checks; trust localStorage; accept arbitrary numeric dimensions/counts | Add shared allowlist constants and normalizers in `app/test-configuration.js`, validate again in main, and persist canonical strings | One browser-safe contract prevents unsupported resolutions, excessive processes, and renderer/main drift | Missing/invalid saved values become 1280x720 and 6; a valid batch snapshots both settings |
| IPC shape | Four parallel channels for start/log/preview/finish; renderer polling; one structured event channel | Add `run-browser-batch` plus removable `browser-batch-event` subscription carrying `{batchId, type, caseId?, slotId?, ...safePayload}` | A single discriminated envelope prevents cross-case ambiguity and is easy to validate/test | Legacy unkeyed Browser run events can be retired after renderer/preload migration; LG channels remain unchanged |
| Artifact isolation | Keep shared paths; add only case ID; isolate by slot; isolate by batch and case | Use `<userData>/browser-runs/<batchId>/<slot>-<safeCaseId>/...` for preview/result/test-results/debug report | Batch and case isolation prevents stale/colliding files even when IDs repeat in later batches | Debug reports become per-case directories; compact report remains the stable user report |
| Compact report concurrency | Concurrent read-modify-write; write once only at batch end; in-memory ordered store with serialized atomic writes | Add a report store initialized with selected order and serialize each completion through one write chain | Preserves incremental report availability without lost updates and keeps deterministic ordering | Browser runner uses the store; LG can keep its serial writer in this milestone |
| Preview transport | Six BrowserViews; iframe/webview embedding; existing screenshot stream | Keep the existing atomic screenshot producer and create one keyed watcher per active live case | Meets the observation-only six-preview requirement without mixing CDP contexts | Up to the configured 1/2/4/6 live previews are best-effort and resource bounded; `None` remains available |
| Interactive preview compatibility | Remove Interactive; coerce silently to Live; support only one case | Preserve Interactive for exactly one Browser case and fail validation for multi-case Interactive | Avoids silently changing saved settings and avoids an unsafe shared-CDP page-selection race | User sees a clear message to choose Live or None before a concurrent batch |
| Workspace layout | Responsive auto-fit grid; show only active tiles; fixed 3x2 holders | Always render six 16:9 tiles in a 3-column by 2-row Browser dashboard, with the log panel below | Matches the supplied fullscreen reference and makes slot identity stable | Empty slots remain visible as `Idle`; fullscreen is the primary supported layout |
| Slot header anatomy | Overlay all text on the preview; truncate the whole header; reserve independent identity/name/status regions | Use a three-part header with non-shrinking ID, flexible ellipsized name, and non-shrinking white status badge | Guarantees ID and status remain readable while long names cannot push either value out of view | CSS must set the name region to `min-width: 0` and ellipsis; tests assert only the name can truncate |
| Status visual language | Colored tile border; colored status background; white status background with semantic text | Use a white status badge and map state to text color | Implements the user's explicit refinement while retaining a dark preview surface and accessible contrast | Running amber, Passed green, Failed red, Stopped neutral gray, and Idle muted gray are centralized renderer/CSS states |
| Browser resolution | Keep 1920x1080; allow free-form width/height; two-value radio allowlist | Use canonical `1280x720`/`1920x1080` values from shared configuration, default 1280x720, and resolve `{width,height}` at config/fixture/main boundaries | Implements the exact product choice without letting saved or renderer input inject unsupported dimensions | The selected viewport can change TV focus/carousel geometry; both modes require regression and staging coverage |
| Preview scaling | Resize screenshots in the runner; CSS holder scaling; resolution-aware 16:9 scaling | Keep screenshots at the selected logical viewport and use `aspect-ratio: 16 / 9` plus `object-fit: contain` in smaller holders | Both allowed resolutions are 16:9 and no image resampling dependency is needed | Preview pixels are observation-only; BrowserView metrics/bounds must use the same selected dimensions |
| Case log ownership | Continue one Logs-modal runner entry; one DOM entry per chunk; per-case string buffers | Keep a bounded redacted string buffer per case and render only the selected buffer in a workspace `<pre>` | Prevents interleaving, supports slot reuse, and avoids thousands of DOM nodes | Oldest output is truncated with a visible marker at the documented cap; app/API Logs modal stays separate |
| Case selection for logs | Preview tile only; table only; both | Tile click and non-control table-row click both set `activeLogCaseId`; checkbox and Detail actions stop propagation | Completed cases displaced from a reused slot must still be selectable | Selection has a distinct visual state and does not alter checked run selection |
| Stop semantics | Kill whichever process is global; stop only one slot; stop all owned active children | Batch `requestStop()` freezes queue assignment, terminates all active owned children, awaits completion, and classifies active vs never-started cases | Matches the single Stop control and close guard while preventing orphaned queue work | Active tiles show `Stopped`; never-started table rows remain `Skipped`; fresh batch state is independent |
| Result ordering | Completion order; event order; original selected order | Store results by ID and return/submit them in original selected order | Makes report/API behavior deterministic when completion order varies | Result submission remains one post-batch operation |
| Fullscreen startup | Maximize; call fullscreen from renderer; BrowserWindow fullscreen option | Set the main-process BrowserWindow `fullscreen: true` while retaining `show: false` and first-paint reveal | Fullscreen is owned by Electron and applied before user interaction | Users may still leave fullscreen with OS controls; every new window opens fullscreen |
| Mid-run settings changes | Reconfigure active children; reject Save; snapshot settings | Snapshot normalized resolution and simultaneous-device count when the batch starts; saved changes affect the next batch | Playwright context size and queue ownership cannot be safely changed for already running children | Settings can still be saved while running, but the active batch reports and retains its original snapshot |
| Dependencies | Add a queue/process library or image library; use Node/Electron primitives | Add no dependency | A bounded configurable worker pool, child ownership, timers, maps, and atomic file replacement are simple with existing primitives | New behavior remains unit-testable with injected fakes |

## Assumptions, Constraints, and Dependencies

- Decision: `Simultaneous devices` is a Browser-only maximum-concurrency setting with canonical numeric values `1`, `2`, `4`, and `6`; its missing/invalid-value default is `6`.
- Decision: `Test resolution` is a Browser-only setting with canonical string values `1280x720` and `1920x1080`; its missing/invalid-value default is `1280x720`.
- Decision: The six preview holders represent maximum capacity, not six mandatory active processes. A lower simultaneous-device selection activates only the first `N` slots and leaves the remaining holders Idle.
- Decision: Both settings are snapshotted per batch. Saving different values during a run does not resize running pages or alter the active queue; it affects the next Browser batch.
- Assumption: The reference's six red rectangles are persistent slot holders; a passed/failed case remains visible in its slot until that slot is reused.
- Assumption: "click on a test case" includes clicking either its preview tile or its testcase table row. Checkbox and Detail interactions retain their existing meanings.
- Decision: Slot statuses use a white background with semantic text colors: Running amber, Passed green, Failed red, Stopped neutral gray, and Idle muted gray. The status text and testcase ID never truncate.
- Decision: The testcase name owns the only flexible header region and uses `min-width: 0`, `overflow: hidden`, `white-space: nowrap`, and `text-overflow: ellipsis`.
- Assumption: Application/API Logs remain useful and stay behind the header Logs button; the new lower panel is Playwright output only.
- Constraint: Do not change the generic spec, action execution, remote focus, virtual keyboard, or `workers: 1` contract. The only supported viewport change is selecting one of the two requested 16:9 resolutions through the shared configuration contract.
- Constraint: Renderer/localStorage values are never authoritative at the execution boundary; main re-normalizes both values before constructing scheduler capacity, child environment, or Interactive bounds.
- Constraint: Renderer input remains a narrow list of selected IDs, source cache key/folder ID, preview choice, and sanitized timeout values. Main resolves cases and paths.
- Constraint: All stdout/stderr passes through `createLogRedactor` before any event or retained renderer buffer.
- Constraint: The batch runner owns only processes it spawned and never uses broad process-name termination.
- Constraint: The result-submission payload and unsynced retry mechanism remain renderer-owned and structurally unchanged.
- Constraint: LG remains single-device, confirmed, main-only, and serial. No Browser change may weaken its preflight or safe IPC filters.
- Dependency: Managed Chromium must resolve once before a Browser batch starts.
- Dependency: Electron user-data storage must permit creation of batch-scoped artifact directories and atomic report replacement.
- Dependency: Live validation needs suitable cases/accounts for concurrency 1, 2, 4, and 6 and both resolutions. Shared credentials may trigger MyTV device/session limits and should be treated as test-data behavior, not scheduler failure.
- Authorization: Tiny-PM's minor-task authorization question is awaiting the user's answer. It does not affect planning and does not authorize this major implementation.
- Unresolved material questions: None. Approval of this plan accepts the 1280x720 default, the 1/2/4/6 configurable Browser concurrency with default 6, the fixed six-holder 3x2 fullscreen layout, and the explicit single-selected-case-only Interactive decision; requested revisions require a plan update before execution.

## Design Review Prototype

- Review location: `/Users/thainguyen/.codex/visualizations/2026/08/11/019ff00e-7ae6-77f2-b9f7-8ebfe3d1f219/six-slot-browser-workspace.html`.
- Purpose: provide a standalone, fake-data workspace preview for layout and
  interaction review before production implementation begins.
- Included states: six assigned slots, mixed Running/Passed/Failed/Stopped
  statuses, long-name ellipsis, more-than-six selected cases represented as a
  queue, and selectable per-case Playwright logs.
- Scope note: the prototype represents the default 6-device workspace at the
  reference display size; it does not open or model the Settings modal. The
  production plan now includes the two new Test configuration controls.
- Interaction: clicking a preview slot or testcase table row updates the lower
  selected-case log panel without changing checkbox selection.
- Review validation: the standalone renderer and a 1920x1080 Chromium check
  confirmed exactly six slots, a 1.77785 preview ratio, full ID/status text,
  long-name ellipsis, white status background, no page errors, and a successful
  queued-row click switching the selected Playwright log.
- Boundary: this review prototype does not import project code, alter runtime
  behavior, or authorize Tiny-Executor. Requested visual changes must update
  this plan when they affect the production acceptance criteria.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| High configured concurrency exhausts CPU/memory | Slow previews, timeouts, or OS pressure at 4/6 devices | Hard cap at six; allow 1/2/4/6 selection; coalesce each watcher so reads cannot overlap; send only changed frames; keep `None` mode; run an approved six-case smoke | Stop the batch and select a lower Simultaneous devices value for the next run; revert batch integration to serial behavior if ownership is faulty |
| 1280x720 changes TV layout/focus assumptions | Existing navigation selectors, carousel positions, or player checks behave differently from 1920x1080 | Apply one resolution consistently to config, context, CDP metrics, screenshots, and BrowserView; add both-resolution contract and staging smoke coverage | Select 1920x1080 for affected runs while diagnosing; revert the default only through an approved plan amendment |
| Invalid/stale settings bypass the product limits | Arbitrary viewport, more than six processes, or renderer/main mismatch | Shared allowlist normalizers, canonical persistence, main-side revalidation, batch snapshot, and negative unit tests | Reject or fall back to the last valid/default value before launching any child; never coerce to an unlisted value |
| Cases reuse one MyTV account | Device-limit popups, logout/session interference, genuine test failures | Keep browser contexts/processes isolated; document distinct-account preference; do not serialize accounts invisibly | Re-run with separate testcase credentials or fewer selected cases; scheduler code remains unchanged |
| A child exits while Stop is racing | Double finish events, wrong status, leaked slot | Per-case finish-once guard, idempotent Stop, owned-process map, and tests for error/exit/stop races | Force cleanup of the tracked child and mark only that case failed/stopped; revert runner module if lifecycle tests fail |
| Child browser descendants survive parent termination | Resource leak after Stop/close | Reuse the established owned-process-group pattern from `app/appium-server-manager.js`: detached group on non-Windows, exact PID on Windows, bounded TERM-to-KILL escalation, and packaged-target smoke tests | Close the app and terminate only the specifically recorded child if necessary; do not add process-name `taskkill`/`pkill` behavior without a plan amendment |
| Concurrent report writes lose entries or reorder tests | Incomplete/misleading user report | One in-memory ordered report plus serialized atomic writes; concurrency unit test resolves cases out of order | Rebuild the compact report from retained case sidecars; revert to end-of-batch write if incremental store is faulty |
| Stale preview/log events update a new batch | Wrong case image/log displayed | Require active batch ID and current case-slot assignment match before rendering; unsubscribe on unload | Clear dashboard state and ignore the stale batch; new batch uses a new opaque ID |
| Slot reuse hides old case output | User cannot inspect completed case | Retain logs/status by case ID and make testcase rows selectable after tile reuse | Open the per-case debug report directory; do not discard buffers until a new batch/source load |
| Multi-case Interactive mode attaches to the wrong page | Tests control another case or preview mixes sessions | Reject multi-case Interactive before any process starts; unit-test validation | Switch setting to Live or None; single-case Interactive remains available |
| Fullscreen layout is unreadable on smaller displays | Tiles/log panel become too small | Preserve 16:9 holders, minimum dimensions, overflow-safe log panel, and fullscreen smoke at 1920x1080 plus one smaller supported display | Exit fullscreen and use OS scaling; revise responsive breakpoints under an approved UI amendment |
| Structured logs expose credentials | Security/privacy incident | Reuse streaming redactor before event dispatch; never emit raw case objects/env; add split-chunk secret tests | Stop the batch, clear UI buffers, and revert event changes; sensitive reports remain local per existing policy |
| Existing red unit baseline masks new failures | False completion claim | Record the two exact pre-existing assertions; require new focused suites and no additional full-suite failures | Classify failures by test name/diff and stop if new failures appear |

## File Impact and Detailed Changes

### `app/test-configuration.js`

**Action:** Modify

**Current role and evidence:** Shared CommonJS/browser-safe constants and
normalizers currently cover only player-check timeout and testcase maximum time.

**Exact changes:**

- Add immutable resolution options for `1280x720` and `1920x1080`,
  `DEFAULT_TEST_RESOLUTION = "1280x720"`, `normalizeTestResolution()`, and
  `resolveTestViewport()` to return a canonical string and frozen
  `{width, height}` object respectively.
- Add immutable simultaneous-device options `[1, 2, 4, 6]`,
  `DEFAULT_SIMULTANEOUS_DEVICES = 6`, and
  `normalizeSimultaneousDevices()`; accept persisted string or numeric forms but
  return the canonical numeric value.
- Preserve the existing browser-global/CommonJS export pattern so renderer,
  Electron main, Playwright config, and the fixture share one contract.
- Fail closed to an explicitly supplied valid fallback or the documented
  default; never parse arbitrary `WIDTHxHEIGHT` strings or clamp arbitrary
  concurrency numbers into the allowlist.

**Invariants and compatibility:** Existing timeout constants/normalizers keep
their exact behavior. The module stays dependency-free and safe to load through
`<script>` in the context-isolated renderer.

**Tests affected:** Modify `tests/unit/test-configuration.test.js`.

### `tests/unit/test-configuration.test.js`

**Action:** Modify

**Current role and evidence:** Covers defaults and invalid-value fallback for
the two current numeric timeout settings.

**Exact changes:**

- Assert exact resolution and simultaneous-device allowlists and defaults.
- Cover valid string/numeric forms, missing values, malformed resolutions,
  unsupported dimensions, fractions, zero/negative counts, counts above six,
  and valid/invalid fallback behavior.
- Assert resolution objects are exactly 1280x720 or 1920x1080 and cannot be
  mutated through exported references.

### `app/browser-batch-runner.js`

**Action:** Add

**Current role and evidence:** No Browser batch owner exists; process lifecycle is
embedded as singleton state in `app/main.js:778-962`.

**Exact changes:**

- Export `MAX_CONCURRENT_BROWSER_CASES = 6` as a defense-in-depth ceiling and a
  dependency-injected `createBrowserBatchRunner()` suitable for pure Node tests.
- Accept a main-normalized `concurrency` value from the 1/2/4/6 allowlist for
  each batch; independently reject any value outside the allowlist/ceiling.
- Accept an already validated ordered case list and batch-scoped launch factory;
  reject a second active batch.
- Create `concurrency` stable slot loops. Each loop claims the next queue index
  only after its current case reaches a finish-once terminal state. Slot IDs
  stay within 1-6 so renderer holders above the configured count remain Idle.
- Track active child, watcher, redactors, case metadata, and stop state by case
  and slot. Continue queue processing after pass, business failure, spawn error,
  or missing sidecar unless Stop has frozen the queue.
- Emit safe structured lifecycle events: batch start, queued, case assignment,
  log chunk, preview frame/clear, case terminal status, stop requested, and batch
  completion. The batch-start event carries the normalized resolution and active
  limit; every case event carries `batchId`, `caseId`, and `slotId`.
- Bound watcher work with a busy flag and mtime check. Clear only the watcher
  owned by the finishing case.
- Implement idempotent `requestStop()` that prevents new claims, terminates every
  active owned child, awaits their finish paths, and classifies active and
  never-started cases separately. Follow the repository's owned-process pattern:
  spawn detached on non-Windows hosts, address only that child's process group
  (`-pid`) on non-Windows or its exact PID on Windows, send `SIGTERM`, wait an
  injected bounded interval, and send `SIGKILL` only if the owned child has not
  exited. Never terminate by executable/process name.
- Return `caseRuns` in input order, independently of completion order.

**Invariants and compatibility:** It does not load raw cases, know Electron,
submit API results, change Playwright workers, or emit unredacted output.

**Tests affected:** Add `tests/unit/browser-batch-runner.test.js`.

### `app/test-report-store.js`

**Action:** Add

**Current role and evidence:** Browser completion currently performs concurrent-
unsafe shared report read/modify/write in `finishTestProcess()`.

**Exact changes:**

- Export a dependency-injected ordered report store initialized with the batch's
  selected ID order and the existing `createEmptyReport`,
  `buildTestReportEntry`, `upsertTestReport`, and `renderUserReport` functions.
- Keep report state in memory, serialize updates through one promise chain, sort
  present entries by original selection order, and atomically replace JSON and
  HTML files.
- Expose `reset()`, `recordCaseCompletion()`, and `flush()`; surface write errors
  to the batch result without dropping other case lifecycle events.

**Invariants and compatibility:** Compact report schema and HTML details remain
unchanged. LG may retain its existing serial writer in this milestone.

**Tests affected:** Add `tests/unit/test-report-store.test.js`; existing
`tests/unit/test-report.test.js` remains regression coverage.

### `app/main.js`

**Action:** Modify

**Current role and evidence:** Owns BrowserWindow creation, singleton Browser
process/watcher state, run/stop IPC, case source validation, child env, report
writes, BrowserView, and close guarding.

**Exact changes:**

- Replace `runningProcess` and `previewWatcher` with one active Browser batch
  runner/controller. Update the close guard's `isRunning` and `stopActiveTest()`
  to request/await all owned Browser children while retaining LG stop behavior
  and the one-way renderer stop notification.
- Extend main's Test configuration state and `set-test-configuration` handler
  with normalized `TEST_RESOLUTION` and `SIMULTANEOUS_DEVICES`. Initialize them
  from shared defaults (1280x720 and 6) and return canonical values with the two
  existing timeout fields: resolution as `"1280x720"`/`"1920x1080"` and the
  simultaneous-device select value as string `"1"`/`"2"`/`"4"`/`"6"`, while
  main passes the normalizer's numeric value to the scheduler.
- Replace `run-test` with `run-browser-batch`. Normalize/deduplicate selected IDs
  in table order, resolve the cache/local source once, validate every ID before
  launch, prepare managed Chromium once, reject an active Browser batch, and
  reject multi-case Interactive mode before spawning.
- Re-normalize the request's resolution and simultaneous-device values in main,
  snapshot them for the batch, and pass the normalized device count to the
  scheduler. Never derive worker count from selected-case count alone or trust
  arbitrary renderer/localStorage values.
- Generate an opaque `batchId` and safe per-case run roots. Build each child env
  with unique `PLAYWRIGHT_HTML_REPORT`, `MYTV_CASE_RESULT_PATH`,
  `MYTV_PREVIEW_PATH`, and `--output` directory while keeping APP_URL, managed
  browsers, timeouts, and cache contract unchanged. Add the canonical
  `MYTV_TEST_RESOLUTION` to every child so Playwright config and fixture resolve
  the same viewport/window dimensions.
- Route batch events to `event.sender.send("browser-batch-event", safeEvent)`.
  Feed stdout/stderr through `createLogRedactor`; send only safe IDs/status,
  redacted chunks, image data URLs, and current safe completion result.
- Use the ordered report store for Browser completions and expose per-case debug
  report paths in the safe completion response. Preserve the stable compact
  report opening/folder paths.
- Keep the current BrowserView/CDP handlers for one Interactive case. The
  renderer supplies the first slot's bounds; multi-case runs never receive the
  shared CDP URL. Replace `setInteractiveViewBounds()` hardcoded logical size
  with the active batch's resolved viewport, and ensure
  `MYTV_INTERACTIVE_VIEW_SCALE` is derived from that same width/height.
- Create `BrowserWindow` with `fullscreen: true` while preserving `show: false`,
  `revealWindowOnFirstPaint`, minimum dimensions, and security preferences.
- Remove obsolete singleton finish/watcher helpers after the new runner owns
  those lifecycles; do not change LG handlers or device secrets.

**Invariants and compatibility:** Main remains the only boundary that resolves
raw cases, filesystem paths, managed Chromium, and credentials. No raw action
credentials are returned to renderer.

**Tests affected:** New runner/report-store tests plus test-configuration,
preload, renderer, and main contract assertions; existing close-guard and
window-startup tests remain required.

### `app/preload.js`

**Action:** Modify

**Current role and evidence:** Exposes singleton `runTest` and unkeyed Browser
start/log/preview/finish listeners.

**Exact changes:**

- Expose `runBrowserBatch(request)` over `run-browser-batch` and one removable
  `onBrowserBatchEvent(callback)` subscription over `browser-batch-event`.
- Preserve `setTestConfiguration(configuration)` as the narrow synchronization
  call and extend its tested payload with canonical `TEST_RESOLUTION` and
  `SIMULTANEOUS_DEVICES`; do not expose raw dimensions or process controls.
- Keep `stopTest`, run-active, unsynced-result, report, settings, and single-case
  interactive BrowserView calls.
- Remove legacy unkeyed Browser listeners after renderer migration. Preserve all
  LG and toolchain APIs/subscriptions.

**Invariants and compatibility:** The preload remains context-isolated and does
not expose Node primitives, raw Electron events, paths, or secrets.

**Tests affected:** Modify `tests/unit/preload.test.js`.

### `app/renderer/index.html`

**Action:** Modify

**Current role and evidence:** Contains one Browser preview stage and the existing
LG preview elements.

**Exact changes:**

- In `[data-settings-content="test-configuration"]`, add a `Test resolution`
  fieldset with radios named `TEST_RESOLUTION`, values `1280x720` and
  `1920x1080`, and stable IDs `test-resolution-1280-720` and
  `test-resolution-1920-1080`; mark 1280x720 as the markup default and provide
  one concise Browser-only help note.
- Add a `Simultaneous devices` labelled select with ID
  `simultaneous-devices-select`, name `SIMULTANEOUS_DEVICES`, and exactly
  `1 device`, `2 devices`, `4 devices`, and `6 devices` options whose values are
  `1`, `2`, `4`, and `6`; mark 6 as the markup default and explain that it caps
  simultaneously running Browser processes.
- Replace the Browser single stage with a Browser dashboard containing six
  accessible slot buttons/articles, each with a 16:9 stage, empty state, image,
  and a three-part header: full testcase ID, flexible testcase name, and full
  live status label.
- Give ID and status their own non-shrinking elements. Give the name a title or
  accessible-label fallback so its full value remains discoverable even when
  its visible text is ellipsized.
- Add a lower selected-case Playwright log panel with a case/status heading,
  empty state, and `<pre role="log">` output.
- Retain the LG single-preview section and state label as a separate target view.
- Retain the header Logs modal for application/API entries and its Clear action.
- Place the one-case interactive BrowserView overlay boundary inside slot 1's
  stage contract without adding five more BrowserViews.

**Invariants and compatibility:** Test selection, Detail modal, status bar
actions, settings, loading overlay, report buttons, and LG dialogs remain.

**Tests affected:** Modify renderer markup contract tests.

### `app/renderer/styles.css`

**Action:** Modify

**Current role and evidence:** The workspace is `54px + 1fr`; Browser preview is
one stage; the supplied reference needs a grid plus lower log panel.

**Exact changes:**

- Make the Browser workspace body a two-row dashboard: a minmax preview region
  and bounded lower log region.
- Reuse existing Settings form/fieldset styles for the Test resolution radio
  group and Simultaneous devices select; keep labels, focus states, and help text
  readable without introducing dashboard-specific styling into the modal.
- Define a fixed 3x2 slot grid with six equal cells, controlled gaps, min-size
  protection, and `aspect-ratio: 16 / 9`. Use `object-fit: contain`; never encode
  either test viewport as CSS dimensions—the preview only displays the selected
  16:9 screenshot surface.
- Add idle, running, passed, failed, stopped, selected-log, and slot-recycled
  visual states with readable status overlays and keyboard focus outlines.
- Make the testcase ID and status non-shrinking and `white-space: nowrap`. Make
  only the testcase name flexible with `min-width: 0`, `overflow: hidden`,
  `white-space: nowrap`, and `text-overflow: ellipsis`.
- Give the status label a white background and state-specific text-color hooks
  for Running, Passed, Failed, Stopped, and Idle. Preserve sufficient contrast
  and do not encode status using color alone; the full text remains present.
- Style the lower log panel to match the reference's blue boundary, use a
  monospace scrollable `<pre>`, and keep the selected case header visible.
- Keep LG single-preview, modal, sidebar, toolbar, and existing application Logs
  styles intact. Add overflow safeguards for fullscreen and supported smaller
  displays without changing the primary 3x2 order.

**Invariants and compatibility:** The app shell remains dark, the sidebar stays
460px on the reference viewport, and preview scaling does not alter the selected
Playwright page geometry.

**Tests affected:** Modify renderer CSS contract tests.

### `app/renderer/renderer.js`

**Action:** Modify

**Current role and evidence:** Owns serial case loop, one active completion,
single preview/log DOM state, case table statuses, result submission, settings,
and LG UI.

**Exact changes:**

- Bind `[name="TEST_RESOLUTION"]` and `#simultaneous-devices-select`.
  Extend `DEFAULT_SETTINGS`, `loadSettings()`, `currentSettings()`,
  `savePreviewSettings()`, `saveTestConfiguration()`, and
  `syncTestConfiguration()` with shared normalization and canonical persistence.
  Persist both UI values as canonical strings. Missing/invalid old localStorage
  data resolves to `"1280x720"`/`"6"` without a migration prompt.
- Replace `activeCompletion`/single Browser preview state with:
  `activeBrowserBatchId`, six slot view models, a case-to-slot map, a
  case-status map, bounded redacted per-case log buffers, and
  `activeLogCaseId`.
- Build one batch request with ordered `selectedCaseIds`, source keys, preview
  type, normalized timeout values, canonical `TEST_RESOLUTION`, and normalized
  `SIMULTANEOUS_DEVICES` string values. Validate multi-case Interactive locally
  before calling main; main converts the allowlisted device value to the numeric
  scheduler limit.
- Treat the returned/start-event settings as the active batch snapshot. Do not
  recolor/reassign slots or resize Interactive bounds when saved settings change
  during a run; new values take effect on the next batch.
- Consume only events whose batch ID matches the current Browser batch. Route
  assignment, preview, log, and status updates by case and slot; clear a slot's
  old frame on reassignment but retain old case logs/status in case maps.
- Select the first starting case by default. Slot clicks and table-row clicks
  switch the lower log panel; checkbox/Detail actions remain independent and
  stop event propagation.
- Bound each case log (implementation constant documented/tested), prepend one
  truncation notice when needed, retain buffers until the next batch/source
  reset, and render only the active case. Do not duplicate Playwright chunks in
  the application/API Logs modal.
- Derive final counts and flow-case result submission from the ordered
  `caseRuns` returned by main. Preserve one post-batch submission, completed-
  before-stop filtering, immutable retry payload, and campaign IDs.
- Update Stop to flag the current renderer batch once and call main once; allow
  main's `request-stop-run` to update local state without echo. Remove all
  singleton-completion resolution assumptions.
- For one Interactive case, measure slot 1 rather than the retired single stage
  and reuse existing suspend/resume/mute behavior around modals and resize; main
  applies the snapshotted logical resolution.
- Toggle Browser dashboard vs existing LG preview by target. Do not route LG
  events into Browser slots.

**Invariants and compatibility:** Password masking, API log redaction, case
selection/filtering, run-active close state, report sync retry, and LG renderer
contracts remain.

**Tests affected:** Modify `tests/unit/renderer.test.js` extensively while
preserving existing non-Browser coverage.

### `playwright.config.js`

**Action:** Modify

**Current role and evidence:** Defines `workers: 1` and independently hardcodes
1920x1080 for the default viewport and Chromium `--window-size`.

**Exact changes:**

- Resolve `process.env.MYTV_TEST_RESOLUTION` through shared
  `resolveTestViewport()` and use the resulting width/height for both
  `use.viewport` and `--window-size`.
- Default to 1280x720 when the environment value is missing/invalid, including
  terminal runs, while allowing terminal maintainers to select 1920x1080 via
  the same canonical environment value.
- Keep `workers: 1`, timeouts, reporters, device profile, and every other
  project option unchanged.

**Invariants and compatibility:** Configuration never evaluates arbitrary
dimensions. Electron and terminal paths share the same two-value resolution
contract; Playwright worker count is not used for desktop concurrency.

**Tests affected:** Add `tests/unit/playwright-config.test.js`; keep
`npx playwright test tests/run-test-case-mytv.spec.js --list`.

### `tests/fixtures/mytv-session-fixture.js`

**Action:** Modify

**Current role and evidence:** Creates each desktop Browser context, applies CDP
device metrics, and currently hardcodes one 1920x1080 `VIEWPORT` constant.

**Exact changes:**

- Resolve the same `MYTV_TEST_RESOLUTION` allowlisted value once for the worker
  and use its dimensions for `browser.newContext({viewport})`.
- Use those same dimensions in `Emulation.setDeviceMetricsOverride` for
  Interactive and non-Interactive pages; retain the supplied preview scale,
  device scale factor, and best-effort atomic screenshot stream.
- Import and call the shared `resolveTestViewport()` helper; do not define or
  export a fixture-local parser and do not change session ownership.

**Invariants and compatibility:** Worker-scoped context lifecycle, one-worker
behavior, preview cadence, cleanup, and test options remain unchanged.

**Tests affected:** `tests/unit/playwright-config.test.js` verifies the shared
helper/config behavior and statically asserts the fixture uses the resolved
viewport in both context and CDP metric paths without launching staging.

### `tests/unit/playwright-config.test.js`

**Action:** Add

**Current role and evidence:** No unit test currently loads Playwright config
under different `MYTV_TEST_RESOLUTION` values or proves the fixture/config
resolution contract remains aligned.

**Exact changes:**

- Load `playwright.config.js` in isolated module-cache/environment scenarios for
  missing, `1280x720`, `1920x1080`, and invalid values.
- Assert `use.viewport` and Chromium `--window-size` match exactly, the default
  is 1280x720, invalid input cannot escape the allowlist, and `workers` remains 1.
- Read the fixture source and assert it imports `resolveTestViewport`, uses the
  resolved viewport for both context creation and CDP metrics, and no longer
  contains a 1920x1080 `VIEWPORT` literal; do not launch a real browser in this
  unit suite.

### `tests/unit/browser-batch-runner.test.js`

**Action:** Add

**Current role and evidence:** No pure contract test can currently exercise
multiple Browser children because lifecycle code is embedded in Electron main.

**Exact changes:**

- Use controlled fake children and deferred exits to prove limits 1, 2, 4, and 6
  start exactly `N` children, the next case waits, the freed active slot takes
  the next ID, and peak active count never exceeds the selected value or six.
- Reject invalid concurrency input independently of renderer normalization so
  the runner cannot launch an unsupported number of children.
- Resolve cases out of order and assert final results remain in input order.
- Cover pass, nonzero exit, spawn throw/error+exit deduplication, missing result
  sidecar, per-case redaction, keyed preview routing, and watcher cleanup.
- Assert every launch receives distinct batch/case artifact paths, the batch's
  canonical `MYTV_TEST_RESOLUTION`, and unchanged timeout/cache/managed-browser
  env values.
- Cover Stop before launch, Stop with the configured active children, no new assignments,
  active stopped vs queued skipped classification, idempotent repeated Stop,
  rejection of a concurrent batch, and a clean later batch.

### `tests/unit/test-report-store.test.js`

**Action:** Add

**Current role and evidence:** Existing `test-report.test.js` covers rendering
and upsert shape, not concurrent filesystem coordination.

**Exact changes:**

- Record multiple completions concurrently and out of order; assert JSON/HTML
  contain all entries once and in selected order.
- Assert writes are serialized/atomic and one failed write is reported without
  mutating previously committed in-memory order incorrectly.
- Reuse representative passed/failed case results; do not include credentials.

### `tests/unit/preload.test.js`

**Action:** Modify

**Current role and evidence:** Tests narrow preload calls and removable LG/tool
subscriptions but has no keyed Browser batch contract.

**Exact changes:**

- Assert `runBrowserBatch` invokes only `run-browser-batch` with the supplied
  narrow request.
- Assert `setTestConfiguration` forwards canonical timeout, resolution, and
  simultaneous-device fields without adding raw width/height or executable
  controls.
- Assert `onBrowserBatchEvent` forwards structured safe values and returns an
  unsubscribe that removes the exact listener.
- Assert retired unkeyed Browser listener methods are absent after migration;
  LG subscriptions remain unchanged.

### `tests/unit/renderer.test.js`

**Action:** Modify

**Current role and evidence:** Provides a lightweight DOM/runner fixture and
serial Browser batch/result/stop/UI contracts.

**Exact changes:**

- Extend the fixture for six slot elements, selected-case log elements,
  Test resolution radios, Simultaneous devices select, `runBrowserBatch`, and
  the removable structured batch-event callback.
- Add startup/default, old-storage migration, invalid saved value, Save,
  restore, `setTestConfiguration`, and batch-request assertions for 1280x720 vs
  1920x1080 and 1/2/4/6 devices. Defaults must be 1280x720 and 6.
- Replace serial-call assertions with configurable cases: first `N` active,
  next queued, one finish causes one next assignment, failure does not block
  queue, slots above `N` remain Idle, and final summary/result order is
  deterministic.
- Add per-slot preview isolation and stale batch/assignment rejection tests.
- Add per-case log routing, redaction, truncation, tile selection, table-row
  selection after slot reuse, and app/API Logs separation tests.
- Add status transitions for running/passed/failed/stopped and idle holder reset.
- Add a long-name header fixture proving the ID and status remain fully visible,
  the name is the only ellipsized field, and each state applies the white badge
  plus expected semantic text-color hook.
- Migrate manual-stop, main-originated-stop, fresh-restart, no-completion stop,
  completed-before-stop submission, campaign submission, and unsynced retry
  tests to ordered batch results.
- Add validation for multi-case Interactive and regression for one-case
  Interactive slot bounds/mute/modal handling at both allowed resolutions.
- Update markup/CSS tests for exactly six 16:9 holders, 3x2 order, lower log
  panel, three-part non-overlapping slot headers, name-only ellipsis, white
  semantic status badges, LG separation, and `fullscreen: true` in main.
- Preserve all case loading, masking, folder/campaign, settings, toolchain, LG,
  report-button, and modal tests. Record the two current unrelated baseline
  failures and require no additional failures.

### `README.md`

**Action:** Modify

**Current role and evidence:** User/maintainer documentation still says selected
cases execute sequentially one IPC call at a time and share one debug report.

**Exact changes:**

- Document Test resolution choices/default, Simultaneous devices choices/default,
  per-batch snapshot behavior, the fixed six-holder/variable-active Browser
  queue, 3x2 live dashboard, status/log selection, single-case Interactive
  restriction, Stop behavior, and fullscreen startup.
- Clarify that concurrency is the selected 1/2/4/6 independent one-worker
  processes, both allowed logical viewports are 16:9, terminal/default behavior
  is 1280x720, and `MYTV_TEST_RESOLUTION=1920x1080` selects the larger terminal
  viewport.
- Document batch/case-scoped debug artifact locations and the stable compact
  report path.
- Preserve LG serial/confirmation wording and credential/report sensitivity.

### `AGENTS.md`

**Action:** Modify

**Current role and evidence:** Maintainer architecture instructions describe a
single Browser child/preview path and intentional one-worker suite behavior.

**Exact changes:**

- Add the Browser batch coordinator/report store to architecture and key files.
- Document the configurable 1/2/4/6 active-process limit with hard ceiling six,
  ordered queue/slot reuse, keyed IPC, isolated artifact roots, per-case
  previews/logs, report serialization, Stop, and fullscreen dashboard.
- Document the shared Test resolution contract, 1280x720 default,
  `MYTV_TEST_RESOLUTION`, and consistent config/context/CDP/BrowserView geometry.
- Clarify that `workers: 1` remains true per Playwright process and does not
  prohibit Electron from owning the configured number of independent generic-
  case processes.
- Update environment/artifact descriptions for per-case paths and retain all LG
  safety boundaries.

### `docs/tinyworkers/20260811_160811_simultaneous-browser-tests.md`

**Action:** Add (this file)

**Current role and evidence:** Durable Tiny-Workers source of truth for plan
approval, milestones, verification evidence, deviations, and final handoff.

**Exact changes:** Tiny-PM/Tiny-Executor update status, checkboxes, actual command
evidence, deviations, and completion only after approval and execution.

## Execution Sequence

### Step 1 — Build configuration, scheduler, and report write contracts

**Objective:** Create testable shared settings and main-only execution cores
before altering Electron IPC or UI.

**Files:** `app/test-configuration.js`, `tests/unit/test-configuration.test.js`,
`app/browser-batch-runner.js`, `app/test-report-store.js`,
`tests/unit/browser-batch-runner.test.js`, `tests/unit/test-report-store.test.js`

**Implementation details:** Add the exact resolution and simultaneous-device
allowlists/defaults/normalizers. Implement the configurable 1/2/4/6 worker queue
with hard ceiling six, finish-once case lifecycle, keyed events, stop/drain
behavior, ordered results, independent preview watchers, unique launch contract,
and serialized ordered report store. Write failing contract tests first, then
the minimal modules.

**Dependencies:** Approved plan; existing child-process, redaction, report, and
filesystem helpers. No external service.

**Verification:**
`node --test tests/unit/test-configuration.test.js tests/unit/browser-batch-runner.test.js tests/unit/test-report-store.test.js`;
`node --check app/test-configuration.js`;
`node --check app/browser-batch-runner.js`; `node --check app/test-report-store.js`.
Expected result: all new lifecycle/concurrency/report tests pass and syntax exits 0.

**Exit criteria:** A pure Node harness proves defaults 1280x720/6, strict
allowlists, active limits 1/2/4/6 with ceiling six, slot refill, ordered results,
stop semantics, event identity, artifact isolation, and no lost report entries
without importing Electron.

**Approval gate:** Required before implementation because this introduces the
new core Browser execution architecture.

### Step 2 — Integrate Electron, Playwright resolution, isolated artifacts, Stop, and fullscreen

**Objective:** Replace singleton Browser run IPC with one safely owned Browser
batch while preserving close, report, toolchain, and Interactive single-case
contracts.

**Files:** `app/main.js`, `app/preload.js`, `playwright.config.js`,
`tests/fixtures/mytv-session-fixture.js`, `tests/unit/preload.test.js`,
`tests/unit/playwright-config.test.js`, relevant runner/report tests from Step 1

**Implementation details:** Extend main Test configuration state; resolve and
snapshot the normalized resolution/concurrency; resolve/validate selected cases
once; prepare managed Chromium once; construct batch/case paths/env; apply the
same selected viewport to Playwright config, worker context, CDP metrics, and
Interactive BrowserView scaling; stream structured events; await batch Stop on
close; keep LG separate; expose the new bridge; and set the window fullscreen.
Remove singleton Browser process/watcher paths only after the new runner is wired.

**Dependencies:** Step 1 complete; existing Browser toolchain, case source,
redaction, report, close guard, and BrowserView helpers.

**Verification:** `node --test tests/unit/test-configuration.test.js tests/unit/browser-batch-runner.test.js tests/unit/test-report-store.test.js tests/unit/preload.test.js tests/unit/playwright-config.test.js tests/unit/run-close-guard.test.js tests/unit/window-close-controller.test.js tests/unit/window-startup.test.js`;
`node --check app/main.js`; `node --check app/preload.js`;
`node --check playwright.config.js`;
`node --check tests/fixtures/mytv-session-fixture.js`.
Expected result: new IPC/lifecycle contracts and existing close/startup checks pass.

**Exit criteria:** Electron main can own one Browser batch at the validated
1/2/4/6 active limit, every child uses the selected 1280x720 or 1920x1080
geometry consistently, Stop/close can drain it, paths are isolated, preload
exposes only keyed events, and every new window opens fullscreen.

**Approval gate:** Not required within the approved architecture and files.

### Step 3 — Implement Test configuration controls and the six-tile Browser dashboard

**Objective:** Deliver the two requested Browser settings plus the supplied 3x2
preview layout, per-slot status, and selected-case log panel.

**Files:** `app/renderer/index.html`, `app/renderer/styles.css`,
`app/renderer/renderer.js`, `tests/unit/renderer.test.js`

**Implementation details:** Add exact Test resolution radios and Simultaneous
devices select; integrate defaults, migration, save/restore/sync, and batch
payloads; add six persistent slots and lower log panel; replace serial Browser
state with keyed batch/slot/case maps; route preview/log/status events; implement
configured active slots, Idle capacity slots, slot/table log selection, buffer
cap/truncation, slot reuse, stale-event rejection, Stop, and one-case Interactive
bounds. Retain the Logs modal for application/API logs and the LG single preview.

**Dependencies:** Step 2 structured IPC/resolution contract; supplied 1920x1080
workspace reference.

**Verification:** `node --check app/renderer/renderer.js`;
`node --test --test-reporter=dot tests/unit/renderer.test.js`.
Expected result: all new dashboard/batch tests and all previously passing
renderer tests pass. The two recorded baseline failures must either remain
identical or be replaced only where the planned markup contract makes them obsolete.

**Exit criteria:** Settings default to 1280x720 and 6, persist only allowlisted
values, and enter the next batch request; six slots render in 3x2 order; exactly
the configured `N` slots can be active; each case receives only its own
frame/status/log; the next queued case refills a freed active slot; old logs
remain selectable; and Browser/LG target switching remains correct.

**Approval gate:** Not required within the approved UI contract. Any change from
fixed 3x2 holders or single-case-only Interactive requires plan amendment.

### Step 4 — Preserve submission/report semantics and update documentation

**Objective:** Complete integration behavior and make the new architecture
maintainable without broadening API, LG, or testcase semantics.

**Files:** `app/renderer/renderer.js`, `tests/unit/renderer.test.js`, `README.md`,
`AGENTS.md`, this plan

**Implementation details:** Finalize deterministic `caseRuns` consumption,
post-batch result submission, completed-before-stop filtering, unsynced retry,
campaign records, report links, and documentation. Explicitly document
resolution/concurrency settings and defaults, per-batch snapshots, per-process
one-worker behavior, artifact roots, resource/account risks, Interactive
restriction, and LG serial invariants.

**Dependencies:** Steps 1-3 complete.

**Verification:** Focused renderer tests for all-results submission, stop with no
completed result, completed-before-stop submission, campaignId propagation,
retry, and LG regression; `node --check app/renderer/renderer.js`;
documentation diff review.

**Exit criteria:** Result/report ordering and filtering match current contracts,
LG is unchanged, and README/AGENTS describe the actual implementation.

**Approval gate:** Not required within approved scope. Any API payload, LG, or
report schema change requires a plan amendment and explicit approval.

### Step 5 — Complete regression, graph, and live Electron verification

**Objective:** Demonstrate that local contracts pass, known failures are
classified, the graph is current, and configurable resolution/concurrency plus
the fullscreen six-slot behavior work in an explicitly approved staging smoke.

**Files:** Plan evidence only; `graphify-out/` is refreshed by the prescribed
post-code update.

**Implementation details:** Run project checks; review the final diff; update
Graphify; then, only with explicit live-test approval and suitable accounts, run
the 1/2/4/6 concurrency matrix, a queued case above each limit, and both
1280x720/1920x1080 resolutions to observe viewport application, concurrency,
slot refill, preview/log isolation, Stop/restart, report content, and fullscreen
startup.

**Dependencies:** Steps 1-4 complete; configured managed Chromium; valid
sensitive testcases/accounts; live staging approval.

**Verification:** `npm run test:unit`; syntax checks for all changed JS;
`npx playwright test tests/run-test-case-mytv.spec.js --list`; `git diff --check`;
`graphify update .`; manual Electron smoke matrix below. Expected result: focused
new tests pass, no new full-suite failures beyond classified baseline, graph
updates, and approved GUI checks satisfy the acceptance criteria.

**Exit criteria:** Actual evidence is recorded for every acceptance criterion,
no unrelated diff is present, known limitations are explicit, and Tiny-PM can
mark the plan Complete.

**Approval gate:** Required immediately before live staging/Electron execution.
Local unit/static/graph checks are covered by approved implementation scope.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Settings defaults and allowlists | Unit | `node --test tests/unit/test-configuration.test.js` | Defaults are 1280x720 and 6; only 1280x720/1920x1080 and 1/2/4/6 normalize successfully; invalid values use a valid fallback/default |
| Settings UI persistence and IPC | Renderer/preload unit | Load missing/legacy/invalid storage, save every valid option, reload, and inspect `set-test-configuration`/batch calls | Exact controls/options render; canonical values persist/restore; main-facing payload contains resolution and simultaneous-device values without raw dimensions |
| Configurable Browser concurrency | Unit | `node --test tests/unit/browser-batch-runner.test.js` with deferred cases for limits 1, 2, 4, and 6 | Exactly `N` children spawn, the next remains queued, and recorded peak equals `N` and never exceeds 6 |
| Slot refill and queue order | Unit | For each allowed limit, resolve a non-last active slot, then later slots | Next selected ID takes the first freed active slot; slots above `N` stay Idle; final results remain selected order |
| Failure isolation | Unit | Exit one child nonzero while others remain pending | One case is Failed, its slot refills, other children are not killed |
| Unique artifacts | Unit/static | Inspect fake launch env/args for six cases | Every case has distinct preview/result/test-results/debug-report paths under one batch root |
| Resolution propagation and one worker | Unit/static/regression | `node --test tests/unit/playwright-config.test.js`; inspect main env/BrowserView and fixture CDP tests; `npx playwright test tests/run-test-case-mytv.spec.js --list` | Default/configured viewport and Chromium window size are respectively 1280x720 or 1920x1080; context/CDP/BrowserView agree; invalid input falls back; `workers: 1`; one generic test lists |
| Batch settings snapshot | Runner/renderer unit | Start at 1280x720/2, save 1920x1080/6 while active, then start another batch | Active batch stays 1280x720 with peak 2; next batch uses 1920x1080 with peak 6 |
| No lost compact-report entries | Unit | Concurrent, out-of-order `recordCaseCompletion()` calls | JSON and HTML contain all cases once in selected order |
| Keyed previews cannot cross slots | Renderer/unit | Emit two case previews plus stale batch/slot events | Each correct image updates once; stale/mismatched frames are ignored |
| Per-case selected logs | Renderer/unit | Interleave redacted chunks for seven cases, select tile/row | Lower panel contains only selected case; old case remains selectable after slot reuse |
| Log buffer is bounded/redacted | Renderer/unit | Send over-cap output and split credential values | Truncation marker appears; secrets do not appear in retained or visible output |
| Status lifecycle | Renderer/unit | Emit queued/assignment/pass/fail/stop transitions | Tiles/table show Idle/Running/Passed/Failed/Stopped/Skipped as designed |
| Slot header overflow and status styling | Renderer/CSS unit + 1920x1080 visual review | Render a deliberately long testcase name in all terminal/running states | ID and status remain fully visible; only the name ellipsizes; the status badge stays white and its text color matches the state |
| Stop all and restart cleanly | Runner + renderer unit | Stop configured active children plus queued, call Stop twice, then start a fresh batch at a different allowed limit | Each owned active child terminated once; queued not spawned; next batch uses its new setting and runs normally |
| Close guard drains Browser batch | Unit | Existing close-controller harness with active batch runner fake | Close awaits Stop and only then allows close; no reverse stop IPC loop |
| Result submission after concurrency | Renderer/unit | Complete cases out of order; stop before/after completed cases | One ordered submission after settle; only fully completed-before-stop cases included |
| Interactive compatibility | Renderer/main contract | 1-case Interactive at both resolutions and 2-case Interactive tests | One case uses slot 1 with resolution-aware BrowserView/CDP bounds; multi-case starts no child and shows instruction |
| LG remains serial and safe | Regression | Existing LG renderer/preload/IPC/unit suites | Confirmation, safe events, one device runner, recovery, and preview tests remain passing |
| Fullscreen startup and reference layout | Static + manual | Main source assertion; start Electron on 1920x1080 | Window opens fullscreen; sidebar, 3x2 previews, and lower log panel match reference structure |
| Resolution staging matrix | Manual, approval required | Run representative Browser cases once at 1280x720 and once at 1920x1080 | Page/screenshot/player geometry matches the selected value; focus/navigation and preview remain functional in both modes |
| Concurrency staging matrix | Manual, approval required | Run `N+1` lightweight cases with N set to 1, 2, 4, then 6 | Exactly N simultaneous Running slots, distinct frames/logs, capacity slots above N stay Idle, and the queued case starts after one terminal slot |
| Manual Stop | Manual, approval required | Stop a queued batch at an allowed limit, then run one fresh case at another limit | All active cases stop, queued cases do not start, fresh case uses the new limit normally |
| Compact/debug reports | Manual/local inspection | Open compact report and per-case debug folders after out-of-order completion | All completed cases present once; per-case debug artifacts do not overwrite |
| Project regression and graph | Static/project | `npm run test:unit`; syntax checks; Playwright list; `git diff --check`; `graphify update .` | No new failures beyond classified baseline; graph update completes |

## Readiness Assessment

- Observable goal and testable acceptance criteria: Ready.
- Explicit scope and non-goals: Ready.
- Current-state evidence and baseline failure classification: Ready.
- Architecture and UI decisions: Ready; no material placeholder or competing
  approach remains. Approval explicitly accepts the 1280x720 resolution default,
  1920x1080 alternative, configurable 1/2/4/6 Browser process limit with default
  6, fixed 3x2 capacity holders, per-batch setting snapshots, and single-selected-
  case-only Interactive preview.
- File-level impact, dependencies, exit criteria, and verification: Ready.
- Risk, rollback, credential handling, and live-test approval boundary: Ready.
- Implementation authorization: User approved this plan and requested execution
  on 2026-08-12. Tiny-Executor is operating within the approved scope.
- Tiny-Planner recommendation: Approved and executing.

## Completed Verification

> Tiny-Executor must record actual results here during execution. Planning
> baselines are documented in `Current State and Findings` and are not completion
> evidence.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 — shared contracts, scheduler, and report store | `node --test tests/unit/test-configuration.test.js tests/unit/browser-batch-runner.test.js tests/unit/test-report-store.test.js` | Pass | 17 tests passed; defaults/allowlists, limits 1/2/4/6, queue refill/order, redaction, preview lifecycle, stop/skip, concurrent-start rejection, report ordering/upsert/error retention all covered | 2026-08-12 |
| Step 1 — syntax and diff hygiene | `node --check app/test-configuration.js`; `node --check app/browser-batch-runner.js`; `node --check app/test-report-store.js`; `git diff --check` | Pass | All syntax checks passed; Git emitted only the pre-existing fsmonitor IPC warning | 2026-08-12 |
| Step 2 — Electron/Playwright focused contracts | `node --test tests/unit/test-configuration.test.js tests/unit/browser-batch-runner.test.js tests/unit/test-report-store.test.js tests/unit/preload.test.js tests/unit/playwright-config.test.js` | Pass | 31 tests passed; keyed Browser batch bridge, settings synchronization, per-resolution Playwright config, scheduler/report contracts verified | 2026-08-12 |
| Step 2 — syntax | `node --check app/main.js`; `node --check app/preload.js`; `node --check tests/fixtures/mytv-session-fixture.js`; `node --check playwright.config.js` | Pass | All changed Electron/fixture/config files parsed successfully | 2026-08-12 |
| Step 3 — renderer batch/settings/UI contracts | `node --test tests/unit/renderer.test.js --test-reporter=dot` | Pass with baseline classification | 104 renderer tests ran; 102 passed and two documented baseline failures remain (`Run Selected (0)` fake-tooltip expectation and legacy `Chiến dịch` label expectation). New settings, keyed slot, bounded-log, fullscreen, LG-preview separation, ordered-submission, markup, and CSS tests pass. | 2026-08-12 |
| Step 3 — Playwright list and diff hygiene | `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git diff --check` | Pass | One generic Chromium test listed; diff check passed with only the pre-existing fsmonitor IPC warning | 2026-08-12 |
| Step 4 — result submission, Interactive/LG compatibility, and docs | Renderer submission/stop/retry/campaign/LG tests; `node --check app/renderer/renderer.js`; README/AGENTS/plan diff review | Pass | Browser results submit once in selected order after keyed batch completion; completed-before-stop filtering and unsynced retry remain covered; Interactive uses the batch resolution and rejects multi-case mode; LG preview hides Browser-only slots/logs and remains serial; documentation matches the implementation | 2026-08-12 |
| Step 5 — project regression | `npm run test:unit -- --test-reporter=dot` | Pass with baseline classification | 665 tests ran; 663 passed and the same two pre-existing renderer assertions failed; no new failures observed | 2026-08-12 09:18 +0700 |
| Step 5 — syntax, Playwright list, and diff hygiene | All changed-file `node --check` commands; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git diff --check` | Pass | Main, preload, renderer, batch runner, report store, configuration, fixture, and Playwright config parse; one generic Chromium test lists; diff check is clean apart from the pre-existing fsmonitor IPC warning | 2026-08-12 09:18 +0700 |
| Step 5 — Graphify refresh | `graphify update .` (approved elevated filesystem access) | Pass | Final Graphify refresh rebuilt 2,959 nodes, 4,588 edges, and 182 communities; five data fixtures were reported as zero-node source files | 2026-08-12 09:23 +0700 |

## Deviations and Plan Updates

- 2026-08-11 16:32:23 +0700: User refined the preview-slot header contract.
  The plan now requires full ID and status text, name-only ellipsis, and a white
  status badge with semantic text color. A fake-data design review prototype was
  added outside the production worktree; implementation remains unstarted.
- 2026-08-12 08:23:33 +0700: User replaced the plan's hardcoded execution
  assumptions with two Test configuration controls. Test resolution is now an
  allowlisted 1280x720/1920x1080 choice defaulting to 1280x720, and Simultaneous
  devices is now an allowlisted 1/2/4/6 maximum defaulting to 6. The six-holder
  dashboard remains maximum-capacity UI; resolution/concurrency are validated,
  persisted, and snapshotted per Browser batch. Implementation remains unstarted.
- 2026-08-12: Step 1 implemented within approved scope. Added shared
  configuration normalizers, configurable scheduler, report store, and focused
  unit tests. Electron/UI integration remains in Step 2/3.
- 2026-08-12: Step 2 implemented within approved scope. Added the main-process
  Browser batch IPC boundary, per-case batch-scoped artifacts, keyed preview/log
  events, owned-process stop/close handling, fullscreen BrowserWindow startup,
  and resolution propagation through Playwright config, the shared fixture, and
  Interactive BrowserView bounds. Graphify refresh was attempted after the
  changes but the local extractor returned an Operation not permitted error;
  the source graph remains available for the final retry.

- 2026-08-12: Step 3 implemented within approved scope. Added persisted
  resolution/device controls, the six-holder 3x2 workspace, full ID/name/status
  headers with name-only ellipsis, keyed preview/status/log routing, bounded
  redacted case logs, and renderer coverage. The existing serial `run-test`
  fallback remains only for legacy test harnesses while production uses the
  new Browser batch bridge.
- 2026-08-12: Step 4 documentation and compatibility review completed. README
  and AGENTS now describe the allowlists, snapshot semantics, per-case
  artifacts, six-slot UI, Interactive restriction, and LG serial boundary.
- 2026-08-12 09:23:55 +0700: Step 4 completed. Ordered Browser result
  submission, completed-before-stop filtering, Interactive resolution
  propagation, LG-only preview separation, and the final README/AGENTS/plan
  documentation review passed. Step 5 local regression, static checks, and
  Graphify refresh passed with the two already-classified renderer baselines;
  live Electron/staging verification remains approval-gated.

## Handoff and Completion

- Changed files: Plan, shared Test configuration, Browser batch runner, ordered
  report store, Electron main/preload/Playwright integration, renderer six-slot
  workspace/settings, documentation, graph output, and focused unit tests.
- Checks passed: Planning baseline checks, 17 focused Step 1 tests, 31 focused
  Step 2 contract tests, 104 renderer tests with two baseline failures, full
  suite classification (663 pass/2 baseline fail across 665 tests), syntax,
  Playwright list, diff hygiene, and final graph refresh.
- Known limitations: The two pre-existing renderer assertion failures remain;
  live Electron/staging verification is not run because the plan requires an
  explicit live-test approval boundary.
- Follow-up work: Request explicit live Electron/staging approval if the user
  wants the manual 1/2/4/6 and 1280x720/1920x1080 smoke matrix.
- Final acceptance status: In progress; Steps 1-4 complete, Step 5 local
  evidence complete, live verification approval-gated.
