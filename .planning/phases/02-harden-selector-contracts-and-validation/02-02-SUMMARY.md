---
phase: 02-harden-selector-contracts-and-validation
plan: 02
subsystem: testing
tags: [playwright, selectors, validation, diagnostics, navigation]
requires:
  - phase: 02-harden-selector-contracts-and-validation
    provides: "Declarative selector contracts and bounded validation primitives"
provides:
  - "Contract-aware navigation and content discovery"
  - "Verified pre-Enter activation across shared workflows"
  - "Post-login selector health preflight and compatibility exports"
affects: [phase-3-smart-state-detection, phase-4-dom-optimization]
tech-stack:
  added: []
  patterns: ["Focused-container relation", "Pre-activation diagnostics", "Required/optional ready-state health"]
key-files:
  created: []
  modified:
    - tests/lib/selectors.js
    - tests/lib/selector-validation.js
    - tests/lib/navigation.js
    - tests/lib/content-rows.js
    - tests/lib/workflows.js
    - tests/lib/index.js
    - tests/lib/ai-plan-runner.js
    - tests/selector-contracts.spec.js
    - tests/login-mytv.spec.js
    - tests/open-setting-mytv.spec.js
    - tests/play-channel-mytv.spec.js
    - tests/play-movie-mytv.spec.js
    - tests/search-content-mytv.spec.js
key-decisions:
  - "Treat a focused menu marker and its sibling label as one bounded control relation, while still rejecting duplicate content candidates with equal scores."
  - "Keep virtual-keyboard character entry keyboard-driven; only user-facing control/content Enter activations use verified activation."
requirements-completed: [SELECTOR-01, SELECTOR-02, SELECTOR-03, SELECTOR-04]
duration: 20 min
completed: 2026-07-13
---

# Phase 2 Plan 2: Integrated Selector Validation Summary

**Shared navigation now validates the focused target immediately before Enter and records bounded diagnostics.**

## Accomplishments

- Wired role-based selector contracts into navigation and content-row discovery without changing public helper signatures.
- Routed login, profile, menu, service, channel, movie, search, and content activation through bounded verification with JSON/screenshot attachments before every attempt.
- Added focused-container/sibling-label handling for the live MyTV DOM while preserving score-margin rejection for duplicate content candidates.
- Added the minimal ready-state health check after home popup handling; required gaps fail and optional gaps warn with structured JSON plus screenshot.
- Preserved the `tests/lib/mytv-helpers.js` compatibility surface and one-worker/session behavior.

## Verification

- `node --check` passed for all modified JavaScript files.
- `npx playwright test tests/selector-contracts.spec.js tests/ai-row-selection.spec.js` — **12 passed**.
- Live staging: `npx playwright test tests/login-mytv.spec.js tests/open-setting-mytv.spec.js tests/play-channel-mytv.spec.js` — **3 passed**.
- Live staging: `npx playwright test tests/login-mytv.spec.js tests/play-movie-mytv.spec.js` — **2 passed**.
- Search without configuration correctly fails with the existing `SEARCH_KEYWORD is required` guard. With `SEARCH_KEYWORD="can phong"`, the run reached virtual-keyboard entry but failed in the existing `remoteFocusByVirtualKey` path while trying to focus `key-w-v2`; this is an environment/UI-navigation limitation, not a selector-contract activation failure.
- AI plan execution was not run because `AI_PLAN_PATH` was not configured.

## Issues and Constraints

- Git task commits could not be created because the workspace `.git` directory is read-only and Git cannot create `.git/index.lock`. Changes remain in the working tree.
- The unconfigured full-suite gaps are explicit setup requirements (`AI_PLAN_PATH`, `SEARCH_KEYWORD`) already present in the project’s Phase 1 concerns.

## Deviations

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accepted live menu label siblings without weakening duplicate-content rejection**
- **Found during:** live channel verification
- **Issue:** A dynamic menu uses `menu_item_*` for focus and `menu_text_*` for its sibling label; equal label scores otherwise caused a false ambiguity failure.
- **Fix:** Added bounded same-parent/common-menu-ancestor relation and allow it to resolve ambiguity only when the candidate is a distinct label node; same-node duplicate content candidates remain rejected.
- **Verification:** Channel live flow passed; synthetic ambiguity test passed.

**2. [Rule 1 - Bug] Removed an obsolete hard-coded first-row coordinate gate**
- **Found during:** live movie verification
- **Issue:** The old `y >= 500`, `120x90` focus gate timed out on a valid scaled live layout.
- **Fix:** Kept the wait bounded but verified only visible, non-zero focus geometry, then delegated identity/activation to the content contract validator.
- **Verification:** Movie live flow passed.

**Total deviations:** 2 auto-fixed, both within the locked selector-validation scope.

## Next Phase Readiness

Selector contracts and integrated activation are implemented and regression-tested. The phase is ready for review; staging-dependent search/AI flows require their existing environment inputs and the search virtual-keyboard path remains a separate live-navigation issue.

---
*Phase: 02-harden-selector-contracts-and-validation*
*Plan: 02*
