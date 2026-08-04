# MyTV Auto Test

Desktop runner and Playwright regression suite for the MyTV HTML5 TV web app.
The Electron app runs server-shaped cases from a local fixture, while the
terminal suite keeps the older helper-based specs available for regression
coverage.

## Requirements

- Node.js 20+ recommended.
- npm.
- Network access to the target MyTV app URL.
- Network access when installing dependencies. The desktop app requests network access only after a user confirms its reviewed Browser installation.

Install dependencies:

```bash
npm install
```

The desktop app does not bundle Chromium. In **Settings → SDK configuration →
Browser configuration**, use **Auto configure**, then separately confirm
**Install reviewed Chromium** when it is missing. The project-pinned Playwright
Chromium is stored in private per-user app storage and is not a system-browser
installation.

For LG, **Settings → SDK configuration** first reviews local tools. After the
user separately confirms installation, the app installs the pinned Node/Appium
toolchain. It installs ChromeDriver only when the selected saved device exactly
matches a centrally shipped verified compatibility profile; otherwise it reports
`COMPATIBILITY_PROFILE_UNVERIFIED` and does not download a guessed driver.

The compatibility catalog is refreshable from the configured API in **SDK
configuration**. Maintainers validate new exact LG model/firmware mappings with
the repository-local `device-compatibility-check` workflow; only a passed,
explicitly confirmed result can add a new record or replace an existing pair in
`DEVICE-COMPATIBILITY.json`. Publishing that reviewed file to the API is a
separate manual maintenance action.

For an existing catalog mapping, **Settings → SDK configuration → Compatibility
catalog → Check device compatibility** provides a temporary, unsaved check. The
first confirmation creates a short-lived local CLI target only to inspect the
device identity. If the catalog has an exact mapping, select exactly one
product-gate validation and separately confirm its one-shot run. The fixed local
case signs in, opens Home and Search, searches for `VTV1 HD`, and starts the
matching search result. Its account is configured once in SDK configuration and
stored only with Electron encryption; it is not part of API-loaded test cases.
The temporary driver, CLI target, and in-memory connection values are removed afterward. An
unknown model/firmware pair stops before a driver download or test run; the app
never guesses a ChromeDriver or adds a catalog record.

LG compatibility investigation is currently paused. Maintainers resuming it
should read [LG Compatibility Pause Handoff](docs/real-tv-appium/LG-COMPATIBILITY-PAUSE-HANDOFF.md)
before any live-device work.

## Project Structure

```text
testcased.json                  Read-only local server-shaped fixture
ACTION-COMPILER.md              Server-side qaDescription-to-actions guide
app/
  main.js                       Electron main process and test-case runner IPC
  preload.js                    Safe IPC bridge
  flow-case-api.js              Flow-case API calls and timeout handling
  test-case-cache.js            Folder/campaign-keyed user-data cache
  renderer/                     Case browser, preview, logs, and settings UI
tests/
  run-test-case-mytv.spec.js    Generic Playwright entry point
  login-mytv.spec.js            Legacy login regression spec
  play-channel-mytv.spec.js     Legacy channel regression spec
  play-movie-mytv.spec.js       Legacy movie regression spec
  search-content-mytv.spec.js   Legacy search regression spec
  open-setting-mytv.spec.js     Legacy settings regression spec
  fixtures/                     Shared browser-session fixture
  lib/
    test-case-schema.js         Test-case and action validation
    test-case-source.js         Local fixture loading and case lookup
    test-case-compiler.js       Limited qaDescription fallback compiler
    test-case-action-runner.js  Validated action dispatch and step results
    mytv-helpers.js             Public helper facade
    workflows.js                Current helper workflows
    mytv-helpers.legacy.js      Retained legacy helper copy
scripts/
  run-headed.js                 Interactive terminal runner for legacy specs
  run-electron-app.js           Starts Electron in development mode
  install-playwright-browsers.js Terminal-only legacy browser-cache helper
playwright.config.js
```

## Run With the Electron Case Browser

