# Hide Fixed APP_URL and DNS Host Settings

**Plan ID:** 20260805-hide-fixed-gui-settings
**Status:** Complete
**Approval:** Approved
**Created:** 2026-08-05
**Updated:** 2026-08-05
**Owner:** Tiny-Planner / Tiny-PM
**Risk:** Medium
**Branch/worktree:** `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright` on `update/security`

## Status

- [x] Step 1: Make APP_URL and DNS host values main-process/source controlled
- [x] Step 2: Remove restricted GUI inputs and narrow renderer/preload calls
- [x] Step 3: Update contract tests and project documentation
- [x] Step 4: Run verification and review the final diff

## Goal

### Problem

The Settings → GUI panel currently renders an editable `APP_URL` input and an
editable `DNS Host` input. The renderer restores both values from localStorage
and sends them through IPC. The main process currently accepts the renderer's
APP_URL for Browser runs and accepts a caller-provided hosts-file entry.

### Desired outcome

Users cannot see or edit the Browser `APP_URL` or the DNS host mapping in the
GUI. APP_URL remains a source-controlled constant used by Browser runs and the
interactive preview. The DNS host mapping remains a source-controlled constant;
users retain only Add host and Remove host controls, with status feedback that
does not reveal the mapping value.

### Acceptance criteria

- [ ] Settings → GUI contains no APP_URL label/input or DNS Host value input.
- [ ] Settings → GUI still provides Add host and Remove host controls and
      reports whether the fixed mapping is present, without displaying the
      mapping value.
- [ ] Persisted or renderer-supplied APP_URL/DNS host values cannot change the
      values used by Browser runs, interactive preview, or host-file operations.
- [ ] Renderer and preload host operations send no host-entry value; main IPC
      resolves the fixed source-controlled entry and does not return the raw
      entry/path to the renderer.
- [ ] Existing editable API, project, environment, timeout, preview, and run
      target settings continue to work.
- [ ] Relevant unit, syntax, diff, and Graphify checks pass, with the known
      pre-existing HTML-label failure recorded separately if it remains.

### Non-goals

- Do not change APP_URL used by retained terminal Playwright workflows or
  `APP_URL` environment-variable support outside the Electron GUI run path.
- Do not change the hosts-file normalization, elevation, permission, or
  add/remove behavior beyond defaulting the app-owned mapping and redacting the
  renderer-facing response.
- Do not hide or change the separate LG device host/passphrase dialogs; those
  are unrelated runtime device connection inputs.
- Do not change API domain, API authorization, project, environment, timeout,
  preview, or test-case selection behavior.

## Current State and Findings

- `app/renderer/index.html:262-334` renders the GUI settings panel, including
  `settings-app-url-input`, `dns-host-input`, and the host action buttons.
- `app/renderer/renderer.js:64-79` defines APP_URL and DNS_HOST in
  `DEFAULT_SETTINGS`; `loadSettings`, `currentSettings`, and
  `savePreviewSettings` currently restore/read/write both values through
  localStorage and DOM inputs.
- `app/renderer/renderer.js:2052-2093` reads the DNS input and passes its value
  to `getHostEntryStatus`, `addHostEntry`, and `removeHostEntry`.
- `app/renderer/renderer.js:2196-2211` includes APP_URL in the per-case run
  payload, and `app/renderer/renderer.js:2431-2442` sends the interactive URL
  to the main process.
- `app/preload.js:8-10` currently exposes host IPC methods that accept an
  `entry` argument.
- `app/main.js:401-403` currently forwards renderer-provided host entries;
  `app/main.js:815` currently sets the child `APP_URL` environment variable from
  `values.APP_URL`; and `app/main.js:961-983` currently loads a renderer-
  supplied interactive URL.
- `app/hosts-file.js:5` already owns the source-controlled host mapping as
  `DEFAULT_HOST_ENTRY`; the service returns `entry` and `path` in its result,
  which must not cross the renderer IPC boundary for this requirement.
- `tests/unit/renderer.test.js` covers persisted settings, run payloads, and
  host controls; `tests/unit/preload.test.js` asserts the current host argument
  contract; `tests/unit/hosts-file.test.js` covers native add/remove behavior.
