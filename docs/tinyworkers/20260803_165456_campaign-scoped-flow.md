# Campaign-scoped folder and testcase flow

**Plan ID:** 20260803_campaign-scoped-flow
**Status:** Complete
**Approval:** Approved by user on 2026-08-03
**Created:** 2026-08-03 16:54:56 +07:00
**Updated:** 2026-08-03 21:18:17 +07:00
**Owner:** Tiny-Planner / Tiny-PM
**Risk:** Medium
**Branch/worktree:** `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright` on `feature/test-all-trailers`

## Status

- [x] Step 1: Align the API client and Main-process loading with campaign-scoped folder/case queries.
- [x] Step 2: Refresh the folder selector from campaign selection and enforce deterministic campaign/folder case loading in the renderer.
- [x] Step 3: Update project guidance, run regression checks, refresh Graphify, and record evidence.

## Goal

### Problem

The current campaign UI already has separate campaign and folder selectors, but
folder refreshes are always project-wide. A campaign load re-fetches the running
campaign list and hydrates each copy by `testcaseId`, while the updated API spec
now provides direct `campaignId` filters for both folder-tree and testcase
queries. The current UI also permits a campaign-only load even though the result
batch needs a selected folder path.

### Desired outcome

Selecting a campaign refreshes the folder selector with only folders relevant to
that campaign. The subsequent case load uses the campaign-scoped testcase query
while retaining the selected campaign folder as the result/cache context. When
the campaign selector is empty, folder refresh and case loading remain entirely
folder-scoped and do not send a campaign filter.

The implementation follows the API spec's explicit rule that exactly one of
`folderName`, `testcaseId`, or `campaignId` is sent to the testcase endpoint; it
does not invent a combined `folderName` + `campaignId` request.

### Acceptance criteria

- [x] `GET /flow-case-folders` receives `campaignId` only when a campaign is selected; an empty campaign selection sends no campaign query.
- [x] `GET /flow-cases/by-folder` supports the spec's `campaignId` source and rejects conflicting source selectors; campaign case loads use the direct campaign query rather than re-fetching and hydrating every running-campaign copy.
- [x] Changing the campaign selection clears stale loaded cases, refreshes the folder selector with the selected campaign ID, and refreshes it without that ID when the selection is cleared.
- [x] Campaign case loading requires a selected campaign folder, sends both selected-source context values through IPC, stores the validated cases under the existing `campaign:<id>` cache key, and uses the selected folder path for result submission.
- [x] Folder-only case loading remains independent of campaigns and keeps its existing cache, Browser, LG, result, retry, and local-fallback behavior.
- [x] Campaign and folder refreshes remain separately callable and blocked by the existing API-request lock; API credentials and result payloads remain redacted/validated in Main.
- [x] Focused and full regression checks pass; `API-SPEC.md` remains the user's existing modification and is not edited.

### Non-goals

- Do not change backend routes, campaign administration, campaign lifecycle, or result endpoint semantics.
- Do not send a forbidden combined `folderName` + `campaignId` testcase query or merge unrelated folder cases with campaign copies.
- Do not change the cache format, preload surface, LG device safety rules, Browser/LG execution mechanics, retry semantics, or local fixture fallback beyond the campaign/folder source values required by this flow.
- Do not edit `API-SPEC.md`; it is the backend-provided contract change in the worktree.
- Do not run live API, Electron, or real-TV operations as part of local verification.

## Current State and Findings

