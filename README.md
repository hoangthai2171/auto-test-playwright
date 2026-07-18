# MyTV Auto Test

Desktop runner and Playwright regression suite for the MyTV HTML5 TV web app.
The Electron app runs server-shaped cases from a local fixture, while the
terminal suite keeps the older helper-based specs available for regression
coverage.

## Requirements

- Node.js 20+ recommended.
- npm.
- Network access to the target MyTV app URL.
- Network access when installing dependencies or Playwright browser binaries.

Install dependencies and the platform-specific browser bundle:

```bash
npm install
npm run browsers:install
```

The browser command creates `.playwright-browsers/`, which is bundled into the
Electron application.

## Project Structure

```text
testcased.json                  Read-only local server-shaped fixture
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
  install-playwright-browsers.js
playwright.config.js
```

## Run With the Electron Case Browser

The app starts with `testcased.json` as a local fallback. API-loaded cases are
downloaded from the configured flow-case folder, validated, and stored in the
Electron user-data cache at `<userData>/testcases-cache.json`, keyed by folder
ID. Downloading the same folder again replaces only that folder's cache entry.

1. Add or update server-shaped cases in `testcased.json`.
2. Start the desktop runner:

   ```bash
   npm run app:dev
   ```

3. Open Settings and configure `APP_URL`, API domain, project ID, environment (default `UI`), and Network config API timeout (default 30 seconds), then save.
4. Select a folder in the sidebar and click `Get test cases`; use the refresh icon to reload the folder tree.
5. Search by case ID substring or name with the instant filter, then check one or more visible cases in the table.
6. Use `Detail` to review metadata, expected result, and normalized actions.
7. Click `Run Selected (N)` and watch the cases execute sequentially in the logs and optional browser preview.
8. Open the Playwright report after the batch finishes.

The renderer captures checked case IDs in table order and sends one
`TEST_CASE_ID`, `APP_URL`, preview-settings, and active folder ID at a time to
the main process. Folder and case API calls run through main-process IPC. A
full-screen spinner blocks interaction while an API call is active; timeout
failures show an alert and leave the existing list/cache untouched. The main
process validates each ID from the selected folder cache, then starts the
generic spec `tests/run-test-case-mytv.spec.js`. The renderer waits for each
process to finish, records its row status, and continues after a pass or
failure.

### Case execution contract

Explicit `actions` are the preferred and authoritative representation. The
initial action vocabulary is:

- `login`
- `open_home`
- `open_service`
- `assert_screen`
- `press_back`
- `wait_for_ready`

If a case has no explicit actions, `test-case-compiler.js` supports a small,
deterministic subset of `qaDescription`: login with a literal account, enter
home, open a named service, press back, and wait for the known app/home/content
or player readiness states. Unsupported or ambiguous lines fail with the case
ID and original source line. The compiler is a migration fallback, not a
general natural-language executor.

Case login actions may contain literal test credentials because different
cases can use different accounts. Treat `testcased.json` as sensitive runtime
data and keep it out of commits when it contains private credentials. Passwords
are masked in the Electron action preview, and the main-process run log records
case metadata rather than action credentials. Playwright case attachments are
generated from the source case, so report folders also require appropriate
access control.

The local fixture remains available when no API folder has been downloaded.
Successful API responses are validated before an atomic cache replacement, and
the generic executor uses the same action handlers for either local or cached
cases.

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

Install browser binaries for the current platform before building:

```bash
npm run browsers:install
```

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

Build on Windows or Windows CI so the bundled browser binaries match the
target platform:

```bash
npm install
npm run browsers:install
npm run app:build:win
```

Do not use macOS browser binaries for a Windows package.

## Browser Bundle Notes

Electron Builder copies:

```text
.playwright-browsers -> Contents/Resources/playwright-browsers
```

Packaged runs set `PLAYWRIGHT_BROWSERS_PATH` to that resource directory.
Development runs use `.playwright-browsers/` from the project root.

## Reports and Artifacts

Terminal runs use the Playwright HTML reporter configured in
`playwright.config.js`. Failure artifacts can include screenshots, popup text,
player state, focus state, and search or movie candidate details. Electron runs
store reports and test output under Electron `userData` and expose report
controls in the UI.

## Common Issues

### Electron binary failed to install

Reinstall dependencies:

```bash
npm install
```

### Playwright cannot find a browser

Install the local bundle and rebuild if necessary:

```bash
npm run browsers:install
```

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
