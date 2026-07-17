# Server-Driven MyTV Test Case Runner

Date: 2026-07-17  
Status: Design approved in conversation; implementation has not started.

## Summary

Replace the Electron app's fixed test-mode selector with a generic test-case runner. The app will read server-shaped test cases from a local `testcased.json` fixture first, display them in the Electron UI, and execute the selected case through a validated action DSL.

The long-term source will be an API. Downloaded cases will be validated and atomically saved to a separate Electron user-data cache so the app can run from the last successful download when the API is unavailable.

The runner will support two representations during migration:

1. Explicit structured `actions`, which are deterministic and authoritative.
2. A deterministic compiler for a limited set of `qaDescription` patterns when `actions` is absent.

The existing Playwright specs remain available as terminal regression tests, but they are removed from the Electron test-case selection flow. The AI key, provider, model, endpoint, manual-description mode, planner, and AI plan execution features are removed from the product flow.

## Goals

- Run server-shaped test cases rather than a hardcoded list of Electron test modes.
- Make explicit structured actions the canonical executable representation.
- Support the provided test-case list locally before API integration exists.
- Preserve the current TV remote-navigation and virtual-keyboard behavior.
- Reuse the existing MyTV helpers instead of duplicating navigation logic.
- Produce step-level results and artifacts suitable for debugging and reporting.
- Add API retrieval and local caching later without changing the executor.
- Keep legacy specs as internal regression coverage.

## Non-goals for the first milestone

- Building a general natural-language understanding system.
- Letting server data execute arbitrary JavaScript or Playwright code.
- Implementing API authentication, pagination, scheduling, or server-side result callbacks.
- Deleting the existing regression specs.
- Interpreting every possible Vietnamese `qaDescription` or `expectedResult` sentence.

## Current project constraints

The current project already provides the important runtime primitives:

- Electron starts Playwright through `app/main.js` and IPC.
- `tests/fixtures/mytv-session-fixture.js` provides a shared worker-scoped browser session.
- MyTV interactions use TV remote keys and the app's virtual keyboard.
- Existing helpers cover app readiness, login, profile selection, home popups, left-menu navigation, service selection, focus movement, content rows, and playback assertions.
- Existing specs import the shared helpers and remain useful for regression testing.

The new runner must preserve the single-worker session model, keyboard-only interaction, Vietnamese text normalization, focus verification, and failure artifacts.

## Chosen architecture

```text
testcased.json / API
        |
        v
test-case source adapter
        |
        v
test-case validation and normalization
        |
        +-- explicit actions present --> validate actions
        |
        +-- actions absent ------------> compile supported qaDescription
        |
        v
validated action list
        |
        v
generic Playwright executor
        |
        v
MyTV helper/action handlers
        |
        v
step results, artifacts, final report
```

The executor is independent of the source. A local file source and a future API source both return normalized test cases through the same interface:

```js
const result = await testCaseSource.load();
```

The executor receives one selected test case and does not know whether it came from the project fixture, the API, or the cache.

## Test-case data contract

The local fixture remains an array to match the server response shape. `actions` is optional during migration.

```json
[
  {
    "id": "12066",
    "projectId": "1",
    "folderId": "24",
    "slug": "case_mrol8f13",
    "name": "Kiểm tra vào dịch vụ phim truyện",
    "qaDescription": "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ app\nB3. Vào dịch vụ phim truyện",
    "platform": "tv",
    "environment": "UI",
    "preCondition": "Chưa đăng nhập tài khoản",
    "expectedResult": "Vào màn hình dịch vụ phim truyện thành công",
    "category": "Auto test demo",
    "status": "created",
    "mode": "script",
    "scriptVersion": 1,
    "actions": [
      {
        "action": "login",
        "username": "ts1",
        "password": "111222"
      },
      {
        "action": "open_home"
      },
      {
        "action": "open_service",
        "service": "Phim truyện"
      },
      {
        "action": "assert_screen",
        "text": "Phim truyện"
      }
    ]
  }
]
```

The first local fixture will contain the two provided cases and explicit actions for reliable execution. Their descriptive fields remain unchanged for display and reporting.

Literal credentials are accepted in this project because test cases may differ by account. The fixture and downloaded cache must be treated as sensitive runtime data and must not be logged in full or accidentally committed.

## Action DSL

The initial action vocabulary is intentionally small:

### `login`

Parameters:

```json
{
  "action": "login",
  "username": "ts1",
  "password": "111222"
}
```

The handler uses the existing app-entry, virtual-keyboard input, profile-selection, and home-readiness helpers. It reports success only after the authenticated home state is ready.

### `open_home`

Ensures the app is at the home screen and verifies the home-ready state. Because login currently enters home, this action is idempotent and should not restart login.

### `open_service`

Parameters:

```json
{
  "action": "open_service",
  "service": "Phim truyện"
}
```

The handler reuses left-menu and “Tất cả dịch vụ” fallback navigation.

### `assert_screen`

Parameters may initially use visible text:

```json
{
  "action": "assert_screen",
  "text": "Phim truyện"
}
```

The implementation should use the existing Vietnamese normalization and visible-state checks. Later versions may add `route`, `focusedText`, or a named screen contract without changing the action-dispatch model.

### `press_back`

Sends the TV back key through the existing remote-navigation helper. An optional `count` can be added when the action contract requires multiple presses.

### `wait_for_ready`

