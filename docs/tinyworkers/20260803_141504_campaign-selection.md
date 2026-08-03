# Run API-loaded test cases by campaign

Plan ID: 20260803_campaign-selection
Status: Complete
Approval: Approved by user on 2026-08-03
Created: 2026-08-03 14:15:04 +07:00
Updated: 2026-08-03 14:39:50 +07:00
Owner: Tiny-Planner / Tiny-PM
Risk: Medium
Branch/worktree: /Users/thainguyen/Documents/Works/MyTV/auto-test-playwright on feature/test-all-trailers

## Status

- [x] Step 1: Add the running-campaign API contract, IPC bridge, campaign-aware case loading, and cache source boundary.
- [x] Step 2: Add the Chiến dịch workspace selector and propagate campaign execution/result context through Browser and LG runs.
- [x] Step 3: Add contract/regression tests, update project documentation, and complete verification.

## Goal

### Problem

The desktop runner currently loads API cases only by folder. It cannot list running
FlowTest campaigns, select a campaign, run its testcase copies, or send the
selected campaign ID with the tested result batch. API-SPEC.md now requires
campaign testcase copies to be run by their own copy IDs and supports campaignId
on result updates.

### Desired outcome

The workspace shows a new select box labelled Chiến dịch above the existing
folder selector, with the same select, refresh, and loading behavior. A selected
running campaign becomes the testcase source; its copied testcase IDs are what
Browser and LG execute, and every submitted result carries the selected
campaignId. With no campaign selected, the existing folder-driven workflow
continues unchanged.

### Acceptance criteria

- [x] Main can fetch GET /api/v1/projects/{projectId}/test-campaigns/running through the existing API authorization boundary and return redacted campaign summaries.
- [x] The workspace renders the campaign list in a Chiến dịch select above the folder select; each selector has its own refresh control and the loading overlay blocks interaction.
- [x] Selecting a campaign and requesting cases loads the running campaign's testcase copies, using each copy's own id rather than sourceFlowCaseId.
- [x] Campaign cases are stored under a campaign-scoped cache key and can be loaded by Browser and LG without replacing or restoring as the ordinary folder cache entry.
- [x] Browser and LG result batches include campaignId on every testcase result item when a campaign is active; folder-only batches do not gain the field.
- [x] Main validates non-empty campaignId values while preserving existing tested/testResult validation and redaction.
- [x] Existing folder loading, local fallback, startup cache restoration, retry sync, and non-campaign result submission remain compatible.
- [x] Unit, syntax, Playwright-list, whitespace, and Graphify verification pass; live API/LG limitations are recorded separately.

### Non-goals

- Do not add campaign administration, creation, start/stop, or account-management UI.
- Do not add a new executable action or allow server-provided selectors/scripts.
- Do not change the result endpoint, retry semantics, partial-batch rules, reports, or LG safety boundaries beyond campaign cache/result context.
- Do not edit the backend-provided API-SPEC.md; preserve its current user change.
- Do not add a separate service-token settings field in this milestone. Campaign requests reuse the existing API_AUTHORIZATION value under the `X-FlowTest-Service-Token` header.

## Current State and Findings

- app/flow-case-api.js builds folder/case/result URLs and sends the configured value only as Authorization; no running-campaign endpoint or testcaseId query exists.
- app/main.js owns folder/case loading and result IPC; app/preload.js exposes only folder/case/result calls. API calls are correctly kept out of the renderer.
- app/renderer/index.html has only the folder select. app/renderer/renderer.js tracks folder state, loads folder cases, and uses the folder cache ID for Browser and LG.
- renderer.js builds one result batch from activeFolderPath; buildFlowCaseResult currently emits only id, status, and testResult.
- app/test-case-cache.js stores entries by folder ID and restores the newest entry without a source discriminator. The generic Browser spec and LG runner both load from that folder key.
- API-SPEC.md sections 3.2, 6, and 9 define the running-campaign endpoint, campaign copy IDs, campaignId result field, and recommended flow. The abbreviated testcase-copy example means Main will re-fetch/hydrate by testcaseId when a listed copy is not already runnable.
- Baseline npm run test:unit: 586 passed, 0 failed, 0 skipped; about 1.17 seconds.
- Baseline npx playwright test tests/run-test-case-mytv.spec.js --list: 1 test listed in 1 file.
- Baseline git diff --check: pass.
- Baseline worktree: feature/test-all-trailers with pre-existing user/backend modification M API-SPEC.md; it must remain untouched.
- Graphify query identified app/flow-case-api.js, app/main.js, app/renderer/renderer.js, app/preload.js, flow-case-api.test.js, and renderer.test.js as the relevant API-to-workspace path; source inspection confirmed the relationships.
- AgentMemory recall found no prior high-confidence campaign design or failed approach.

