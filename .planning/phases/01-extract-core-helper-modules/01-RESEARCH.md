# Phase 1 Research: Extract Core Helper Modules

**Researched:** 2026-07-13
**Scope:** `tests/lib/mytv-helpers.js` modularization with zero-change compatibility for existing specs

## Executive Summary

`tests/lib/mytv-helpers.js` is a single CommonJS module containing environment parsing, high-level flows, DOM lookup/scoring, keyboard navigation, content-row discovery, playback assertions, and report artifacts. The existing code already has natural function clusters and no external module consumers depend on private implementation details except the `__internal` seam used by `tests/ai-row-selection.spec.js`.

The safest implementation is a mechanical extraction that preserves function bodies and call behavior first, followed by explicit imports between `workflows.js` and the five primitives. The dependency direction must remain one-way: primitive modules do not import one another; `workflows.js` imports the primitives; `index.js` merges public and internal exports; `mytv-helpers.js` becomes a compatibility shim.

## Current Function Clusters

### `text-utils.js`

- `normalizeVietnameseText`
- `fuzzyMatch` as the named public matching API required by REFACTOR-01; it should preserve the current normalization/token-scoring behavior used by embedded DOM callbacks.
- Supporting pure helpers currently embedded or colocated with matching logic: `escapeRegExp`, `containsTextPattern`, and any token/score helpers needed to keep browser-evaluated matching behavior identical.
- `safeArtifactName` is pure but is more appropriately owned by `artifacts.js` because all current callers use it to name report attachments.

Important compatibility detail: several `page.evaluate`/`page.waitForFunction` callbacks currently define local `normalizeText`, tokenization, and scoring functions because Node closures are not serializable into the browser. Extracting the Node utility alone is not sufficient; equivalent browser-side logic must remain in those callbacks or be passed as serializable source where practical.

### `navigation.js`

- `remotePress`
- `remoteFocus`
- `remoteFocusById`
- `remoteFocusByText`
- `remoteFocusByKeyText`
- `remoteFocusByVirtualKey`
- `enterWithVirtualKeyboard`
- `virtualKeyIds`
- `chooseDirection`, `rangesOverlap`, `fallbackDirection`, `center`
- `getFocusedState`
- `expectFocusedText`
- `expectFocusedElementToLookOrange`

`remoteFocus` is the central primitive. It depends on `getFocusedState`, `chooseDirection`, and `remotePress`; `remoteFocusById` and text/key variants provide target rectangles and predicates. The current `__internal.chooseDirection` test should continue to resolve through the compatibility export.

### `content-rows.js`

- `collectVisibleContentRows`
- `focusRequestedContentRow`
- `findContentRowByPosition`
- `findLastContentRow`
- `findBestContentRowMatch`
- `scoreNormalizedTextMatch`
- `collectFirstRowPlayableItems`
- `focusFirstRowStart`
- `expectFocusedContent`
- `isFocusedContentItem`
- `isFocusedOnContentItem`
- `isFocusedOnRowItems`
- `getFocusedContentMetadata`
- `contentItemSignature`
- `isFocusedNearRow`
- `moveToNextFirstRowContent`
- `returnToFirstRowContent`
- `openFocusedContentForPlayback`

This cluster owns geometry and row semantics, but it needs navigation and playback primitives to move focus and check a player after activation. To honor D-05, keep its module dependency-free by receiving required operations as injected functions, or by retaining only the navigation calls it owns through a narrowly defined internal adapter. The plan should choose the simpler extraction shape that does not introduce primitive-to-primitive circular imports and verify it with module-load smoke checks.

### `playback.js`

- `assertPlayback`
- `assertChannelPlayback`
- `assertMoviePlayback`
- `assertSearchContentPlayback`
- `getVisiblePopup`
- `getPlayerState`
- `inspectPlaybackAfterWait`

Playback checks use Playwright `expect`, DOM evaluation, and artifact attachment. The report attachment calls should be supplied by `artifacts.js` or kept behind an injected artifact adapter so playback does not import the workflow layer.

### `artifacts.js`

- `runStep`
- `attachCurrentAppScreenshot`
- `attachFailureArtifacts`
- `attachMovieSearchFailureArtifacts`
- `attachSearchNoResultArtifacts`
- `attachFirstRowPlaybackReport`
- `renderPlaybackResultsHtml`
- `renderPlaybackErrorCell`
- `imageDataUrl`
- `escapeHtml`
- `safeArtifactName`

Artifact helpers call focused-state and candidate collection functions when producing failure context. Those calls must not create a primitive cycle. Use dependency injection for diagnostic callbacks or keep small report-only data collection adapters in `artifacts.js`; workflow code can pass the current state/candidate functions explicitly.

### `workflows.js`

