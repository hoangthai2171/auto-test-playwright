# AGENTS.md

AI agent context document for the MyTV Auto Test project.

---

## Project Overview

**MyTV Auto Test** is an automated testing framework for the MyTV HTML5 TV web application. It combines Playwright test automation with an Electron desktop UI, enabling both terminal-based test execution and a visual test runner with live browser preview.

**Project Type**: Quality Assurance / Test Automation  
**Primary Language**: JavaScript (CommonJS)  
**Key Technologies**: Playwright, Electron, Node.js  
**Target Platform**: HTML5 TV web app controlled via TV remote navigation (arrow keys, Enter, Backspace)

**Important**: When text input is required in the TV app, always use the app's virtual keyboard character-by-character, not standard web form input methods.

---

## Architecture

### Three Execution Modes

1. **Terminal with Playwright CLI** – Direct test execution via `npx playwright test`
2. **Interactive Terminal Runner** – Guided CLI with prompts (`npm run test:headed`)
3. **Electron Desktop App** – Visual UI with live browser preview and test controls

### Key Components

```
app/
  main.js              Electron main process, spawns Playwright, manages IPC
  preload.js           IPC bridge for renderer security
  renderer/            Desktop UI (HTML/CSS/JS)
    index.html
    styles.css
    app.js

tests/
  fixtures/
    mytv-session-fixture.js    Shared browser context, CDP integration
  lib/
    mytv-helpers.js             Core navigation, fuzzy search, assertions
    ai-plan-runner.js           Executes AI-generated JSON test plans
  *.spec.js                     Test specs (login, channel, movie, search, settings, AI)

scripts/
  run-headed.js                 Interactive terminal runner
  run-electron-app.js           Launches Electron in dev mode
  install-playwright-browsers.js Bundle browsers locally

playwright.config.js            1920×1080 viewport, single worker, HTML reports
package.json                    Dependencies, build config, npm scripts
```

### Test Architecture

- **Single shared session**: `workers: 1` in Playwright config ensures all specs share one browser context
- **Login first**: `login-mytv.spec.js` must run before other specs to establish session
- **TV remote control**: Navigation uses arrow keys, Enter, Backspace (no mouse clicks)
- **Fuzzy text matching**: Vietnamese text normalization (accent removal, `đ → d`) for search
- **CDP integration**: Electron embeds a BrowserView connected via Chrome DevTools Protocol for live preview

---

## Test Capabilities

### Standard Test Modes

1. **Login** – Authenticate with username/password, select profile
2. **Channel Playback** – Open "Truyền hình", play channel by name or category
3. **Movie Playback** – Open "Phim truyện", play first movie or search by name
4. **Search Content** – Search by keyword, select best result, verify playback
5. **Settings** – Open "Cài đặt", verify account info screen

### AI Test Planning Mode

The project includes a **local + cloud AI planner** that converts natural-language Vietnamese test descriptions into structured JSON plans.

**Supported actions**:
- `open_service` – Open a service from left menu (e.g., "Phim truyện", "Danet")
- `play_all_items_in_first_row` – Play all items in a content row, with options:
  - `rowName` – Target row by title (e.g., "Phim song song")
  - `rowIndex` – Target row by position (0 = first, 1 = second)
  - `rowPosition` – "last" for last row
  - `itemLimit` – Play only N items
  - `waitSeconds` – Playback duration per item (default 6)
  - `backPresses` – How many back presses to return to row (default 2)

**Local planner**: Built-in regex-based planner for simple requests like "mở dịch vụ phim truyện và play hàng đầu tiên"

**Cloud AI planner**: If `AI_API_KEY` is provided, the Electron app calls OpenAI-compatible or Gemini endpoints to parse complex requests into JSON plans.

**Plan storage**: Generated plans are saved to `userData/ai-plans/latest-plan.json` and attached to Playwright reports.

---

## Key Technical Patterns

### 1. TV Remote Navigation

All interaction uses keyboard navigation simulating a TV remote:

- `page.keyboard.press("ArrowUp/Down/Left/Right")` for focus movement
- `page.keyboard.press("Enter")` for selection
- `page.keyboard.press("Backspace")` or `Escape` for back/cancel
- Virtual keyboard for text input (character-by-character focus + Enter)

