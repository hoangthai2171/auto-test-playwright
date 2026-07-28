# Phase 3 Target-Neutral Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the existing server-case action schema through trusted Browser and LG TV action contexts without changing the server payload.

**Architecture:** Keep compilation and result formatting in the existing case runner. Add a small target-neutral action layer that accepts a validated context and dispatches trusted handlers; Browser adapts existing helpers and LG adapts `TvSession`/redacted DOM state. Every action is preflighted before execution and every TV behavior is proven with injected fakes before any live validation is requested.

**Tech Stack:** CommonJS, Node `node:test`, existing Playwright helpers, Appium-backed `TvSession`.

## Global Constraints

- LG is the only physical-TV implementation; Samsung must remain blocked before device activity.
- Do not persist runtime hosts, pairing data, credentials, or screenshots.
- Preserve case schema, browser behavior, and flow-case API result payloads.
- Use virtual-keyboard/remote semantics for TV input; never direct text injection.
- Run the required unit, syntax, Playwright-listing, and diff checks after every repository edit.

---

### Task 1: Define the target-neutral action contract

**Files:**
- Create: `tests/lib/tv-session/dom-session.js`
- Create: `tests/lib/target-action-context.js`
- Test: `tests/unit/target-action-context.test.js`

**Interfaces:**
- Consumes: `TvSession` methods `pressKey`, `getDomState`, `waitForDomState`, `screenshot`, and `cleanup`.
- Produces: `createTargetActionContext({session, testInfo, helpers, capabilities})` and `TargetActionError` with `code`, `caseId`, and `actionIndex`.

- [ ] **Step 1: Write failing context contracts**

```js
const context = createTargetActionContext({session: fakeSession, capabilities: {domInspection: true}});
assert.equal(context.session, fakeSession);
assert.throws(() => context.requireAction("login", 3, "case-7"), /case-7.*3/);
```

- [ ] **Step 2: Run the focused test and verify it fails because the module is missing.**

Run: `node --test tests/unit/target-action-context.test.js`

- [ ] **Step 3: Implement immutable context construction and capability preflight.**

```js
function createTargetActionContext({session, testInfo, helpers, capabilities}) {
  return Object.freeze({session, testInfo, helpers, capabilities: Object.freeze({...capabilities})});
}
```

- [ ] **Step 4: Re-run the focused test and then `npm run test:unit`.**

### Task 2: Add trusted TV DOM primitives

**Files:**
- Modify: `tests/lib/tv-session/webos-appium-session.js`
- Modify: `tests/lib/tv-session/dom-session.js`
- Test: `tests/unit/webos-appium-session.test.js`
- Test: `tests/unit/dom-session.test.js`

**Interfaces:**
- Consumes: the Phase 2 WebOS session and redacted DOM normalization.
- Produces: trusted reads, native remote key presses, bounded DOM waits, and visual-capture capability errors.

- [ ] **Step 1: Add failing tests for native remote input and bounded DOM reads.**

```js
await dom.press("ArrowRight");
assert.deepEqual(calls.at(-1), ["webos: pressKey", [{key: "RIGHT"}]]);
await assert.rejects(() => dom.requireVisualCapture(), {code: "VISUAL_CAPTURE_UNAVAILABLE"});
```

- [ ] **Step 2: Run the focused tests and verify the missing primitive/error behavior fails.**

- [ ] **Step 3: Implement only the trusted primitives; do not expose arbitrary server JavaScript or selectors.**

- [ ] **Step 4: Re-run focused tests and the unit suite.**

### Task 3: Extract target-neutral action dispatch and preserve Browser behavior

**Files:**
- Create: `tests/lib/target-action-runner.js`
- Modify: `tests/lib/test-case-action-runner.js`
- Test: `tests/unit/target-action-runner.test.js`
- Test: `tests/unit/test-case-action-runner.test.js`

**Interfaces:**
- Consumes: compiled cases and a Phase 1 context.
- Produces: `runTargetActions(context, testCase, options)` with existing step-result shape.

