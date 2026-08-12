# Campaign testcase loading with an optional folder

**Plan ID:** 20260812_campaign_optional_folder_workflow  
**Status:** Completed  
**Approval:** Approved by user (`Approve, 1`)  
**Created:** 2026-08-12 10:58:38 +07:00  
**Updated:** 2026-08-12 11:34:05 +07:00
**Owner:** Codex / Tiny-Planner, governed by Tiny-PM  
**Risk:** Medium  
**Branch/worktree:** `feature/single-campaign` at `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright`

## Status

- [x] Step 1: Add the dedicated campaign-testcase and folderless result API contracts.
- [x] Step 2: Implement testable campaign selection/filtering and Main-process orchestration.
- [x] Step 3: Make the renderer's folder optional for campaign loading and preserve Browser/LG result synchronization.
- [x] Step 4: Update documentation, run regression checks, and refresh Graphify.

## Goal

### Problem

The desktop currently requires a folder after the operator chooses a campaign. The
renderer disables `Get test cases` until the folder selector has a value
(`app/renderer/renderer.js:updateFolderControls`), and `loadCasesFromSelection`
rejects a campaign without a selected folder. Main then loads campaign copies via
the older `GET /flow-cases/by-folder?campaignId=...` query and treats the selected
folder as the single result-submission context
(`app/main.js:loadCampaignCases`). This prevents an operator from loading the
whole selected campaign directly.

The requested contract introduces the authoritative campaign testcase endpoint:

```http
GET /api/v1/projects/{projectId}/test-campaigns/{campaignId}/testcases
X-FlowTest-Service-Token: <SERVICE_TOKEN>
```

### Desired outcome

An operator can choose a running campaign and immediately load all runnable copy
testcases from that campaign without choosing a folder. A folder remains optional:
when selected, the loaded list is restricted to the selected folder subtree and
the selected campaign. Folder-only loading remains unchanged when no campaign is
selected. Browser and LG can run either campaign list, use the existing campaign
cache key, and send completed results without inventing a folder path.

### Acceptance criteria

- [x] With a campaign selected and no folder selected, `Get test cases` is enabled after API loading completes.
- [x] Campaign cases are fetched from `GET /api/v1/projects/{projectId}/test-campaigns/{campaignId}/testcases`, using the configured value only in `X-FlowTest-Service-Token`.
- [x] The campaign endpoint does not receive the folder, environment, platform, or status as invented query parameters.
- [x] Each campaign copy is validated and executed by its own `id`; `sourceFlowCaseId` is never substituted.
- [x] With a campaign and folder selected, Main still fetches the authoritative campaign list, fetches the selected folder subtree through the existing folder-case API, and returns only IDs present in both lists.
- [x] The campaign-and-folder intersection preserves authoritative campaign objects and order, rejects ambiguous duplicate IDs, and cannot admit a non-campaign folder case.
- [x] With no campaign selected, a folder is still required and the existing `flow-cases/by-folder?folderName=...` workflow is unchanged.
- [x] Campaign lists continue to use `campaign:<campaignId>` cache keys; campaign-only entries store no fabricated folder, while folder-filtered entries retain the selected folder metadata.
- [x] Startup restoration accepts a campaign cache entry with no folder and restores its campaign/cache-key state.
- [x] Browser and LG campaign-only runs use the campaign cache key and are no longer blocked merely because `activeFolderPath` is empty.
- [x] Folder-filtered campaign results continue to use the current single `PATCH /flow-cases/by-folder` batch with the selected `folderPath`.
- [x] Campaign-only results use the documented per-case `PATCH /flow-cases/{caseId}` contract with `campaignId`, `status`, and `testResult`; successful writes are excluded from retry so a later retry cannot knowingly duplicate their campaign history rows.
- [x] Normal completion and operator-stop behavior remain unchanged: submit only cases that fully completed; do not submit skipped, stopped, local-fixture, or launch-failed cases.
- [x] API request/response logs remain redacted, including both requests used for campaign-plus-folder intersection.
- [x] No new unit-test failures are introduced beyond the two verified renderer baseline failures documented below.

### Non-goals

- Do not add campaign creation, editing, start/stop, ownership, or administration UI.
- Do not change how running campaigns are listed or which campaigns the backend authorizes.
- Do not change folder-only cache keys, local-fixture fallback, batch scheduling, Playwright worker ownership, reports, or LG safety/preflight behavior.
- Do not send a folder query parameter to the new campaign-testcase endpoint unless a future backend contract explicitly adds one.
- Do not trust folder membership from labels, names, or `sourceFlowCaseId`; filtering is an exact intersection of copy IDs.
- Do not invent `/` or another synthetic `folderPath` for a campaign-only result submission.
- Do not silently skip result synchronization for campaign-only runs.
- Do not fix the two unrelated renderer baseline failures in this plan unless the user separately authorizes that cleanup.
- Do not edit `API-SPEC.md` without an authoritative response-envelope update from the backend; the user-provided endpoint and header are sufficient for this client change, while response normalization remains deliberately tolerant.

## Current State and Findings

