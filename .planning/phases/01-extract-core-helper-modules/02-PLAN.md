---
phase: 01-extract-core-helper-modules
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/lib/content-rows.js
  - tests/lib/playback.js
  - tests/lib/artifacts.js
autonomous: true
requirements: [REFACTOR-03, REFACTOR-04, REFACTOR-05]
must_haves:
  truths:
    - "D-01: The five named primitive modules are extracted with content rows, playback, and artifacts delivered in this plan."
    - "D-04: Each module exports only the functions it owns and receives cross-module operations through explicit adapters."
    - "D-05: No primitive module imports another primitive or the workflow layer."
    - "D-10: The exact requirement filenames are used."
    - "D-11: All new modules stay directly under tests/lib/."
    - "D-12: Each module uses CommonJS module.exports."
    - "Content-row discovery, row focus, and first-row traversal preserve the current geometry filters, heading association, row scoring, and keyboard behavior."
    - "Playback assertions and player-state inspection preserve popup detection, media-state checks, and Playwright report attachments."
    - "Failure screenshots, JSON context, and first-row HTML reports remain available without creating primitive-module cycles."
  artifacts:
    - path: tests/lib/content-rows.js
      provides: "Content row collection, selection, focus validation, and first-row traversal"
      contains: "collectVisibleContentRows"
    - path: tests/lib/playback.js
      provides: "assertPlayback and player/popup state helpers"
      contains: "getPlayerState"
    - path: tests/lib/artifacts.js
      provides: "Screenshot, JSON, failure-context, and HTML report attachments"
      contains: "attachFailureArtifacts"
  key_links:
    - from: tests/lib/playback.js
      to: testInfo.attach
      via: injected artifact adapter
      pattern: "testInfo"
    - from: tests/lib/content-rows.js
      to: navigation callbacks
      via: explicit dependency object
      pattern: "dependencies"
---

<objective>
Extract content-row discovery, playback verification, and artifact/report generation into focused modules while enforcing the locked one-way dependency rule: primitive modules do not require one another, and cross-module operations use explicit adapters bound by the composition layer.
</objective>

