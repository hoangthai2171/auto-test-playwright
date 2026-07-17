# MyTV Auto Test

Desktop runner and Playwright test suite for the MyTV HTML5 TV web app.

The project can be used in two ways:

- Run tests from terminal with Playwright.
- Run tests from the Electron desktop UI and build a standalone app for macOS or Windows.

## Requirements

- Node.js 20+ recommended.
- npm.
- Network access to the target MyTV app URL.
- Network access when installing dependencies or Playwright browser binaries.

Install dependencies:

```bash
npm install
```

Install Playwright browser binaries into the local bundle folder:

```bash
npm run browsers:install
```

This creates `.playwright-browsers/`, which is bundled into the Electron app.

## Project Structure

```text
app/                         Electron desktop app
  main.js                    Main process, starts Playwright
  preload.js                 Safe IPC bridge
  renderer/                  UI files
scripts/
  run-headed.js              Interactive terminal runner
  run-electron-app.js        Starts Electron in dev mode
  install-playwright-browsers.js
tests/
  run-ai-plan-mytv.spec.js
  login-mytv.spec.js
  play-channel-mytv.spec.js
  play-movie-mytv.spec.js
  search-content-mytv.spec.js
  open-setting-mytv.spec.js
  fixtures/mytv-session-fixture.js
  lib/mytv-helpers.js
playwright.config.js
```

## Run With Desktop UI

Start the Electron app in development mode:

```bash
npm run app:dev
```

In the app UI:

1. Enter `APP_URL`, `USERNAME`, and `PASSWORD`.
2. Choose a test case:
   - Play kênh
   - Play phim truyện
   - Tìm kiếm nội dung
   - Mở cài đặt
   - Mô tả thủ công (A.I)
3. Fill the extra field for the chosen test:
   - `CHANNEL_NAME` for channel playback.
   - movie mode and `MOVIE_NAME` for movie playback by name.
   - `SEARCH_KEYWORD` for search playback.
   - `AI_TEST_DESCRIPTION` for the A.I mode.
4. Click `Run Test`.
5. Watch realtime logs in the app.
6. Click `Open Report` after the run finishes.

Reports created by the packaged app are written to the Electron user data folder, not inside the app bundle.

### A.I Manual Mode

`Mô tả thủ công (A.I)` turns a natural-language request into a structured JSON test plan, then runs that plan with the fixed Playwright executor.

The current executor supports:

- Opening a service from the left menu.
- If the service is not visible in the left menu, opening `Tất cả dịch vụ` and finding the service there.
- Playing all visible items in the first content row.
- Finding a requested cate/content row by title such as `Phim song song`, then playing items in that row.
- Limiting playback to the requested number of items such as `3 phim đầu tiên`.
- Waiting 6 seconds per item by default.
- Capturing playback status, popup text, poster, title, screenshots for failed items, and JSON/HTML report attachments.

If `AI API key` is left blank, the app uses the built-in local planner for requests like:

```text
Mở dịch vụ phim truyện và play toàn bộ hàng nội dung đầu tiên trong dịch vụ đó
Mở dịch vụ phim truyện và play 3 phim đầu tiên của cate "Phim song song"
```

If `AI API key` is provided, the app calls the configured OpenAI-compatible chat completions endpoint and expects JSON using the allowed actions:

- `open_service`
- `play_all_items_in_first_row`

The generated plan is saved under Electron `userData/ai-plans/latest-plan.json` and is attached to the Playwright report as `ai-plan.json`.

## Run From Terminal

Interactive headed runner:

```bash
npm run test:headed
```

The script asks for:

- `APP_URL`
- `USERNAME`
- `PASSWORD`
- test mode
- mode-specific values such as `CHANNEL_NAME`, `MOVIE_NAME`, or `SEARCH_KEYWORD`

Run the full Playwright suite:

```bash
npm test
```

List all tests:

```bash
npm run test -- --list
```