The app restores the most recently downloaded API folder at startup. API-loaded
cases are downloaded from the configured flow-case folder or a selected running
campaign, validated, and stored in the Electron user-data cache at
`<userData>/testcases-cache.json`. Folder entries use their folder ID; campaign
entries use `campaign:<campaignId>` and never replace or become the startup
folder entry. `testcased.json` is used only as the local fallback when no cached
API folder is available.

1. Add or update server-shaped cases in `testcased.json`.
2. Start the desktop runner:

   ```bash
   npm run app:dev
   ```

3. Open Settings and configure `APP_URL`, API domain, API authorization/service-token value, project ID, environment (default `UI`), and Network config API timeout (default 30 seconds), then save. The configured value is sent verbatim in the `X-FlowTest-Service-Token` header and is redacted from Logs. In **Test configuration**, set `Test case maximum time (minutes)` to a positive integer (default 30 minutes) to control the maximum duration of one Browser test case, and set `Player check timeout (second)` to control the wait before Browser and LG player health checks (default 6 seconds). In **SDK configuration → Browser configuration**, review and, when needed, explicitly install the project-pinned Chromium.
4. Use the refresh icon beside **Chiến dịch** to load running campaigns or the refresh icon beside **Folders** to load folders. Selecting a campaign automatically refreshes **Folders** with only that campaign's folders; clearing the campaign refreshes the unfiltered project folders. Choose a folder before clicking `Get test cases`: with a campaign selected, cases come from that campaign and the folder supplies the result context; with no campaign selected, cases come only from the selected folder.
5. Search by case ID substring or name with the instant filter, then check one or more visible cases in the table.
6. Use `Detail` to review metadata, expected result, and normalized actions.
7. Click `Run Selected (N)` and watch the cases execute sequentially in the logs and optional browser preview.
8. Open the test report after the batch finishes. Use `Details` for any test to
   see its expected result; passed tests also show their final viewport
   screenshot. `play_row` details list every tested poster with its name,
   content ID, poster, player/error screenshot, pass/fail result, and any error;
   one failed poster makes the overall testcase fail while later posters are
   still tested.

The renderer captures checked case IDs in table order and sends one
`TEST_CASE_ID`, `APP_URL`, player-check timeout, test-case maximum time,
preview-settings, and the
active cache key at a time to the main process. Folder and campaign API calls
run through main-process IPC. A selected campaign scopes both the folder-tree
request and the direct testcase request with `campaignId`; the selected folder
path remains the result context. With no campaign selected, neither request
contains a campaign filter. A
full-screen spinner blocks interaction while an API call is active; timeout
failures show an alert and leave the existing list/cache untouched. The main
process validates each ID from the selected folder or campaign cache, then
starts the generic spec `tests/run-test-case-mytv.spec.js`. Campaign loading
uses each returned campaign copy's own `id`; `sourceFlowCaseId` is never used as
the execution ID. The renderer waits for each process to finish, records its row
status, and continues after a pass or failure. When every checked API-loaded
case has completed, it sends one
`PATCH /api/v1/projects/{projectId}/flow-cases/by-folder` request with the
selected folder path and each case's `tested` lifecycle status plus its
`testResult`. Campaign batches also include the selected `campaignId` on every
testcase result item. A stopped, skipped, local-fixture, or failed-to-launch
batch is not submitted partially.

Player checks wait for normal playback using the value from **Settings → Test
configuration** (6 seconds by default), capture the player screen for the
report, then use the shared adaptive player/detail-close helper before the next
non-player step or test completion. It observes the destination after each
Back, sends a second Back only when the first did not close the player, and
dismisses a recognized exit-confirmation popup without issuing an extra close
press. A final player check waits two seconds after closing so watching-session
teardown API calls can finish; player-check failures retain the player-screen
capture in the compact report.

Each generic case invokes the trusted app global `window.processLogOut` after
execution, including failed cases. The cleanup is awaited and is isolated from
the shared legacy session fixture.

If login displays the device-limit popup, the workflow detects its message and
remotely selects `Tiếp tục` before continuing to profile selection. The four
supported dialog families (`#dialog_confirm_v2`, `#dialog_alert_v2`,
`#dialog_alert_full`, and `#dialog_confirm_full`) report their active button
with `.active`; normal controls report focus with `.focused`.