- The updated contract adds optional `campaignId` to the folder-tree endpoint and makes `campaignId` a third mutually exclusive testcase source — evidence: `API-SPEC.md:102-161`.
- The recommended campaign flow is campaign-scoped folders followed by a `campaignId` testcase query; folder-only runs continue to use `folderName` — evidence: `API-SPEC.md:511-522`.
- The shared client currently builds folder URLs without query parameters and testcase URLs with only `folderName` or `testcaseId` — evidence: `app/flow-case-api.js:20-35`, `app/flow-case-api.js:169-214`.
- Main currently forwards no campaign ID for folder loading and sends campaign loads through `loadCampaignCases`, which re-fetches running campaigns and hydrates incomplete copies — evidence: `app/main.js:399-471`, `app/main.js:473-548`.
- The renderer currently refreshes folders only from the manual folder button, lets either selector enable `Get test cases`, and sends `CAMPAIGN_ID` plus optional folder context only when the user clicks the load button — evidence: `app/renderer/renderer.js:770-944`, `app/renderer/renderer.js:2053-2064`.
- Existing cache namespacing and Browser/LG cache-key propagation are already implemented and tested — evidence: `app/test-case-cache.js:38-89`, `tests/unit/test-case-cache.test.js`, `tests/unit/lg-desktop-batch-runner.test.js`.
- Graphify navigation identified `flow-case-api.js`, `main.js`, `renderer.js`, the API tests, and the cache/test-source boundary as the relevant path; direct source inspection confirmed those relationships.
- Baseline worktree: branch `feature/test-all-trailers`; only `API-SPEC.md` is modified before this plan. The repository fsmonitor IPC reports an environment error, so git checks use `-c core.fsmonitor=false`.
- Baseline: `npm run test:unit` — 596 passed, 0 failed, 0 skipped.
- Baseline: `npx playwright test tests/run-test-case-mytv.spec.js --list` — 1 test in 1 file.
- Baseline: relevant `node --check` commands — pass.
- Baseline: `git -c core.fsmonitor=false diff --check` — pass.
- Pre-existing failures: none observed in the baseline commands.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Campaign testcase source | Re-fetch running campaigns and hydrate each copy; send `folderName` plus `campaignId`; use the new direct campaign query | Call `by-folder` with `campaignId` only | Matches the updated API contract and avoids redundant requests or a forbidden query shape | Folder selection is retained as UI/result context, not combined into the testcase query |
| Folder refresh scope | Keep project-wide folders; filter the existing list in the renderer; request campaign-scoped folders from Main | Request `flow-case-folders?campaignId=<id>` on campaign selection and `flow-case-folders` when blank | Backend supplies the authoritative campaign folder tree and removes unrelated branches | Campaign changes are asynchronous and must clear stale case/source state |
| Campaign load prerequisite | Allow campaign-only loads and fail later at run time; require both campaign and folder; auto-select an arbitrary folder | Require a folder whenever a campaign is selected | The result contract needs an absolute `folderPath`, and the user explicitly requested the case list to use campaign and folder context | Existing campaign-only renderer tests must be updated to select a folder |
| Main campaign metadata | Re-fetch the running campaign list; trust renderer metadata; return a minimal selected-campaign summary | Use the direct campaign case response, validate it, and return/cache the selected ID plus optional renderer name | The API validates the campaign ID and the spec's direct query is authoritative; no per-copy hydration is needed | `testcaseId` URL support remains in the API client for its documented standalone use, but is removed from this selected-flow path |
| State reset | Preserve old loaded cases while selectors change; clear only on successful load; clear immediately on source selection changes | Clear loaded cases, source/cache/result context, and campaign-scoped folder selection before refresh/load | Prevents running or submitting stale cases after changing campaign or folder | The user must click `Get test cases` after choosing a new source |
| Existing execution boundary | Move API filtering into the renderer; change preload/cache/LG contracts | Keep API calls and validation in Main and reuse existing cache key/Browser/LG propagation | Preserves the project's security and source/cache architecture | Only API client, Main, renderer, tests, and docs need changes |

## Assumptions, Constraints, and Dependencies