Run specific tests:

```bash
npx playwright test tests/login-mytv.spec.js tests/play-channel-mytv.spec.js --project=chromium
```

Run with environment variables:

```bash
APP_URL="https://html5stage.mytv.vn/" \
USERNAME="ts1" \
PASSWORD="111222" \
CHANNEL_NAME="VTV1 HD" \
npx playwright test tests/login-mytv.spec.js tests/play-channel-mytv.spec.js --project=chromium
```

Movie by name:

```bash
MOVIE_PLAY_MODE=by_name \
MOVIE_NAME="can phong tu than" \
npx playwright test tests/login-mytv.spec.js tests/play-movie-mytv.spec.js --project=chromium
```

Search:

```bash
SEARCH_KEYWORD="can phong tu than" \
npx playwright test tests/login-mytv.spec.js tests/search-content-mytv.spec.js --project=chromium
```

## Build Desktop App

Always install browser binaries for the current platform before building:

```bash
npm run browsers:install
```

### macOS

Build macOS zip:

```bash
npm run app:build:mac
```

Output:

```text
dist/MyTV Auto Test-1.0.0-arm64-mac.zip
dist/mac-arm64/MyTV Auto Test.app
```

Build macOS DMG:

```bash
npm run app:build:mac:dmg
```

DMG creation may fail on some machines because it depends on `hdiutil`, APFS/HFS support, and signing/notarization setup. The zip target is the safer default for now.

### Windows

Build on a Windows machine or Windows CI:

```bash
npm install
npm run browsers:install
npm run app:build:win
```

Output is written to `dist/`.

Important: Playwright browser binaries are platform-specific. Do not build the Windows installer using the macOS `.playwright-browsers` folder. Run `npm run browsers:install` on Windows before `npm run app:build:win`.

## Browser Bundle Notes

The app bundles Playwright browsers via Electron Builder `extraResources`:

```text
.playwright-browsers -> Contents/Resources/playwright-browsers
```

At runtime, the Electron app sets:

```text
PLAYWRIGHT_BROWSERS_PATH=<app resources>/playwright-browsers
```

This lets the packaged app use the bundled browser instead of relying on the user's global Playwright cache.

For development mode, the app uses:

```text
.playwright-browsers/
```

## Test Behavior Notes

- The suite uses `workers: 1` because specs intentionally share one browser session.
- `login-mytv.spec.js` should run before playback/search/settings specs.
- The app is controlled with TV remote-style keys:
  - Arrow keys for navigation.
  - Enter for OK.
  - Backspace/Escape for Back.
- Text input uses the app's virtual keyboard, not normal browser typing.
- Search supports fuzzy matching:
  - accents are ignored,
  - case is ignored,
  - `đ` is treated as `d`,
  - partial names can match longer titles.

## Reports And Artifacts

Playwright HTML report opens automatically for terminal runs because of `playwright.config.js`.

Failure artifacts can include:

- screenshots,
- popup text,
- player state JSON,
- search result candidates,
- no-result details.

For packaged Electron app runs, report and test output are stored under Electron `userData`, and can be opened from the app UI.

## Common Issues

### Electron binary failed to install

If Electron reports that it failed to install correctly, reinstall dependencies:

```bash
npm install
```

If needed, remove `node_modules` and install again.

### Playwright cannot find browser

Run:

```bash
npm run browsers:install
```

Then rebuild the app.

### macOS blocks the app

Unsigned apps may be blocked by Gatekeeper. For internal testing, open from Finder with right click > Open. For distribution outside the team, configure Apple Developer ID signing and notarization.

### Windows build from macOS

The project can define a Windows target, but a reliable Windows package should be built on Windows or Windows CI so the correct browser binaries and installer tooling are used.

### DMG build fails

Use the zip target:

```bash
npm run app:build:mac
```

DMG can be revisited after signing/notarization and local `hdiutil` behavior are stable.