- Baseline: `node --test tests/unit/renderer.test.js tests/unit/preload.test.js
  tests/unit/hosts-file.test.js tests/unit/hosts-file-elevation.test.js` — 106
  passed, 1 failed. The failure is pre-existing and unrelated to this request:
  `tests/unit/renderer.test.js` expects `<label for="campaign-select">Chiến
  dịch</label>` while current markup contains `Campaigns`.
- Worktree baseline: branch `update/security`; no user file changes reported.
  Git emitted a local `.git/fsmonitor--daemon.ipc` query warning while checking
  status; no cleanup or destructive command was run.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Ownership of APP_URL | Keep a hidden/disabled renderer input; trust renderer default; enforce in main | Store the fixed APP_URL in `app/main.js`; omit it from renderer settings and run IPC payloads; main uses it for child runs and interactive preview | A hidden DOM control is still a user-editable/runtime-visible surface; main enforcement protects the actual execution boundary | Renderer no longer needs the APP_URL value; interactive URL cache-busting moves to main |
| Ownership of DNS host mapping | Keep a hidden input; send the fixed value from renderer; add new host config UI | Main calls the hosts service without an entry argument; the service defaults to `DEFAULT_HOST_ENTRY` | Keeps add/remove available while preventing renderer input from selecting another mapping | Preload methods become no-argument calls; main strips `entry` and `path` from results |
| LocalStorage migration | Continue persisting old restricted keys; delete storage wholesale; ignore and overwrite only restricted keys | Ignore `APP_URL` and `DNS_HOST` when loading saved settings and do not write them back | Preserves all unrelated user settings and removes the old editable values on the next save | Existing users lose only the obsolete restricted overrides |
| GUI presentation | Leave blank disabled inputs; remove only the input elements; add a value-free explanatory note | Remove both restricted value controls and retain host action buttons/status with a note that the mapping is built in | Satisfies “cannot see or edit” and keeps the available host actions understandable | HTML contract and renderer fixture assertions must change |

## Assumptions, Constraints, and Dependencies

- Assumption: “Cannot see the value” refers to the GUI and renderer-facing IPC
  contract; source-controlled application code may contain the fixed values for
  the maintainer to edit.
- Constraint: the Electron renderer must continue using context-isolated,
  narrow preload IPC; it must not receive raw host mapping/path data.
- Constraint: all TV/browser application navigation remains keyboard/remote
  driven where applicable; this change does not add app interaction.
- Dependency: Browser runs continue to receive a valid APP_URL environment value
  from the main process, and legacy terminal runs remain unchanged.
- Dependency: host-file updates may still require native administrator
  elevation on the existing platforms.
- Unresolved material questions: None.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| A renderer call still overrides APP_URL or host entry | Users could change the target or hosts mapping despite the hidden UI | Remove renderer inputs, omit values from preload calls, and enforce fixed values in main IPC/run code; add negative contract assertions | Revert the focused changes in the affected app/test/docs files; no data migration or destructive operation is introduced |
| Existing localStorage contains old restricted keys | Old values could remain effective or be re-exposed | Explicitly omit both keys during load and save; test with hostile persisted values | Restore the prior renderer settings code if a regression is found; unrelated settings remain in the same storage key |
| Host status response leaks the mapping through `entry` or `path` | Renderer code could inspect the fixed value even without a visible input | Return only safe status fields from main host IPC | Restore the prior response shape only if a dependent renderer contract is identified; current renderer uses only `ok`, `exists`, `status`, and `message` |
| Interactive preview behavior changes while moving URL construction | Preview may fail to load or lose cache-busting | Keep the existing URL validation/cache-busting behavior in a main-owned helper and test syntax/renderer call shape | Revert the interactive-preview portion independently; Browser test execution remains main-owned |

## File Impact and Detailed Changes

### `app/main.js`

**Action:** Modify

**Current role and evidence:** Electron main process owns `run-test`, the
interactive BrowserView, and host-file IPC (`run-test`, `show-interactive-
browser`, and host handlers around the anchors above).

**Exact changes:** Add the source-controlled APP_URL constant. Set child
`APP_URL` from that constant rather than `values.APP_URL`. Make the interactive
BrowserView load the fixed URL with its cache-busting query regardless of any
renderer-supplied URL. Change host handlers to call the hosts service without a
renderer-provided entry and return only renderer-safe status fields, excluding
the raw entry and hosts-file path.