**No mouse clicks**. The app is a TV interface.

### 2. Fuzzy Vietnamese Text Matching

`normalizeVietnameseText()` in `tests/lib/mytv-helpers.js:686`:
- NFD normalization removes accents
- `đ/Đ → d/D`
- Case-insensitive, whitespace-normalized

Search uses **token-based fuzzy matching** with coverage scoring. Partial matches work: "can phong" matches "Căn Phòng Tử Thần".

### 3. Element Location Strategy

Elements are located by:
1. **ID attributes** – `channel_name`, `movie_name`, `service_title` attributes
2. **Fuzzy text search** – Multiple attribute sources (`title`, `title_text`, `textContent`)
3. **Visible bounding box** – Size/position constraints filter menu items vs content
4. **Focus state** – `.focused` CSS class indicates current TV remote focus

Example: `findChannelIdByName()` at line 1241 scores candidates by normalized label match.

### 4. Content Row Detection

`collectVisibleContentRows()` at line 1759:
- Finds all visible content items (120×80 to 520×420 px)
- Groups by vertical position (±40px tolerance)
- Matches rows to heading text above them
- Returns structured rows with `{ rowY, title, normalizedTitle, items[] }`

### 5. Playback Verification

`assertPlayback()` at line 488:
- Waits 6 seconds after pressing Enter
- Checks for error popups
- Queries player state: `hasVideo`, `isProbablyPlaying`
- Attaches JSON player state, screenshots, popup text to test report

### 6. Shared Browser Session

`mytv-session-fixture.js`:
- `workers: 1` in Playwright config
- `scope: "worker"` for context and options fixtures
- Login spec runs first, subsequent specs reuse authenticated session
- CDP viewport scaling for Electron BrowserView

### 7. Live Preview Stream

Electron app:
- Sets `MYTV_PREVIEW_PATH` env var to `userData/browser-preview/current.png`
- Playwright fixture captures screenshots every 1 second via `page.screenshot()`
- Atomic write with temp file + rename to avoid partial reads
- Main process polls file mtime, sends base64 data URL to renderer via IPC

### 8. Interactive Browser Mode

For Electron app "Interactive" preview type:
- Electron launches with `--remote-debugging-port` flag
- Playwright connects via `chromium.connectOverCDP()`
- BrowserView embeds the CDP-connected page
- Real-time zoom/bounds applied via CDP `Emulation.setDeviceMetricsOverride`
- User sees live browser, test controls it via CDP

---

## Environment Variables

Test runtime accepts these variables (terminal and Electron):

```bash
APP_URL                  # Default: https://html5stage.mytv.vn/
USERNAME                 # MyTV account username
PASSWORD                 # MyTV account password

# Channel mode
CHANNEL_NAME             # e.g., "VTV1 HD"
CHANNEL_PLAY_MODE        # "by_name" | "by_cate"
CHANNEL_CATE_NAME        # Category name for by_cate mode
CHANNEL_CATE_LIMIT       # Item limit, 0 = all

# Movie mode
MOVIE_PLAY_MODE          # "first" | "by_name" | "by_cate"
MOVIE_NAME               # Movie title for by_name mode
MOVIE_CATE_NAME          # Category name for by_cate mode
MOVIE_CATE_LIMIT         # Item limit, 0 = all

# Search mode
SEARCH_KEYWORD           # Search query

# AI mode
AI_PLAN_PATH             # Path to JSON plan file

# Electron preview
MYTV_PREVIEW_PATH        # Screenshot output path for live preview
MYTV_INTERACTIVE_CDP_URL # CDP URL for interactive mode
MYTV_INTERACTIVE_VIEW_SCALE # Zoom scale for interactive view

# Playwright
PLAYWRIGHT_BROWSERS_PATH # Browser binary location
PLAYWRIGHT_HTML_REPORT   # HTML report output directory
```

---

## AI Plan JSON Schema

Generated by AI or local planner, consumed by `tests/run-ai-plan-mytv.spec.js`:

