# AGENTS.md

Agent context for the MyTV Auto Test project.

## AgentMemory

Before a non-trivial task, use AgentMemory recall/smart-search for relevant decisions, affected files, test history, and failed approaches. Treat recalled items as leads and verify them against the current code.
Save durable decisions, non-obvious fixes, and reusable test lessons. Never save secrets, credentials, production dumps, or private customer data.

## Project Overview

MyTV Auto Test is a Playwright test-automation suite for the MyTV HTML5 TV web
application, with an Electron desktop runner for local server-shaped test
cases. The target application behaves like a TV interface: navigation uses a
remote-control focus model and text entry uses the app's virtual keyboard.

Project type: quality assurance / test automation
Primary language: JavaScript (CommonJS)
Key technologies: Playwright, Electron, Node.js

When text input is required in the TV app, always use the virtual keyboard
character by character. Do not use standard form input or mouse-driven app
interaction.

## Architecture

### Electron local case runner

The Electron workflow is source-independent at the execution boundary:

```text
testcased.json
ACTION-COMPILER.md                 Server-side qaDescription-to-actions guide
      |
      v
test-case-source.js
      |
      v
test-case-schema.js
      |
      +-- explicit actions ------------------+
      |                                      |
      +-- supported qaDescription fallback --+
                                             v
                              test-case-action-runner.js
                                             |
                                             v
                                      MyTV helpers
```

`testcased.json` is the read-only local fallback fixture. On startup, the app
restores the latest successfully loaded API test-case list (folder or campaign)
from the user-data cache; it uses the fixture only when no latest cached list is
available. `app/main.js` also
owns flow-case API IPC, sanitizes passwords and service-token header values for the renderer, validates the
selected case ID from either the fixture or the user-data cache, and starts the
generic `tests/run-test-case-mytv.spec.js` entry point. Browser runs send one
ordered selected-case list plus the validated Test resolution (`1280x720` by
default or `1920x1080`), Simultaneous devices (`1`, `2`, `4`, or `6`, default
`6`), player-check timeout, test-case maximum time, preview settings, and an
active folder or campaign cache key for the batch. `app/browser-batch-runner.js`
owns the main-process queue and one-worker child per active slot; each child
gets batch/case-scoped preview, result, test-results, and debug-report paths.
After every normally completed selected API-loaded case, the renderer submits
one validated `tested`/`testResult` batch through main-process IPC; campaign
batches include `campaignId` per testcase. If the operator stops a batch, only
cases that fully completed before the stop are submitted. Stopped, skipped,
local-fixture, and launch-failed cases are never included.

The desktop supports two execution targets: Browser (the default) and LG webOS.
The Settings dialog owns Browser configuration, Test configuration, LG SDK configuration, the
saved LG-device list, redacted connection status, managed/advanced toolchain
selection, and the compatibility catalog. APP_URL is source-controlled in
`app/main.js` and is not rendered or accepted from the GUI. The DNS host mapping
is source-controlled in `app/hosts-file.js`; host IPC resolves it in the main
process and returns only safe status fields. Browser runs require the separately
confirmed managed Chromium installation. The Browser workspace always renders
six 16:9 holders; slots above the selected concurrency remain Idle, and each
assigned holder routes keyed live frames/status/logs by batch, case, and slot.
The lower Playwright log panel is fixed at 240px and scrolls its selected output
internally; failed-test text must never resize or move the preview grid.
The top workspace status bar owns a persisted Browser-only App environment
selector with `ONLINE` as the default plus `PILOT` and `STAGE`. Main validates
the enum and the generic Browser runner applies the fixed trusted page bootstrap
before the first action; LG runs do not use it.
Interactive BrowserView/CDP preview is allowed only for one selected Browser
case; Live or None is required for a multi-case batch. LG runs reuse the same case selection,
batch control, report, and result-submission flow, but require an explicitly
confirmed real-TV operation.

