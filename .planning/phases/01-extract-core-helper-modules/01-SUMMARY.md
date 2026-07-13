---
phase: 01-extract-core-helper-modules
plan: 01
subsystem: testing
tags: [playwright, commonjs, vietnamese, remote-navigation]
requires: []
provides:
  - "Focused Vietnamese text utility module"
  - "Keyboard remote-navigation and focus-state module"
affects: [phase-2-selector-contracts, phase-3-smart-waits, phase-4-dom-optimization]
tech-stack:
  added: []
  patterns: ["focused CommonJS helper modules", "keyboard navigation primitives"]
key-files:
  created: [tests/lib/text-utils.js, tests/lib/navigation.js]
  modified: []
key-decisions:
  - "Preserved browser-evaluated normalization callbacks and extracted Node-side text utilities without changing existing selector scoring behavior."
patterns-established:
  - "Navigation module owns remote key dispatch, geometry direction selection, virtual-keyboard entry, and focus-state inspection."
requirements-completed: [REFACTOR-01, REFACTOR-02]
duration: 12 min
completed: 2026-07-13
---

# Phase 1 Plan 1: Text and Navigation Summary

**Vietnamese text normalization and TV remote focus primitives extracted into independently loadable CommonJS modules.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added `text-utils.js` with accent normalization, regex escaping, fuzzy matching, and text-pattern helpers.
- Added `navigation.js` with remote key dispatch, geometry direction selection, virtual-keyboard input, focus targeting, and focus assertions.
- Preserved the existing `__internal.chooseDirection` geometry behavior.

## Task Commits

1. **Task 1: extract_text_utilities** — `4bea73b`
2. **Task 2: extract_navigation_primitives** — `4bea73b`

## Files Created/Modified

- `tests/lib/text-utils.js` — Vietnamese normalization and pure text helpers.
- `tests/lib/navigation.js` — keyboard navigation and focus-state helpers.

## Decisions Made

Kept browser-side normalization/scoring callbacks local where Playwright serialization requires it; the new Node utility is available for module-level callers without changing DOM-evaluation behavior.

## Deviations from Plan

None — implementation followed the planned module boundaries.

## Issues Encountered

The deterministic Playwright test initially hit a macOS browser sandbox permission error; rerunning with the approved escalated test command passed.

## Next Phase Readiness

Wave 1 text/navigation primitives are ready for composition with the content-row, playback, and artifact modules.

---
*Phase: 01-extract-core-helper-modules*
*Completed: 2026-07-13*
