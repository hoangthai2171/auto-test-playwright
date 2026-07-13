---
phase: 01-extract-core-helper-modules
plan: 03
subsystem: testing
tags: [playwright, commonjs, compatibility, workflows]
requires:
  - phase: 01-extract-core-helper-modules
    provides: "Focused text, navigation, content-row, playback, and artifact modules"
provides:
  - "High-level workflows module composed from focused helpers"
  - "Central index export surface"
  - "Backward-compatible mytv-helpers shim and retained legacy reference"
affects: [phase-2-selector-contracts, phase-3-smart-waits, phase-4-dom-optimization]
tech-stack:
  added: []
  patterns: ["CommonJS composition root", "legacy export compatibility shim"]
key-files:
  created: [tests/lib/workflows.js, tests/lib/index.js, tests/lib/mytv-helpers.legacy.js]
  modified: [tests/lib/mytv-helpers.js, .planning/phases/01-extract-core-helper-modules/03-PLAN.md]
key-decisions:
  - "The compatibility shim preserves every legacy public and __internal key while the central index adds focused-module exports."
  - "The legacy implementation remains as a non-runtime reference for export and behavior comparisons."
patterns-established:
  - "Workflows configure content-row and artifact adapters once, then expose the existing page-first helper signatures."
requirements-completed: [REFACTOR-06, REFACTOR-07]
duration: 35 min
completed: 2026-07-13
---

# Phase 1 Plan 3: Workflow and Compatibility Summary

**High-level MyTV flows now compose focused helper modules through a central barrel while preserving all legacy imports and internal test seams.**

## Performance

- **Duration:** 35 min
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

- Extracted startup, login, menu, service, channel, movie, search, and AI orchestration into `workflows.js`.
- Added `index.js` to compose and re-export all focused modules, including the legacy `__internal` seam.
- Replaced active `mytv-helpers.js` with a compatibility re-export and retained the original implementation as `mytv-helpers.legacy.js`.
- Confirmed legacy export compatibility and all deterministic helper tests pass; 9 of 11 full-suite tests passed in the configured staging run.

## Task Commits

1. **Task 1: extract_workflows** — `4d2c093`
2. **Task 2: compose_barrel_and_compatibility_shim** — `4d2c093`
3. **Task 3: rename_legacy_and_run_compatibility_verification** — `4d2c093`

## Files Created/Modified

- `tests/lib/workflows.js` — high-level orchestration and lookup flows.
- `tests/lib/index.js` — central composition and export surface.
- `tests/lib/mytv-helpers.js` — active compatibility shim.
- `tests/lib/mytv-helpers.legacy.js` — retained pre-refactor reference.
- `.planning/phases/01-extract-core-helper-modules/03-PLAN.md` — additive export parity and execution-result corrections.

## Decisions Made

The index intentionally exposes additive focused-module APIs while requiring every legacy public and `__internal` key to remain present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing search keyboard utility import**
- **Found during:** Task 3 (`rename_legacy_and_run_compatibility_verification`)
- **Issue:** `searchAndOpenBestContent` referenced `searchKeyboardInput` after workflow extraction but the adapter destructuring omitted it.
- **Fix:** Imported `searchKeyboardInput` from `navigation.js` in `workflows.js`.
- **Files modified:** `tests/lib/workflows.js`
- **Verification:** Static module load and export parity pass; the isolated live run reached the search flow and exposed only this missing symbol before the fix.
- **Committed in:** `4d2c093`

**Total deviations:** 1 auto-fixed bug. **Impact:** Necessary compatibility wiring; no scope expansion.

## Issues Encountered

- The full suite ran 11 tests with 9 passing. The unconfigured run failed `run-ai-plan-mytv` because `AI_PLAN_PATH` was unset and then failed search because `SEARCH_KEYWORD` was unset.
- A configured retry with a temporary valid AI plan and `SEARCH_KEYWORD="can phong"` still saw a live-staging playback-return failure in the AI batch flow; its shared worker state caused the following search test to fail. The missing search import was then fixed.
- The post-fix live rerun was blocked by the environment’s automatic approval reviewer due model capacity. Deterministic Playwright coverage and compatibility checks passed.

## User Setup Required

To run the complete staging-dependent suite, provide `AI_PLAN_PATH` and `SEARCH_KEYWORD` along with valid MyTV credentials/session configuration.

## Next Phase Readiness

The modular helper structure and compatibility surface are ready for Phase 2 selector contracts. The remaining live AI playback-return issue should be investigated separately if it reproduces with a stable staging plan.

---
*Phase: 01-extract-core-helper-modules*
*Completed: 2026-07-13*
