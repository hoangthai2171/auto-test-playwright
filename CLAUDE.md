# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyTV Auto Test is a Playwright test suite wrapped in an Electron desktop app for testing a TV web application. The app is controlled like a TV remote (arrow keys for navigation, Enter for OK, Backspace for Back) and uses a virtual keyboard for text input rather than normal browser typing.

## Commands

### Running Tests

**Terminal runner (interactive):**
```bash
npm run test:headed
```

**Full test suite:**
```bash
npm test
```

**Single test file:**
```bash
npx playwright test tests/login-mytv.spec.js --project=chromium
```

**With environment variables:**
```bash
APP_URL="https://html5stage.mytv.vn/" \
USERNAME="ts1" \
PASSWORD="111222" \
CHANNEL_NAME="VTV1 HD" \
npx playwright test tests/login-mytv.spec.js tests/play-channel-mytv.spec.js --project=chromium
```

### Electron Desktop App

**Development mode:**
```bash
npm run app:dev
```

**Build for macOS:**
```bash
npm run browsers:install  # Always run before building
npm run app:build:mac
```

**Build for Windows (on Windows machine):**
```bash
npm install
npm run browsers:install
npm run app:build:win
```

### Browser Installation

```bash
npm run browsers:install
```

This installs Playwright browsers to `.playwright-browsers/` which gets bundled into the Electron app.

## Architecture

### Shared Browser Context Pattern

The test suite uses `workers: 1` and a custom fixture (`tests/fixtures/mytv-session-fixture.js`) that creates a shared browser context across all test specs. This is intentional: the specs are designed to run sequentially and share one logged-in session.

- `login-mytv.spec.js` must run before other specs
- All specs share the same browser context within a worker
- The fixture supports both normal runs and CDP connection mode for Electron integration

### TV Remote Control Navigation

The MyTV app simulates a TV interface:

- **Arrow keys** navigate between UI elements
- **Enter** activates the focused element (OK button)
- **Backspace/Escape** goes back
- Text input uses a **virtual keyboard** rendered in the app, not `page.keyboard.type()`

Helper functions for navigation are in `tests/lib/mytv-helpers.js`:
- `remotePress(page, key, delay)` - press a key and wait
- `remoteFocusById(page, id, maxMoves)` - navigate to an element by moving focus
- `remoteFocusByText(page, text, maxMoves)` - navigate to an element by text
- `getFocusedState(page)` - get currently focused element state

### Fuzzy Vietnamese Text Matching

The app uses fuzzy matching for finding content by name because:
- Vietnamese diacritics may be inconsistent
- Titles can be partial
- `đ` is treated as `d`
- Case is ignored

Key helpers:
- `normalizeVietnameseText(value)` - removes diacritics, lowercases, normalizes whitespace
- `findChannelIdByName()`, `findMovieContentIdByName()`, `findBestSearchResult()` - use fuzzy scoring
- Scoring prioritizes exact matches, then substring matches, then token coverage

### Content Row Navigation

The TV app displays content in horizontal rows. The helpers can:

- Find rows by title: `focusRequestedContentRow(page, { rowName: "Phim song song" })`
- Find rows by position: `focusRequestedContentRow(page, { rowIndex: 0 })` or `{ rowPosition: "last" }`
- Play all items in a row: `playAllItemsInFirstRow(page, testInfo, { waitSeconds: 6, itemLimit: 3 })`
- Navigate within rows while tracking position to avoid infinite loops

`collectVisibleContentRows(page)` detects content rows by:
- Finding visible elements with appropriate dimensions
- Grouping items by Y position (within 40px)
- Matching row headings that appear above the content

### Viewport Scaling and CDP

The fixture applies viewport scaling for Electron:
- Base viewport: 1920x1080
- Default scale: 0.5 (960x540 window)
- Uses CDP `Emulation.setDeviceMetricsOverride` for pixel-perfect scaling
- Electron app can connect via CDP (`MYTV_INTERACTIVE_CDP_URL`) for live preview mode

### AI Test Planning Mode

The app includes an AI mode that:
1. Takes a natural-language test description
2. Generates a JSON plan with actions (`open_service`, `play_all_items_in_first_row`)
3. Executes the plan with `tests/lib/ai-plan-runner.js`
4. Attaches the plan JSON to the Playwright report

The local planner (without API key) understands requests like:
```
Mở dịch vụ phim truyện và play 3 phim đầu tiên của cate "Phim song song"
```