- Assumption: “test case list from both campaign and folder” means the campaign query supplies the campaign copies and the selected campaign folder supplies the required result/cache context, because the updated API explicitly forbids sending both selectors to the testcase endpoint.
- Constraint: A campaign ID must be a positive integer at the API boundary as required by `API-SPEC.md`; empty means no campaign filter.
- Constraint: Explicit `actions`/`qaDescription` validation, credential redaction, and the existing source/cache boundary remain unchanged.
- Dependency: The backend must support the new `campaignId` query parameters and return campaign-scoped folders/cases according to `API-SPEC.md`.
- Dependency: No live API credentials or LG operation is required for local unit/static verification.
- Unresolved material questions: None under the API-spec interpretation above.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| Backend campaign query response is malformed or incomplete | Campaign cases fail to load or could not be safely executed | Validate the returned list in Main before replacing the campaign cache; preserve the prior cache on failure | Revert only the campaign-query changes; folder-only flow remains available |
| Campaign selection leaves stale folder/case state during refresh | User could run cases from the prior campaign | Clear selected folder and loaded source before the scoped folder request; disable controls through the existing request lock | Select the campaign again and reload its folders/cases |
| Campaign cases span multiple folders while one result path is selected | Result PATCH may be rejected by backend folder semantics | Require an explicit folder selection and preserve its absolute path; record any live backend limitation separately | Choose the correct campaign folder or use folder-only mode |
| Existing folder-only behavior regresses | Normal API runs lose cases or become campaign-filtered | Add explicit no-campaign URL and renderer request assertions; run full unit suite | Revert campaign-specific branches while retaining the new API helper tests only if needed |
| User API-SPEC change is overwritten | Backend contract notes are lost | Never edit `API-SPEC.md`; review final diff against the baseline | Restore the user file manually; no reset/checkout/clean command will be used |

## File Impact and Detailed Changes

### `app/flow-case-api.js`

**Action:** Modify
**Current role and evidence:** Builds FlowTest URLs, performs timeout/error handling, extracts response lists, and exposes folder/case/campaign/result helpers (`buildFlowCaseFoldersUrl`, `buildFlowCasesUrl`, `fetchFlowCaseFolders`, `fetchFlowCases`).
**Exact changes:** Add an optional positive-integer `campaignId` query to the folder URL/fetcher. Extend the testcase URL/fetcher with `campaignId` and enforce that exactly one of `folderName`, `testcaseId`, or `campaignId` is selected. Preserve service-token headers, timeout behavior, response logs, and documented standalone `testcaseId` support.
**Invariants and compatibility:** Empty campaign IDs produce the current folder-only URL; folder and testcase callers remain compatible; no `Authorization` header is reintroduced.
**Tests affected:** Add URL exclusivity, campaign-folder URL, campaign-case URL, and fetch forwarding assertions in `tests/unit/flow-case-api.test.js`.

### `app/main.js`

**Action:** Modify
**Current role and evidence:** Owns API IPC, validation, cache replacement, result normalization, and runner source selection.
**Exact changes:** Forward `settings.CAMPAIGN_ID` to folder loading. Replace the selected campaign's running-list/refetch/hydration path with a direct `fetchFlowCases({campaignId, environment, ...})` call; validate the returned cases, cache them under `campaign:<id>`, and attach the selected folder metadata from `FOLDER_ID`/`FOLDER_NAME` for the renderer/result context. Keep the folder-only branch unchanged, retain redaction, and return a safe selected-campaign/cache/folder response.
**Invariants and compatibility:** Main remains the only API/cache/validation boundary; `sourceFlowCaseId` is never used as an execution ID; failed validation never replaces cache data; Browser/LG still receive the existing opaque cache key.
**Tests affected:** Validate through focused API/renderer tests and source inspection; no live Electron main-process test harness exists in `tests/unit`.

### `app/renderer/renderer.js`

**Action:** Modify
**Current role and evidence:** Owns campaign/folder selectors, API refresh controls, selected-case list, source context, and Browser/LG/result propagation.
**Exact changes:** Let `loadFolders` accept the current/explicit campaign ID and include it only when non-empty. On campaign selection, clear stale cases/source/folder selection and automatically refresh folders with the selected campaign; when cleared, refresh the unscoped folder list. Make manual folder refresh respect the current campaign selection. Require a selected folder for `Get test cases`, send campaign and folder context together for campaign loads, omit `CAMPAIGN_ID` for folder-only loads, and retain the active campaign cache/result metadata only after a successful response.
**Invariants and compatibility:** Refresh buttons remain independent; the shared API lock remains authoritative; campaign result items keep `campaignId`; folder-only result items do not gain it; LG readiness/run payloads continue using the active cache key and folder ID.
**Tests affected:** Update campaign fixtures and add coverage for campaign-triggered folder refresh, blank-campaign unscoped refresh, required folder selection, stale-state clearing, campaign/folder request context, and folder-only regression.

