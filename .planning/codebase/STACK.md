# Technology Stack

**Analysis Date:** 2026-07-13

## Languages

**Primary:**
- JavaScript (CommonJS) - Application, Electron processes, scripts, and Playwright specs in `app/`, `scripts/`, `tests/`, and `playwright.config.js`; CommonJS is explicitly selected in `package.json`.

**Secondary:**
- HTML - Electron renderer document in `app/renderer/index.html`.
- CSS - Electron renderer styling in `app/renderer/styles.css`.
- JSON - npm metadata, lockfile, generated AI plans, and Playwright artifacts; package metadata is in `package.json` and the npm lockfile is `package-lock.json`.

## Runtime

**Environment:**
- Node.js 20+ recommended by `README.md`; no pinned Node version file or `engines` declaration is detected.
- Electron 31.7.7 (declared as `^31.7.7`) runs the desktop main and renderer processes from `app/main.js` and `app/renderer/`.
- Chromium is provisioned by Playwright for test execution through `scripts/install-playwright-browsers.js`.

**Package Manager:**
- npm - invoked by all scripts in `package.json` and documented in `README.md`.
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**
- Electron ^31.7.7 - Desktop UI shell, BrowserWindow/BrowserView preview, process management, and IPC in `app/main.js` and `app/preload.js`.
- Playwright ^1.61.1 - Chromium automation framework and test runner, configured in `playwright.config.js` and used across `tests/`.

**Testing:**
- Playwright Test ^1.61.1 - Test runner, assertions, fixtures, HTML reporting, screenshots, and tracing in `playwright.config.js` and `tests/fixtures/mytv-session-fixture.js`.

**Build/Dev:**
- electron-builder ^24.13.3 - Packages macOS zip/DMG and Windows NSIS targets via the `build` configuration in `package.json`.
- Node child-process APIs - Launch Electron and Playwright subprocesses in `scripts/run-electron-app.js`, `scripts/run-headed.js`, and `app/main.js`.

## Key Dependencies

**Critical:**
- `playwright` ^1.61.1 - Drives the external MyTV HTML5 application with Chromium; its test API is imported in `playwright.config.js`, `tests/lib/mytv-helpers.js`, and `tests/fixtures/mytv-session-fixture.js`.
- `electron` ^31.7.7 - Hosts the local test-runner UI, secure preload bridge, BrowserView, and CDP debugging endpoint in `app/main.js` and `app/preload.js`.

**Infrastructure:**
- `electron-builder` ^24.13.3 - Produces distributable desktop builds and copies browser binaries from `.playwright-browsers/` into app resources, per `package.json`.
- Node built-ins (`node:fs/promises`, `node:child_process`, `node:path`, `node:readline/promises`) - Handle artifacts, spawning, paths, and terminal prompts in `app/main.js` and `scripts/`.

## Configuration

**Environment:**
- Provide test target and account inputs as `APP_URL`, `USERNAME`, and `PASSWORD`; `tests/lib/mytv-helpers.js` reads them in `getTestOptions()` and `app/main.js` passes GUI values to Playwright.
- Supply mode-specific inputs as `CHANNEL_NAME`, `CHANNEL_PLAY_MODE`, `CHANNEL_CATE_NAME`, `CHANNEL_CATE_LIMIT`, `MOVIE_PLAY_MODE`, `MOVIE_NAME`, `MOVIE_CATE_NAME`, `MOVIE_CATE_LIMIT`, and `SEARCH_KEYWORD`; parsing defaults live in `tests/lib/mytv-helpers.js`.
- Use `AI_PLAN_PATH` to select the JSON plan consumed by `tests/run-ai-plan-mytv.spec.js`; the Electron main process creates this plan under Electron `userData` in `app/main.js`.
- The desktop AI planner accepts `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, and `AI_ENDPOINT` as GUI values saved in renderer `localStorage` by `app/renderer/renderer.js`; no `.env` file is detected.
- Playwright runtime variables include `PLAYWRIGHT_BROWSERS_PATH` and `PLAYWRIGHT_HTML_REPORT`, assigned by `app/main.js`; `scripts/install-playwright-browsers.js` installs Chromium into `.playwright-browsers/`.
- Preview and CDP controls are `MYTV_PREVIEW_PATH`, `MYTV_INTERACTIVE_CDP_URL`, `MYTV_INTERACTIVE_VIEW_SCALE`, and optional `MYTV_INTERACTIVE_BROWSER_DEBUG_PORT`, used by `app/main.js` and `tests/fixtures/mytv-session-fixture.js`.

**Build:**
- `playwright.config.js` defines the test directory, 1920×1080 logical viewport scaling, Chromium project, single worker, HTML reporter, screenshot, and trace behavior.
- `package.json` defines `app:dev`, `app:build`, platform-specific build, browser installation, standard test, and interactive headed-runner commands.
- `package.json` configures `asar: false`, Electron Builder output directory `dist/`, local browser `extraResources`, macOS zip, and Windows NSIS packaging.
- No TypeScript, ESLint, Prettier, Babel, Vite/Webpack, Docker, or CI configuration is detected in repository-root configuration files.

## Platform Requirements

**Development:**
- Use Node.js 20+ and npm as documented in `README.md`.
- Run `npm install` and `npm run browsers:install`; the latter downloads platform-specific Chromium to `.playwright-browsers/` through `scripts/install-playwright-browsers.js`.
- Network access is required for the configured MyTV URL and optional OpenAI-compatible/Gemini planning endpoints, per `playwright.config.js` and `app/main.js`.

**Production:**
- Deployment target: packaged macOS desktop app (zip or DMG) and Windows desktop installer (NSIS), configured in `package.json`.
- Build each platform on that platform so `extraResources` contains matching Playwright browser binaries, as required by `README.md`.

---

*Stack analysis: 2026-07-13*