Waits for a named readiness condition such as `app`, `home`, `content`, or `player`, using the existing wait utilities rather than arbitrary fixed delays wherever possible.

Every action is validated against an allowlist. No action can provide a function name, module path, selector script, or arbitrary JavaScript.

## Description fallback compiler

When `actions` is absent, the compiler splits `qaDescription` into ordered `B1`, `B2`, etc. steps and recognizes only explicit patterns supported by the first milestone:

- Login with literal username and password.
- Enter or verify the home screen.
- Open a named service.
- Press back.
- Wait for a known readiness state.

The compiler emits the same action objects consumed by the normal executor. Unsupported lines fail compilation with the original line, test-case ID, and a suggested explicit action equivalent.

`expectedResult` is human-readable metadata by default. Only a small known set of result phrases may be compiled into `assert_screen`; unknown wording must not be guessed. Explicit assertion actions are the reliable long-term contract.

## Source and cache design

### Prototype source

`testcased.json` at the project root is a development fixture only. It is read as input and is not rewritten by the app.

### Future runtime cache

The API source will save cases separately under Electron `app.getPath("userData")`, for example:

```text
<userData>/testcases-cache.json
```

The cache wrapper is:

```json
{
  "schemaVersion": 1,
  "source": {
    "type": "api",
    "endpoint": "https://...",
    "fetchedAt": "2026-07-17T..."
  },
  "testCases": []
}
```

API refresh behavior:

1. Fetch the response.
2. Validate the top-level shape and each test case.
3. Write a temporary cache file in the same directory.
4. Rename it atomically to `testcases-cache.json`.
5. Preserve the previous cache if validation, network access, or writing fails.
6. Mark the UI source as API or cached.

When the API is unavailable, the app can load the last valid cache. The executor does not need to change for this behavior.

## Electron UI and IPC

The Electron UI becomes a test-case browser:

- Load and list cases by `id`, `name`, `platform`, `environment`, `status`, and `updatedAt`.
- Select one case.
- Show `preCondition`, `qaDescription`, `expectedResult`, and normalized actions.
- Run the selected case.
- Show live logs, current action, browser preview, final status, and report link.

The fixed playback-mode controls and AI settings are removed from the main flow. The conceptual IPC surface is:

```text
load-test-cases
get-test-case-details
run-test-case
stop-test
open-report
```

The future API integration adds `refresh-test-cases`; it should not require a new execution path.

The existing terminal runner and legacy specs remain available outside the Electron selection flow.

## Execution and reporting

Use a generic Playwright entry spec that receives the selected test case ID through environment or an equivalent runner option. It loads the case, compiles or validates its actions, then dispatches them in order.

Action handlers are kept in an action registry. Each handler:

- Validates parameters before browser interaction.
- Calls app-owned MyTV helpers.
- Wraps execution in the existing step/artifact mechanism.
- Returns a structured result with action, status, duration, and message.

The final result includes:

```json
{
  "testCaseId": "12066",
  "status": "passed",
  "source": "local|api|cache",
  "steps": [],
  "expectedResult": "..."
}
```

Failures must identify the test-case ID, action index, action name, message, screenshot, and focused-element state where available. Credentials must not be echoed in logs or report titles.

## Error boundaries

Failures are reported at the narrowest meaningful boundary:

```text
source loading
  → test-case validation
  → description compilation
  → action parameter validation
  → helper execution
  → assertion
```

Malformed input must fail before opening the browser when possible. Browser/runtime failures must preserve the existing screenshot, popup, focus-state, and player artifacts.

## Testing strategy

- Unit tests for test-case validation, action normalization, description compilation, and cache read/write.
- Contract tests for every action handler.
- Existing selector, wait, DOM, and helper contract tests remain regression coverage.
- End-to-end fixture tests for login → home and login → home → movie service.
- Negative tests for malformed JSON, missing action parameters, unsupported descriptions, unavailable services, and failed screen assertions.
- A cache test verifies that a failed refresh does not destroy the previous valid cache.

## Delivery phases

### Phase 1: local action runner

- Add the two-case `testcased.json` fixture with explicit actions.
- Add test-case loading, validation, selection, and generic execution.
- Replace Electron fixed mode selection with test-case selection.
- Remove AI UI, settings, planner, and AI plan execution from the product flow.

### Phase 2: fallback and reporting

- Add the limited deterministic `qaDescription` compiler.
- Add action-level reports and artifacts.
- Add assertion handling and negative tests.

### Phase 3: API and cache

- Add API source and refresh IPC.
- Validate downloaded cases.
- Save and read the atomic user-data cache.
- Support cached execution when the API is unavailable.

### Phase 4: server-owned actions

- Make server-provided `actions` the normal contract.
- Expand the action vocabulary only when a real test case requires it.
- Keep the description compiler as a migration fallback until server coverage is complete.

## Acceptance criteria for the first implementation

- Electron displays the cases in local `testcased.json`.
- The user can select and run the movie-service case without choosing a predefined mode.
- Login uses the existing virtual keyboard and remote navigation.
- The generic runner executes explicit actions in order.
- A case without actions can run if its description uses a supported fallback pattern.
- Unsupported descriptions and invalid actions fail clearly.
- AI key/manual-description controls and planner execution are no longer present in Electron.
- Existing legacy specs still run from the terminal.
- Reports include the original case, normalized actions, per-step status, and failure artifacts.