### `tests/unit/flow-case-api.test.js`

**Action:** Modify
**Current role and evidence:** Contracts the shared FlowTest URL, headers, response envelopes, timeout errors, and result submission.
**Exact changes:** Cover optional campaign folder query, direct campaign testcase query, positive-ID validation, mutual exclusion with folder/testcase selectors, and no-campaign folder behavior.
**Invariants and compatibility:** Keep all existing header/redaction/result assertions and update only expected URLs where the new optional query is intentionally present.
**Tests affected:** This file is the focused verification target for Step 1.

### `tests/unit/renderer.test.js`

**Action:** Modify
**Current role and evidence:** Provides the fake DOM/runner contract for selector, loading, Browser/LG, result, retry, and markup behavior.
**Exact changes:** Assert campaign selection invokes scoped folder loading; clearing campaign invokes unscoped loading; campaign case requests carry selected folder context; campaign-only loads are rejected/disabled; stale cases are cleared; folder-only loads omit campaign data; and existing independent refresh behavior remains.
**Invariants and compatibility:** Preserve current test fixture APIs, cache-key assertions, result `campaignId` assertions, and LG request narrowing.
**Tests affected:** Focused renderer test suite and full unit suite.

### `README.md`

**Action:** Modify
**Current role and evidence:** Documents the desktop runner's API folder/campaign workflow, cache boundary, and Browser/LG behavior (`README.md:92-130`).
**Exact changes:** Document that selecting/clearing a campaign refreshes folders with/without the campaign filter, that a selected campaign requires a campaign folder before loading cases, and that campaign copies use the direct campaign query while folder-only mode remains independent.
**Invariants and compatibility:** Keep the existing service-token, redaction, cache, result, and safety documentation accurate.
**Tests affected:** Markdown/source review and full regression checks.

### `AGENTS.md`

**Action:** Modify
**Current role and evidence:** Provides the project architecture and maintenance contract for campaign/folder API/cache behavior (`AGENTS.md:50-105`).
**Exact changes:** Update the Electron workflow and API/cache notes to describe campaign-scoped folder refresh, direct `campaignId` case retrieval, required folder result context, and unfiltered folder mode when no campaign is selected.
**Invariants and compatibility:** Preserve Main-process ownership, cache isolation, result submission, redaction, and LG safety rules.
**Tests affected:** Documentation/source review.

### `API-SPEC.md`

**Action:** Do not modify
**Current role and evidence:** Backend-provided contract and the user's existing worktree modification (`git status`, `API-SPEC.md:102-161`, `API-SPEC.md:511-522`).
**Exact changes:** None. Use the updated contract as the implementation source of truth.
**Invariants and compatibility:** Final diff must still show only the user's API-SPEC change for that file.
**Tests affected:** Final diff review.

### `docs/tinyworkers/20260803_165456_campaign-scoped-flow.md`

**Action:** Add
**Current role and evidence:** Durable Tiny-Workers plan and execution evidence for this change.
**Exact changes:** Keep status, milestone checkboxes, completed verification, deviations, and handoff current through execution.
**Invariants and compatibility:** Do not prefill execution claims; preserve the plan as the source of truth.
**Tests affected:** Plan/document review.

### `graphify-out/*`

**Action:** Generated Modify via `graphify update .` after code changes
**Current role and evidence:** Persistent project knowledge graph; the existing graph was used for discovery.
**Exact changes:** Refresh graph output after implementation so changed call relationships are current; do not hand-edit generated files.
**Invariants and compatibility:** Record any Graphify environment limitation rather than treating it as a code failure.
**Tests affected:** Graphify maintenance check.

## Execution Sequence

### Step 1 — API and Main-process campaign source

