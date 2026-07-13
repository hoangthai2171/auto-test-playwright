# Phase 01: Extract Core Helper Modules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 01-extract-core-helper-modules
**Areas discussed:** Module boundaries and grouping, Backward compatibility strategy, Module naming and structure

---

## Module boundaries and grouping

### Workflow organization

| Option | Description | Selected |
|--------|-------------|----------|
| 5 primitive modules + workflows module | Keep the 5 specified modules (text-utils, navigation, content-rows, playback, artifacts) and a central index. High-level workflows stay in a 6th module (workflows.js or flows.js) that orchestrates the primitives. | ✓ |
| 5 modules + keep workflows in mytv-helpers.js | Extract only the 5 specified modules and leave high-level workflows in the original mytv-helpers.js. Less disruption but keeps the main file large. | |
| Distribute workflows into the 5 modules | Flatten everything into the 5 modules by distributing workflows based on their primary concern (login flows → navigation.js, playback flows → playback.js). Makes modules larger but eliminates the monolithic file completely. | |

**User's choice:** 5 primitive modules + workflows module (Recommended)
**Notes:** Recommended option selected

### Helper utilities location

| Option | Description | Selected |
|--------|-------------|----------|
| Move to workflows.js | Move them into the new workflows.js module. Keeps all high-level orchestration together and makes it easy to find complete user flows. | ✓ |
| Distribute by primary concern | Distribute by concern: environment/options helpers stay with the module they configure, login flows go to navigation since they're heavily keyboard-driven, etc. More fragmented but logically grouped. | |
| Leave in mytv-helpers.js for now | Leave them where they are for now. Focus Phase 1 only on extracting the 5 primitive modules, defer workflow organization to a later phase. | |

**User's choice:** Move to workflows.js (Recommended)
**Notes:** Environment/options helpers (getTestOptions, DEFAULT_OPTIONS) will move to workflows.js

### Module dependencies

| Option | Description | Selected |
|--------|-------------|----------|
| Clean module imports | Each module exports only the functions it owns. The workflows module imports from text-utils, navigation, content-rows, playback, and artifacts to compose high-level flows. Clean dependencies but requires careful ordering. | ✓ |
| Shared base module for common utilities | Create a shared module (core.js or base.js) that all modules can import from for common utilities. Introduces an extra layer but reduces circular dependency risk. | |
| Allow cross-module imports | Allow cross-imports between modules where needed (e.g., playback.js can import from navigation.js). More flexible but requires careful circular dependency management. | |

**User's choice:** Clean module imports (Recommended)
**Notes:** No circular dependencies between primitive modules

---

## Backward compatibility strategy

### Import strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Central index with mytv-helpers alias | Create tests/lib/index.js that re-exports everything from all modules. Specs import from '../lib/mytv-helpers' which becomes an alias for '../lib/index'. Zero spec changes, one-line mapping file. | ✓ |
| Update imports in all specs | Update each spec's import to the new structure: import specific functions from text-utils, navigation, workflows, etc. More explicit dependencies but requires touching all 7 specs. | |
| Dual exports (index.js + mytv-helpers.js wrapper) | Create tests/lib/index.js AND keep mytv-helpers.js as a legacy wrapper that imports from index and re-exports. Gives time to migrate specs gradually in future phases. | |

**User's choice:** Central index with mytv-helpers alias (Recommended)
**Notes:** Zero changes to test spec imports

### Original file handling

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to .legacy.js and replace | Rename the original mytv-helpers.js to mytv-helpers.legacy.js as a reference, then create a new mytv-helpers.js file that imports and re-exports from index.js. Specs keep working, old file preserved for comparison. | ✓ |
| Delete original, pure alias | Delete the original mytv-helpers.js completely. The alias mytv-helpers → index.js lives only in the import path mapping. Cleaner but loses the original file entirely. | |
| Archive original in subdirectory | Keep the original mytv-helpers.js as-is in a different location (tests/lib/archive/ or similar) for reference, create the new structure from scratch. | |

**User's choice:** Rename to .legacy.js and replace (Recommended)
**Notes:** Preserves original file for comparison and reference

### Verification strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Run full test suite | Run all 7 test specs unchanged after extraction to verify behavioral equivalence. If they pass, the refactor is valid. This matches the success criteria: 'All existing test specs run unchanged.' | ✓ |
| Unit tests first, then integration | Add unit tests for each extracted module first, then run the integration specs. Provides granular confidence but adds more work to Phase 1. | |
| Incremental per-module validation | Run specs one at a time during extraction — extract text-utils, verify specs still work, extract navigation, verify again, etc. Incremental validation but slower. | |

**User's choice:** Run full test suite (Recommended)
**Notes:** All 7 specs must pass unchanged to confirm behavioral equivalence

---

## Module naming and structure

### Module names

| Option | Description | Selected |
|--------|-------------|----------|
| Use requirement names exactly | Use the names from requirements exactly: text-utils.js, navigation.js, content-rows.js, playback.js, artifacts.js, workflows.js, index.js. Clear correspondence to requirements. | ✓ |
| More descriptive names | Use more descriptive names: vietnamese-text.js, remote-navigation.js, content-discovery.js, playback-verification.js, test-artifacts.js, test-workflows.js. Longer but more explicit. | |
| Shorter technical names | Use shorter technical names: text.js, nav.js, rows.js, video.js, reports.js, flows.js. Brevity over clarity. | |

**User's choice:** Use requirement names exactly (Recommended)
**Notes:** Maintains clear traceability to requirements

### File location

| Option | Description | Selected |
|--------|-------------|----------|
| All modules in tests/lib/ | Place all 7 modules (text-utils, navigation, content-rows, playback, artifacts, workflows, index) directly in tests/lib/ alongside the current mytv-helpers.js. Flat structure, easy to find. | ✓ |
| Subdirectory tests/lib/modules/ | Create tests/lib/modules/ subdirectory for the 6 functional modules, keep index.js in tests/lib/. Organized but adds nesting. | |
| Layer-based subdirectories | Group by layer: tests/lib/primitives/ for the 5 base modules, tests/lib/workflows.js and tests/lib/index.js at the top level. Shows architecture but more complex. | |

**User's choice:** All modules in tests/lib/ (Recommended)
**Notes:** Flat structure, no subdirectories

### Export style

| Option | Description | Selected |
|--------|-------------|----------|
| CommonJS module.exports | Use standard CommonJS exports: module.exports = { fn1, fn2, ... } at the end of each module file. Matches existing pattern in mytv-helpers.js and ai-plan-runner.js. | ✓ |
| Named exports assignments | Use named exports with explicit assignments: exports.fn1 = fn1; exports.fn2 = fn2; at the end. More verbose but shows each export clearly. | |
| Mixed exports (public + __internal) | Mix both: use module.exports for public API, exports.__internal for test-only functions. Already established in mytv-helpers.js for ai-row-selection.spec.js. | |

**User's choice:** CommonJS module.exports (Recommended)
**Notes:** Matches existing codebase conventions

---

## Claude's Discretion

- Module-level constant organization (where to place existing constants like CLOSE_POPUP_TEXT, VIEWPORT, etc.)
- File size targets for extracted modules (keep functions together vs. split aggressively)
- How to handle comments and JSDoc during extraction (preserve, update, or remove)
- Order of exports in index.js (alphabetical, by module, or by usage frequency)

## Deferred Ideas

None — discussion stayed within phase scope