The LG renderer may send only a selected saved-device ID, case IDs, an optional
folder ID or campaign cache key, and explicit confirmation to the LG IPC boundary. The main process
alone resolves encrypted connection data and the selected toolchain, performs a
fresh read-only identity/app preflight, and starts a loopback-only Appium
session only after confirmation. It uses native remote control,
virtual-keyboard entry, an installed-app session with `appium:noReset: true`,
and trusted logout. Never deploy, uninstall, reset, or clear the TV app; never
use `appium:rcMode: "js"` or `webos:clearApp`.

LG device compatibility validation is separate from normal LG batches. It uses
one fixed local MyTV product-gate case—login, Home, Search, `VTV1 HD` search,
and matching-result playback—rather than a selected API case. Its account is
configured once in SDK configuration and stored only through Electron
encryption; the renderer receives redacted status only.

Explicit structured `actions` are authoritative. `ACTION-COMPILER.md` is the
server-side guide for transforming `qaDescription` into validated actions
before delivery. The app-side deterministic compiler remains a migration
fallback for supported descriptions, including login, home/service/search
navigation, named/search-result/row playback, back, and readiness waits.
Unsupported or ambiguous lines must fail with the case ID and original line;
never guess arbitrary behavior or evaluate server-provided code.

API folder, running-campaign, and case retrieval runs in the main process
through the preload IPC bridge. When a campaign is selected, folder retrieval
passes `campaignId` to return only campaign-related folders and case retrieval
uses `GET /api/v1/projects/{projectId}/test-campaigns/{campaignId}/testcases`
with the configured value only in `X-FlowTest-Service-Token`. A selected folder
is optional for campaign loading: Main fetches the authoritative campaign list
without invented query filters and, when a folder is selected, intersects it
with the existing folder subtree by exact copy ID. When the campaign selector is
empty, a folder is still required and the existing folder case retrieval is
unchanged. Successful folder responses atomically replace their folder-ID cache
entry and campaign responses use `campaign:<campaignId>`; each updates the
latest-entry marker used for GUI startup restoration. Campaign-only cache entries
may omit `folder`, while folder-filtered campaign entries retain the selected
folder metadata. Refreshing either campaign or folder lists clears the marker and
the visible loaded cases. Campaign copies are validated using their own `id`;
`sourceFlowCaseId` is never substituted. The generic action executor receives
either the local fixture source or a validated cache source and does not contain
API or cache logic. Folder-filtered campaign results use
`PATCH /api/v1/projects/{projectId}/flow-cases/by-folder` with the real selected
`folderPath` and per-case `tested`/`testResult` records carrying `campaignId`.
Campaign-only results use ordered per-case
`PATCH /api/v1/projects/{projectId}/flow-cases/{caseId}` requests with
`campaignId`, `status`, and `testResult`; only failed/unknown IDs remain
eligible for Retry sync after partial success. The renderer re-encodes each
case's result screenshot to WebP through a canvas and submits it as the raw
base64 `testResult.screenshots` string; `app/test-result-screenshot.js` validates
that string at the main-process boundary, and both the renderer and main API logs
elide the base64 body. `app/api-curl.js` is a dual-mode module (script
global plus CommonJS export, like `app/test-configuration.js`) that turns an
HTTP request descriptor into a `curl` command. `sanitizeApiLog` in `app/main.js`
runs it on the *unredacted* request and ships the result as an extra `curl` field
beside the redacted `request`/`response`, so the Logs modal's Copy cURL button
hands over a runnable command (real service token, full screenshot base64) while
the rendered log keeps its redactions: the renderer strips `curl` from the
displayed JSON and `elideCopyOnlyLogValues` elides both `curl` and `screenshots`.
The renderer never rebuilds API URLs itself, so the buttons on a request card are
filled from the matching response's `curl`. The card's second action, Get text
file, goes through the `save-text-file` IPC handler: the main process owns the
`dialog.showSaveDialog` call and the write, so the renderer never touches the
filesystem.

### Terminal regression runner

