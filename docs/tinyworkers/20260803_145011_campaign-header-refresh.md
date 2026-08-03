# Campaign refresh and service-token header follow-up

Plan ID: 20260803_campaign-header-refresh
Status: Complete
Approval: Direct user request on 2026-08-03
Created: 2026-08-03 14:50:11 +07:00
Updated: 2026-08-03 14:58:02 +07:00
Owner: Tiny-PM / Tiny-Executor
Branch/worktree: /Users/thainguyen/Documents/Works/MyTV/auto-test-playwright on feature/test-all-trailers

## Scope

1. Change the shared FlowTest request header from `Authorization` to
   `X-FlowTest-Service-Token`, retaining the configured token value and masking
   it in Main/API logs.
2. Add a campaign refresh button beside `Chiến dịch`; the campaign and folder
   buttons each refresh only their own list.
3. Update focused tests/docs, refresh Graphify, and run the project checks.

## Constraints

- Do not edit the backend-provided `API-SPEC.md`.
- Keep the existing API setting/storage value and IPC payload names; only the
  outbound header name changes.
- Preserve campaign loading, folder loading, cache, Browser/LG, result, and
  retry behavior outside the requested header/control changes.

## Acceptance criteria

- [x] FlowTest requests send the configured value under
  `X-FlowTest-Service-Token` and do not send `Authorization`.
- [x] API logs redact the new service-token header value.
- [x] Campaign and folder each have an adjacent refresh control; each control
  refreshes only its own list and both remain blocked during an API request.
- [x] Existing campaign/folder and full-suite tests pass.
- [x] Syntax, Playwright-list, whitespace, and Graphify checks pass.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused API/header tests | Pass | `node --test tests/unit/flow-case-api.test.js`: 16 passed; assertions cover new header and absence of `Authorization`. |
| Focused renderer tests | Pass | `node --test tests/unit/renderer.test.js`: 88 passed; independent refresh click behavior, markup IDs, and new-header text redaction covered. |
| Full unit/syntax/list/diff checks | Pass | Final `npm run test:unit`: 596 passed; `node --check` passed for main/preload/renderer; Playwright listed 1 test; final `git -c core.fsmonitor=false diff --check` passed. |
| Graphify update | Pass | Final `graphify update .` rebuilt 2618 nodes, 4181 edges, 160 communities; five JSON/config files still produced zero AST nodes as an existing Graphify warning. |

## Deviations and handoff

- The existing `API_AUTHORIZATION` setting and IPC names are intentionally
  retained for compatibility; only the outbound header key changed.
- The first full-suite run had one nondeterministic `durationMs` assertion
  failure in the existing action-runner test (595/596 passed); the immediate
  rerun passed all 596 tests without changing that unrelated code.
- The first sandboxed Graphify update was denied by filesystem permissions; the
  required elevated retry completed successfully.
- `API-SPEC.md` remains the backend-provided user change and was not edited.
- Live API calls are not required for this follow-up; the existing token value
  is preserved and only its request header name changes.

## Handoff

- `app/flow-case-api.js` now emits `X-FlowTest-Service-Token` for the existing
  configured value and never emits `Authorization` from the shared client.
- `app/main.js` masks the new header name in API logs.
- `app/renderer/index.html` has a campaign refresh button beside `Chiến dịch`
  and a folder-only refresh button beside `Folders`; `renderer.js` binds each
  to only its own loader while the shared API-request lock disables both. The
  renderer text redactor also recognizes the hyphenated service-token key.
- Focused tests, full unit tests, syntax checks, Playwright listing, whitespace,
  and Graphify verification are complete. Live campaign authentication/state
  and LG execution remain environment-dependent.