**Invariants and compatibility:** Keep existing run guards, preview bounds,
case selection, child environment shape, status messages, and host elevation
behavior unchanged.

**Tests affected:** Static syntax check; renderer/preload contract tests;
source-level review of the main IPC boundary.

### `app/hosts-file.js`

**Action:** Modify

**Current role and evidence:** Owns `DEFAULT_HOST_ENTRY`, normalization, hosts
file reads/writes, and elevation fallback.

**Exact changes:** Make `getStatus`, `add`, and `remove` default to
`DEFAULT_HOST_ENTRY` when called without a value, while retaining explicit
arguments for isolated service tests and internal utility compatibility.

**Invariants and compatibility:** Preserve validation, line normalization,
duplicate handling, permission statuses, and existing direct-call behavior.

**Tests affected:** Add default-call coverage to `tests/unit/hosts-file.test.js`.

### `app/preload.js`

**Action:** Modify

**Current role and evidence:** Exposes the narrow renderer/main bridge,
including host-file operations.

**Exact changes:** Expose `getHostEntryStatus`, `addHostEntry`, and
`removeHostEntry` as no-argument methods that invoke their channels without an
entry object.

**Invariants and compatibility:** Keep channel names and all unrelated bridge
methods unchanged.

**Tests affected:** Update `tests/unit/preload.test.js` to assert no host value
crosses the bridge.

### `app/renderer/index.html`

**Action:** Modify

**Current role and evidence:** Owns the Settings → GUI markup.

**Exact changes:** Remove the APP_URL label/input and the DNS Host input.
Retain Add host, Remove host, and status elements, with a value-free note that
the host mapping is built into the application.

**Invariants and compatibility:** Keep API/network timeout and other GUI
settings controls, settings navigation, action IDs, accessibility status roles,
and save behavior intact.

**Tests affected:** Update the HTML contract assertions to require absence of
restricted inputs and presence of host actions/status.

### `app/renderer/renderer.js`

**Action:** Modify

**Current role and evidence:** Owns GUI settings state, localStorage
serialization, DNS status/action wiring, Browser run payload construction, and
interactive preview requests.

**Exact changes:** Remove restricted DOM lookups and renderer constants. Ignore
legacy persisted APP_URL/DNS_HOST keys while preserving all other settings. Do
not read or write restricted keys, call host IPC without arguments, omit APP_URL
from Browser run payloads, and request interactive preview by bounds only. Keep
the existing status messages and host button enable/disable logic.

**Invariants and compatibility:** API/case loading continues to use editable
API settings; Browser run selection, preview type, timeouts, LG paths, report
sync, and localStorage for unrelated fields remain unchanged.

**Tests affected:** Update renderer fixtures and add coverage for hidden inputs,
host calls without values, legacy restricted-key rejection, and APP_URL omission
from renderer payloads.

### `tests/unit/hosts-file.test.js`

**Action:** Modify

**Current role and evidence:** Pure contract tests for hosts-file behavior.

**Exact changes:** Verify no-argument `getStatus`, `add`, and `remove` operate
on the fixed default entry; retain current explicit-entry validation tests.

### `tests/unit/preload.test.js`

**Action:** Modify

**Current role and evidence:** Contract tests for the context-isolated bridge.

**Exact changes:** Call host bridge methods without arguments and assert the
three IPC invocations contain no entry value.

### `tests/unit/renderer.test.js`

**Action:** Modify

**Current role and evidence:** Renderer fixture, settings persistence, host
actions, run payload, and markup contract tests.

**Exact changes:** Remove restricted input elements from the fixture; update
settings persistence expectations to ignore hostile APP_URL/DNS_HOST values;
assert host methods receive no argument; assert Browser run payloads omit APP_URL;
and assert the HTML has no restricted inputs while retaining host actions/status.
Preserve the known unrelated Campaigns-label failure as a separate baseline
failure if it remains.

### `README.md`

**Action:** Modify

**Current role and evidence:** User-facing Electron setup and data-flow guide.

