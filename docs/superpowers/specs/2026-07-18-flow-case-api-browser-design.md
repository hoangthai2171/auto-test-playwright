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
  `folderName` and `environment`, then writes the response to the cache.

The API client normalizes a successful list response from either a bare array
or a conventional `{data: [...]}`/`{folders: [...]}`/`{cases: [...]}` envelope,
while rejecting malformed lists. HTTP failures include the status in the
returned error and never mutate the cache.

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
- A folder selection clears the current case table only when the user
  successfully retrieves a new case list; failed retrieval leaves the current
  list intact.
- Settings are loaded before the initial folder request. Invalid persisted
  values fall back to defaults.
- The Get button is disabled until a folder is selected and is disabled while
  the request is active.
- The existing run validation and sequential batch behavior remain unchanged.

## Testing strategy

- Add pure unit tests for API URL/query construction, response normalization,
  recursive folder flattening, and cache replacement/atomic persistence.
- Extend renderer tests with settings load/save, folder rendering, refresh,
  Get test cases, API error preservation, and execution payloads carrying the
  folder ID.
- Add markup assertions for the new settings fields and sidebar controls.
- Keep the existing local fixture and Electron syntax checks passing.

## Scope boundaries

- No server-side API changes.
- No automatic background polling.
- No platform selector for case retrieval; the API request uses only the
  configured environment because that is the required parameter in
  `API-SPEC.md`.
- No cache eviction policy beyond replacing entries by folder ID.