- [ ] **Step 1: Write a failing fake-session test for `wait_for_ready`, `press_ok`, `press_back`, and `assert_screen`.**

```js
const result = await runTargetActions(context, caseWith("press_back"));
assert.equal(result.steps[0].status, "passed");
assert.deepEqual(fakeSession.keys, ["back"]);
```

- [ ] **Step 2: Run it and verify it fails because target dispatch is absent.**

- [ ] **Step 3: Implement preflight and dispatch, then adapt the existing Browser runner without changing its helper calls.**

- [ ] **Step 4: Run focused contracts and existing browser action-runner tests.**

### Task 4: Port authenticated/navigation/search actions through trusted adapters

**Files:**
- Create: `tests/lib/tv-mytv-actions.js`
- Modify: `tests/lib/target-action-runner.js`
- Test: `tests/unit/tv-mytv-actions.test.js`
- Test: `tests/unit/target-action-runner.test.js`

**Interfaces:**
- Consumes: trusted DOM primitives and case `login`, `open_home`, `open_search`, and `search_content` actions.
- Produces: remote-only action outcomes and clear capability errors.

- [ ] **Step 1: Write one fake-session test per action, including character-by-character virtual-keyboard entry.**

```js
await actions.searchContent({name: "abc", type: "content"});
assert.deepEqual(fakeSession.virtualKeyboardCharacters, ["a", "b", "c"]);
```

- [ ] **Step 2: Run focused tests and verify each missing handler fails.**

- [ ] **Step 3: Implement trusted semantic handlers with no credential logging and no direct text injection.**

- [ ] **Step 4: Run focused tests and the full unit suite.**

### Task 5: Port playback and row-navigation actions

**Files:**
- Modify: `tests/lib/tv-mytv-actions.js`
- Modify: `tests/lib/target-action-runner.js`
- Test: `tests/unit/tv-mytv-actions.test.js`
- Test: `tests/unit/target-action-runner.test.js`

**Interfaces:**
- Consumes: trusted navigation/search state and `play_content`, `play_search_result`, `play_row`, `focus_row`, `focus_row_first_item`, and `focus_text` actions.
- Produces: structured business failures for absent content and capability failures for unavailable player/visual state.

- [ ] **Step 1: Add failing fake-session tests for every remaining action and player-return cleanup.**

```js
await assert.rejects(() => actions.playContent({name: "missing", type: "movie"}), {code: "CONTENT_NOT_FOUND"});
```

- [ ] **Step 2: Verify each test fails for the missing action handler.**

- [ ] **Step 3: Implement the minimum trusted remote/DOM semantics and preserve the browser expected-result path.**

- [ ] **Step 4: Run focused tests and the full unit suite.**

### Task 6: Add fake-only terminal execution and cleanup/result contracts

**Files:**
- Modify: `tests/run-test-case-tv.spec.js`
- Modify: `tests/lib/target-action-runner.js`
- Test: `tests/unit/target-action-runner.test.js`
- Test: `tests/unit/tv-runner.test.js`

**Interfaces:**
- Consumes: a fake `TvSession` and completed target actions.
- Produces: existing result payloads, redacted local artifact metadata, and cleanup precedence.

- [ ] **Step 1: Write failing terminal contracts for a full fixture case and a cleanup failure after a passing case.**

```js
assert.equal(result.status, "failed");
assert.equal(result.steps.at(-1).action, "logout_cleanup");
```

- [ ] **Step 2: Verify the terminal contract fails before the new execution bridge exists.**

- [ ] **Step 3: Implement terminal bridge/result mapping with injected fakes only.**

- [ ] **Step 4: Run `npm run test:tv:contract`, the required validation suite, and `git diff --check`.**

### Task 7: Documentation and final verification

**Files:**
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Test: `tests/unit/*.test.js`

- [ ] **Step 1: Record exactly which Phase 3 local contracts are complete and which live validation remains separately approved.**

- [ ] **Step 2: Run all required verification commands and review the staged diff.**

- [ ] **Step 3: Request a bounded code review, address Critical/Important findings, then commit the Phase 3 work.**