**Objective:** Make the updated `campaignId` contract executable while preserving the existing folder path and cache/result boundaries.
**Files:** `app/flow-case-api.js`, `app/main.js`, `tests/unit/flow-case-api.test.js`.
**Implementation details:** Add optional campaign query construction and exact source-selector validation; forward campaign scope for folder loading; switch selected campaign case retrieval to the direct campaign endpoint; validate, cache, and return the selected-folder context; remove only the obsolete selected-flow campaign list/hydration dependency.
**Dependencies:** Approved plan; API-SPEC campaign query contract.
**Verification:** `node --test tests/unit/flow-case-api.test.js`; `node --check app/flow-case-api.js`; `node --check app/main.js`; expected result: campaign and folder URLs/forwarding are correct, invalid combinations fail closed, and all focused tests pass.
**Exit criteria:** Main can load validated campaign cases using `campaignId` alone while folder-only loading still uses `folderName`; the campaign cache key and selected folder context are returned.
**Approval gate:** Required — overall plan approval before the first edit; no additional approval within the stated file/scope boundary.

### Step 2 — Renderer campaign/folder selection behavior

**Objective:** Make the desktop selectors follow the campaign-scoped workflow and prevent stale source execution.
**Files:** `app/renderer/renderer.js`, `tests/unit/renderer.test.js`.
**Implementation details:** Scope folder refreshes from the selected campaign; automatically refresh on campaign selection/clearing; clear stale folder/case/source state; require a folder for case loading; send campaign plus selected-folder context for campaign runs and no campaign field for folder-only runs; preserve existing cache/result/LG propagation.
**Dependencies:** Step 1 API/Main behavior and response shape.
**Verification:** `node --test tests/unit/renderer.test.js`; `node --check app/renderer/renderer.js`; expected result: selector events, scoped/unscoped requests, loading state, source reset, and result context assertions pass.
**Exit criteria:** Campaign-selected and campaign-cleared flows are deterministic in the renderer; folder-only behavior remains unchanged.
**Approval gate:** Not required within approved scope.

### Step 3 — Documentation, full regression, and graph maintenance