- `DEFAULT_OPTIONS` and `getTestOptions`
- Login and startup flow: `openAppAndEnterLoginPage`, `loginWithAccount`, `chooseFirstProfileAndEnterHome`, `closeHomePopupsAndVerifyHome`, `waitForAppReady`, `gotoApp`, `getSubpage`, `isWelcomeScreen`, `waitForProfileSelection`, `closeHomePopups`, `closeAdvertisePopupIfVisible`
- Left-menu/service flow: `openTelevisionFromLeftMenu`, `openMovieFromLeftMenu`, `openSettingFromLeftMenu`, `openSearchFromLeftMenu`, `openServiceFromLeftMenuOrAllServices`, `openLeftMenuFromHome`, `focusLeftMenuItem`, `focusSearchMenuItem`, `findLeftMenuItemIdByText`, `findLeftMenuItemIdByFuzzyText`, `isLeftMenuOpen`, `findServiceIdInAllServices`, `findVisibleServiceIdByTitleAttribute`, `collectVisibleAllServiceLabels`, `findVisibleElementIdByFuzzyLabel`
- Content lookup/search flow: `openChannel`, `findChannelIdByName`, `findFirstPlayableContentId`, `openFirstMovieContent`, `openMovieContent`, `openMovieContentByName`, `searchAndOpenBestContent`, `focusStableSearchResult`, `isFocusedOnSearchResult`, `focusSearchResult`, `focusSearchRowItemByPosition`, `parseSearchRowId`, `submitSearchFromVirtualKeyboard`, `findMovieContentIdByName`, `findBestSearchResult`, `collectSearchResultCandidates`, `collectMovieSearchCandidates`
- AI batch orchestration: `playAllItemsInFirstRow`

This is the high-level composition layer. It may import all five primitives, but none of the primitives may import `workflows.js`.

## Compatibility Surface

Current consumers import from `tests/lib/mytv-helpers.js`:

- All six live workflow specs import public helpers from that path.
- `tests/fixtures/mytv-session-fixture.js` imports `getTestOptions` from that path.
- `tests/lib/ai-plan-runner.js` imports workflow helpers from that path.
- `tests/ai-row-selection.spec.js` imports `__internal` and uses `focusFirstRowStart`, `chooseDirection`, `findServiceIdInAllServices`, `closeAdvertisePopupIfVisible`, and `getVisiblePopup`.

Therefore the compatibility contract is:

1. `tests/lib/index.js` re-exports the complete public surface from all six modules and merges the required `__internal` members.
2. `tests/lib/mytv-helpers.js` contains only `module.exports = require("./index")` (or an equivalent direct re-export).
3. No spec or fixture import changes are required for this phase. If any import changes are made, they must be mechanical and all seven specs must remain behaviorally identical.
4. The original implementation is renamed to `tests/lib/mytv-helpers.legacy.js` and retained only as a comparison/reference artifact; it must not remain on the active import path or be discovered as a test.

## Verification Strategy

- Static module-load smoke test: require every new module, `index.js`, the compatibility shim, the fixture, and `ai-plan-runner.js`; assert no circular-load or missing-export errors.
- Export parity check: compare the public keys and `__internal` keys exposed by the new compatibility shim against the legacy module before the legacy file is removed from the active path. This catches silent omissions without executing the live app.
- Deterministic helper regression: run `tests/ai-row-selection.spec.js`, which exercises geometry navigation, content-row focus, service lookup, popup handling, and the `__internal` seam with synthetic DOM.
- Full suite: run all seven Playwright specs with the configured single worker and existing environment. The live staging-dependent specs are the behavioral-equivalence gate; do not replace them with mocks.
- Import compatibility: verify that no source file still requires a removed path and that `tests/lib/mytv-helpers.js` resolves to the new barrel.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| A helper is extracted but not re-exported | Maintain an explicit export inventory and run legacy/new key parity checks. |
| Browser-evaluated callbacks lose local normalization/scoring functions | Preserve callback-local implementations during the mechanical extraction; only deduplicate later if serialization remains explicit. |
| Primitive modules introduce circular dependencies | Keep primitives self-contained through injected callbacks/adapters; enforce a load smoke test. |
| `__internal` helpers become inaccessible | Rebuild the nested `__internal` object in `index.js` and run `ai-row-selection.spec.js`. |
| Renaming the legacy file breaks a hidden import | Search all `require` references before changing the path and require the shim from every current consumer. |
| Live staging test credentials/session are unavailable | Separate deterministic checks from the live gate and report the environment limitation; do not weaken the compatibility contract. |

## Recommended Execution Waves

1. Extract the five primitive module files with stable APIs and no consumer changes.
2. Extract `workflows.js`, wire primitive dependencies, and add `index.js` plus the legacy-compatible shim.
3. Run parity/static/deterministic checks, then the complete seven-spec suite and fix omissions or behavioral regressions.

## Canonical Sources Read

- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/TESTING.md`
- `tests/lib/mytv-helpers.js`
- `tests/lib/ai-plan-runner.js`
- `tests/fixtures/mytv-session-fixture.js`
- all seven `tests/*.spec.js` consumers

