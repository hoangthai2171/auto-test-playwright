# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AgentMemory

Before a non-trivial task, use AgentMemory recall/smart-search for relevant decisions, affected files, test history, and failed approaches. Treat recalled items as leads and verify them against the current code.
Save durable decisions, non-obvious fixes, and reusable test lessons. Never save secrets, credentials, production dumps, or private customer data.

## Project Overview

MyTV Auto Test is a Playwright test-automation suite for the MyTV HTML5 TV web app, wrapped in an
Electron desktop runner that executes server-shaped test cases (`testcased.json` schema) rather than
ad-hoc scripts. The target app behaves like a TV interface: navigation uses a remote-control focus
model (`.focused` / `.active` classes) and text entry goes through the app's on-screen virtual
keyboard — never native form input or mouse-driven interaction.

This repo also has a detailed `AGENTS.md` with the full architecture writeup and a `README.md` with
end-user/operator instructions. Read those for depth; this file is the quick-start map.

## Commands

```bash
npm install                          # install deps
npm run app:dev                      # run the Electron desktop app in dev mode
npm test                             # run the full Playwright suite (playwright.config.js)
npx playwright test tests/foo.spec.js         # run one Playwright spec
npx playwright test -g "test name"            # run by title match
npm run test:unit                    # run all Node unit tests (tests/unit/*.test.js)
node --test tests/unit/foo.test.js   # run a single unit test file
npm run test:tv:contract             # run the TV contract spec (tests/run-test-case-tv.spec.js)
npm run test:list:contract           # play_all_contents contract spec (no live app needed)
npm run test:popup:contract          # playback popup detector spec (real DOM, no live app)
npm run test:channel:contract        # channel-list profile spec (real DOM, no live app)
npm run test:headed                  # interactive terminal runner for legacy specs
npm run browsers:install             # install/cache the pinned Playwright Chromium
npm run app:build / app:build:mac / app:build:win   # electron-builder packaging + artifact SHA-256 report
npm run app:build:win -- --x64       # extra args pass straight through to electron-builder
```

There is no lint/typecheck script configured (no ESLint/Prettier config in the repo).

Unit tests use Node's built-in test runner (`node --test`), not Jest/Mocha — assertions are plain
`node:assert`. Playwright specs live directly under `tests/` (not `tests/unit/`).

## Architecture

Two independent execution paths share the same low-level helpers but have separate entry points:

### 1. Electron case runner (primary path)

```
testcased.json / API-loaded cases (cached in Electron userData)
        |
tests/lib/test-case-source.js   (load + lookup)
        |
tests/lib/test-case-schema.js   (validate/normalize)
        |
   explicit `actions` (authoritative) -------- OR -------- qaDescription
        |                                                      |
        |                                    tests/lib/test-case-compiler.js (deterministic fallback;
        |                                    unsupported/ambiguous lines fail closed, never guessed)
        v                                                      |
tests/lib/test-case-action-runner.js  <------------------------+
        |
      MyTV helpers (tests/lib/*.js) via tests/lib/mytv-helpers.js facade
```

- `app/main.js` is the Electron main process: owns flow-case API IPC, credential/token redaction for
  the renderer, case-ID validation, and starts `tests/run-test-case-mytv.spec.js` as a child process
  per case.
- `app/browser-batch-runner.js` schedules Browser-target batches: one worker child per active slot
  (1/2/4/6 concurrent devices), each with isolated preview/result/test-results/debug-report paths.
- `app/flow-case-api.js`, `app/test-case-cache.js`, `app/campaign-flow-case-workflow.js` handle
  folder/campaign retrieval from the flow-case API and the atomic local cache that backs GUI restore.
- `app/app-update-*.js` implement `Settings > Application update`: the manifest comes from a
  parameterless `GET {API_DOMAIN}/api/v1/app-updates/latest`, the app itself compares `version` and
  picks the artifact for its own platform/arch, the renderer never sees the artifact URL, and only a
  checked release whose declared size and SHA-256 both match is installed. See README.md's
  "Application update" section for the manifest contract the server must serve.
- `app/lg-*.js` files implement the second execution target — real LG webOS TVs via Appium
  (`app/loopback-appium-client.js`, loopback-only, native remote control + virtual keyboard,
  `noReset: true`). This path never deploys/uninstalls/resets the TV app and never uses
  `appium:rcMode: "js"` or `webos:clearApp`.
- `app/renderer/` is the case-browser/preview/settings UI (context-isolated via `app/preload.js`).
- Explicit `actions` in a case are authoritative over `qaDescription`; see `ACTION-COMPILER.md` for
  the server-side description→actions grammar that should be applied before cases reach the app.

