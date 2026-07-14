---
phase: 04-optimize-dom-scanning-performance
plan: 03
subsystem: selector-navigation
tags: [playwright, locator, selectors, keyboard-navigation]
key-files:
  created:
    - tests/locator-contracts.spec.js
  modified:
    - tests/lib/selectors.js
    - tests/lib/selector-validation.js
    - tests/lib/workflows.js
    - tests/selector-contracts.spec.js
metrics:
  tests: 25
  locator_fallback: one diagnostic evaluate fallback
---

# Phase 04 Plan 03: Locator Filtering Summary

## Outcome

Added contract-backed Locator helpers for stable left-menu and search-action controls. Locator filtering resolves visible structural targets with `hasText`; when a contract misses, one evaluate fallback returns explicit diagnostics and a `contractMiss` signal. All resolved targets continue through remote focus, selector verification, and keyboard Enter, with no `locator.click()` path introduced.

## Commits

| Commit | Description |
|---|---|
| `252caa8` | Add contract-backed Locator filtering and keyboard activation diagnostics |

## Verification

- `node --check` passed for workflows, selector validation, and Locator tests.
- Focused Locator/selector suite passed: 11 tests.
- Combined Wave 3 regression gate passed: 25 tests.
- Tests cover duplicate-label disambiguation, one fallback invocation with diagnostics, keyboard-only activation, and absence of `locator.click()`.

## Decisions Implemented

- D-08: stable menu and action controls use centralized contract-backed Locators.
- D-09: dynamic content discovery remains on the specialized scoped evaluator path.
- D-10: Locator misses run one visible diagnostic fallback and surface `LOCATOR_CONTRACT_MISS` when unresolved.
- D-11: Locator lookup never activates by mouse; remote focus and verified Enter remain mandatory.

## Deviations from Plan

None.

## Self-Check: PASSED

- Created files exist on disk.
- Production commit is present in git history.
- Focused and combined verification commands pass.