**Exact changes:** State that APP_URL and the DNS host mapping are fixed in
source (`app/main.js` and `app/hosts-file.js`), are not shown/editable in GUI
settings, and that Settings retains only value-free Add/Remove host controls.
Remove the claim that the renderer sends APP_URL per run while preserving the
legacy terminal APP_URL documentation.

### `AGENTS.md`

**Action:** Modify

**Current role and evidence:** Project architecture and maintenance guidance.

**Exact changes:** Document the new Electron GUI configuration boundary: APP_URL
is main-process source controlled, DNS host operations use the main-owned
default, and raw host values are not returned to the renderer. Keep the
environment-variable note for the child runner and legacy terminal workflows
accurate.

## Execution Sequence

### Step 1 — Enforce source-controlled runtime values

**Objective:** Ensure the main process, not renderer input, owns APP_URL and the
DNS mapping.

**Files:** `app/main.js`, `app/hosts-file.js`

**Implementation details:** Add the fixed APP_URL constant and use it in child
environment and interactive preview loading. Default hosts service operations
to `DEFAULT_HOST_ENTRY`; main host handlers ignore request values and redact
`entry`/`path` from returned objects.

**Dependencies:** Approved plan; existing host service and BrowserView APIs.

**Verification:** `node --check app/main.js`; `node --check app/hosts-file.js`;
focused hosts unit tests; source review confirming no main handler consumes a
renderer APP_URL/entry.

**Exit criteria:** Renderer-supplied values cannot alter Browser URL, preview
URL, or host-file target at the main boundary.

**Approval gate:** Not required after plan approval.

### Step 2 — Remove restricted GUI surfaces and renderer inputs

**Objective:** Make the GUI value-free for APP_URL and DNS Host while retaining
host actions.

**Files:** `app/renderer/index.html`, `app/renderer/renderer.js`,
`app/preload.js`

**Implementation details:** Remove the two value controls; preserve host action
buttons/status; remove restricted storage/DOM reads; call no-argument host IPC;
omit APP_URL from renderer run/preview requests; ignore old restricted storage
keys.

**Dependencies:** Step 1 main IPC contract.

**Verification:** Renderer/preload unit tests; inspect generated HTML assertions;
`node --check app/preload.js`; `node --check app/renderer/renderer.js`.

**Exit criteria:** GUI has no value input/display and cannot submit restricted
values through the bridge.

**Approval gate:** Not required after plan approval.

### Step 3 — Update contract tests and documentation

**Objective:** Make the new ownership and visibility contract durable.

**Files:** `tests/unit/hosts-file.test.js`, `tests/unit/preload.test.js`,
`tests/unit/renderer.test.js`, `README.md`, `AGENTS.md`

**Implementation details:** Update tests for no-argument/default behavior,
restricted-key migration, hidden markup, and renderer payloads; update user and
maintainer documentation without changing legacy terminal configuration.

**Dependencies:** Steps 1–2.

**Verification:** Relevant unit tests and `git diff --check`.

**Exit criteria:** Tests and docs describe the same main-owned fixed-value
contract.

**Approval gate:** Not required after plan approval.

### Step 4 — Run verification and review the final diff

**Objective:** Validate the complete scoped change and identify regressions.

**Files:** All modified files.

**Implementation details:** Run targeted tests, full unit suite, syntax checks,
Playwright case listing, Graphify update, and final diff review. Classify any
pre-existing failure separately from implementation failures.

**Dependencies:** Steps 1–3.

**Verification:**
`npm run test:unit`; `node --check app/main.js`;
`node --check app/preload.js`; `node --check app/renderer/renderer.js`;
`npx playwright test tests/run-test-case-mytv.spec.js --list`;
`git diff --check`; `graphify update .`.

**Exit criteria:** All relevant checks pass or any remaining failures are
explicitly classified and accepted by Tiny-PM; final diff contains no unrelated
changes.