## Findings and Decisions

| Decision          | Alternatives considered                                                        | Chosen approach                                                                                          | Reason                                                                                 | Consequence                                                                    |
| ----------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Campaign response | Expose raw entries or all testcase data to the renderer                        | Return redacted summaries; re-fetch the selected campaign in Main when cases are requested               | Keeps API data, validation, and action credentials behind Main                         | Get test cases may make a second API request; log both calls                   |
| Copy loading      | Reuse folder query; trust abbreviated copies; fetch every copy unconditionally | Trust complete runnable copies and hydrate only incomplete entries by testcaseId                         | Follows the contract and handles the abbreviated example without needless requests     | Invalid copies fail before cache replacement                                   |
| Cache             | Overwrite folder cache; renderer memory; fake folder ID                        | Use generic cache keys with campaign:<id> and a source discriminator; keep folder wrappers               | Prevents stale campaign copies from replacing/restoring folder data                    | Browser/LG payloads gain an explicit cache key                                 |
| Workspace source  | Replace folder; require both; treat campaign as metadata only                  | Campaign is primary source when selected; folder remains independent and is preferred folderPath context | Implements campaign-or-folder flow without fabricating result paths                    | If campaign has no unambiguous path, run is blocked until a folder is selected |
| Result field      | Outer campaignId; rely on inference; per-item field                            | Add selected campaignId to every testcase result item                                                    | Matches the API example and makes partial completed batches explicit                   | Folder-only payloads stay unchanged                                            |
| Service token    | New service-token field; raw token in URL; overloaded second header            | Reuse existing API_AUTHORIZATION value under `X-FlowTest-Service-Token`                                  | Honors the updated API contract without adding another credential surface              | Existing setting/storage names remain authorization-oriented                         |
| LG                | Browser-only; bypass cache; silently use folder key                            | Carry campaign cache key through narrow LG IPC and use the same result context                           | Preserves the existing Browser/LG parity promise                                       | LG IPC/runner tests need cache-key coverage                                    |

## Assumptions, Constraints, and Dependencies

- API_AUTHORIZATION retains its existing configured value and is sent under `X-FlowTest-Service-Token` for the campaign endpoint.
- Each campaign copy either has actions or qaDescription, or can be hydrated by its copy ID. sourceFlowCaseId is never substituted.
- A selected folder path is preferred for result PATCH. Without one, Main may use a single unambiguous absolute folder path present on the campaign copies; otherwise the renderer blocks before execution.
- API access, cache writes, case validation, and masking remain Main responsibilities. Renderer receives redacted summaries and sanitized cases.
- Existing folder cache, local fallback, one-worker session ownership, and partial-result rules stay unchanged for folder runs.
- The existing PATCH flow-cases/by-folder endpoint and absolute folderPath validation remain in force.
- Live API authentication/campaign state and LG execution are environment-dependent.
- Unresolved material questions: None under these assumptions. The follow-up user request confirmed that the existing configured value should be reused under the service-token header.

## Risks and Rollback

| Risk                                            | Impact                             | Mitigation                                                                          | Rollback or recovery                                                           |
| ----------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Campaign ends between list/load/result          | 409 or stale batch                 | Re-fetch and validate before caching; preserve API errors; never auto-retry success | Reload running campaigns or revert campaign code; folder runs remain available |
| Summary-only or malformed copies                | Incomplete or wrong case could run | Hydrate by copy ID and validate before cache replacement                            | Leave prior cache untouched; fix backend response or select folder             |
| Campaign contaminates folder cache              | Wrong IDs after restart            | Namespaced campaign key and startup filter; explicit key in both runners            | Remove only the affected campaign entry through normal cache handling          |
| No valid campaign folderPath                    | Run cannot satisfy result contract | Prefer selected folder/copy metadata; block before execution when absent            | Select a folder and reload                                                     |
| Campaign refresh auth failure breaks folder use | Existing folder workflow regresses | Handle folder/campaign responses independently and preserve successful list         | Revert campaign IPC only                                                       |
| API-SPEC.md is overwritten                      | Backend notes are lost             | Do not edit it; check final status/diff                                             | Restore user change manually; no reset/checkout                                |

