# Phase 3 Target-Neutral Actions Design

## Goal

Run the existing validated server-case schema through one trusted action contract for Browser and LG TV targets without adding target tags, changing flow-case API payloads, or performing a live product flow.

## Boundary

`compileTestCase()` remains the single schema/compiler boundary. A new action context carries `{ session, testInfo, helpers, capabilities }`; it never receives server-supplied selectors, JavaScript, Appium capabilities, hosts, or secrets. Browser execution adapts its existing Playwright page to this context, while LG execution adapts the existing `TvSession` to the same contract.

The trusted action adapter owns all DOM semantics. It uses normalized DOM state, native remote keys for TV navigation, and character-by-character virtual-keyboard input. It returns the existing structured step results and only redacted local diagnostics/artifact references.

## Execution model

1. Compile and validate the selected case before target interaction.
2. Preflight each action against the selected context capabilities. An unsupported action fails with the original case ID and action index before that action runs.
3. Dispatch through target-neutral handlers. Browser handlers delegate to existing helpers; TV handlers delegate to `DomSession`/`TvSession` methods and trusted MyTV semantic helpers.
4. Preserve per-action result attachment, expected-result handling, completion artifacts, and failure precedence.
5. After every TV case, run trusted logout/cleanup. A cleanup failure changes a passing result to failed; it never hides the primary action failure.

## Safety and scope

- LG remains the only physical-TV target implementation. Samsung stays rejected before discovery or session creation.
- TV runtime connection data, pairing material, credentials, and screenshots remain absent from profiles, diagnostics, commits, and responses.
- Phase 3 local tests use injected fakes only. They do not contact a TV, perform pairing, deploy software, log in, search, or play media.
- Browser test behavior and flow-case API result payloads remain unchanged.

## Testing

Unit contracts cover action preflight, action-index error context, key/input mapping, DOM-state waits, artifact/result conversion, cleanup precedence, and every supported action through a fake `TvSession`. Existing browser action-runner tests remain the regression suite for the Playwright path. The terminal TV contract stays fake-only until a separately approved live validation.