- Graphify mapped the campaign flow to `app/flow-case-api.js`, `app/main.js`, `app/test-case-cache.js`, `app/renderer/renderer.js`, the prior campaign Tiny-Workers plans, and their unit tests. Its stored lessons identify `requestJson()` and `submitFlowCaseResults()` as preferred sources; those findings were verified against current source.
- AgentMemory smart search returned no campaign-specific durable decision or failed approach; unrelated low-score observations were not used as design evidence.
- The current campaign case URL is `flow-cases/by-folder?campaignId=...` — evidence: `app/flow-case-api.js:buildFlowCasesUrl`, `tests/unit/flow-case-api.test.js` campaign URL contracts.
- `requestJson()` already sends the configured value as `X-FlowTest-Service-Token`, omits `Authorization`, records a redacted request envelope, and distinguishes HTTP failures from timeouts — evidence: `app/flow-case-api.js:requestJson` and `tests/unit/flow-case-api.test.js`.
- Main chooses the campaign branch whenever `CAMPAIGN_ID` is present, but `loadCampaignCases()` ignores the selected folder for data filtering and passes it only to `resolveCampaignFolder()` as context — evidence: `app/main.js:load-flow-cases`, `loadCampaignCases`, and `resolveCampaignFolder`.
- The renderer currently requires a folder in two places: `updateFolderControls()` disables the button without a folder, and `loadCasesFromSelection()` returns an error when the folder map has no selected item — evidence: `app/renderer/renderer.js:updateFolderControls` and `loadCasesFromSelection`.
- The existing campaign cache format already permits `folder` to be absent and treats a campaign entry as usable — evidence: `app/test-case-cache.js:replaceCampaignCacheEntry` and `isUsableTestCaseCacheEntry`; `tests/unit/test-case-cache.test.js` already reads a folderless campaign entry.
- Browser and LG already prefer `TEST_CASE_CACHE_KEY` for campaign cases, so no runner-process or LG IPC source contract needs expansion — evidence: `app/renderer/renderer.js:handleSubmit`, `runLgSelectedCases`; `app/main.js` cache-key loading branches; existing Browser/LG renderer tests.
- The renderer currently blocks a campaign run with no folder path, and every target builds one folder-batch result payload — evidence: `app/renderer/renderer.js:handleSubmit`, `buildFlowCaseResultSubmission`, and the three Browser/single/LG result-submission branches.
- The repository's integration spec documents `PATCH /flow-cases/{caseId}` with `campaignId`, `status`, and `testResult`, and warns that each successful result request creates a history row — evidence: `API-SPEC.md` sections 4.2 and 6. This makes failed-only retry tracking mandatory for per-case fan-out.
- `app/preload.js` already exposes the needed `loadFlowCases` and `submitFlowCaseResults` IPC calls; no new renderer-to-main channel is required.
- `app/renderer/index.html` already has campaign, folder, refresh, and `Get test cases` controls. The workflow can change through state/placeholder behavior without adding a new control.
- The previous campaign plans are complete historical evidence, not reusable execution plans: `docs/tinyworkers/20260803_141504_campaign-selection.md` introduced campaign caches/results, and `docs/tinyworkers/20260803_165456_campaign-scoped-flow.md` deliberately required a folder under the old API.
- Git history attributes the existing campaign URL and folder-required renderer behavior to commit `2af111f`; there are no later alternate implementations to preserve.
- Worktree baseline: branch `feature/single-campaign`; discovery modified only generated Graphify reflection/vocabulary files before this plan was added. No implementation file was changed during planning.
- Baseline `npm run test:unit`: **Fail**, 668 tests total, 666 pass, 2 fail. Both failures predate this plan and are in `tests/unit/renderer.test.js`: the empty batch action expects `Run Selected (0)` but receives an empty tooltip, and markup expects `Chiến dịch` while current HTML says `Campaigns`.
- Baseline syntax: `node --check app/flow-case-api.js`, `app/main.js`, `app/preload.js`, and `app/renderer/renderer.js` all pass.
- Baseline Playwright discovery: `npx playwright test tests/run-test-case-mytv.spec.js --list` passes with one test in one file.
- Baseline whitespace: `git -c core.fsmonitor=false diff --check` passes.
- Pre-existing failures: the two renderer assertions above. They must remain separately classified and must not mask a new failure.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Campaign transport | Keep using `flow-cases/by-folder?campaignId`; change only the button; add a dedicated client for the new endpoint | Add `buildCampaignTestCasesUrl()` and `fetchCampaignTestCases()` and make Main use them for every campaign load | Directly implements the requested endpoint and prevents the UI change from remaining coupled to the obsolete query | `flow-case-api.js` gains a dedicated URL/fetch contract; the older campaign query helper may remain for compatibility but is no longer used by the desktop workflow |
| Campaign response envelope | Require one undocumented exact body; trust any object; accept the repository's existing list conventions | Reuse `extractList()` with explicit `testcases`, `cases`, and `data` keys, then run full testcase schema validation in Main | The user supplied the route/header but not an outer envelope; bounded normalization avoids guessing case semantics | A materially different live response requires a plan amendment rather than ad-hoc parsing |
| Optional folder semantics | Treat folder as display metadata; call only the folder API; filter by names/paths; intersect authoritative IDs | Fetch the new campaign list first; when a folder is selected, also fetch its existing folder subtree and retain only exact copy-ID matches | Guarantees every returned item belongs to both scopes without requiring an undocumented folder query on the new endpoint | Campaign-plus-folder loading makes two sequential API requests and needs multi-request redacted logging |
| Empty intersection | Fall back to all campaign cases; show folder cases anyway; return an empty scoped list | Return a successful empty list and cache the exact empty selection | Fails closed and accurately represents the selected intersection | The UI shows `Loaded 0 test cases`; no unrelated cases become runnable |
| Campaign cache identity | Add folder to the cache key; reuse folder cache; keep `campaign:<id>` | Keep `campaign:<id>` and atomically replace it with the latest all-campaign or folder-filtered selection, with optional folder metadata | Browser/LG already consume this opaque key and the cache is designed to represent the latest loaded list | Loading another folder in the same campaign replaces the previous active campaign selection, which matches current behavior |
| Campaign-only execution | Make the loaded list view-only; silently omit result sync; invent a root folder; add folderless result support | Permit Browser/LG execution and route folderless completed results through the existing per-case PATCH endpoint | A list that cannot run is an incomplete campaign workflow, while a synthetic folder would violate the result contract | Main fans one logical renderer submission into ordered per-case requests only for campaign-only runs |
| Partial result failure | Retry every per-case request; stop at first failure; track successful and failed IDs | Attempt each completed case in order, return safe successful/failed ID lists, and persist only failed/unknown cases for Retry sync | The backend creates one history row per successful request; knowingly replaying successes would duplicate history | Renderer result-submission code must be centralized so Browser, legacy single-case, and LG use identical retry narrowing |
| Folder-filtered results | Switch all campaign results to per-case PATCH; retain existing batch PATCH | Keep the existing by-folder batch when a real selected folder path exists | Preserves the current efficient and tested contract where it is valid | Result routing is determined by presence of a real folder path, never by a fabricated one |
| IPC surface | Add separate campaign IPC channels; send API calls from renderer; reuse existing channels | Reuse `load-flow-cases` and `submit-flow-case-results`, with Main selecting the safe internal route | Maintains the existing context-isolated boundary and avoids exposing raw API credentials/data | `preload.js` needs no change; its unit contract is still run as regression coverage |
| API logs | Report only the final request; expose raw responses; return a sanitized log array | Add backward-compatible sanitized `apiLogs` support while retaining existing `apiLog` for single-call operations | Operators need both campaign and folder request outcomes without leaking the service token or login passwords | Renderer logging tests cover multiple entries and redaction |
| Baseline failures | Fix them opportunistically; ignore all renderer failures; classify them | Preserve the two known failures and require zero additional failures | Keeps this plan scoped and makes regression evidence honest | Focused campaign tests must pass; the full suite may remain 2-failing until separate cleanup is authorized |

