# Phase 01: Extract Core Helper Modules - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a modularized test helper library by extracting the 2,825-line `tests/lib/mytv-helpers.js` into 6 focused modules (text-utils, navigation, content-rows, playback, artifacts, workflows) plus a central index that maintains backward compatibility with all existing test specs.

</domain>

<decisions>
## Implementation Decisions

### Module boundaries and grouping
- **D-01:** Extract 5 primitive modules as specified in requirements: text-utils.js, navigation.js, content-rows.js, playback.js, artifacts.js
- **D-02:** Create a 6th module workflows.js for high-level orchestration functions (openAppAndEnterLoginPage, openChannel, searchAndOpenBestContent, etc.)
- **D-03:** Move environment/options helpers (getTestOptions, DEFAULT_OPTIONS) into workflows.js to keep all high-level orchestration together
- **D-04:** Each module exports only the functions it owns; workflows.js imports from the 5 primitive modules to compose flows
- **D-05:** No circular dependencies — primitive modules are self-contained, workflows depends on primitives, no cross-imports between primitives

### Backward compatibility strategy
- **D-06:** Create tests/lib/index.js that re-exports everything from all 6 modules
- **D-07:** Rename original mytv-helpers.js to mytv-helpers.legacy.js as reference
- **D-08:** Create new mytv-helpers.js that imports from index.js and re-exports — specs continue to work with zero changes
- **D-09:** Verify refactoring by running all 7 test specs unchanged; if they pass, behavioral equivalence is confirmed

### Module naming and structure
- **D-10:** Use requirement names exactly: text-utils.js, navigation.js, content-rows.js, playback.js, artifacts.js, workflows.js, index.js
- **D-11:** Place all 7 modules directly in tests/lib/ (flat structure, no subdirectories)
- **D-12:** Use CommonJS module.exports pattern at end of each file to match existing codebase conventions

### Claude's Discretion
- Module-level constant organization (where to place existing constants like CLOSE_POPUP_TEXT, VIEWPORT, etc.)
- File size targets for extracted modules (keep functions together vs. split aggressively)
- How to handle comments and JSDoc during extraction (preserve, update, or remove)
- Order of exports in index.js (alphabetical, by module, or by usage frequency)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — defines REFACTOR-01 through REFACTOR-07 that map to this phase
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependency chain

### Codebase maps
- `.planning/codebase/TESTING.md` — test framework patterns, fixture usage, runStep() wrapper pattern
- `.planning/codebase/CONVENTIONS.md` — naming patterns, CommonJS exports, function design, error handling
- `.planning/codebase/STRUCTURE.md` — directory layout, tests/lib/ organization, where to add new modules

### Source code
- `tests/lib/mytv-helpers.js` — the 2,825-line file being extracted; contains all functions to be split
- `tests/fixtures/mytv-session-fixture.js` — shows how helper imports are used in fixture layer
- `tests/ai-row-selection.spec.js` — shows __internal export pattern for test-only access

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **runStep() wrapper** (mytv-helpers.js:547) — wraps test actions for automatic failure artifact capture; must remain available in workflows.js since all specs use it
- **__internal export pattern** (mytv-helpers.js:2797) — used by ai-row-selection.spec.js for deterministic testing; extraction should preserve this for modules that need test-only exports
- **Playwright expect.poll** pattern (mytv-helpers.js:104) — established async assertion style; preserved during extraction
- **Remote navigation primitives** — remotePress, remoteFocusById, remoteFocusByText are the foundation; navigation.js exports these and workflows.js composes them

### Established Patterns
- **CommonJS modules** — all test code uses require/module.exports, not ES modules
- **Two-space indentation** in test specs and mytv-helpers.js (four spaces in app/ and some scripts/)
- **Explicit Playwright object passing** — page, testInfo, options passed as parameters rather than implicit context
- **TV remote control model** — all navigation is keyboard-only (arrow keys, Enter, Backspace); no mouse clicks
- **Fuzzy Vietnamese text matching** — normalizeVietnameseText removes diacritics for content lookup; critical for all search/navigation
- **Single worker requirement** — tests share authenticated session state; behavioral equivalence requires no parallelization changes

### Integration Points
- **Test spec imports** — all 7 specs import from `../lib/mytv-helpers`; this path becomes an alias for `../lib/index` after extraction
- **Fixture dependencies** — mytv-session-fixture.js doesn't directly import helpers but specs that use the fixture do
- **AI plan runner** — tests/lib/ai-plan-runner.js imports specific workflow functions from mytv-helpers; may need path updates or should import from index
- **Electron IPC layer** — app/main.js doesn't import helpers directly; runs specs through Playwright CLI

</code_context>

<specifics>
## Specific Ideas

- Preserve mytv-helpers.legacy.js as a reference for comparison during and after extraction
- The 6 modules + index represent a total of 7 new files in tests/lib/
- Current line distribution estimate: text-utils (~150 lines), navigation (~400 lines), content-rows (~500 lines), playback (~200 lines), artifacts (~100 lines), workflows (~1,475 lines), index (~50 lines)
- Success is binary: all 7 test specs pass unchanged, or the refactor is invalid

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-extract-core-helper-modules*
*Context gathered: 2026-07-13*
