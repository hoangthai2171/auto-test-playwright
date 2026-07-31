# AGENTS.md

Agent context for the MyTV Auto Test project.

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
restores the most recently downloaded API folder from the user-data cache; it
uses the fixture only when no cached folder is available. `app/main.js` also
owns flow-case API IPC, sanitizes passwords and authorization headers for the renderer, validates the
selected case ID from either the fixture or the user-data cache, and starts the
generic `tests/run-test-case-mytv.spec.js` entry point. The renderer sends the
selected case ID, `APP_URL`, preview settings, and active folder ID for a run.
After every selected API-loaded case has completed, the renderer submits one
validated `tested`/`testResult` batch through main-process IPC; stopped,
skipped, local-fixture, and launch-failed batches are never partially sent.

The desktop supports two execution targets: Browser (the default) and LG webOS.
The Settings dialog owns Browser configuration, LG SDK configuration, the
saved LG-device list, redacted connection status, managed/advanced toolchain
selection, and the compatibility catalog. Browser runs require the separately
confirmed managed Chromium installation. LG runs reuse the same case selection,
batch control, report, and result-submission flow, but require an explicitly
confirmed real-TV operation.

The LG renderer may send only a selected saved-device ID, case IDs, optional
folder ID, and explicit confirmation to the LG IPC boundary. The main process
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

API folder and case retrieval runs in the main process through the preload IPC
bridge. Successful case responses are validated and atomically replace the
matching folder-ID entry in `<userData>/testcases-cache.json`, timestamped for
startup restoration. The generic
action executor receives either the local fixture source or a validated cache
source and does not contain API or cache logic. Result submission uses
`PATCH /api/v1/projects/{projectId}/flow-cases/by-folder` with a `folderPath`
and per-case `tested` lifecycle/test-result records.

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
  main.js                         Electron process, case loading, run IPC
  test-report.js                  Compact user report HTML/data generation
  preload.js                      Context-isolated IPC bridge
  flow-case-api.js                Flow-case API URLs, fetch, normalization, timeout
  test-case-cache.js              Atomic folder-keyed user-data cache
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
playwright.config.js              1920x1080 viewport, one worker, debug HTML report
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
- `focus_row`: requires a row/category name and navigates to it using its first visible item as the TV focus anchor. An optional positive 1-based `itemIndex` focuses that visible item instead. Home rows are matched by visible headings/content and do not depend on dynamic row IDs.
- `focus_row_first_item`: focuses the leftmost item in the currently active row, regardless of content type.
- `focus_text`: focuses a visible control by its human-readable text through remote navigation. Immediately after `focus_row` for the Home `Thể loại` row, it scans every reachable service poster in that carousel, moving right and re-reading the row until it finds the requested service or reaches the end. It never falls back to a same-named left-menu item.
- `press_ok`: sends the remote OK/Enter key. After a Home `Thể loại` service
  poster it immediately requires a non-Home destination with visible content
  rows; a visible toast/tooltip or no-data/error popup fails the action.
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
  items within the existing batch runtime budget.
- `assert_screen`: checks visible body text.
- `press_back`: sends Backspace; optional `count` repeats it.
- `wait_for_ready`: accepts `app`, `home`, `content`, or `player`.

After credential submission, the login workflow detects the device-limit popup
(`Vượt quá số lượng thiết bị cho phép`) and remotely activates `Tiếp tục` to
remove the oldest logged-in device before profile selection. The shared focus
model reads `.active` inside `#dialog_confirm_v2`, `#dialog_alert_v2`,
`#dialog_alert_full`, and `#dialog_confirm_full`; regular controls continue to
use `.focused`. Generic case cleanup still calls `window.processLogOut` after
the run to release the account.

Every action is validated before browser interaction. Server data must not
provide JavaScript, module paths, selectors, or function names.

`run-test-case-mytv.spec.js` reads the folder-keyed cache when
`TEST_CASE_FOLDER_ID` and `TEST_CASE_CACHE_PATH` are present; otherwise it
reads `TEST_CASE_PATH` (defaulting to the project fixture). It selects
`TEST_CASE_ID` and calls `runTestCase`. The runner compiles or validates the
case, dispatches actions in order, wraps each step with the existing artifact
mechanism, and returns structured per-step results.

After all action steps pass, recognized `expectedResult` values add a final
`expected_result` check. Playback-success wording waits six seconds, then waits
for a healthy playing player; service-success wording (`Vào`/`Mở` a service or
category `bình thường`/`thành công`) requires the activation check to have
observed a non-Home destination with visible content rows. A visible
auto-hide toast/tooltip or no-data/error popup fails service access. Player
checks capture the player screen before cleanup,
remotely return to the prior screen, then wait two seconds when final so
watching-session teardown API calls can complete, unless the next action
explicitly waits for the player or performs its own Back action.
Failed player checks retain that player-screen capture in the compact report.

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

- `APP_URL` — target MyTV URL passed to the selected case.
- `TEST_CASE_PATH` — fixture path used by the child Playwright process.
- `TEST_CASE_ID` — selected case ID.
- `TEST_CASE_CACHE_PATH` — user-data cache path for API-downloaded cases.
- `TEST_CASE_FOLDER_ID` — folder cache key for the selected API case.
- `MYTV_PREVIEW_PATH` — live screenshot output path.
- `MYTV_CASE_RESULT_PATH` — per-case structured result sidecar for the compact user report.
- `MYTV_INTERACTIVE_CDP_URL` — CDP endpoint for interactive preview.
- `MYTV_INTERACTIVE_VIEW_SCALE` — interactive preview scale.
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
name, poster, and screenshot.
The Playwright HTML report remains under `<userData>/playwright-report` for
debugging and is not the user-facing report.

### Content rows and playback

`collectVisibleContentRows()` and `focusRequestedContentRow()` detect visible
rows using dimensions, vertical grouping, headings, and focus state. Preserve
the existing batch-budget behavior and row-return navigation when changing
legacy playback helpers.

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