## Assumptions, Constraints, and Dependencies

- Assumption: The new endpoint returns runnable campaign copy testcase objects, either as a top-level array or under the existing `testcases`, `cases`, or `data` list conventions.
- Assumption: Copy IDs returned by the new endpoint are the same copy IDs visible from the existing folder-case endpoint for a campaign-scoped folder tree. If they are not, folder intersection safely returns no cases rather than admitting unrelated data.
- Assumption: “Get test cases from a folder in that campaign” includes the selected folder's descendants, matching the current `folderName` API behavior.
- Assumption: Campaign-only cases should remain runnable and their results should be synchronized; loading them as view-only would not satisfy the runner workflow.
- Constraint: Campaign IDs remain positive integers and are encoded as a path segment only after validation.
- Constraint: The new campaign-testcase GET sends no undocumented filter query parameters.
- Constraint: The Main process remains the sole API, validation, cache, and result-routing boundary. The renderer receives sanitized cases and logs only.
- Constraint: Campaign-copy IDs are authoritative. `sourceFlowCaseId` is metadata only.
- Constraint: Folder-only loading/result submission and campaign-plus-folder batch result submission remain compatible.
- Constraint: Result retries must never knowingly resend an item already confirmed successful in the same logical submission.
- Constraint: Existing partial-batch rules remain: only normally completed cases are eligible for submission.
- Dependency: Backend availability for the new GET endpoint and the already documented per-case PATCH endpoint is required for live verification.
- Dependency: The backend response must include enough runnable fields (`actions` or supported `qaDescription`) to pass `validateTestCaseList`.
- Dependency: No live credentials, campaign, or real LG TV are available for local planning checks; Electron/API/LG smoke verification remains environment-dependent.
- Unresolved material questions: None for the chosen fail-closed implementation. A response envelope outside the bounded conventions above or a backend prohibition on per-case campaign result PATCH requires a plan amendment and user approval before implementation continues.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| New endpoint response differs from known list envelopes | Campaign loads fail before caching | Normalize only bounded list keys, preserve sanitized request/response evidence, validate every selected case | Leave the existing cache untouched; amend the parser only after receiving an authoritative example |
| Folder endpoint and campaign endpoint expose different ID domains | Optional folder returns zero cases | Exact-ID intersection with a clear `Loaded 0` outcome; never fall back to unscoped data | Use campaign-only loading while the backend contract is corrected; revert the optional intersection helper independently |
| Campaign-plus-folder dual request partially fails | Stale or misleading list could be shown | Do not replace cache/rendered cases unless both requests and validation succeed; return both safe logs | Retry the load; prior cache remains intact |
| Folderless per-case result fan-out partially succeeds | Some histories are written while others fail | Attempt deterministically, return confirmed-success and retry IDs, persist only failed/unknown items for retry | Retry only the retained items; use API logs to reconcile unknown timeout cases manually |
| Network timeout occurs after the backend accepted a per-case result | A manual retry may duplicate one history row | Mark timeout as unknown in the safe result and surface it before retry; do not auto-retry | Operator reviews backend history before pressing Retry sync; no automatic replay occurs |
| Renderer source state survives campaign/folder changes | Wrong cache or result context could run | Reset loaded case source and persisted latest cache on source refresh/change before enabling a new run | Reload the intended campaign/folder; revert renderer state changes without touching API helpers |
| Campaign-only cache restoration lacks folder state | Run could be blocked or target loader could choose the wrong source | Restore campaign ID/cache key independently from folder metadata; Browser/LG use the opaque campaign key | Clear the testcase cache through the existing control and reload the campaign |
| Existing folder workflow regresses | Ordinary API test runs fail | Keep folder branch unchanged; add explicit no-campaign request/result regression tests | Revert campaign-specific branches while retaining independent API tests if useful |
| Multi-request API logs leak the service token | Credential exposure in renderer logs | Reuse `sanitizeApiLog` recursively for every entry and assert redaction | Disable the aggregate log field and retain single safe summaries until corrected |
| Existing two renderer failures obscure new failures | False confidence at handoff | Record the exact baseline names, run focused campaign patterns, and compare full-suite failures by name | Stop execution if any third failure appears or either baseline changes unexpectedly |