**Objective:** Make the contract durable and collect final evidence without touching the backend spec.
**Files:** `README.md`, `AGENTS.md`, this plan, generated `graphify-out/*`.
**Implementation details:** Update user/developer guidance; review the final diff for unrelated edits; run the full required checks; update Graphify after code changes; record results and any deviations in this plan.
**Dependencies:** Steps 1 and 2 complete.
**Verification:** `npm run test:unit`; all changed-module `node --check` commands; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git -c core.fsmonitor=false diff --check`; `graphify update .`; expected result: full suite, syntax, listing, whitespace, and graph maintenance pass, with live integration explicitly not run.
**Exit criteria:** Every acceptance criterion has evidence, final diff preserves the `API-SPEC.md` user change, and the plan handoff is current.
**Approval gate:** Not required within approved scope.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Campaign folder URL is optional and correctly scoped | Unit | `node --test tests/unit/flow-case-api.test.js` | Campaign URL contains the positive ID; blank URL has no campaign query; malformed IDs fail closed |
| Campaign testcase query uses the new mutually exclusive source | Unit | `node --test tests/unit/flow-case-api.test.js` | `campaignId` query is present alone; folder/testcase conflicts are rejected |
| Main forwards and validates campaign data | Static/source + focused contract | Inspect `app/main.js`; API/renderer tests | Direct campaign fetch, validated list, namespaced cache, and selected folder context; no selected-flow hydration loop |
| Campaign selection refreshes campaign-scoped folders | Unit | `node --test tests/unit/renderer.test.js` | Campaign change calls folder IPC with `CAMPAIGN_ID`; folder options are replaced |
| Empty campaign restores independent folder behavior | Unit | `node --test tests/unit/renderer.test.js` | Clearing campaign calls folder IPC without `CAMPAIGN_ID`; folder case request omits it |
| Campaign case load uses both UI selections without a forbidden combined API query | Unit/source | Renderer request assertions plus `flow-case-api` URL assertions | IPC carries campaign ID and selected folder metadata; Main's testcase URL carries only campaignId |
| Stale cases cannot run after source changes | Unit | `node --test tests/unit/renderer.test.js` | Case list and active cache/result state clear before refresh/load |
| Existing execution/result/cache behavior remains compatible | Regression | `npm run test:unit`, focused LG/cache tests included by suite | 596 baseline tests remain passing or any implementation-caused failure is repaired |
| Final static checks and Graphify | Static/maintenance | Syntax, Playwright list, diff check, `graphify update .` | All pass; generated graph reflects changed relationships |
| Live API/LG behavior | Manual, not run | Authenticated campaign API/Electron or real-TV run | Record as not run/environment-dependent, not as a local failure |

## Completed Verification

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Planning baseline | `npm run test:unit` | Pass | 596 passed, 0 failed, 0 skipped | 2026-08-03 16:54 +07:00 |
| Planning baseline | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | 1 test in 1 file | 2026-08-03 16:54 +07:00 |
| Planning baseline | Relevant `node --check` commands | Pass | Flow API, Main, preload, renderer, LG, and generic spec parsed | 2026-08-03 16:54 +07:00 |
| Planning baseline | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors | 2026-08-03 16:54 +07:00 |
| Planning baseline | Worktree inspection | Pass | Branch `feature/test-all-trailers`; only `API-SPEC.md` modified before plan creation | 2026-08-03 16:54 +07:00 |
| Step 1 focused | `node --test tests/unit/flow-case-api.test.js` | Pass | 20 passed, 0 failed; campaign folder/case URLs and source-selector validation covered | 2026-08-03 21:12 +07:00 |
| Step 1 syntax | `node --check app/flow-case-api.js` and `node --check app/main.js` | Pass | Both changed runtime modules parsed successfully | 2026-08-03 21:12 +07:00 |
| Step 2 focused | `node --test tests/unit/renderer.test.js` | Pass | 90 passed, 0 failed; scoped/unscoped refresh, stale-state clearing, campaign/folder context, and LG propagation covered | 2026-08-03 21:15 +07:00 |
| Step 2 syntax | `node --check app/renderer/renderer.js` | Pass | Renderer parsed successfully | 2026-08-03 21:15 +07:00 |
| Step 3 regression | `npm run test:unit` | Pass | 602 passed, 0 failed, 0 skipped | 2026-08-03 21:16 +07:00 |
| Step 3 syntax | All changed-module `node --check` commands | Pass | Flow API, Main, preload, renderer, LG, and generic spec parsed | 2026-08-03 21:16 +07:00 |
| Step 3 list | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | 1 test in 1 file | 2026-08-03 21:16 +07:00 |
| Step 3 whitespace | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors | 2026-08-03 21:16 +07:00 |
| Step 3 graph | `graphify update .` | Pass | Elevated retry rebuilt 2,647 nodes, 4,206 edges, and 160 communities; five JSON/config files produced zero AST nodes as a Graphify warning | 2026-08-03 21:17 +07:00 |
| Final diff review | `git -c core.fsmonitor=false status/diff` | Pass | Implementation scope reviewed; `API-SPEC.md` remains the pre-existing user change | 2026-08-03 21:18 +07:00 |

## Deviations and Plan Updates

- 2026-08-03, Step 3: the sandboxed Graphify update failed with `Operation not permitted`; the required elevated retry succeeded. Graphify reported five non-code JSON/config files with zero AST nodes; generated outputs were refreshed.
- 2026-08-03, Step 3: the first temporary full-suite capture used zsh's read-only `status` variable and did not run the suite; the rerun used `test_exit_code` and passed all 602 tests. No implementation change was required.

## Handoff and Completion

- Changed files: `app/flow-case-api.js`, `app/main.js`, `app/renderer/renderer.js`, `tests/unit/flow-case-api.test.js`, `tests/unit/renderer.test.js`, `README.md`, `AGENTS.md`, generated `graphify-out/*`, and this plan. `API-SPEC.md` remains the user's existing modification.
- Checks passed: 602 unit tests; focused API (20) and renderer (90) suites; changed-module syntax; Playwright listing; whitespace; Graphify update; final diff review.
- Known limitations: live API authentication/campaign state, Electron smoke, and LG execution are not exercised locally. Graphify still warns about five non-code JSON/config files producing zero AST nodes.
- Follow-up work: none identified; campaign/folder intersection semantics follow the updated API's mutual-exclusion rule and use the selected folder as result context.
- Final acceptance status: Complete.