The legacy Playwright specs remain runnable from the terminal. They retain
their non-case-specific options for login, channel, movie, search, and settings
regression coverage. `scripts/run-headed.js` provides the interactive channel,
movie, and search runner.

### Shared browser session

`tests/fixtures/mytv-session-fixture.js` keeps the existing worker-scoped
browser context and CDP integration. `workers: 1` is intentional: specs are
ordered and may reuse one authenticated session. Do not change this to parallel
workers without redesigning session ownership.

## Key Files

```text
testcased.json
app/
  test-configuration.js          Shared player/case-timeout defaults and validation
  browser-batch-runner.js        Configurable Browser slot scheduler and lifecycle events
  test-report-store.js           Ordered serialized compact-report persistence
  main.js                         Electron process, case loading, run IPC
  test-report.js                  Compact user report HTML/data generation
  preload.js                      Context-isolated IPC bridge
  flow-case-api.js                Flow-case API URLs, fetch, normalization, timeout
  campaign-flow-case-workflow.js Pure campaign/folder intersection and ordered result fan-out
  test-case-cache.js              Atomic folder/campaign-keyed user-data cache
  lg-desktop-run-preflight.js     Main-only LG local/read-only preflight
  lg-desktop-batch-runner.js      Confirmed LG serial batch and recovery policy
  lg-run-ipc.js                   Narrow renderer-to-main LG run IPC
  lg-compatibility-*.js           Catalog, encrypted product gate, inspection, and validation
  lg-toolchain-*.js               Managed/advanced LG SDK detection and installation
  loopback-appium-client.js       Redacted loopback-only Appium client
  tv-runner.js                    Target-neutral LG runner orchestration
  renderer/index.html             Case browser and preview markup
  renderer/renderer.js            Case selection, masking, logs, preview UI
  renderer/styles.css             Desktop runner styles
tests/
  run-test-case-mytv.spec.js      Generic selected-case Playwright spec
  fixtures/mytv-session-fixture.js Shared context, CDP, preview screenshots
  lib/test-case-schema.js         Case/action validation and normalization
  lib/test-case-source.js         Read-only fixture loading and lookup
  lib/test-case-compiler.js       Deterministic description fallback
  lib/test-case-action-runner.js  Action registry and step results
  lib/mytv-helpers.js             Facade exporting tests/lib/index.js
  lib/index.js                    Shared helper exports
  lib/workflows.js                Current helper workflows and options
  lib/mytv-helpers.legacy.js      Retained legacy helper implementation
  lib/navigation.js               Remote focus and virtual-keyboard primitives
  lib/content-rows.js             Content-row discovery and navigation
  lib/playback.js                 Player state and playback assertions
  lib/waits.js                    Readiness and pacing utilities
  lib/artifacts.js                Failure screenshots and JSON/HTML attachments
  unit/                           Pure Node contract and renderer tests
  login-mytv.spec.js              Legacy login flow
  play-channel-mytv.spec.js       Legacy channel flow
  play-movie-mytv.spec.js         Legacy movie flow
  search-content-mytv.spec.js     Legacy search flow
  open-setting-mytv.spec.js       Legacy settings flow
scripts/run-headed.js             Interactive legacy runner
scripts/run-electron-app.js       Electron development entry point
playwright.config.js              Allowlisted 1280x720/1920x1080 viewport, one worker, debug HTML report
package.json                      Commands and Electron Builder configuration
```

## Test-Case Contract

The local fixture is an array matching the server list shape. Each case needs a
stable `id`, a display `name`, and either non-empty `actions` or a non-empty
`qaDescription`. Metadata such as `platform`, `environment`, `preCondition`,
and `expectedResult` is retained for the case browser and report.

The supported action allowlist is:

- `login`: requires `username` and `password`.
- `open_home`: waits for the ready home state.
- `focus_row`: requires a row/category name and navigates to it using its first visible item as the TV focus anchor. An optional positive 1-based `itemIndex` uses remote horizontal navigation to focus that absolute poster position, including items that are initially outside the viewport; it fails only when the row cannot reach the requested position. Home rows are matched by visible headings/content and do not depend on dynamic row IDs.
- `focus_row_first_item`: focuses the leftmost item in the currently active row, regardless of content type.
- `focus_text`: focuses a visible control by its human-readable text through remote navigation. Immediately after `focus_row` for the Home `Thể loại` row, it scans every reachable service poster in that carousel, moving right and re-reading the row until it finds the requested service or reaches the end. Immediately after any `focus_row`, the exact aliases `Xem tất cả`, `Xem thêm`, and `View more` focus the trusted `.view_more[item_view_more="1"]` poster, even when `content_name` is blank; without row context they fail closed. It never falls back to a same-named left-menu item.
- `press_ok`: sends the remote OK/Enter key. After a Home `Thể loại` service
  poster or a pending view-more poster it immediately requires a non-Home
  destination with visible content rows; a visible toast/tooltip or
  no-data/error popup fails the action. View-more activation may open either a
  row-content grid or a service screen.
- `open_service`: requires a service name and uses the left-menu or “Tất cả
  dịch vụ” fallback navigation. A service can also be entered from the Home
  “Thể loại” row with `focus_row`, `focus_text`, and `press_ok`.
- `open_search`: opens the global search page through the left menu.
- `search_content`: requires a content `name` and `type` (`channel`, `movie`,
  or `content`), enters the normalized name through the virtual keyboard,
  submits `#callSearch`, waits three seconds, and focuses a fuzzy result.
- `play_content`: requires a visible content `name` and `type` (`channel`,
  `movie`, or `content`), then verifies playback of the matching visible item.
- `play_search_result`: plays the result currently focused by `search_content`.
- `play_row`: requires either a 1-based `rowIndex` or a `rowName`; optional
  positive `count` limits the number of items, and omitted `count` requests all
  reachable items in the selected row. Omitted-count row playback is bounded
  by row exhaustion rather than the shared short batch runtime budget; every
  attempted poster is recorded and a failed poster does not stop later items.
  On Home, numeric row indexes exclude the single `homePage1` promotional row:
  public `rowIndex: N` resolves to the `homePage2_(N-1)_*` item IDs.
- `play_all_contents`: Browser-only action that plays the content-list page
  opened from a `Xem tất cả` poster. It is the multi-row counterpart of
  `play_row`: the list page is a grid, and playback follows reading order - left
  to right inside a row, then down to the leftmost poster of the next row.
  Optional positive `count` limits the number of posters in that order; optional
  positive `rowCount` limits the number of rows; the two are mutually exclusive
  and neither means the whole list. The action requires the current route to be
  `specialModuleList`, `specialModuleListV2`, or `shortHome`, rejects
  `channel-list` with a dedicated message (its rows and items use the channel
  format and need their own test), and fails closed on any other screen. The
  list page detaches rows scrolled out of the visible window and calls its
  load-more API as focus nears the end of the grid, so traversal steps with the
  remote, re-reads the focused `<idName>_<row>_<col>` position, retries a step
  dropped during a load-more fetch, and ends only when a Down press no longer
  changes rows. View-more posters inside the list are stepped over without an
  Enter. Per-poster evidence, continue-after-failure behavior, and the row
  playback report table match `play_row`; `count`/`rowCount` are the only bound,
  with no implicit runtime budget.
- `play_home_trailers`: Browser-only parameterless action that tests every
  distinct Home promotional trailer through remote `Xem ngay` → player or
  Album-detail check → Back navigation. It reads the trailer name from the
  trusted promo title, captures a post-activation screenshot for every trailer,
  reports healthy video as `playable`, visible Album detail content as
  `album_opened`, and retains all names/statuses/types/screenshots in the
  selected test's user report. The bounded run is large enough for the reported
  16-item Home carousel and does not impose a fixed trailer count. Its return
  cleanup delegates to the shared adaptive player/detail-close helper used by
  generic Browser player checks and row playback; Home supplies only the Home
  promo boundary. The helper supports destinations requiring one or two Back
  presses and dismisses a recognized exit-confirmation dialog without another
  close press.