## File Impact and Detailed Changes

### `app/flow-case-api.js`

**Action:** Modify  
**Current role and evidence:** Builds FlowTest URLs, centralizes `requestJson()`/service-token behavior, extracts list envelopes, and submits by-folder results. `fetchFlowCases()` currently also carries the old campaign query.  
**Exact changes:**

- Add `buildCampaignTestCasesUrl({apiDomain, projectId, campaignId})` for `/api/v1/projects/{projectId}/test-campaigns/{campaignId}/testcases`.
- Validate `campaignId` with the existing positive-integer normalizer before inserting it into the path.
- Add `fetchCampaignTestCases()` using `requestJson()` and `extractList()` with bounded `testcases`, `cases`, and `data` keys; return the established `{ok,cases,request,response}` shape.
- Keep the existing folder/testcase URL behavior compatible, but stop using its `campaignId` branch from the desktop campaign workflow.
- Add `buildFlowCaseResultUrl({apiDomain,projectId,caseId})` and `submitFlowCaseResult()` for the documented per-case PATCH body used by folderless campaigns.
- Preserve timeout handling, header construction, response diagnostics, and redaction inputs.

**Invariants and compatibility:** `X-FlowTest-Service-Token` is the only auth header; no secrets enter public error messages; folder-only and by-folder result helpers remain unchanged; no query filters are appended to the new campaign route.  
**Tests affected:** `tests/unit/flow-case-api.test.js` adds path encoding, positive-ID rejection, list envelope, token header, HTTP/timeout, per-case PATCH body, and folder/by-folder regression coverage.

### `app/campaign-flow-case-workflow.js`

**Action:** Add  
**Current role and evidence:** No pure module currently owns campaign/folder intersection or per-case partial-result accounting; both would otherwise be buried in Electron `main.js` and untestable without booting Electron.  
**Exact changes:**

- Export a pure `intersectCampaignCasesById(campaignCases, folderCases)` helper that validates usable IDs, rejects duplicate campaign copy IDs, creates a folder-ID set, preserves campaign endpoint order/objects, and returns only exact matches.
- Export an async ordered campaign-result fan-out helper that accepts normalized testcase result records and an injected single-submit function, attempts every eligible item, and returns safe confirmed-success, failed/unknown, and retry ID lists without returning credentials or raw thrown errors.
- Keep transport, cache writes, and Electron dependencies out of this module.

**Invariants and compatibility:** `sourceFlowCaseId`, names, and folder labels never participate in selection; result order is deterministic; successful IDs never appear in the retry set.  
**Tests affected:** Add `tests/unit/campaign-flow-case-workflow.test.js` for ordering, exact intersection, duplicates, empty sets, mixed success/failure, timeout/unknown classification, and failed-only retry IDs.

### `app/main.js`

**Action:** Modify  
**Current role and evidence:** Owns all flow-case IPC, schema validation, campaign cache replacement, result payload validation, and safe API logs.  
**Exact changes:**

- Import `fetchCampaignTestCases`, `submitFlowCaseResult`, and the new pure workflow helpers.
- Change `loadCampaignCases(settings,campaignId)` to fetch the new campaign endpoint first.
- When `FOLDER_NAME` is absent, validate/cache/return all campaign copies with `folder: null`/omitted and `cacheKey: campaign:<id>`.
- When `FOLDER_NAME` is present, additionally call existing `fetchFlowCases({folderName,environment,...})`, intersect exact copy IDs, validate the authoritative campaign objects, and attach only the explicitly selected folder metadata.
- Remove the inferred-single-folder fallback from campaign-only loading; delete `resolveCampaignFolder()` if it has no remaining caller.
- Return a backward-compatible sanitized `apiLog` for one-request campaign loads and sanitized `apiLogs` for two-request folder intersections or failures.
- Extend result normalization to allow exactly two valid contexts: a real absolute `FOLDER_PATH`, or a non-empty consistent `CAMPAIGN_ID` with no folder path. Reject neither/both-invalid contexts and mismatched item campaign IDs.
- Keep by-folder submission for real folder paths. For campaign-only payloads, fan out normalized items to `submitFlowCaseResult()` with per-item `campaignId` and return safe `submittedTestcaseIds`, `retryTestcaseIds`, and failure status.
- Never auto-retry inside Main and never include a confirmed-success ID in `retryTestcaseIds`.

**Invariants and compatibility:** API/cache/validation remain main-only; cache replacement happens only after every required fetch and validation succeeds; folder-only IPC behavior is untouched; test credentials/passwords and service tokens remain redacted; result eligibility remains renderer-owned and unchanged.  
**Tests affected:** API and pure workflow suites cover transport/orchestration primitives; renderer tests cover public IPC response handling; `node --check app/main.js` plus source inspection verifies the Main wiring because no current unit harness loads Electron `main.js`.

### `app/renderer/renderer.js`

**Action:** Modify  
**Current role and evidence:** Owns campaign/folder selectors, request locking, active source/cache/result context, Browser/LG dispatch, result construction, and Retry sync.  
**Exact changes:**