Recognized `expectedResult` values are checked after all declared actions. Play
or Phát success wording waits for the configured player-check timeout (6 seconds
by default), then verifies a healthy playing player; service-screen
success wording verifies either left-menu/all-services navigation or the Home
“Thể loại” row route (`focus_row`, `focus_text`, `press_ok`) without requiring
the service name to appear on the destination screen.

The retained terminal channel/movie/search workflows have separate post-Enter
activation-settle delays in `activateVerifiedTarget`. Those delays only give the
application time to render the destination screen; they do not replace or
perform the player-health check.

### Case execution contract

Explicit `actions` are the preferred and authoritative representation. The
initial action vocabulary is:

- `login`
- `open_home`
- `focus_row`
- `focus_row_first_item`
- `focus_text`
- `press_ok`
- `open_service`
- `open_search`
- `search_content`
- `play_content`
- `play_search_result`
- `play_row`
- `play_home_trailers`
- `assert_screen`
- `press_back`
- `wait_for_ready`

`play_row` accepts a 1-based `rowIndex` or a `rowName`. An optional positive
`count` limits the run; when omitted, the Browser runner continues until the
selected carousel reaches its last reachable poster. Each poster is activated
through the remote Enter path, checked independently, and returned to the row
before the next poster is focused. A recognized playback/unsupported-device
dialog is recorded as that poster's failure and dismissed safely so the row
can continue. On Home, the single `homePage1` promotional row is excluded from
numeric counting, so public `rowIndex: 5` targets `homePage2_4_*`.

When `focus_text` immediately follows `focus_row` for Home `Thể loại`, it
scans the complete reachable service carousel, moving right and re-reading the
row until it finds the requested poster. It never falls back to a matching
left-menu label.

After any generic service activation (`open_service`, or `focus_row` →
`focus_text` → `press_ok` on Home `Thể loại`), the runner requires a non-Home
screen with visible content rows. A visible toast/tooltip or no-data/error
popup fails the action; an Enter press alone is not a successful service open.

`focus_row` requires a `rowName` and normally focuses its first visible item.
For a numbered poster, provide a positive 1-based `itemIndex`, for example
`{"action":"focus_row","rowName":"HTV","itemIndex":4}`. The helper uses
remote horizontal navigation to reach that position even when the poster is
initially outside the viewport.

Server responses should transpile `qaDescription` into explicit `actions`
before they reach the app. See [ACTION-COMPILER.md](ACTION-COMPILER.md) for the
grammar, normalization rules, output shapes, and failure behavior. If a case
still has no explicit actions, `test-case-compiler.js` provides the same
deterministic grammar as a migration fallback. Unsupported or ambiguous lines
fail with the case ID and original source line; it is not a general
natural-language executor.

Case login actions may contain literal test credentials because different
cases can use different accounts. Treat `testcased.json` as sensitive runtime
data and keep it out of commits when it contains private credentials. Passwords
are masked in the Electron action preview, and the main-process run log records
case metadata rather than action credentials. Playwright case attachments are
generated from the source case, so report folders also require appropriate
access control.

The local fixture remains available when no API folder has been downloaded.
Successful API responses are validated before an atomic, timestamped cache
replacement, and the generic executor uses the same action handlers for either
local or cached cases.

Playback actions use only content currently visible in the TV page's rows:

```json
{"action":"play_content","name":"VTV1 HD","type":"channel"}
{"action":"play_content","name":"Dune","type":"movie"}
{"action":"open_search"}
{"action":"search_content","name":"Căn phòng tử thần","type":"movie"}
{"action":"play_search_result","type":"movie"}
{"action":"play_row","rowIndex":2,"count":3}
{"action":"play_row","rowName":"Phim song song"}
{"action":"play_home_trailers"}
```