## File Impact and Detailed Changes

### app/flow-case-api.js

Action: Modify. Add the running-campaign URL/fetcher for data envelope entries
containing campaign and run. Extend the case URL/fetcher to accept testcaseId
as the alternate query to folderName. Preserve the configured token value,
timeout, error, and API-log shapes while sending the value under
`X-FlowTest-Service-Token`.

### app/test-case-cache.js

Action: Modify. Add generic key read/write helpers and folder versus campaign
source/context metadata. Retain existing folder wrappers and make newest-folder
startup restoration ignore campaign entries. Keep atomic temp-write/rename.

### app/main.js

Action: Modify. Add load-flow-case-campaigns IPC returning redacted summaries.
When CAMPAIGN_ID is supplied, re-fetch the selected running campaign, hydrate
incomplete copies by copy ID, validate the full list, write a campaign cache key,
and return campaign/cache/folder context. Add the cache key to Browser/LG loading
and preserve optional campaignId through result normalization.

### app/preload.js

Action: Modify. Expose loadFlowCaseCampaigns(settings) through the narrow
load-flow-case-campaigns IPC channel.

### app/renderer/index.html

Action: Modify. Insert a campaign header/select above the folder header/select,
with exact label Chiến dịch and placeholder Select a campaign.... Reuse the
existing select and folder-browser styles and keep Get test cases.

### app/renderer/renderer.js

Action: Modify. Add campaign map/active ID/cache-key state; render summaries;
refresh campaigns with folders; enable loading when either source is selected;
request campaign cases by ID; track returned cache/folder context; pass cache key
to Browser/LG; and add campaignId to each campaign result item. Preserve folder
loading, stop/skip/partial rules, LG confirmation, and frozen retry payloads.

### app/lg-run-ipc.js and app/lg-desktop-batch-runner.js

Action: Modify. Allow an optional opaque cacheKey in the narrow LG request,
forward only its normalized value, and prefer it over folderId when loading a
campaign case. Do not change device/preflight/connection behavior.

### tests/run-test-case-mytv.spec.js

Action: Modify. Prefer TEST_CASE_CACHE_KEY when present and fall back to
TEST_CASE_FOLDER_ID; keep api-cache source and local fallback behavior.

### Focused unit tests

Action: Modify tests/unit/flow-case-api.test.js, test-case-cache.test.js,
preload.test.js, lg-run-ipc.test.js, lg-desktop-batch-runner.test.js, and
renderer.test.js. Cover URL/envelope/auth, testcaseId hydration, cache
isolation/startup filtering, narrow IPC, Browser/LG cache-key propagation,
campaign/folder source switching, selector order/loading, campaign result
fields, retry equality, and folder-only regressions.

### README.md and AGENTS.md

Action: Modify. Document the Chiến dịch selector, campaign-versus-folder
source, copy-ID rule, campaign cache isolation, Bearer authorization
requirement, campaignId result field, and shared Browser/LG behavior. Keep
Main-process ownership, redaction, and TV/LG safety rules intact.

### API-SPEC.md

Action: Do not modify. It is the backend-provided pre-existing M and the
contract source for this work.

### docs/tinyworkers/20260803_141504_campaign-selection.md

Action: Add. Keep the status block, milestone checkboxes, completed verification,
deviations, and handoff current through execution.

## Execution Sequence

### Step 1 — API, IPC, cache, and runner contract

Objective: Deliver validated campaign cases to Browser and LG without
contaminating folder cache behavior.

Files: flow-case-api.js, main.js, preload.js, test-case-cache.js,
lg-run-ipc.js, lg-desktop-batch-runner.js, run-test-case-mytv.spec.js, and
focused tests.