- Change `updateFolderControls()` so `Get test cases` is enabled when either a valid campaign or folder is selected and no API request is active.
- Make the folder placeholder clearly optional while a campaign is active (for example, `All campaign folders (optional)`), without adding a new control.
- Update `loadCasesFromSelection()` to require `campaign || folder`, include folder fields only when selected, and allow the campaign-only request.
- Preserve the existing source reset/cache-clear behavior on campaign or folder changes so stale cases cannot run.
- On success, restore `activeCampaignId` and `activeCacheKey` independently from `response.folder`; leave `activeFolderId`/`activeFolderPath` empty for campaign-only loads.
- Extend `appendApiResponseLog()` to render every sanitized `apiLogs` entry while retaining current `apiLog` behavior.
- Remove the `activeCampaignId && !activeFolderPath` run block.
- Always create `FLOW_CASE_RESULT_CONTEXT` for API campaign cases: include `CAMPAIGN_ID`, and include `FOLDER_PATH` only when a real folder was selected. Folder-only/local behavior stays unchanged.
- Refactor the three duplicated Browser batch, legacy single-case, and LG result-submission blocks into one helper that builds/submits the payload, records safe logs, and narrows `pendingResultSubmission.testcases` to Main's `retryTestcaseIds` on partial per-case failure.
- Preserve exact-payload retry behavior for by-folder failures and token refresh behavior in `retryResultSync()`.

**Invariants and compatibility:** Renderer never calls HTTP directly; campaign results retain copy IDs and per-item campaign IDs; Browser/LG source payloads stay narrow; stopped/skipped/launch-failed cases remain excluded; local fixture runs still omit result context.  
**Tests affected:** `tests/unit/renderer.test.js` adds campaign-only enable/load/restore/Browser/LG cases, optional-folder requests, active state, multi-log handling, folder-only regressions, per-case partial retry narrowing, and by-folder retry compatibility.

### `tests/unit/flow-case-api.test.js`

**Action:** Modify  
**Current role and evidence:** Contracts URL construction, headers, list envelopes, HTTP/timeout errors, and result bodies for `flow-case-api.js`.  
**Exact changes:** Add dedicated campaign-testcase GET and single-case PATCH coverage; assert no invented campaign query parameters; retain existing folder/running-campaign/by-folder tests and explicitly assert their URLs remain unchanged.  
**Invariants and compatibility:** Service-token redaction/header behavior remains the same; tests use only fake fetch implementations.  
**Tests affected:** Focused Step 1 target.

### `tests/unit/campaign-flow-case-workflow.test.js`

**Action:** Add  
**Current role and evidence:** Provides deterministic coverage for new logic extracted from Electron Main.  
**Exact changes:** Cover campaign-order preservation, exact copy-ID membership, duplicates/missing IDs, empty intersection, ordered fan-out, mixed success/failure, safe failure output, and confirmed-success exclusion from retry.  
**Invariants and compatibility:** No Electron, filesystem, network, credentials, or time-dependent behavior.  
**Tests affected:** Focused Step 2 target.

### `tests/unit/renderer.test.js`

**Action:** Modify  
**Current role and evidence:** Fake-DOM contract for campaign/folder selection, API state, Browser/LG cache propagation, result sync/retry, and static markup.  
**Exact changes:** Replace folder-required campaign assertions with optional-folder behavior; add campaign-only and campaign-plus-folder request assertions; verify folder-only requests omit campaign fields; verify folderless startup restore/run; test `apiLogs`; verify partial per-case failures retain only retry IDs; retain current by-folder and LG safety assertions.  
**Invariants and compatibility:** The two recorded unrelated baseline failures remain separately classified; new tests must pass under a campaign-specific `--test-name-pattern`.  
**Tests affected:** Focused Step 3 and full regression.

### `README.md`

**Action:** Modify  
**Current role and evidence:** User-facing Electron workflow and API/cache/result behavior at `Run With the Electron Case Browser`.  
**Exact changes:** Document campaign-only loading, optional folder intersection, the new GET endpoint, campaign cache behavior, Browser/LG parity, folder-filtered batch results, and campaign-only per-case result synchronization/retry semantics.  
**Invariants and compatibility:** Keep service-token redaction, folder-only usage, partial-batch rules, and environment-dependent verification clear.  
**Tests affected:** Source review and `git diff --check`.

### `AGENTS.md`

**Action:** Modify  
**Current role and evidence:** Repository architecture and maintenance contract for future agents.  
**Exact changes:** Replace the folder-required campaign description with the new endpoint and optional intersection, state that campaign cache folders are optional, and describe result routing for folder-filtered versus campaign-only runs.  
**Invariants and compatibility:** Preserve Main-process ownership, credential rules, copy-ID rule, Browser/LG source boundaries, and destructive-action prohibitions.  
**Tests affected:** Source review.

### `graphify-out/*`

**Action:** Generated modify during Step 4  
**Current role and evidence:** Persistent project graph required by `AGENTS.md`; it was used for this plan's discovery.  
**Exact changes:** Run `graphify update .` only after code/document changes so the new API route, workflow helper, and result-routing edges replace stale campaign-flow relationships. Do not hand-edit generated graph data.  
**Invariants and compatibility:** Dirty generated graph files are expected; record tool warnings/failures separately from application verification.  
**Tests affected:** Graphify maintenance evidence.

### `docs/tinyworkers/20260812_105838_campaign-optional-folder-workflow.md`

**Action:** Add/update  
**Current role and evidence:** Durable Tiny-Workers source of truth for approval, status, milestone evidence, deviations, and handoff.  
**Exact changes:** Tiny-PM sets approval/status; Tiny-Executor updates one milestone at a time, records actual commands/results immediately, and never pre-fills completion claims.  
**Invariants and compatibility:** The native Codex task panel is only a live projection once execution begins; this file remains authoritative.  
**Tests affected:** Plan readiness review.

## Files Explicitly Unchanged

- `app/preload.js`: existing `loadFlowCases` and `submitFlowCaseResults` bridges are sufficient.
- `app/test-case-cache.js`: campaign entries already accept an absent folder and remain usable; run existing cache tests as regression coverage.
- `app/lg-run-ipc.js`, `app/lg-desktop-batch-runner.js`, `app/browser-batch-runner.js`: both targets already accept the campaign cache key; no scheduling or safety contract change is needed.
- `tests/run-test-case-mytv.spec.js` and `tests/lib/test-case-source.js`: generic execution already prefers `TEST_CASE_CACHE_KEY`.
- `API-SPEC.md`: do not infer an undocumented response schema or rewrite backend documentation from the route/header alone.