`play_content` verifies the selected item is playing. `play_row` opens each
item, waits for playback, uses the shared adaptive player/detail-close helper to
return to the row, waits 1.5 seconds for the carousel to re-render, and
continues after individual failures. Its `rowIndex` is 1-based; omit `count` to
request all items. The row playback JSON/HTML report includes the name and
poster of each attempted item, including failed items. When failures occur, the
action error also lists them as `content ID - content name` entries.

`play_home_trailers` tests every distinct promotional trailer shown on Home. It
uses remote `Xem ngay` → player/Album-detail check → Back navigation so
returning Home lets the carousel advance. A healthy video is `playable`; an
Album detail screen with a visible content list is `album_opened`; otherwise the
item is `failed`. The local user report lists each trailer name, activation
status/type, and post-activation screenshot, including failed trailers. The
bounded run is large enough for the reported 16-trailer Home carousel and does
not cap the number of discovered trailers. This action is currently Browser-only because its trusted DOM contract uses Home's
`#promo-video-next` and trailer-title elements. It uses the same shared adaptive
player/detail-close helper as generic player checks and row playback; Home only
adds its Home-promo readiness predicate. The helper sends one remote Back at a
time, permits a second Back only when the first destination is not ready, and
dismisses a detected exit-confirmation popup without another close press.

search_content uses the on-screen virtual keyboard, activates #callSearch,
waits three seconds, then focuses the best fuzzy match in the visible
search-result rows. play_search_result plays that focused result.

Reports created by the packaged app are written to the Electron user-data
folder, not inside the application bundle.

## Legacy Terminal Regression Specs

The older terminal specs remain available for helper and navigation regression
coverage. They retain their non-case-specific environment options and should be
run with the login spec first when a shared authenticated session is required.

Interactive terminal runner:

```bash
npm run test:headed
```

Direct legacy spec examples:

```bash
npx playwright test tests/login-mytv.spec.js tests/play-channel-mytv.spec.js --project=chromium
npx playwright test tests/login-mytv.spec.js tests/play-movie-mytv.spec.js --project=chromium
npx playwright test tests/login-mytv.spec.js tests/search-content-mytv.spec.js --project=chromium
npx playwright test tests/login-mytv.spec.js tests/open-setting-mytv.spec.js --project=chromium
```

The retained legacy options are `APP_URL`, `USERNAME`, `PASSWORD`,
`CHANNEL_NAME`, `CHANNEL_PLAY_MODE`, `CHANNEL_CATE_NAME`,
`CHANNEL_CATE_LIMIT`, `MOVIE_PLAY_MODE`, `MOVIE_NAME`, `MOVIE_CATE_NAME`,
`MOVIE_CATE_LIMIT`, and `SEARCH_KEYWORD`. These options are consumed by the
legacy terminal specs only; the Electron case browser uses the selected case's
actions instead.

Run the pure local tests with:

```bash
npm run test:unit
```

## Test Behavior Notes

- The suite uses `workers: 1` because the shared fixture intentionally reuses
  one browser session.
- MyTV interaction is keyboard-only: Arrow keys navigate, Enter activates, and
  Backspace/Escape goes back.
- Text input uses the app's virtual keyboard character by character, not normal
  browser typing.
- Vietnamese matching ignores accents and case, maps `đ` to `d`, and supports
  partial token matches.
- Readiness checks and action failures preserve screenshots, focused-element
  state, popup text, and other existing artifacts where available.

## Build the Desktop App

Browser binaries are not packaged. Each desktop user configures the
project-pinned Chromium after installation through **Settings → SDK
configuration → Browser configuration**.

### Build commands

The target platform is selected by the command. Unless an architecture is
specified explicitly, electron-builder uses the current host architecture.

Build the macOS zip (ARM64 on Apple Silicon, x64 on Intel macOS):

```bash
npm run app:build:mac
```

Build a DMG when local signing and disk-image tooling are available:

```bash
npm run app:build:mac:dmg
```

Build the Windows installer using the current host architecture:

```bash
npm install
npm run app:build:win
```

On Apple Silicon, `npm run app:build:win` produces a Windows ARM64 installer.
To build a Windows x64 installer explicitly, use:

```bash
npx electron-builder --win --x64
```

In summary:

| Command | Output |
| --- | --- |
| `npm run app:build:mac` | macOS ZIP for the host architecture |
| `npm run app:build:mac:dmg` | macOS DMG for the host architecture |
| `npm run app:build:win` | Windows NSIS installer for the host architecture |
| `npx electron-builder --win --x64` | Windows x64 NSIS installer |

The app obtains the host-appropriate reviewed Chromium only through the
post-install Browser configuration flow.

## Browser Configuration Notes

Electron resolves Playwright Chromium from its private per-user storage. A
missing browser disables Browser test runs and offers **Configure Browser**;
the setup screen reviews first and installs only after a separate confirmation.
No Chromium archive is included in macOS or Windows artifacts. The
`npm run browsers:install` command remains only for legacy terminal development
and is not used by the Electron app.

Browser case runs use a 1920x1080 logical Playwright viewport, matching the
MyTV TV layout. The Electron preview can display that surface at a smaller
visual scale when the app window is smaller; that visual scale does not change
the page's logical viewport or carousel behavior.

## Reports and Artifacts

Terminal runs use the Playwright HTML reporter configured in
`playwright.config.js`. Failure artifacts can include screenshots, popup text,
player state, focus state, and search or movie candidate details. Electron runs
show a compact test report from `userData/user-report/test-report.html`,
whose `Details` rows show the expected result and final viewport screenshot for
passed tests. `play_row` details also show every tested poster, content ID,
pass/fail result, and player/error screenshot. The full Playwright HTML report remains under
`userData/playwright-report` for debugging.

## Common Issues

### Electron binary failed to install

Reinstall dependencies:

```bash
npm install
```

### Playwright cannot find a browser

Open **Settings → SDK configuration → Browser configuration**, select **Auto
configure**, then confirm **Install reviewed Chromium**. The app never falls
back to a system browser.

### macOS blocks the app

Unsigned internal builds may be blocked by Gatekeeper. Open the app from
Finder with right-click > Open, or configure signing and notarization for
distribution.

### DMG creation fails

Use the zip target while `hdiutil`, signing, and notarization setup are being
stabilized:

```bash
npm run app:build:mac
```

## LG device setup status

The LG sidebar uses a device list with Add/Edit dialog. It accepts only device
name, host, and passphrase; saved connection values stay encrypted in app-owned
storage and are never returned to the renderer. **Validate and save** is
intentionally unavailable until a separately approved live-TV preflight; it
does not currently contact or alter a TV.

After a device is already saved and its webOS CLI target is already registered,
**Check connection** performs a separate read-only identity and MyTV-app
inventory check. It uses only a verified user-imported LG CLI or an explicitly
configured Advanced CLI; it does not require Appium or ChromeDriver, and never
falls back to a system CLI or changes the TV.

### LG Run Selected

LG uses the same folder, case selection, **Run Selected**, report, and result
sync workflow as Browser. Select a saved LG device, ensure the local SDK review
shows the required toolchain and verified compatibility profile, then select
one or more cases. **Run Selected** remains disabled while those local
prerequisites are unavailable and provides a **Configure SDK** shortcut.

Starting an LG batch always shows a single confirmation for the selected cases.
The confirmation explains that the run can foreground MyTV, reset only MyTV
local storage, send native remote input, enter the selected case login through
MyTV's virtual keyboard, and perform trusted logout cleanup. After confirmation
the main process performs a new read-only identity and installed-app preflight;
failure at that point sends no remote input and starts no Appium session.

The workspace displays fixed redacted progress and genuine TV frames when
available. Business failures continue to the next selected case. Technical
failures restart the current case from a clean MyTV-only reset up to three
times, then require **Keep retrying** or **Stop**; pairing always requires a
manual operator decision. Completed API-loaded cases use the same result-sync
shape as Browser. No TV artifacts are sent to the API.

This implementation has local contract coverage, but a real GUI LG batch is
not a routine smoke test: it needs fresh explicit approval and the live-TV
preflight documented in `docs/real-tv-appium/poc-runbook.md`. It never deploys,
uninstalls, pairs automatically, or changes a TV app outside an approved run's
MyTV-only local-storage reset.