**Approval gate:** Required only if verification exposes a scope/risk change.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| No APP_URL/DNS value controls are visible | Unit/static | Renderer HTML contract test and inspect `index.html` | Restricted IDs/labels/inputs absent; host buttons/status remain |
| Values are source controlled | Unit/static | Renderer/preload tests; inspect main handlers; syntax checks | Renderer sends no values; main uses fixed APP_URL/default host |
| Host actions remain available without leakage | Unit | `node --test tests/unit/hosts-file.test.js tests/unit/preload.test.js tests/unit/renderer.test.js` | Add/remove/status behavior passes; IPC calls contain no entry; response assertions use safe fields |
| Other settings continue working | Regression unit | `npm run test:unit` | Existing API/config/run-target contracts pass; unrelated baseline failures classified |
| No syntax/format regressions | Static | Node checks and `git diff --check` | All commands pass |
| Graph reflects changed code | Repository maintenance | `graphify update .` | Graph update completes without an empty/shrink error |

## Completed Verification

> Update this section during execution with actual results. Do not prefill claims.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 | `node --check app/main.js` | Pass | No syntax output or errors | 2026-08-05 |
| Step 1 | `node --check app/hosts-file.js` | Pass | No syntax output or errors | 2026-08-05 |
| Step 1 | `node --test tests/unit/hosts-file.test.js tests/unit/hosts-file-elevation.test.js` | Pass | 7 passed, 0 failed | 2026-08-05 |
| Step 1 | Source review of `app/main.js` host/APP_URL/interactive handlers | Pass | Fixed APP_URL is used; host IPC ignores request values and strips `entry`/`path` | 2026-08-05 |
| Step 2 | `node --check app/preload.js` | Pass | No syntax output or errors | 2026-08-05 |
| Step 2 | `node --check app/renderer/renderer.js` | Pass | No syntax output or errors | 2026-08-05 |
| Step 2 | Static review of renderer markup and restricted references | Pass | APP_URL/DNS value controls and renderer host arguments removed; host action/status controls remain | 2026-08-05 |
| Step 3 | `node --test tests/unit/renderer.test.js tests/unit/preload.test.js tests/unit/hosts-file.test.js` | Pass with pre-existing failure | 104 passed, 1 failed; the only failure remains the unrelated `Chiến dịch` vs `Campaigns` HTML assertion | 2026-08-05 |
| Step 3 | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors | 2026-08-05 |
| Step 4 | `npm run test:unit` | Fail — pre-existing | Exit 1 from the unchanged `tests/unit/renderer.test.js` assertion expecting `Chiến dịch` while markup contains `Campaigns`; no new failure identified | 2026-08-05 |
| Step 4 | `node --check app/main.js`; `node --check app/preload.js`; `node --check app/renderer/renderer.js` | Pass | All three syntax checks passed | 2026-08-05 |
| Step 4 | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | One generic Browser test listed successfully | 2026-08-05 |
| Step 4 | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors | 2026-08-05 |
| Step 4 | `graphify update .` and explicit-interpreter retry | Blocked — unrelated tooling | Graphify rebuild fails with `Operation not permitted`; installed package warns it is 0.9.12 while the skill is 0.9.16 | 2026-08-05 |
| Step 4 | Final diff/status review | Pass | Only approved app, test, documentation, and plan files are changed; no generated temp file remains | 2026-08-05 |

## Deviations and Plan Updates

- 2026-08-05 — Graphify maintenance verification could not complete. The
  required `graphify update .` command and an explicit-interpreter retry both
  reached Graphify's code rebuild but failed with `Operation not permitted`;
  the installed package also reports version 0.9.12 against the 0.9.16 skill.
  This is an unrelated local tooling limitation; the existing graph remains
  available for navigation and no Graphify output was manually altered.

## Handoff and Completion

- Changed files: `app/main.js`, `app/hosts-file.js`, `app/preload.js`,
  `app/renderer/index.html`, `app/renderer/renderer.js`, the three focused unit
  test files, `README.md`, `AGENTS.md`, and this plan.
- Checks passed: targeted contracts (104 pass, with one pre-existing failure),
  all syntax checks, Playwright listing, and diff check.
- Known limitations: APP_URL and the DNS mapping remain discoverable by a user
  who inspects packaged source/runtime files; this change controls GUI editing
  and renderer IPC access as requested, not source-code confidentiality. The
  full unit suite retains the pre-existing campaign-label failure, and Graphify
  update remains blocked by the local tooling error above.
- Follow-up work: none planned.
- Final acceptance status: complete within approved scope.