```json
{
  "name": "Test name",
  "source": {
    "type": "local|ai|openai|gemini",
    "model": "gpt-4.1-mini",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "description": "Original Vietnamese request"
  },
  "steps": [
    {
      "action": "open_service",
      "serviceName": "Phim truyện"
    },
    {
      "action": "play_all_items_in_first_row",
      "waitSeconds": 6,
      "backPresses": 2,
      "rowName": "Phim song song",
      "rowIndex": 0,
      "rowPosition": "last",
      "itemLimit": 3
    }
  ],
  "report": {
    "include": ["title", "poster", "playbackStatus", "errorPopup", "screenshot"]
  }
}
```

---

## Build and Packaging

### Browser Binary Bundling

Playwright browsers are platform-specific. The project bundles them locally:

```bash
npm run browsers:install
# Installs chromium to .playwright-browsers/

npm run app:build:mac
# Electron Builder copies .playwright-browsers -> Resources/playwright-browsers
# Runtime: PLAYWRIGHT_BROWSERS_PATH points to bundled location
```

**Important**: Do NOT cross-compile. Windows installer must be built on Windows with Windows browser binaries.

### Electron Builder Config

`package.json` build section:
- `asar: false` – Node modules stay unpacked for Playwright
- `files` – Includes `app/`, `tests/`, `playwright.config.js`, `node_modules/`
- `extraResources` – Copies `.playwright-browsers/` to app resources
- Mac target: `zip` (DMG requires signing/notarization)
- Windows target: `nsis`

---

## Common Patterns for AI Agents

### Adding a New Test Spec

1. Create `tests/new-test.spec.js`
2. Import `{ test }` from `./fixtures/mytv-session-fixture`
3. Import helpers from `./lib/mytv-helpers`
4. Use `runStep()` to wrap test steps for failure artifacts
5. Add spec to `testModes` in `app/main.js` if adding to desktop UI
6. Add to `playbackModes` in `scripts/run-headed.js` if adding to interactive terminal

### Adding a New Helper Function

Place in `tests/lib/mytv-helpers.js`:
- Follow existing naming: `openXFromLeftMenu()`, `findXIdByName()`, `assertXPlayback()`
- Use `page.evaluate()` for DOM queries with visibility/bounding box checks
- Use `page.waitForFunction()` with timeout for async conditions
- Always normalize Vietnamese text for string matching
- Attach artifacts to `testInfo` for failures

### Adding AI Plan Actions

1. Define action schema in `app/main.js` system prompt (lines 426-438)
2. Add action handler in `tests/lib/ai-plan-runner.js` `runAiPlan()`
3. Implement helper in `tests/lib/mytv-helpers.js` if needed
4. Update `validateAiPlan()` allowed actions set

### Debugging Tips

- Use `await page.screenshot({ path: "debug.png" })` liberally
- Use `await page.pause()` for manual inspection (headed mode only)
- Check `.focused` class in DOM: `page.locator(".focused")`
- Inspect `getFocusedState()` result: `{ id, text, label, rect }`
- Test Vietnamese text matching: `normalizeVietnameseText("Căn phòng") === "can phong"`
- Playwright trace: `trace: "on-first-retry"` in config

---

## Project Constraints and Context

### TV App Peculiarities

- **No standard HTML controls**: Custom virtual keyboard, no input fields
- **Navigation is focus-based**: All state is tracked via `.focused` CSS class
- **Element IDs are unreliable**: Text/attribute-based fuzzy search required
- **Dynamic content loading**: Scroll down to reveal more rows
- **Popup close buttons**: Multiple Vietnamese text variants for "Close" button
- **Left menu auto-hides**: Must press ArrowLeft or Backspace to open

### Vietnamese Language Handling

- All UI text is Vietnamese
- Test descriptions (AI mode) are in Vietnamese
- Error messages in Vietnamese
- Fuzzy matching required due to:
  - Accented characters (á, ă, â, etc.)
  - Unicode normalization variants
  - Letter đ/Đ (not d/D)
  - Case sensitivity

### Electron App Constraints

- Reports stored in `app.getPath("userData")`, not in app bundle
- Browser binaries must be bundled with app (no global Playwright cache)
- CDP connection requires `--remote-debugging-port` at app launch
- BrowserView zoom must be applied after page load
- IPC is one-way (main → renderer) for security

---

## File Reference

### Entry Points