### 2. Terminal regression suite (legacy path)

Standalone Playwright specs (`tests/login-mytv.spec.js`, `play-channel-mytv.spec.js`,
`play-movie-mytv.spec.js`, `search-content-mytv.spec.js`, `open-setting-mytv.spec.js`) runnable via
`npm test` or `scripts/run-headed.js`. These call the same helper library directly instead of going
through the action-runner/schema layer.

### Shared session fixture — do not parallelize

`tests/fixtures/mytv-session-fixture.js` provides one worker-scoped browser context/CDP session.
`playwright.config.js` pins `workers: 1` intentionally: specs are ordered and reuse one authenticated
session. Do not change this to run in parallel without redesigning session ownership.

### Helper library layout (`tests/lib/`)

- `navigation.js` — remote-control focus primitives and virtual-keyboard entry
- `content-rows.js` — content-row discovery/navigation (carousels, view-more, row indexing)
- `playback.js` — player state and playback health assertions
- `waits.js` — readiness/pacing waits (the TV app has async transitions, not instant DOM updates)
- `artifacts.js` — failure screenshots and JSON/HTML report attachments
- `workflows.js` — current composed helper workflows; `mytv-helpers.legacy.js` is the retained old
  implementation kept for the legacy terminal specs
- `test-case-schema.js` / `test-case-source.js` / `test-case-compiler.js` /
  `test-case-action-runner.js` — the case-execution contract described above

### Key config

- `playwright.config.js` — `baseURL: https://html5stage.mytv.vn/`, viewport driven by
  `app/test-configuration.js` (`resolveTestViewport`), single worker, HTML + line reporters.
- `app/main.js` fixes `APP_URL` and the Browser `App environment` (`ONLINE`/`PILOT`/`STAGE`) bootstrap
  logic; these are not renderer-editable beyond the environment selector.
- `app/hosts-file.js` owns the source-controlled DNS host mapping; Settings only exposes
  add/remove controls, never raw values.
- `DEVICE-COMPATIBILITY.json` — the reviewed LG model/firmware compatibility catalog; changes must go
  through the repo-local `device-compatibility-check` workflow, not manual edits.

## Working with test cases

- Treat `testcased.json` as sensitive: cases can embed literal test credentials per-account. Keep it
  out of commits when it contains private credentials; passwords are masked in the Electron preview
  UI only, not in the raw fixture file.
- When adding/editing an action-based case, prefer explicit `actions` (see README.md's "Case
  execution contract" section for the current vocabulary: `login`, `open_home`, `focus_row`,
  `focus_text`, `press_ok`, `open_service`, `open_search`, `search_content`, `play_content`,
  `play_search_result`, `play_row`, `play_all_contents`, `play_home_trailers`,
  `player_seek`, `player_toggle_play`, `assert_screen`, `press_back`,
  `wait_for_ready`) over relying on the `qaDescription` fallback compiler.
- `play_row` on Home excludes the `homePage1` promotional row from numeric counting — public
  `rowIndex: 5` maps to `homePage2_4_*`.
- `player_seek` / `player_toggle_play` drive the remote inside an open VOD
  player (`tests/lib/player-control.js`). The player's three screen states are
  read from geometry, not classes: the detail panel stays mounted and slides to
  `x=-1280`, and `#player-button-play` keeps `focused` while the control bar is
  hidden. One seek step is one press on `#new-player-timeshift-bar` (the app
  owns the increment and accelerates, so the action verifies measured movement
  of the strip's middle thumbnail rather than a fixed jump); the seek
  stays pending until `press_ok` commits it, so the runner keeps the player open
  between those two steps. `press_ok` inside the player derives its required
  outcome from the current state (commit/play, pause a playing player, or toggle
  play/pause), and `expectedResult` pause wording (`Pause player/màn hình`)
  verifies an open, paused player.
- `play_all_contents` plays a content-list page opened from a `Xem tất cả` poster
  (`specialModuleList`, `specialModuleListV2`, `shortHome`, `channel-list`) in
  reading order, with
  optional `count` (posters) or `rowCount` (rows). `channel-list` is also
  supported through a route-scoped profile because it marks focus with
  `is_focus="1"` instead of the shared focus class; do not widen
  `FOCUS_SELECTORS` for it.

## Graphify (knowledge graph)

This repo has a graphify knowledge graph at `graphify-out/` (god nodes, community structure,
cross-file relationships). For codebase questions, prefer the `/graphify` skill / `graphify query`
over raw grep when `graphify-out/graph.json` exists — it returns a scoped subgraph instead of full
file dumps. Run `graphify update .` after code changes to keep it current.