- `assert_screen`: checks visible body text.
- `press_back`: sends Backspace; optional `count` repeats it.
- `wait_for_ready`: accepts `app`, `home`, `content`, or `player`.

After activating the account-login method, the login workflow handles the
optional service-consent popup with native remote focus: it moves up to
`#user-consent-popup-accept-all-checkbox`, moves down to
`#user-consent-popup-footer-checkbox`, activates both checkboxes, then focuses
`#user-consent-btn-submit` and confirms. Deployments without that popup continue
directly to the username keyboard. During the asynchronous transition from
credential submission to profile selection, the workflow monitors for the
device-limit popup (`Vượt quá số lượng thiết bị cho phép`), remotely activates
`Tiếp tục`, and waits for that popup to close before selecting a profile. The
shared focus model reads `.active` inside `#dialog_confirm_v2`,
`#dialog_alert_v2`, `#dialog_alert_full`, `#dialog_confirm_full`, and the
`#user-consent-popup` root; regular controls continue to use `.focused`. Generic
case cleanup still calls `window.processLogOut` after the run to release the
account.

Every action is validated before browser interaction. Server data must not
provide JavaScript, module paths, selectors, or function names.

`run-test-case-mytv.spec.js` reads the cache key in `TEST_CASE_CACHE_KEY` (or
the legacy `TEST_CASE_FOLDER_ID`) when `TEST_CASE_CACHE_PATH` is present;
otherwise it reads `TEST_CASE_PATH` (defaulting to the project fixture). It selects
`TEST_CASE_ID` and calls `runTestCase`. The runner compiles or validates the
case, dispatches actions in order, wraps each step with the existing artifact
mechanism, and returns structured per-step results.

After all action steps pass, recognized `expectedResult` values add a final
`expected_result` check. Playback-success wording waits for the configured
player-check timeout (6 seconds by default), then waits for a healthy playing
player; service- and view-more-success wording (`Vào`/`Mở` a service or item,
or category `bình thường`/`thành công`) requires the activation check to have
observed a non-Home destination with visible content rows. A visible
auto-hide toast/tooltip or no-data/error popup fails service access. Player
checks capture the player screen before cleanup, use the shared adaptive
player/detail-close helper to return to the prior screen, then wait two seconds when final so
watching-session teardown API calls can complete, unless the next action
explicitly waits for the player or performs its own Back action.
Failed player checks retain that player-screen capture in the compact report.

The retained terminal channel/movie/search workflows use separate
post-activation settle delays in `activateVerifiedTarget`; those delays wait for
the destination screen after `Enter` and do not inspect player health.

After each generic selected-case run, `run-test-case-mytv.spec.js` invokes the
trusted app cleanup function `window.processLogOut` in a `finally` path and
awaits its result. A cleanup failure after a passing case is recorded as a
failed `logout_cleanup` step; when the test already failed, the original test
failure remains authoritative. The shared legacy session fixture is not logged
out automatically because ordered legacy specs may reuse its authentication.

## Credentials and Sensitive Data

Literal credentials are allowed in test cases because separate cases may use
separate accounts. Treat `testcased.json`, downloaded cases, Playwright output,
and report directories as sensitive data.

`app/main.js` recursively replaces a login action's `password` with `••••••`
before returning cases to the renderer. The renderer masks passwords again when
formatting an action preview. The main-process startup log contains case and
path metadata, not action credentials. The raw case is still available to the
Playwright runner and its case attachment, so do not publish reports containing
private fixture data.

## Environment Variables

### Electron generic runner

- `APP_URL` — target MyTV URL passed to the selected case; the Electron generic
  runner sets it from the source-controlled constant in `app/main.js`, while the
  retained terminal specs may still override their own URL through this variable.