## Execution Sequence

### Step 1 — Dedicated campaign and folderless-result API contracts

**Objective:** Add the new GET route and the existing per-case PATCH client without changing Main or renderer behavior yet.  
**Files:** `app/flow-case-api.js`, `tests/unit/flow-case-api.test.js`.  
**Implementation details:** Add validated URL builders/fetchers; reuse `requestJson()` and bounded list extraction; assert the service-token header and no invented query parameters; add per-case PATCH body/error tests; keep folder/by-folder helpers compatible.  
**Dependencies:** User-provided campaign endpoint/header; existing documented per-case result endpoint.  
**Verification:** `node --test tests/unit/flow-case-api.test.js`; `node --check app/flow-case-api.js`. Expected: all focused tests pass and URLs/bodies/headers match exactly.  
**Exit criteria:** A caller can securely fetch a complete campaign testcase list by campaign path and submit one campaign result by testcase path using fake-fetch verified contracts.  
**Approval gate:** Required — approving this plan authorizes the new campaign GET route and folderless per-case result route. No implementation starts before approval.

### Step 2 — Campaign intersection and Main-process orchestration

**Objective:** Produce validated all-campaign or folder-intersected cache entries and route result submissions safely inside Main.  
**Files:** `app/campaign-flow-case-workflow.js`, `app/main.js`, `tests/unit/campaign-flow-case-workflow.test.js`.  
**Implementation details:** Add/test exact-ID intersection and ordered result fan-out; switch `loadCampaignCases()` to the new API; conditionally fetch/intersect folder data; atomically cache only validated final lists; remove inferred folder behavior; add multi-log redaction; route folder results to batch PATCH and folderless campaign results to per-case PATCH with safe failed-only retry IDs.  
**Dependencies:** Step 1 API helpers and approved plan.  
**Verification:** `node --test tests/unit/campaign-flow-case-workflow.test.js tests/unit/flow-case-api.test.js`; `node --check app/campaign-flow-case-workflow.js`; `node --check app/main.js`; targeted source inspection of `load-flow-cases` and `submit-flow-case-results`. Expected: exact intersection/fan-out tests pass, Main parses, and no renderer/API secret crosses the IPC boundary.  
**Exit criteria:** Main can return/cache all campaign cases without a folder, filter by an optional folder fail-closed, and submit campaign-only results without fabricating `folderPath` or replaying confirmed successes.  
**Approval gate:** Not required within the approved files/behavior; any response shape outside the declared assumption or any need to change backend contracts requires a plan amendment.

### Step 3 — Renderer optional-folder workflow and target parity

**Objective:** Make the new Main behavior usable and consistent across Browser, legacy single-case fallback, and LG.  
**Files:** `app/renderer/renderer.js`, `tests/unit/renderer.test.js`.  
**Implementation details:** Enable campaign-only loading; keep folder required only for folder-only mode; clarify the optional placeholder; preserve stale-state resets; restore folderless campaign cache state; support multiple safe API logs; remove the folderless run block; build folderless campaign result context; centralize result submission and partial retry narrowing; retain campaign cache-key propagation to Browser/LG.  
**Dependencies:** Step 2 response/result shapes.  
**Verification:**

- `node --test --test-name-pattern='campaign|Campaign|folderless|optional folder|partial.*retry|api logs' tests/unit/renderer.test.js` — expected: all selected new/affected tests pass.
- `node --check app/renderer/renderer.js` — expected: pass.
- Manual fake-DOM/source review of folder-only request omission and Browser/LG narrow source payloads.

**Exit criteria:** Campaign-only and campaign-plus-folder lists load with the right active state; both targets use `campaign:<id>`; results use the correct route/context; retry retains only eligible unsynced records.  
**Approval gate:** Not required within approved scope; any UI redesign beyond placeholder/state copy requires approval.

### Step 4 — Documentation, regression, and graph maintenance

**Objective:** Make the behavior durable and prove no new regression beyond the known baseline.  
**Files:** `README.md`, `AGENTS.md`, generated `graphify-out/*`, this plan.  
**Implementation details:** Update user/agent guidance; review final diff for scope; run focused/full checks; compare full-suite failures by exact name; update Graphify; record actual evidence/deviations/handoff.  
**Dependencies:** Steps 1–3 complete.  
**Verification:**

- `node --test tests/unit/flow-case-api.test.js tests/unit/campaign-flow-case-workflow.test.js tests/unit/test-case-cache.test.js tests/unit/preload.test.js`
- Renderer focused command from Step 3.
- `npm run test:unit` — expected: no new failures; the two named baseline renderer failures may remain.
- `node --check app/flow-case-api.js app/campaign-flow-case-workflow.js app/main.js app/preload.js app/renderer/renderer.js` as individual commands.
- `npx playwright test tests/run-test-case-mytv.spec.js --list` — expected: one test listed.
- `git -c core.fsmonitor=false diff --check` — expected: pass.
- `git -c core.fsmonitor=false status --short` and scoped diff review — expected: only approved implementation/docs plus generated Graphify/plan changes.
- `graphify update .` — expected: graph refreshed; warnings recorded separately.
- Environment-dependent manual smoke when credentials are available: campaign only, campaign plus folder, folder only, Browser result sync, and confirmed real-LG flow only with its separate safety approval.