- `app/main.js:67` – `ipcMain.handle("run-test")` – Test execution entry
- `tests/fixtures/mytv-session-fixture.js:14` – Playwright fixture setup
- `tests/lib/mytv-helpers.js:21` – `getTestOptions()` – Env var parsing
- `scripts/run-headed.js:51` – Interactive terminal entry

### Core Helpers

- `mytv-helpers.js:47` – `openAppAndEnterLoginPage()` – Login flow entry
- `mytv-helpers.js:81` – `loginWithAccount()` – Username/password auth
- `mytv-helpers.js:104` – `chooseFirstProfileAndEnterHome()` – Profile selection
- `mytv-helpers.js:112` – `closeHomePopupsAndVerifyHome()` – Popup handling
- `mytv-helpers.js:143` – `openServiceFromLeftMenuOrAllServices()` – Service navigation
- `mytv-helpers.js:197` – `playAllItemsInFirstRow()` – Batch content playback
- `mytv-helpers.js:336` – `searchAndOpenBestContent()` – Search flow
- `mytv-helpers.js:488` – `assertPlayback()` – Playback verification
- `mytv-helpers.js:1635` – `focusRequestedContentRow()` – Row finding logic
- `mytv-helpers.js:1759` – `collectVisibleContentRows()` – DOM row detection

### AI Planning

- `app/main.js:381` – `createAiPlan()` – Plan generation router
- `app/main.js:394` – `createPlanWithAi()` – Cloud AI planning
- `app/main.js:574` – `createLocalPlan()` – Built-in planner
- `app/main.js:623` – `validateAiPlan()` – Plan schema validation
- `tests/lib/ai-plan-runner.js:8` – `loadAiPlan()` – Load from file
- `tests/lib/ai-plan-runner.js:17` – `runAiPlan()` – Execute plan steps

### Electron IPC

- `app/main.js:67` – `run-test` – Start test
- `app/main.js:185` – `stop-test` – Kill process
- `app/main.js:194` – `show-interactive-browser` – Show BrowserView
- `app/main.js:218` – `hide-interactive-browser` – Hide BrowserView
- `app/main.js:247` – `test-ai-connection` – Verify API key
- `app/main.js:256` – `open-report` – Open HTML report
- `app/renderer/app.js` – Renderer IPC calls

---

## Testing Philosophy

This project tests a **TV web app with remote control navigation** where:
- Mouse clicks don't work (TV has no mouse)
- Traditional Playwright locators like `page.click()` won't work
- All interaction is keyboard-based focus movement
- Element visibility and bounding boxes matter more than selectors
- Vietnamese text requires fuzzy matching
- Session sharing reduces test time (no repeated login)

AI agents should understand this is **not a standard web app test suite**. Navigation patterns, locator strategies, and assertions are custom-built for TV remote control interaction.

---

## Recommendations for AI Agents

### When Modifying Tests

1. **Preserve the TV remote navigation pattern** – Use arrow keys + Enter, not clicks
2. **Use fuzzy Vietnamese text matching** – Don't assume exact string equality
3. **Always attach failure artifacts** – Screenshots, JSON state, error text
4. **Test with single worker** – Session sharing requires `workers: 1`
5. **Run login spec first** – Other specs depend on authenticated session

### When Adding Features

1. **Update all three execution modes** – Terminal, interactive terminal, Electron UI
2. **Add environment variables** – Terminal needs env vars, Electron needs form fields
3. **Update README and this file** – Keep documentation in sync
4. **Test on target platform** – macOS builds don't validate Windows bundles

### When Debugging

1. **Check focused element** – Use `getFocusedState()` or inspect `.focused` in DevTools
2. **Verify Vietnamese text normalization** – Log both raw and normalized strings
3. **Check viewport size** – Tests assume 1920×1080 logical viewport
4. **Verify browser bundle** – Packaged app must include platform-specific browsers
5. **Check CDP connection** – Interactive mode requires debug port + successful CDP connect

---

## Document Maintenance

**Last Updated**: 2024 (created during project analysis)  
**Project Version**: 1.0.0  
**Primary Maintainer**: Thai Nguyen  
**Purpose**: AI agent context for code understanding, modification, and feature development

When making significant architectural changes, update this document to reflect:
- New test modes or AI actions
- Changes to navigation patterns
- New environment variables
- Electron IPC protocol changes
- Build/packaging process updates
