---
phase: 01-extract-core-helper-modules
plan: 03
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - tests/lib/workflows.js
  - tests/lib/index.js
  - tests/lib/mytv-helpers.js
  - tests/lib/mytv-helpers.legacy.js
autonomous: true
requirements: [REFACTOR-06, REFACTOR-07]
must_haves:
  truths:
    - "D-02: workflows.js owns high-level orchestration functions."
    - "D-03: DEFAULT_OPTIONS and getTestOptions move into workflows.js."
    - "D-04: workflows.js composes primitives while each module exports only its own functions."
    - "D-05: The final dependency graph is one-way with no primitive cross-imports."
    - "D-06: index.js re-exports all six modules."
    - "D-07: The original implementation is renamed to mytv-helpers.legacy.js."
    - "D-08: The active mytv-helpers.js re-exports index.js with unchanged consumer imports."
    - "D-09: All seven existing specs are run as the equivalence gate."
    - "D-10: The exact requirement filenames are used."
    - "D-11: All seven modules stay directly under tests/lib/."
    - "D-12: Each module uses CommonJS module.exports."
    - "All current specs, fixtures, and the AI plan runner continue resolving their existing `./lib/mytv-helpers` import with the same public helper names."
    - "The central index re-exports every workflow and primitive function and preserves the `__internal` members used by ai-row-selection.spec.js."
    - "The original implementation remains available as mytv-helpers.legacy.js for parity comparison but is no longer the active import target."
    - "All seven existing Playwright specs pass unchanged or with no behavior-changing import edits under the existing single-worker configuration."
  artifacts:
    - path: tests/lib/workflows.js
      provides: "High-level login, menu, search, content, AI batch, and options orchestration"
      contains: "getTestOptions"
    - path: tests/lib/index.js
      provides: "Central public export surface and bound adapter composition"
      contains: "module.exports"
    - path: tests/lib/mytv-helpers.js
      provides: "Backward-compatible active import shim"
      contains: "./index"
    - path: tests/lib/mytv-helpers.legacy.js
      provides: "Reference copy of the pre-refactor monolithic helper"
  key_links:
    - from: tests/lib/mytv-helpers.js
      to: tests/lib/index.js
      via: CommonJS re-export
      pattern: "require(\"./index\")"
    - from: tests/lib/index.js
      to: tests/lib/workflows.js
      via: merged exports
      pattern: "workflows"
    - from: tests/ai-row-selection.spec.js
      to: tests/lib/index.js
      via: __internal compatibility object
      pattern: "__internal"
---

<objective>
Complete the modularization by extracting the high-level workflows, composing adapter-bound primitive APIs in a central `index.js`, replacing the active helper with a compatibility shim, and proving export parity and end-to-end behavioral equivalence across all seven existing specs.
</objective>

