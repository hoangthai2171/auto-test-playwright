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
  test-case-cache.js            Folder-keyed user-data cache
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
cases are downloaded from the configured flow-case folder, validated, and stored
in the Electron user-data cache at `<userData>/testcases-cache.json`, keyed by
folder ID and timestamped. Downloading the same folder again replaces only that
folder's cache entry. `testcased.json` is used only as the local fallback when
no cached API folder is available.

1. Add or update server-shaped cases in `testcased.json`.
2. Start the desktop runner:

   ```bash
   npm run app:dev
   ```

3. Open Settings and configure `APP_URL`, API domain, optional API Authorize value, project ID, environment (default `UI`), and Network config API timeout (default 30 seconds), then save. In **Test configuration**, set `Player check timeout (second)` to a positive integer; it defaults to 6 seconds and controls the wait before Browser and LG player health checks. In **SDK configuration → Browser configuration**, review and, when needed, explicitly install the project-pinned Chromium. The authorization value is sent verbatim in the `Authorization` header for all flow-case API requests and is redacted from Logs.
4. Select a folder in the sidebar and click `Get test cases`; use the refresh icon to reload the folder tree.
5. Search by case ID substring or name with the instant filter, then check one or more visible cases in the table.
6. Use `Detail` to review metadata, expected result, and normalized actions.
7. Click `Run Selected (N)` and watch the cases execute sequentially in the logs and optional browser preview.
8. Open the test report after the batch finishes. Use `Details` for any test to
   see its expected result; passed tests also show their final viewport
   screenshot, while failed tests show the failed item name, poster, and screenshot.

The renderer captures checked case IDs in table order and sends one
`TEST_CASE_ID`, `APP_URL`, player-check timeout, preview-settings, and active folder ID at a time to
the main process. Folder and case API calls run through main-process IPC. A
full-screen spinner blocks interaction while an API call is active; timeout
failures show an alert and leave the existing list/cache untouched. The main
process validates each ID from the selected folder cache, then starts the
generic spec `tests/run-test-case-mytv.spec.js`. The renderer waits for each
process to finish, records its row status, and continues after a pass or
failure. When every checked API-loaded case has completed, it sends one
`PATCH /api/v1/projects/{projectId}/flow-cases/by-folder` request with the
selected folder path and each case's `tested` lifecycle status plus its
`testResult`. A stopped, skipped, local-fixture, or failed-to-launch batch is
not submitted partially.

Player checks wait for normal playback using the value from **Settings → Test
configuration** (6 seconds by default), capture the player screen for the
report, then return with Back before the next non-player step or test
completion. A final player check waits two seconds after Back so
watching-session teardown API calls can finish; player-check failures retain the
player-screen capture in the compact report.

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
- `assert_screen`
- `press_back`
- `wait_for_ready`

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
```

`play_content` verifies the selected item is playing. `play_row` opens each
item, waits for playback, returns to the row, and continues after individual
failures. Its `rowIndex` is 1-based; omit `count` to request all items. The
row playback JSON/HTML report includes the name and poster of each attempted item,
including failed items.

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

### macOS

Build the macOS zip:

```bash
npm run app:build:mac
```

Build a DMG when local signing and disk-image tooling are available:

```bash
npm run app:build:mac:dmg
```

### Windows

Build on Windows or Windows CI:

```bash
npm install
npm run app:build:win
```

The app obtains the host-appropriate reviewed Chromium only through the
post-install Browser configuration flow.

## Browser Configuration Notes

Electron resolves Playwright Chromium from its private per-user storage. A
missing browser disables Browser test runs and offers **Configure Browser**;
the setup screen reviews first and installs only after a separate confirmation.
No Chromium archive is included in macOS or Windows artifacts. The
`npm run browsers:install` command remains only for legacy terminal development
and is not used by the Electron app.

## Reports and Artifacts

Terminal runs use the Playwright HTML reporter configured in
`playwright.config.js`. Failure artifacts can include screenshots, popup text,
player state, focus state, and search or movie candidate details. Electron runs
show a compact test report from `userData/user-report/test-report.html`,
whose `Details` rows show the expected result and final viewport screenshot for
passed tests; the full Playwright HTML report remains under
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