**Exit criteria:** Every acceptance criterion has recorded evidence or an explicit environment-dependent limitation; no third unit failure appears; documentation and graph match the implemented workflow.  
**Approval gate:** Live authenticated API/Electron or real-LG operation requires separate environment/operation authorization; local checks do not.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| New campaign GET path/header | Unit | `node --test tests/unit/flow-case-api.test.js` | Exact `/test-campaigns/{id}/testcases` URL, positive ID validation, `X-FlowTest-Service-Token`, no invented queries |
| Tolerant but bounded response list | Unit/negative | Flow API focused tests | Array/data/testcases/cases accepted; malformed payload rejected with safe diagnostics |
| Campaign-only load | Unit/source | Renderer campaign pattern + Main inspection | Request contains campaign only; button enabled; response caches/restores `campaign:<id>` with no folder |
| Campaign plus optional folder | Unit | Pure workflow + renderer patterns | Main makes both logical requests; exact ID intersection preserves campaign order/objects; no non-campaign case appears |
| Empty/malformed intersection | Unit/negative | `campaign-flow-case-workflow.test.js` | Empty stays empty; duplicates/missing IDs fail closed; cache is not replaced on failure |
| Folder-only regression | Unit | Flow API, renderer, cache suites | Existing folder URL, folder requirement, folder cache ID, and by-folder result payload unchanged |
| Browser campaign-only source | Unit | Renderer campaign pattern | `TEST_CASE_CACHE_KEY=campaign:<id>`, no required folder ID/path, run proceeds |
| LG campaign-only source | Unit | Renderer campaign/LG pattern | Availability/run request uses only cache key plus existing safe fields; confirmation/safety flow unchanged |
| Folder-filtered result batch | Unit | Renderer result tests + Flow API tests | One by-folder PATCH with real selected path and per-item campaignId |
| Campaign-only result fan-out | Unit | Flow API + pure workflow + renderer patterns | Per-case PATCH bodies correct; ordered attempts; only fully completed cases included |
| Partial failure retry | Unit/negative | Pure workflow + renderer pattern | Confirmed successes absent from pending retry; failed/unknown IDs retained; no automatic replay |
| API log redaction | Unit | Renderer logging test + Main source review | Both campaign/folder requests visible as sanitized records; service token/password masked |
| Cache startup restore | Unit | Cache suite + renderer campaign pattern | Folderless campaign entry is usable; active campaign/cache key restored with empty folder state |
| Static/regression quality | Static/regression | Syntax, Playwright list, full unit suite, diff check | Syntax/list/diff pass; no failures beyond the two named baseline failures |
| Live backend behavior | Manual/environment-dependent | Authenticated Electron campaign/folder smoke | Counts/intersection/results agree with backend; record not run if credentials unavailable |

## Completed Verification