<tasks>
  <task type="execute">
    <name>extract_workflows</name>
    <files>tests/lib/workflows.js</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>tests/lib/ai-plan-runner.js</file>
      <file>tests/fixtures/mytv-session-fixture.js</file>
      <file>tests/login-mytv.spec.js</file>
      <file>tests/play-channel-mytv.spec.js</file>
      <file>tests/play-movie-mytv.spec.js</file>
      <file>tests/search-content-mytv.spec.js</file>
      <file>tests/open-setting-mytv.spec.js</file>
      <file>tests/run-ai-plan-mytv.spec.js</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-RESEARCH.md</file>
    </read_first>
    <action>
      Create `tests/lib/workflows.js` and move the high-level orchestration and lookup functions from the legacy file: `DEFAULT_OPTIONS`/`getTestOptions`; startup/login/profile/popup flows; left-menu/service flows; channel/movie/search flows; `playAllItemsInFirstRow`; and their workflow-only lookup helpers. Import the five primitive modules and bind their adapter APIs in this module or expose a dependency object for `index.js`; do not duplicate primitive implementations. Preserve every current public function signature, default option, timeout/delay, error message, and AI batch result/report behavior. Keep `getTestOptions` as the source for fixture options and keep `runStep` available through the bound artifact API.
    </action>
    <verify>
      Require `tests/lib/workflows.js` after the primitive modules exist and assert it exports `getTestOptions`, `openAppAndEnterLoginPage`, `openChannel`, `openMovieContent`, `searchAndOpenBestContent`, and `playAllItemsInFirstRow`. Compare the option keys and default values against the legacy implementation before the rename.
    </verify>
    <acceptance_criteria>
      <criterion>`workflows.js` contains `getTestOptions` and all high-level functions currently imported by the seven specs, the fixture, or `ai-plan-runner.js`.</criterion>
      <criterion>`getTestOptions()` returns the same environment-backed keys, default values, and derived `MOVIE_NAME_PATTERN`/`SEARCH_KEYWORD_PATTERN` values as before.</criterion>
      <criterion>`workflows.js` imports primitives only through the planned five module paths and does not require `mytv-helpers.legacy.js` at runtime.</criterion>
      <criterion>No test spec, fixture, or AI runner requires a new call signature or mouse interaction.</criterion>
    </acceptance_criteria>
    <done>`tests/lib/workflows.js` owns all high-level flows and exposes the same consumer-facing signatures as the legacy helper.</done>
  </task>

  <task type="execute">
    <name>compose_barrel_and_compatibility_shim</name>
    <files>tests/lib/index.js, tests/lib/mytv-helpers.js</files>
    <read_first>
      <file>tests/lib/workflows.js</file>
      <file>tests/lib/text-utils.js</file>
      <file>tests/lib/navigation.js</file>
      <file>tests/lib/content-rows.js</file>
      <file>tests/lib/playback.js</file>
      <file>tests/lib/artifacts.js</file>
      <file>tests/lib/mytv-helpers.js</file>
      <file>tests/ai-row-selection.spec.js</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md</file>
    </read_first>
    <action>
      Create `tests/lib/index.js` as the composition root. Instantiate the adapter-bound content-row, playback, and artifact APIs with the navigation/text/workflow dependencies, merge all public exports from the six modules, and explicitly export `__internal.focusFirstRowStart`, `__internal.findServiceIdInAllServices`, `__internal.closeAdvertisePopupIfVisible`, `__internal.getVisiblePopup`, and `__internal.chooseDirection`. Preserve one unambiguous export for duplicate names such as `getFocusedState`, `safeArtifactName`, and playback helpers. Replace the active `tests/lib/mytv-helpers.js` implementation with a CommonJS re-export of `./index` and do not edit the seven consumer imports unless a static resolution check proves an import must change.
    </action>
    <verify>
      Require `tests/lib/index.js` and `tests/lib/mytv-helpers.js`; assert that the compatibility shim exposes every key from the legacy public export object plus the required `__internal` keys. Require `tests/fixtures/mytv-session-fixture.js` and `tests/lib/ai-plan-runner.js` to catch missing transitive exports.
    </verify>
    <acceptance_criteria>
      <criterion>`tests/lib/mytv-helpers.js` resolves to `tests/lib/index.js` and exports `runStep`, `getTestOptions`, all workflow functions, all required primitive functions, and `__internal`.</criterion>
      <criterion>`__internal.focusFirstRowStart`, `findServiceIdInAllServices`, `closeAdvertisePopupIfVisible`, `getVisiblePopup`, and `chooseDirection` are callable through the compatibility path.</criterion>
      <criterion>Every current `require("./lib/mytv-helpers")`, `require("../lib/mytv-helpers")`, and AI-runner import resolves without `MODULE_NOT_FOUND` or undefined destructured helpers.</criterion>
      <criterion>Only one active implementation exists at `tests/lib/mytv-helpers.js`; the legacy copy is named exactly `tests/lib/mytv-helpers.legacy.js` and is not required by runtime modules.</criterion>
    </acceptance_criteria>
    <done>`index.js` composes the bound APIs, the shim re-exports it, and all current transitive imports resolve with the required internal seam.</done>
  </task>

  <task type="execute">
    <name>rename_legacy_and_run_compatibility_verification</name>
    <files>tests/lib/mytv-helpers.legacy.js, tests/lib/mytv-helpers.js, tests/ai-row-selection.spec.js, test-results/, playwright-report/</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>tests/lib/index.js</file>
      <file>.planning/ROADMAP.md</file>
      <file>.planning/REQUIREMENTS.md</file>
      <file>playwright.config.js</file>
      <file>package.json</file>
    </read_first>
    <action>
      Rename the pre-refactor 2,825-line implementation to `tests/lib/mytv-helpers.legacy.js` only after the new modules and barrel are wired. Run a repository-wide reference search and fail if any active source file requires the `.legacy.js` path. Run a Node export-parity script comparing sorted public keys and nested `__internal` keys between the legacy module and the new compatibility shim. Run the deterministic `tests/ai-row-selection.spec.js` test, then run the complete seven-spec suite with the existing Playwright command/configuration and `workers: 1`; preserve generated report artifacts for any failure. Do not add new unit-test files in this phase because TEST-01/TEST-02 are explicitly deferred to v2.
    </action>
    <verify>
      Run `node -e` module-load and export-parity checks, `npx playwright test tests/ai-row-selection.spec.js`, and `npm test`. Confirm the repository-wide import search finds no runtime reference to `mytv-helpers.legacy.js`, and record the exact pass/fail result for all seven specs.
    </verify>
    <acceptance_criteria>
      <criterion>`tests/lib/mytv-helpers.legacy.js` exists and `tests/lib/mytv-helpers.js` is a compatibility shim requiring `./index`.</criterion>
      <criterion>The new shim contains every sorted public export key and nested `__internal` key from the legacy module; additional focused-module exports are allowed.</criterion>
      <criterion>`npx playwright test tests/ai-row-selection.spec.js` exits 0.</criterion>
      <criterion>`npm test` executes all seven existing specs under the configured single worker; it exits 0 in a fully configured environment, or the plan records a concrete environment/staging blocker with the generated report path rather than claiming equivalence.</criterion>
      <criterion>No source file outside the legacy reference itself contains a runtime require of `mytv-helpers.legacy.js`, and no consumer import was changed for convenience.</criterion>
    </acceptance_criteria>
    <done>Legacy/new export parity passes, deterministic helper coverage passes, and the full seven-spec suite has a recorded result under the unchanged Playwright configuration.</done>
  </task>