- `TEST_CASE_PATH` — fixture path used by the child Playwright process.
- `TEST_CASE_ID` — selected case ID.
- `TEST_CASE_CACHE_PATH` — user-data cache path for API-downloaded cases.
- `TEST_CASE_CACHE_KEY` — selected folder ID or `campaign:<campaignId>` cache key.
- `TEST_CASE_FOLDER_ID` — legacy/compatibility folder cache key for the selected API case.
- `MYTV_PREVIEW_PATH` — live screenshot output path.
- `MYTV_CASE_RESULT_PATH` — per-case structured result sidecar for the compact user report.
- `MYTV_INTERACTIVE_CDP_URL` — CDP endpoint for interactive preview.
- `MYTV_INTERACTIVE_VIEW_SCALE` — interactive preview scale.
- `MYTV_TEST_RESOLUTION` — validated Browser resolution (`1280x720` by default
  or `1920x1080`) snapshotted for the child process.
- `MYTV_SIMULTANEOUS_DEVICES` — validated Browser batch limit (`1`, `2`, `4`,
  or `6`); the main process owns scheduling and does not pass this to
  Playwright workers.
- `MYTV_APP_ENVIRONMENT` — validated Browser app mode (`online`, `pilot`, or
  `stage`; defaults to `online`) passed to the generic child. The trusted
  runner uses it only for the fixed PILOT/STAGE page bootstrap.
- `MYTV_PLAYER_CHECK_TIMEOUT_SECONDS` — sanitized positive-integer player-check wait used by the generic Browser runner; defaults to 6 seconds.
- `MYTV_TEST_CASE_MAX_TIME_MINUTES` — sanitized positive-integer maximum duration for one generic Browser test case; defaults to 30 minutes and is configurable in Test configuration.
- `PLAYWRIGHT_BROWSERS_PATH` — app-private per-user Playwright Chromium root,
  assigned by the Electron main process. It is never a bundled browser cache or
  system-browser fallback.
- `PLAYWRIGHT_HTML_REPORT` — report output directory.

### Legacy terminal specs

The retained helper option parsers support:

```text
APP_URL
USERNAME
PASSWORD
CHANNEL_NAME
CHANNEL_PLAY_MODE
CHANNEL_CATE_NAME
CHANNEL_CATE_LIMIT
MOVIE_PLAY_MODE
MOVIE_NAME
MOVIE_CATE_NAME
MOVIE_CATE_LIMIT
SEARCH_KEYWORD
```

These are for the legacy terminal specs. The generic Electron run gets login
credentials from the selected case's `login` action rather than from separate
desktop form fields.

## Technical Patterns

### TV remote navigation

- `ArrowUp`, `ArrowDown`, `ArrowLeft`, and `ArrowRight` move focus.
- `Enter` activates the focused target.
- `Backspace` or `Escape` goes back.
- `remoteFocusById` and `remoteFocusByText` verify the `.focused` state.
- Virtual-keyboard helpers enter each character through focused keyboard keys.

### Vietnamese matching

`normalizeVietnameseText()` in `tests/lib/text-utils.js` removes accents,
maps `đ`/`Đ` to `d`/`D`, lowercases, and normalizes whitespace. Content and
service lookup must use the existing fuzzy helpers instead of exact raw-string
comparisons.

### Readiness and artifacts

Use the wait utilities and observers in `tests/lib/waits.js`,
`tests/lib/workflows.js`, and `tests/lib/playback.js` for asynchronous app
state. Use `runStep` and the artifact helpers so failures retain screenshots,
popup text, focused state, player state, and search/movie diagnostics.

Electron runs write the user-facing compact report to
`<userData>/user-report/test-report.html`, with one row per selected test and a
`Details` row for every test. The row shows the expected result; passed tests
also show their final viewport screenshot, while failed tests show failed item
name, poster, and screenshot. `play_row` details list every attempted poster
with its name, DOM ID, `content_id`, poster, player/error screenshot, pass/fail
result, and error text when present; the testcase remains failed when any row
poster fails.
The Playwright HTML report remains under `<userData>/playwright-report` for
debugging and is not the user-facing report.

