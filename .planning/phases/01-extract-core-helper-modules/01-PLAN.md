---
phase: 01-extract-core-helper-modules
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/lib/text-utils.js
  - tests/lib/navigation.js
autonomous: true
requirements: [REFACTOR-01, REFACTOR-02]
must_haves:
  truths:
    - "D-01: The five named primitive modules are extracted with text and navigation delivered in this plan."
    - "D-04: Each module exports only the functions it owns."
    - "D-05: Primitive modules remain self-contained with no cross-imports."
    - "D-10: The exact requirement filenames are used."
    - "D-11: All new modules stay directly under tests/lib/."
    - "D-12: Each module uses CommonJS module.exports."
    - "Vietnamese normalization and fuzzy matching are available from a focused CommonJS module without changing accent, đ/Đ, whitespace, or case behavior."
    - "Remote focus and virtual-keyboard navigation retain the current keyboard-only behavior and geometry fallback behavior."
  artifacts:
    - path: tests/lib/text-utils.js
      provides: "normalizeVietnameseText, fuzzyMatch, and pure text helpers"
      contains: "module.exports"
    - path: tests/lib/navigation.js
      provides: "remotePress, remoteFocus, remoteFocusById, remoteFocusByText, and focus-state helpers"
      contains: "chooseDirection"
  key_links:
    - from: tests/lib/navigation.js
      to: page.keyboard.press
      via: remotePress
      pattern: "keyboard.press"
---

<objective>
Extract the text and remote-navigation primitives from the legacy helper module into independently loadable CommonJS modules while preserving their observable behavior and the existing `__internal` test seam.
</objective>

<tasks>
  <task type="execute">
    <name>extract_text_utilities</name>
    <files>tests/lib/text-utils.js</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md</file>
      <file>.planning/REQUIREMENTS.md</file>
      <file>.planning/codebase/CONVENTIONS.md</file>
    </read_first>
    <action>
      Create `tests/lib/text-utils.js` using CommonJS `module.exports`. Move the Node-side implementations of `normalizeVietnameseText`, `containsTextPattern`, and `escapeRegExp` without changing the NFD accent removal, `đ`/`Đ` conversion, whitespace collapsing, trim, or lowercase behavior. Add an exported `fuzzyMatch(value, target)` boolean predicate that uses the normalized exact, substring, and complete-token-coverage rules already embedded in the helper file; keep selector-specific numeric ranking tiers inside their browser-evaluated callbacks unless the exact score behavior can be shared without changing serialization. Do not import Playwright or any other local module into this file.
    </action>
    <verify>
      Require `tests/lib/text-utils.js` in Node and assert that its exports include `normalizeVietnameseText`, `fuzzyMatch`, `containsTextPattern`, and `escapeRegExp`; assert `normalizeVietnameseText("Căn phòng Đặc biệt")` equals `"can phong dac biet"`, and assert `fuzzyMatch("Căn Phòng Tử Thần", "can phong")` is true.
    </verify>
    <acceptance_criteria>
      <criterion>`tests/lib/text-utils.js` exists and ends with a CommonJS export object containing the required named functions.</criterion>
      <criterion>`normalizeVietnameseText("Căn phòng Đặc biệt")` returns exactly `"can phong dac biet"`.</criterion>
      <criterion>`fuzzyMatch` returns false for an empty/non-overlapping target and true for an accent-insensitive complete-token match.</criterion>
      <criterion>The module has no `require("./navigation")`, `require("./content-rows")`, `require("./playback")`, or `require("./workflows")` dependency.</criterion>
    </acceptance_criteria>
    <done>`tests/lib/text-utils.js` loads independently and passes the specified Vietnamese normalization and fuzzy-match assertions.</done>
  </task>

  <task type="execute">
    <name>extract_navigation_primitives</name>
    <files>tests/lib/navigation.js</files>
    <read_first>
      <file>tests/lib/mytv-helpers.js</file>
      <file>tests/ai-row-selection.spec.js</file>
      <file>.planning/phases/01-extract-core-helper-modules/01-RESEARCH.md</file>
      <file>.planning/codebase/TESTING.md</file>
    </read_first>
    <action>
      Create `tests/lib/navigation.js` with the current implementations of `remotePress`, `remoteFocus`, `remoteFocusById`, `remoteFocusByText`, `remoteFocusByKeyText`, `remoteFocusByVirtualKey`, `enterWithVirtualKeyboard`, `virtualKeyIds`, `getFocusedState`, `expectFocusedText`, and `expectFocusedElementToLookOrange`, plus the geometry helpers `chooseDirection`, `rangesOverlap`, `fallbackDirection`, and `center`. Preserve the current default delays, max-move values, containment checks for container IDs, final-focus check, fallback direction behavior, and virtual keyboard key-ID map. Export public helpers directly and export the geometry helpers through a nested `__internal` object so the existing deterministic spec can be wired through the barrel later. Keep this module limited to Playwright and its own local geometry/key helpers; do not import any other new local module.
    </action>
    <verify>
      Require `tests/lib/navigation.js` in Node and assert the public navigation keys and `__internal.chooseDirection` exist. Evaluate `__internal.chooseDirection({x:1272,y:505,width:334,height:68},{x:1528,y:416,width:70,height:70})` and assert it returns `ArrowUp`.
    </verify>
    <acceptance_criteria>
      <criterion>`tests/lib/navigation.js` exports `remoteFocusById`, `remoteFocusByText`, and `remoteFocus` with the current page-first signatures.</criterion>
      <criterion>`remotePress` calls `page.keyboard.press(key)` and retains a default 250ms wait; virtual-key entry retains the current character-by-character Enter behavior.</criterion>
      <criterion>`__internal.chooseDirection` returns `ArrowUp` for the existing wide-spacebar geometry regression case.</criterion>
      <criterion>The module contains no imports from `content-rows.js`, `playback.js`, `artifacts.js`, or `workflows.js`.</criterion>
    </acceptance_criteria>
    <done>`tests/lib/navigation.js` loads independently and preserves the existing keyboard geometry regression behavior.</done>
  </task>
</tasks>

<verification>
  <command>node -e 'const t=require("./tests/lib/text-utils"); const n=require("./tests/lib/navigation"); if(n.__internal.chooseDirection({x:1272,y:505,width:334,height:68},{x:1528,y:416,width:70,height:70})!=="ArrowUp") process.exit(1); if(t.normalizeVietnameseText("Căn phòng Đặc biệt")!=="can phong dac biet") process.exit(1);'</command>
  <command>node -e 'for (const file of ["./tests/lib/text-utils","./tests/lib/navigation"]) require(file);'</command>
</verification>

<success_criteria>
  <criterion>Both new primitive modules load independently and expose the named APIs required by REFACTOR-01 and REFACTOR-02.</criterion>
  <criterion>The existing text and geometry regression examples pass without requiring the legacy helper module.</criterion>
  <criterion>No primitive module imports another new primitive or the workflow layer.</criterion>
</success_criteria>

## Decision Coverage

- D-01: Extract the five named primitive modules, with text and navigation delivered here.
- D-04: Each module exports only the functions it owns.
- D-05: Primitive modules remain self-contained with no cross-imports.
- D-10: Use the exact requirement filenames in the flat `tests/lib/` directory.
- D-11: Keep all new modules directly under `tests/lib/`.
- D-12: Use CommonJS `module.exports` in each module.