### Test Helper Library Structure

`tests/lib/mytv-helpers.js` is 2800+ lines and organized by concern:

- **Options and env vars**: `getTestOptions()` reads env vars with fallbacks
- **Login flow**: `openAppAndEnterLoginPage()`, `loginWithAccount()`, `chooseFirstProfileAndEnterHome()`
- **Navigation**: `openLeftMenuFromHome()`, `openServiceFromLeftMenuOrAllServices()`, menu navigation
- **Content finding**: Channel, movie, search result finding with fuzzy matching
- **Playback**: `openChannel()`, `openMovieContent()`, `searchAndOpenBestContent()`
- **Assertions**: `assertPlayback()`, `assertChannelPlayback()`, `assertMoviePlayback()`
- **Popups**: `closeHomePopups()`, `closeAdvertisePopupIfVisible()`, `getVisiblePopup()`
- **Player state**: `getPlayerState()` checks video element and playback health
- **Content rows**: Row detection, navigation, and batch playback
- **Artifacts**: Screenshot and JSON attachment helpers for failures

When adding new test helpers, follow the existing pattern:
- Pure functions where possible
- Single responsibility per function
- Attach artifacts on failure
- Use fuzzy matching for Vietnamese text
- Return structured data (ids, metadata) rather than side effects

## Test Environment Variables

All test specs support these environment variables:

- `APP_URL` - MyTV app URL (default: `https://html5stage.mytv.vn/`)
- `USERNAME`, `PASSWORD` - login credentials
- `CHANNEL_NAME` - channel name for channel playback test
- `MOVIE_NAME` - movie name for movie playback (requires `MOVIE_PLAY_MODE=by_name`)
- `SEARCH_KEYWORD` - search keyword for search test
- `AI_PLAN_PATH` - path to JSON plan file for AI test mode

Electron app mode also uses:
- `MYTV_INTERACTIVE_CDP_URL` - CDP endpoint for connecting to Electron browser
- `MYTV_PREVIEW_PATH` - path for live screenshot preview stream
- `MYTV_INTERACTIVE_VIEW_SCALE` - viewport scale override

## Common Patterns

### Adding a New Test Spec

1. Import the shared fixture:
   ```javascript
   const { test, expect } = require("./fixtures/mytv-session-fixture");
   const { getTestOptions, openAppAndEnterLoginPage, /* ... */ } = require("./lib/mytv-helpers");
   ```

2. Use `options` fixture for env vars:
   ```javascript
   test("My test", async ({ page, options }) => {
     console.log(options.APP_URL);
   });
   ```

3. Ensure `login-mytv.spec.js` runs first (already configured in test order)

4. Use `runStep()` helper for automatic failure artifacts

### Finding and Focusing Elements

```javascript
// By exact text
await remoteFocusByText(page, /^Đăng nhập$/);

// By element ID
await remoteFocusById(page, "menu_item_1", 80);

// By fuzzy Vietnamese text (service, movie, channel)
const serviceId = await findServiceIdInAllServices(page, "Phim truyen");
await remoteFocusById(page, serviceId, 120);
```

### Handling Popups

```javascript
// Close home screen popups
await closeHomePopups(page);

// Check for error popups during playback
const popup = await getVisiblePopup(page);
if (popup) {
  console.log(`Error: ${popup.text}`);
}
```

### Verifying Playback

```javascript
const playerState = await getPlayerState(page);
expect(playerState.hasVideo).toBe(true);
expect(playerState.isProbablyPlaying).toBe(true);
```

### Row-Based Content Playback

```javascript
// Play first 5 items in a specific category row
await playAllItemsInFirstRow(page, testInfo, {
  rowName: "Phim song song",
  itemLimit: 5,
  waitSeconds: 6,
  backPresses: 2
});
```

## Debugging

- Playwright HTML report opens automatically after test runs (configured in `playwright.config.js`)
- Failure artifacts include: screenshots, popup text, player state JSON, search/movie candidates
- Use `--headed` for visible browser: `npx playwright test --headed`
- For Electron app debugging, check `userData` folder for logs and reports

## Platform-Specific Notes

- **Browser binaries are platform-specific**: Always run `npm run browsers:install` on the target platform before building
- **macOS DMG builds** may fail due to signing/notarization requirements; use zip target instead
- **Windows builds** must be created on Windows or Windows CI
- Electron app reports are written to `userData` folder, not the app bundle
