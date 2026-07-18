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

`testcased.json` is the read-only local fallback fixture. `app/main.js` also
owns flow-case API IPC, sanitizes passwords for the renderer, validates the
selected case ID from either the fixture or the user-data cache, and starts the
generic `tests/run-test-case-mytv.spec.js` entry point. The renderer sends the
selected case ID, `APP_URL`, preview settings, and active folder ID for a run.

Explicit structured `actions` are authoritative. The deterministic compiler
is a migration fallback for a limited set of `qaDescription` lines: login with
literal credentials, enter home, open a named service, press back, and wait for
the known app/home/content/player readiness states. Unsupported or ambiguous
lines must fail with the case ID and original line; never guess arbitrary
behavior or evaluate server-provided code.

API folder and case retrieval runs in the main process through the preload IPC
bridge. Successful case responses are validated and atomically replace the
matching folder-ID entry in `<userData>/testcases-cache.json`. The generic
action executor receives either the local fixture source or a validated cache
source and does not contain API or cache logic.

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
  preload.js                      Context-isolated IPC bridge
  flow-case-api.js                Flow-case API URLs, fetch, normalization, timeout
  test-case-cache.js              Atomic folder-keyed user-data cache
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
playwright.config.js              1920x1080 viewport, one worker, HTML report
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
- `open_service`: requires a service name and uses left-menu/all-services
  fallback navigation.
- `assert_screen`: checks visible body text.
- `press_back`: sends Backspace; optional `count` repeats it.
- `wait_for_ready`: accepts `app`, `home`, `content`, or `player`.

Every action is validated before browser interaction. Server data must not
provide JavaScript, module paths, selectors, or function names.

`run-test-case-mytv.spec.js` reads the folder-keyed cache when
`TEST_CASE_FOLDER_ID` and `TEST_CASE_CACHE_PATH` are present; otherwise it
reads `TEST_CASE_PATH` (defaulting to the project fixture). It selects
`TEST_CASE_ID` and calls `runTestCase`. The runner compiles or validates the
case, dispatches actions in order, wraps each step with the existing artifact
mechanism, and returns structured per-step results.

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
- `MYTV_INTERACTIVE_CDP_URL` — CDP endpoint for interactive preview.
- `MYTV_INTERACTIVE_VIEW_SCALE` — interactive preview scale.
- `PLAYWRIGHT_BROWSERS_PATH` — bundled or local browser directory.
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

## Maintenance

When the architecture changes, update this file and `README.md` for new case
actions, entry points, environment variables, credential-handling behavior,
source/cache boundaries, and packaging changes. Keep API and cache behavior
behind the main-process boundary and preserve the local fixture fallback.
