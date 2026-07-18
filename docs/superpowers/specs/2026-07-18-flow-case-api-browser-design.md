# Flow-case API browser design

## Goal

Add API-backed folder and test-case loading to the Electron case browser while
moving `APP_URL` into Settings. The existing local fixture remains available as
the initial fallback, and downloaded cases are persisted in the Electron
user-data directory.

## User-facing behavior

- Settings contains a Connection section with:
  - `APP_URL` (default `https://html5stage.mytv.vn/`)
  - API domain (default `http://172.16.240.254:30100`)
  - Project ID (default `1`)
  - Environment (`API` or `UI`, default `UI`)
- Settings contains a `Network config` section with API timeout in seconds
  (default `30`). Invalid or non-positive values use the default.
- Settings continues to contain the existing preview type controls. Saving
  settings persists all connection and preview values in the existing
  `mytv-auto-test-settings` local-storage record.
- The old sidebar `APP_URL` input is removed. Its position contains a `Folders`
  select, a refresh icon button, and a `Get test cases` button.
- On renderer startup, the app requests the flow-case folder tree through main
  process IPC. The refresh button repeats that request using the current saved
  connection settings.
- Folder nodes are flattened recursively. Each option displays `name`, has
  `fullPath` as its value, and retains the node `id` for caching and execution.
- `Get test cases` requires a selected folder. It requests the cases for the
  selected `fullPath` and configured environment, replaces the table contents,
  and persists the successful response in the cache keyed by folder ID.
- API errors show an actionable message in the sidebar and do not overwrite the
  current case list or an existing cache entry.
- While any folder or case API request is active, a renderer-wide loading overlay
  with a spinner blocks pointer and keyboard interaction with the app. The
  overlay is removed after success or failure.
- If an API request reaches the configured timeout, the renderer shows an alert
  stating that the API request timed out and leaves existing folders, cases, and
  cache data unchanged.

## Architecture and data flow

The renderer calls safe preload methods; the main process owns HTTP and file
system access.

```text
renderer settings/localStorage
        |
        v
preload IPC bridge
        |
        v
main process flow-case API client ----> API domain/project endpoints
        |
        +----> userData/testcases-cache.json
        |
        +----> sanitized cases/folders back to renderer
```

New IPC operations:

- `load-flow-case-folders({apiDomain, projectId})` gets
  `/api/v1/projects/{projectId}/flow-case-folders`.
- `load-flow-cases({apiDomain, projectId, folderId, folderName, environment})`
  gets `/api/v1/projects/{projectId}/flow-cases/by-folder` with encoded
  `folderName` and `environment`, then writes the response to the cache. Both
  operations also receive the configured timeout in milliseconds.

The API client normalizes a successful list response from either a bare array
or a conventional `{data: [...]}`/`{folders: [...]}`/`{cases: [...]}` envelope,
while rejecting malformed lists. Each request uses `AbortController` and a
30-second default deadline overridden by the saved Network config value. HTTP
failures include the status in the returned error and never mutate the cache.
Timeout failures carry a distinct machine-readable timeout flag for the
renderer alert.

## Cache and execution

The cache lives at:

```text
<app.getPath("userData")>/testcases-cache.json
```

Its top-level object is keyed by folder ID. Each entry contains the folder
identity (`id`, `name`, `fullPath`) and the validated case list. A successful
download replaces only the entry for that folder ID. Writes use a temporary
file followed by rename so an interrupted write cannot leave a partial cache.

The renderer tracks the active folder ID and sends it with each run. The main
process passes the cache path and folder ID to the generic Playwright spec; the
spec validates and resolves the selected case from that cache entry. Runs that
do not have a folder ID continue to use the local fixture, preserving existing
behavior.

Downloaded cases are sanitized before returning to the renderer, using the
existing credential redaction rules. Raw cached cases remain in user data for
the runner and are treated as sensitive.

## UI state and error handling

- Folder loading has loading/disabled states so repeated requests cannot race
  and leave a stale selection unnoticed.
- The API loading overlay is reference-counted so overlapping startup/refresh
  transitions cannot hide it while another request is still active.
- A folder selection clears the current case table only when the user
  successfully retrieves a new case list; failed retrieval leaves the current
  list intact.
- Settings are loaded before the initial folder request. Invalid persisted
  values fall back to defaults.
- The Get button is disabled until a folder is selected and is disabled while
  the request is active.
- Timeout errors use the configured deadline and are reported with an alert;
  ordinary API errors continue to use the existing inline error message.
- The existing run validation and sequential batch behavior remain unchanged.

## Testing strategy

- Add pure unit tests for API URL/query construction, response normalization,
  recursive folder flattening, timeout/abort behavior, and cache
  replacement/atomic persistence.
- Extend renderer tests with settings load/save, folder rendering, refresh,
  Get test cases, loading-overlay blocking, timeout alerts, API error
  preservation, and execution payloads carrying the folder ID.
- Add markup assertions for the new settings fields and sidebar controls.
- Keep the existing local fixture and Electron syntax checks passing.

## Scope boundaries

- No server-side API changes.
- No automatic background polling.
- No platform selector for case retrieval; the API request uses only the
  configured environment because that is the required parameter in
  `API-SPEC.md`.
- No cache eviction policy beyond replacing entries by folder ID.