</tasks>

<verification>
  <command>node -e 'const legacy=require("./tests/lib/mytv-helpers.legacy"); const current=require("./tests/lib/mytv-helpers"); const keys=x=>Object.keys(x).filter(k=>k!=="__internal").sort(); const internal=x=>Object.keys(x.__internal||{}).sort(); const missing=keys(legacy).filter(k=>!keys(current).includes(k)); const missingInternal=internal(legacy).filter(k=>!internal(current).includes(k)); if(missing.length||missingInternal.length) throw new Error(`compatibility export parity failed: ${missing} ${missingInternal}`);'</command>
  <command>npx playwright test tests/ai-row-selection.spec.js</command>
  <command>npm test</command>
</verification>

<success_criteria>
  <criterion>REFACTOR-01 through REFACTOR-07 are represented by working module files, a central barrel, and the compatibility shim.</criterion>
  <criterion>The active import surface is backward-compatible and export parity passes against the retained legacy reference.</criterion>
  <criterion>The deterministic helper suite passes and the full seven-spec suite is executed under the unchanged shared-session/single-worker architecture.</criterion>
  <criterion>No runtime module introduces a primitive circular dependency, and the original legacy source remains available only for comparison.</criterion>
</success_criteria>

## Decision Coverage

- D-02: Create `workflows.js` for high-level orchestration functions.
- D-03: Move `DEFAULT_OPTIONS` and `getTestOptions` into `workflows.js`.
- D-04: `workflows.js` composes the five primitives while each module exports its own functions.
- D-05: The final dependency graph is one-way: `workflows.js` depends on primitives and primitives do not cross-import.
- D-06: `index.js` re-exports all six modules.
- D-07: Rename the original implementation to `mytv-helpers.legacy.js`.
- D-08: Replace active `mytv-helpers.js` with an `index.js` re-export so specs remain unchanged.
- D-09: Run all seven existing specs as the behavioral-equivalence gate.
- D-10: Use the exact requirement filenames.
- D-11: Keep all seven modules directly in `tests/lib/`.
- D-12: Use CommonJS `module.exports` throughout.
