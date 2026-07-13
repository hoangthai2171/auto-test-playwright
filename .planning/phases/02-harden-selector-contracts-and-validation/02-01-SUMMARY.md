---
phase: 02-harden-selector-contracts-and-validation
plan: 01
subsystem: testing
tags: [playwright, selectors, validation, diagnostics]
requires:
  - phase: 01-extract-core-helper-modules
    provides: "Focused CommonJS navigation, content, artifact, and text utility modules"
provides:
  - "Declarative role-based selector contracts with ordered alternatives"
  - "Bounded focused-target verification, minimal activation diagnostics, and health checks"
  - "Synthetic Playwright coverage for selector drift and ambiguity handling"
affects: [02-02, phase-3-smart-state-detection, phase-4-dom-optimization]
tech-stack:
  added: []
  patterns: ["Declarative selector contracts", "Threshold plus score-margin verification", "Top-candidate JSON plus screenshot diagnostics"]
key-files:
  created:
    - tests/lib/selectors.js
    - tests/lib/selector-validation.js
    - tests/selector-contracts.spec.js
  modified: []
key-decisions:
  - "Use a two-tier contract registry with explicit alternatives and bounded failure instead of undeclared broad fallback matching."
  - "Keep diagnostics limited to focused state and one top candidate, attached as JSON plus screenshot."
requirements-completed: [SELECTOR-01, SELECTOR-02, SELECTOR-03, SELECTOR-04]
duration: 6 min
completed: 2026-07-13
---

# Phase 2 Plan 1: Selector Contract Primitives Summary

**Declarative selector contracts with bounded fuzzy verification, minimal activation diagnostics, and ready-state health results**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-13T04:59:00Z
- **Completed:** 2026-07-13T05:06:24Z
- **Tasks:** 3 completed
- **Files modified:** 3 created

## Accomplishments

- Added role-based selector contracts for focus, menus, content, channels, popups, and player elements.
- Added focused-target verification with Vietnamese normalization, score thresholds, score-margin ambiguity rejection, bounded fallback metadata, and required/optional health statuses.
- Added five synthetic Playwright tests covering contract structure, minimal diagnostics, ambiguity, artifact attachments, and health-check severity.

## Task Commits

Task commits were not created because the workspace `.git` directory is read-only and Git cannot create `.git/index.lock`. The implementation remains in the working tree for the next execution step.

## Files Created/Modified

- `tests/lib/selectors.js` - Declarative selector contract registry and lookup helpers.
- `tests/lib/selector-validation.js` - Candidate diagnostics, activation verification, and health-check helpers.
- `tests/selector-contracts.spec.js` - Deterministic synthetic selector validation coverage.

## Decisions Made

- Exact thresholds, score margins, and fallback limits are configurable implementation choices within the user-locked contract behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added score-margin comparison for ambiguity**
- **Found during:** Task 2 (selector validation)
- **Issue:** A highest-scoring exact match could still be ambiguous when a second candidate had the same score.
- **Fix:** Added `secondScore` and `scoreMargin` to diagnostics and require the configured margin.
- **Files modified:** `tests/lib/selector-validation.js`
- **Verification:** Ambiguous synthetic fixture is rejected; clear fixture passes.
- **Committed in:** Not committed because `.git` is read-only.

**Total deviations:** 1 auto-fixed.
**Impact on plan:** Correctness fix within the locked ambiguity requirement; no scope expansion.

## Issues Encountered

- Sandboxed Chromium initially failed with a macOS `mach_port_rendezvous` permission error. The focused suite passed when rerun through the approved elevated browser execution path.
- Git commits remain blocked by workspace permissions (`.git/index.lock` cannot be created).

## Verification

- `node` module smoke checks: passed.
- `npx playwright test tests/selector-contracts.spec.js`: 5 passed with elevated Chromium.
- `npx playwright test tests/selector-contracts.spec.js tests/ai-row-selection.spec.js`: 10 passed with elevated Chromium.

## Next Phase Readiness

Wave 1 primitives and deterministic coverage are ready for Wave 2 integration into navigation, content rows, workflows, and the backward-compatible helper barrel.

---
*Phase: 02-harden-selector-contracts-and-validation*
*Plan: 01*
*Completed: 2026-07-13*