Implementation: Add running-campaign URL/fetcher and testcaseId query; add IPC;
re-fetch/hydrate and validate copies in Main; write namespaced campaign entries;
prefer TEST_CASE_CACHE_KEY; and preserve per-item campaignId normalization.

Verification: Focused API/cache/preload/LG tests and node --check on every changed
runtime/spec module. Expected: all pass and no unvalidated campaign data reaches
execution.

Exit criteria: Campaign ID resolves to validated copy cases and a cache key;
folder requests remain compatible; Browser/LG loaders accept the key.

Approval gate: Satisfied by user approval on 2026-08-03.

### Step 2 — Workspace selector and result propagation

Objective: Add the requested selector and make campaign/folder source selection
visible and deterministic.

Files: renderer/index.html, renderer/renderer.js, renderer.test.js, and only
minimal shared CSS if required.

Implementation: Add Chiến dịch above folders; give campaigns and folders separate
refresh controls under the common overlay; make campaign primary when selected; preserve folder-only loading; track
campaign/cache/folder context; pass cache key to Browser/LG; add campaignId to
result items; and guard missing result folder paths.

Verification: renderer and preload focused tests plus fixture inspection for option
order, loading disable state, source switching, campaign payload, folder payload,
retry, and missing-path guard.

Exit criteria: Campaign runs use copy IDs and campaignId; folder runs unchanged;
retries reuse the exact campaign-aware payload.

Approval gate: Satisfied by user approval on 2026-08-03.

### Step 3 — Documentation, regression, and final evidence

Objective: Make the new contract durable and hand off evidence without changing
the backend spec or unrelated work.

Files: README.md, AGENTS.md, affected tests, and this plan.

Implementation: Update docs; update plan status/checkpoints after each verification;
review final diff; run Graphify update after code changes.

Verification: npm run test:unit; all changed-module node --check commands;
npx playwright test tests/run-test-case-mytv.spec.js --list; git diff --check;
graphify update .. Expected: full suite passes, one generic test lists, syntax and
whitespace pass, and Graphify succeeds or its environment failure is recorded.

Exit criteria: Every acceptance criterion has evidence; final diff is reviewed;
API-SPEC.md remains the existing user modification.

Approval gate: Satisfied by user approval on 2026-08-03; final evidence recorded below.

## Verification Plan

| Acceptance criterion                 | Check type      | Command or action                                                    | Expected evidence                                                                                |
| ------------------------------------ | --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Campaign URL/envelope/auth           | Unit            | node --test tests/unit/flow-case-api.test.js                         | Correct running endpoint, data mapping, auth, HTTP and timeout shape                             |
| Incomplete copies hydrate by copy ID | Unit/contract   | flow-case-api and renderer tests                                     | testcaseId is used, never sourceFlowCaseId; invalid cases fail before cache                      |
| Cache isolation                      | Unit            | node --test tests/unit/test-case-cache.test.js                       | Campaign key is isolated and ignored by folder startup restore                                   |
| Narrow IPC/redaction                 | Unit/static     | node --test tests/unit/preload.test.js plus source review            | One campaign bridge; summaries/cases are sanitized                                               |
| Selector UX                          | Unit/manual     | renderer tests and index.html inspection                             | Chiến dịch is above folders; refresh/loading/select behavior matches                             |
| Browser/LG campaign source           | Unit/static     | renderer, lg-run-ipc, lg-desktop-batch-runner tests; Playwright list | Campaign cache key/copy IDs propagate; one generic test lists                                    |
| Result campaignId                    | Unit            | renderer tests and main normalizer source review                     | Per-item campaignId only for campaign runs; retries remain equal                                 |
| Regression/static                    | Regression      | npm run test:unit, node --check, diff --check                        | All pass; API-SPEC.md remains pre-existing M                                                     |
| Graph maintenance                    | Maintenance     | graphify update .                                                    | Graph current, or exact tool limitation recorded                                                 |
| Live integration                     | Optional/manual | Authenticated API/Electron campaign run; no forced LG run            | Options/copy IDs match and result PATCH contains campaignId; live 403/409 is recorded separately |

## Completed Verification

Update only with actual execution evidence.