<tasks>
  <task type="execute">
    <name>extract_content_row_module</name>
    <files>tests/lib/content-rows.js</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-RESEARCH.md</file>
      <file>.planning/codebase/TESTING.md</file>
    </read_first>
    <action>
      Create `tests/lib/content-rows.js` with `collectVisibleContentRows`, `focusRequestedContentRow`, `findContentRowByPosition`, `findLastContentRow`, `findBestContentRowMatch`, `scoreNormalizedTextMatch`, `collectFirstRowPlayableItems`, `focusFirstRowStart`, `expectFocusedContent`, `isFocusedContentItem`, `isFocusedOnContentItem`, `isFocusedOnRowItems`, `getFocusedContentMetadata`, `contentItemSignature`, `isFocusedNearRow`, `moveToNextFirstRowContent`, `returnToFirstRowContent`, and `openFocusedContentForPlayback`. Keep the existing 100-520px item geometry, ±40px row bucketing, heading lookback, deduplication, row ordering, max-row attempts, and focus containment/intersection thresholds. Do not require `navigation.js` or `playback.js`; functions that need remote movement, focus state, visible text, or player state must accept an explicit dependency object as an optional third argument. Export the discovery functions directly and expose a `createContentRowsApi(dependencies)` binder so `index.js` can provide the existing two-argument workflow surface without circular imports.
    </action>
    <verify>
      Require the module and assert `collectVisibleContentRows`, `focusRequestedContentRow`, and `createContentRowsApi` exist. Search the file for imports and assert it contains no `require("./navigation")`, `require("./playback")`, or `require("./workflows")`.
    </verify>
    <acceptance_criteria>
      <criterion>`collectVisibleContentRows` still returns row objects with `rowY`, `title`, `normalizedTitle`, and deduplicated `items` containing `id`, title, poster, and rounded rect data.</criterion>
      <criterion>`focusRequestedContentRow` supports `rowName`, zero-based `rowIndex`, and `rowPosition: "last"` through the same selection and error paths as the legacy function.</criterion>
      <criterion>Cross-module operations are received through explicit dependencies or the returned API binder; the module has no local-module imports.</criterion>
      <criterion>The module preserves `focusFirstRowStart` behavior for the existing synthetic DOM fixture, including the final `expectFocusedContent` and row-item polling checks.</criterion>
    </acceptance_criteria>
    <done>`tests/lib/content-rows.js` exposes the required row discovery API with adapter-based navigation and no local-module imports.</done>
  </task>

  <task type="execute">
    <name>extract_playback_module</name>
    <files>tests/lib/playback.js</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-RESEARCH.md</file>
      <file>.planning/codebase/CONVENTIONS.md</file>
    </read_first>
    <action>
      Create `tests/lib/playback.js` with `assertPlayback`, `assertChannelPlayback`, `assertMoviePlayback`, `assertSearchContentPlayback`, `getVisiblePopup`, `getPlayerState`, and `inspectPlaybackAfterWait`. Preserve the visible-popup close/error regexes, popup-root traversal, video selection, 1.5-second media-state comparison, `hasVideo`/`isProbablyPlaying` calculations, failure reasons, and Playwright `expect` messages. Keep the module free of `artifacts.js` imports: accept an artifact adapter for attachment operations, and have the composition layer bind the adapter while keeping the current three-argument assertion calls available to workflows.
    </action>
    <verify>
      Require the module and assert `assertPlayback`, `getPlayerState`, `getVisiblePopup`, and `inspectPlaybackAfterWait` exist. Inspect the source to confirm `HAVE_CURRENT_DATA`, `isProbablyPlaying`, the popup error regex, and the `testInfo` attachment contract remain present.
    </verify>
    <acceptance_criteria>
      <criterion>`getPlayerState` returns `hasVideo: false` with `reason: "No video element found"` when no video exists and preserves the before/after state fields when one exists.</criterion>
      <criterion>`assertPlayback` attaches player-state and popup/failure artifacts through the injected adapter, then throws the same Playwright assertion failures for missing video or unhealthy playback.</criterion>
      <criterion>`assertChannelPlayback`, `assertMoviePlayback`, and `assertSearchContentPlayback` construct the same labels and artifact prefixes as the legacy helper.</criterion>
      <criterion>The module has no imports from `navigation.js`, `content-rows.js`, `artifacts.js`, or `workflows.js`.</criterion>
    </acceptance_criteria>
    <done>`tests/lib/playback.js` preserves popup/player-state semantics and exposes artifact operations through an adapter.</done>
  </task>

  <task type="execute">
    <name>extract_artifact_module</name>
    <files>tests/lib/artifacts.js</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>tests/lib/ai-plan-runner.js</file>
      <file>.planning/codebase/TESTING.md</file>
    </read_first>
    <action>
      Create `tests/lib/artifacts.js` with `runStep`, `attachCurrentAppScreenshot`, `attachMovieSearchFailureArtifacts`, `attachSearchNoResultArtifacts`, `attachFailureArtifacts`, `attachFirstRowPlaybackReport`, `renderPlaybackResultsHtml`, `renderPlaybackErrorCell`, `imageDataUrl`, `escapeHtml`, and `safeArtifactName`. Preserve attachment names/content types, JSON fields (`step`, `url`, `focused`, `error`, candidate lists), HTML escaping, embedded screenshot data URLs, and the existing `test.step` wrapper. For focused-state and candidate collection used only for diagnostics, accept callbacks in an optional dependency object rather than importing navigation or workflow modules. Keep the four-argument `runStep(page,testInfo,title,action)` contract available through the composition binding.
    </action>
    <verify>
      Require the module and assert all listed artifact functions exist. Call `safeArtifactName("Căn phòng / lỗi")` and assert it returns `can-phong-loi`; call `renderPlaybackResultsHtml` with one failed result containing quote/angle-bracket text and assert the output contains escaped entities and the expected HTML report heading.
    </verify>
    <acceptance_criteria>
      <criterion>All current artifact filenames and content types remain unchanged for screenshot, text, JSON, and HTML attachments.</criterion>
      <criterion>`safeArtifactName` produces lowercase ASCII hyphenated names with the `artifact` fallback for empty input.</criterion>
      <criterion>`renderPlaybackResultsHtml` escapes item titles, error text, poster URLs, and screenshot data before interpolation.</criterion>
      <criterion>The module contains no imports from `text-utils.js`, `navigation.js`, `content-rows.js`, `playback.js`, or `workflows.js`.</criterion>
    </acceptance_criteria>
    <done>`tests/lib/artifacts.js` preserves attachment contracts and safely renders failure reports without local-module imports.</done>
  </task>
</tasks>

<verification>
  <command>node -e 'for (const file of ["./tests/lib/content-rows","./tests/lib/playback","./tests/lib/artifacts"]) require(file);'</command>
  <command>node -e 'const a=require("./tests/lib/artifacts"); if(a.safeArtifactName("Căn phòng / lỗi")!=="can-phong-loi") process.exit(1); if(!a.renderPlaybackResultsHtml([{index:1,title:"&lt;bad&gt;",status:"failed",errorPopup:"\"x\""}]).includes("AI first-row playback results")) process.exit(1);'</command>
</verification>

<success_criteria>
  <criterion>All three focused modules load without circular dependencies and expose the functions required by REFACTOR-03, REFACTOR-04, and REFACTOR-05.</criterion>
  <criterion>Content-row geometry, playback state, popup detection, and report artifact contracts remain represented in source and deterministic checks.</criterion>
  <criterion>Cross-module operations are adapter-driven and can be bound by `index.js` without changing existing workflow call signatures.</criterion>
</success_criteria>

## Decision Coverage

- D-01: Extract the five named primitive modules, with content rows, playback, and artifacts delivered here.
- D-04: Each module exports only the functions it owns; adapters are explicit composition seams.
- D-05: No primitive module imports another primitive or the workflow layer.
- D-10: Use the exact requirement filenames in the flat `tests/lib/` directory.
- D-11: Keep all new modules directly under `tests/lib/`.
- D-12: Use CommonJS `module.exports` in each module.