### Content rows and playback

`collectVisibleContentRows()` and `focusRequestedContentRow()` detect visible
rows using dimensions, vertical grouping, headings, and focus state. Preserve
the existing batch-budget behavior and row-return navigation when changing
legacy playback helpers.

Numeric Home row selection uses the stable `homePage2_<zero-based-row>_<item>`
ID pattern rather than counting the `homePage1` promotional row. An indexed
Home target may be present in the DOM while offscreen, partially visible, or
still missing its title/heading during lazy rendering; the resolver must reveal
it through remote vertical navigation, wait for the target row's stable IDs and
card geometry, and never fall back to row-title matching for a numeric request.
Row playback skips the trusted `.view_more[item_view_more="1"]` navigation poster
instead of activating or recording it. Row playback failure messages enumerate
each failed content ID and name.

After the shared player/detail close boundary is detected, row playback waits
1.5 seconds for the previous screen's poster geometry to finish re-rendering
before refocusing the current item or pressing Right for the next poster.

Browser case runs use the validated 1280x720 or 1920x1080 logical Playwright
viewport (1280x720 by default), matching the selected MyTV TV UI layout. The
viewport is part of the app's responsive layout, so it can change which rows
and posters are currently rendered; semantic actions must remain resolution-
agnostic by deriving visibility from the runtime viewport and using remote
navigation to reveal offscreen targets. Do not hard-code one supported
resolution into an action/helper.
Electron may render that logical surface at a smaller visual scale inside the
six preview holders, but it does not reduce the document viewport.
The six Browser preview cards must remain inside their assigned 3x2 grid rows;
retain the card row-bound (`max-height: 100%`) guard alongside the 16:9 sizing
so maximized-window geometry cannot make adjacent rows overlap.

### Preview and CDP

The fixture writes screenshots atomically to `MYTV_PREVIEW_PATH`. Electron polls
that file for live preview images. Interactive preview connects through CDP and
uses `MYTV_INTERACTIVE_CDP_URL`; settings and logs modals temporarily suspend
the BrowserView and restore it afterward.

LG preview frames originate only from genuine Appium screenshots, pass through
the main-process safe IPC filter as PNG data URLs, and are observation-only.
The renderer must never use a local file path, synthetic image, or manual TV
control as an LG preview.

## Adding or Changing Tests

For a new server-shaped action:

1. Update the schema allowlist and validation.
2. Add or update a contract test before the handler.
3. Implement the handler through existing MyTV helpers.
4. Add compiler coverage only when a real fallback description requires it.
5. Update `testcased.json` with explicit actions for reliable local execution.
6. Keep credentials out of logs and avoid committing sensitive fixtures.

For a legacy spec, import the shared fixture and helper facade, preserve
keyboard-only interaction, and run the login spec first when the flow depends
on the shared session.

Never execute deployment scripts under `bash-script/` during ordinary
investigation or validation; they are destructive and host-dependent.

## Validation Commands

```bash
npm run test:unit
node --check app/main.js
node --check app/preload.js
node --check app/renderer/renderer.js
npx playwright test tests/run-test-case-mytv.spec.js --list
git diff --check
```

Live staging and Electron smoke runs are environment-dependent. If they are not
run, record that separately from local unit and syntax results.

LG compatibility work is currently paused. Before resuming it, read
`docs/real-tv-appium/LG-COMPATIBILITY-PAUSE-HANDOFF.md`; it records the exact
safe diagnostic state and the required approval boundary.

## Maintenance

When the architecture changes, update this file and `README.md` for new case
actions, entry points, environment variables, credential-handling behavior,
source/cache boundaries, and packaging changes. Keep API and cache behavior
behind the main-process boundary and preserve the local fixture fallback.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