> Planning and execution evidence is recorded below; baseline failures remain separately classified from implementation results.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Planning discovery | AgentMemory smart search | Pass / no relevant memory | No campaign-specific decision or failed approach returned; unrelated matches excluded | 2026-08-12 10:58:38 +07:00 |
| Planning discovery | Graphify reflect/query | Pass | Preferred sources `requestJson()` and `submitFlowCaseResults()` verified; campaign flow mapped to API/Main/cache/renderer/tests | 2026-08-12 10:58:38 +07:00 |
| Worktree baseline | `git status --short --branch` | Pass with generated changes | Branch `feature/single-campaign`; Graphify reflection/vocabulary files modified by planning discovery; no implementation source edits | 2026-08-12 10:58:38 +07:00 |
| Unit baseline | `npm run test:unit` and dot/TAP summary | Fail (pre-existing) | 668 total, 666 pass, 2 fail: empty batch tooltip expectation and `Chiến dịch` markup expectation | 2026-08-12 10:58:38 +07:00 |
| Syntax baseline | `node --check` for API/Main/preload/renderer | Pass | All four current modules parse | 2026-08-12 10:58:38 +07:00 |
| Playwright discovery baseline | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | 1 test in 1 file | 2026-08-12 10:58:38 +07:00 |
| Whitespace baseline | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors | 2026-08-12 10:58:38 +07:00 |
| Step 1 focused API | `node --test tests/unit/flow-case-api.test.js` | Pass | 25 passed, 0 failed; dedicated campaign GET, list envelopes, service-token header, no filter query, and per-case PATCH body covered | 2026-08-12 11:12:30 +07:00 |
| Step 1 syntax | `node --check app/flow-case-api.js` | Pass | API module parsed successfully | 2026-08-12 11:12:30 +07:00 |
| Step 1 whitespace | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors after Step 1 | 2026-08-12 11:12:30 +07:00 |
| Step 2 focused contracts | `node --test tests/unit/campaign-flow-case-workflow.test.js tests/unit/flow-case-api.test.js` | Pass | 33 passed, 0 failed; exact-ID intersection, sourceFlowCaseId exclusion, ordered fan-out, failed/unknown retry classification, dedicated API contracts | 2026-08-12 11:16:30 +07:00 |
| Step 2 syntax | `node --check app/campaign-flow-case-workflow.js` and `node --check app/main.js` | Pass | Workflow helper and Electron Main module parsed successfully | 2026-08-12 11:16:30 +07:00 |
| Step 2 wiring review | `rg` source inspection of Main campaign load/result handlers | Pass | `loadCampaignCases` uses `fetchCampaignTestCases`, optional folder intersection, campaign cache; result handler supports folder batch or per-case campaign fan-out; old campaign query helper is absent from campaign load | 2026-08-12 11:16:30 +07:00 |
| Step 2 whitespace | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors after Step 2 | 2026-08-12 11:16:30 +07:00 |
| Step 3 renderer campaign-only flow | `node --test tests/unit/renderer.test.js` | Pass with baseline | All new campaign-only load, Browser, LG, optional-folder, and partial-retry tests passed; renderer file reports only the two pre-existing failures (`Run Selected (0)` tooltip and `Chiến dịch` markup) | 2026-08-12 11:25:00 +07:00 |
| Step 3 focused campaign/log coverage | `node --test --test-reporter=dot --test-name-pattern='campaign|optional|partial|API log|LG' tests/unit/renderer.test.js` | Pass | 33 selected campaign, optional-folder, partial-retry, API-log, and LG tests passed; no baseline tests matched the pattern | 2026-08-12 11:33:20 +07:00 |
| Step 3 syntax | `node --check app/renderer/renderer.js` | Pass | Renderer module parsed successfully after campaign-only and result-sync changes | 2026-08-12 11:25:00 +07:00 |
| Step 4 focused contracts | `node --test tests/unit/flow-case-api.test.js tests/unit/campaign-flow-case-workflow.test.js tests/unit/test-case-cache.test.js tests/unit/preload.test.js` | Pass | 51 passed, 0 failed; new transport, intersection/fan-out, cache, and preload contracts pass | 2026-08-12 11:27:00 +07:00 |
| Step 4 full unit regression | `node --test --test-reporter=dot tests/unit/*.test.js` | Fail with baseline only | Exactly the same two pre-existing renderer failures; no new failure appeared | 2026-08-12 11:28:00 +07:00 |
| Step 4 syntax | Individual `node --check` commands for API, workflow helper, Main, preload, and renderer | Pass | All five modules parsed successfully | 2026-08-12 11:28:00 +07:00 |
| Step 4 Playwright discovery | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | 1 test in 1 file listed | 2026-08-12 11:28:00 +07:00 |
| Step 4 whitespace | `git -c core.fsmonitor=false diff --check` | Pass | No whitespace errors after implementation, focused test additions, and docs | 2026-08-12 11:33:20 +07:00 |
| Step 4 final static checks | Individual `node --check` commands for API, workflow helper, Main, preload, and renderer; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git -c core.fsmonitor=false diff --check` | Pass | All five modules parse, one Playwright test is listed, and the final diff has no whitespace errors | 2026-08-12 11:34:05 +07:00 |
| Step 4 documentation review | Scoped `git diff` review of `README.md` and `AGENTS.md` | Pass | User/agent guidance now describes campaign-only loading, optional exact-ID folder intersection, cache state, and result routing | 2026-08-12 11:29:00 +07:00 |
| Step 4 Graphify refresh | `graphify update .` (also `--no-cluster` and `--force --no-cluster`) | Blocked by local tool | Re-extraction repeatedly fails with `[Errno 1] Operation not permitted`; existing generated Graphify learning/reflection files remain, but `graphify-out/graph.json` was not rebuilt | 2026-08-12 11:30:00 +07:00 |

## Deviations and Plan Updates

- 2026-08-12 planning: no implementation deviation. Graphify discovery updated generated reflection/vocabulary files; these are not application changes.
- 2026-08-12 planning: Graphify query feedback was saved successfully, but the installed package reported version `0.9.12` while the skill files are from `0.9.16`. Do not upgrade tooling as part of this feature; record the warning separately if it recurs during the required update.
- 2026-08-12 execution: the required Graphify refresh was attempted three ways (`graphify update .`, `--no-cluster`, and `--force --no-cluster`) and each failed during local re-extraction with `[Errno 1] Operation not permitted`. No workaround changed source or generated graph data; the limitation is recorded for a later environment/tooling repair.
- 2026-08-12 execution: the two renderer baseline failures remain unchanged and are not part of this feature: the empty-run tooltip assertion and the existing `Campaigns`/`Chiến dịch` markup assertion.
- Any change to response parsing beyond the bounded list envelopes, any new backend endpoint, or any decision to make campaign-only cases view-only requires a plan amendment and Tiny-PM/user approval.

## Readiness Gate

- Goal and acceptance criteria are observable and testable: **Pass**.
- Scope/non-goals are explicit: **Pass**.
- Current-state findings have file/symbol/command evidence: **Pass**.
- Material design questions are resolved by a fail-closed approach and explicit assumptions: **Pass**.
- Every planned file has an action, role, exact change, invariant, and test impact: **Pass**.
- Steps are ordered with dependencies, verification, exit criteria, and approval gates: **Pass**.
- Happy, invalid, regression, static, and environment-dependent checks are covered: **Pass**.
- Risks, rollback, external dependencies, and the two pre-existing failures are visible: **Pass**.
- Implementation and documentation changes match the approved scope: **Pass**.
- New focused tests and static checks pass; full-suite failure count remains exactly the two recorded baseline failures: **Pass**.
- Graphify refresh: **Blocked by local `[Errno 1] Operation not permitted` during re-extraction; recorded as an environment/tooling limitation**.

**Tiny-Executor completion recommendation:** Implementation is complete within the approved scope. Live authenticated API/Electron and real-LG smoke checks remain environment-dependent and were not run.

## Handoff and Completion

- Changed files: `app/flow-case-api.js`, `app/campaign-flow-case-workflow.js`, `app/main.js`, `app/renderer/renderer.js`, focused unit tests, `README.md`, `AGENTS.md`, this plan, and generated Graphify learning/reflection files.
- Checks passed: 51 focused contract tests; all new renderer campaign/LG tests; syntax for all changed runtime modules; Playwright test discovery; diff/whitespace checks.
- Full-suite result: exactly the two documented renderer baseline failures remain; no new unit failure was introduced.
- Known limitations: live endpoint response and authenticated Electron/API/LG smoke behavior were not available locally; Graphify re-extraction is blocked by local `[Errno 1] Operation not permitted`.
- Follow-up work: run authenticated campaign-only, campaign-plus-folder, folder-only, Browser result-sync, and separately approved real-LG smoke checks when the environment is available; repair Graphify tooling/permissions and rerun `graphify update .`.
- Final acceptance status: Implementation complete; local evidence recorded; environment-dependent checks pending.