| Step or check     | Command or action                                           | Result | Evidence                        | Timestamp               |
| ----------------- | ----------------------------------------------------------- | ------ | ------------------------------- | ----------------------- |
| Planning baseline | npm run test:unit                                           | Pass   | 586 passed, 0 failed, 0 skipped | 2026-08-03 14:15 +07:00 |
| Planning baseline | npx playwright test tests/run-test-case-mytv.spec.js --list | Pass   | 1 test in 1 file                | 2026-08-03 14:15 +07:00 |
| Planning baseline | git diff --check                                            | Pass   | No whitespace errors            | 2026-08-03 14:15 +07:00 |
| Step 1 focused    | node --test tests/unit/flow-case-api.test.js                | Pass   | 16 passed, 0 failed            | 2026-08-03 14:32 +07:00 |
| Step 1 focused    | node --test tests/unit/test-case-cache.test.js              | Pass   | 4 passed, 0 failed             | 2026-08-03 14:32 +07:00 |
| Step 1 focused    | node --test tests/unit/preload.test.js                      | Pass   | 9 passed, 0 failed             | 2026-08-03 14:32 +07:00 |
| Step 1 focused    | node --test tests/unit/lg-run-ipc.test.js                   | Pass   | 3 passed, 0 failed             | 2026-08-03 14:32 +07:00 |
| Step 1 focused    | node --test tests/unit/lg-desktop-batch-runner.test.js      | Pass   | 8 passed, 0 failed             | 2026-08-03 14:32 +07:00 |
| Step 1 syntax     | node --check on changed runtime/spec modules                 | Pass   | main/API/cache/preload/LG/spec all parsed | 2026-08-03 14:32 +07:00 |
| Step 2 UI         | node --test tests/unit/renderer.test.js                       | Pass   | 88 passed, 0 failed; selector, Browser, LG, and result coverage | 2026-08-03 14:38 +07:00 |
| Step 2 syntax      | node --check app/renderer/renderer.js                         | Pass   | Renderer parsed successfully       | 2026-08-03 14:38 +07:00 |
| Step 3 regression | npm run test:unit                                             | Pass   | 596 passed, 0 failed, 0 skipped   | 2026-08-03 14:39 +07:00 |
| Step 3 syntax     | node --check changed runtime/spec modules                     | Pass   | All changed JS modules parsed      | 2026-08-03 14:39 +07:00 |
| Step 3 list       | npx playwright test tests/run-test-case-mytv.spec.js --list  | Pass   | 1 test in 1 file                   | 2026-08-03 14:39 +07:00 |
| Step 3 whitespace | git -c core.fsmonitor=false diff --check                    | Pass   | No whitespace errors               | 2026-08-03 14:39 +07:00 |
| Step 3 graph      | graphify update .                                             | Pass   | Rebuilt 2610 nodes, 4174 edges, 161 communities; 5 non-code data files produced zero AST nodes | 2026-08-03 14:39 +07:00 |

## Deviations and Plan Updates

- No scope deviation. Campaign hydration is kept in Main and only uses the
  backend-provided copy `id`; `sourceFlowCaseId` is never used for execution.
- Follow-up amendment: The existing API_AUTHORIZATION setting value now uses the
  backend-required `X-FlowTest-Service-Token` request header, and campaigns/folders
  have independent refresh controls. No new credential setting was introduced.
- The first sandboxed Graphify update was denied by the filesystem. The same
  required command succeeded with elevated workspace access; its warning about
  five JSON/config files producing zero AST nodes is recorded in the evidence.

## Handoff and Completion

- Changed files: API/cache/Main/preload/LG runner boundaries, generic runner spec,
  renderer selector/source propagation, README.md, AGENTS.md, focused tests,
  refreshed Graphify output, and this plan; API-SPEC.md remains the pre-existing
  user change. The follow-up plan records the header/control amendment.
- Checks passed: 596 unit tests from the campaign implementation, plus the
  follow-up focused API/renderer tests; final full-suite evidence is recorded in
  the follow-up plan.
- Known limitations: Live campaign authentication/state and LG execution are
  environment-dependent; no live campaign call or real-TV batch was run.
- Follow-up: Live campaign authentication/state and LG execution remain
  environment-dependent; no live campaign call or real-TV batch was run.
- Final acceptance status: Complete. API-SPEC.md was not modified by this work.
