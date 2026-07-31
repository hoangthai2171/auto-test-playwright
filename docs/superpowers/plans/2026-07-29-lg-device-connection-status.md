# LG Device Connection Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present an honest, compact local-only connection status for the
selected LG device without performing a TV operation.

**Architecture:** Keep connection-status presentation in the renderer because
this increment has no connection check, IPC, or persisted status. Extend the
existing LG device panel with semantic text-style buttons, a neutral status row,
and a disabled control. The renderer resets the visual state whenever the
selected profile changes or a profile is successfully saved.

**Tech Stack:** Electron renderer HTML, CSS, CommonJS JavaScript, Node unit
tests.

## Global Constraints

- LG only; Samsung remains out of scope.
- No network, CLI, Appium, target registration, pairing, validation, or TV
  contact.
- The connection control is disabled and creates no preload/main-process IPC.
- A saved profile is not a connected profile; the initial visual state is
  neutral gray and `Connection not checked`.
- Use semantic `<button type="button">` elements styled as underlined text,
  not anchor navigation.
- Preserve redaction boundaries: no host, passphrase, pairing data, archive
  path, or runtime diagnostic reaches renderer status.
- Do not stage, commit, or push the shared dirty worktree.
- Use `apply_patch` for repository edits and prefix every shell command with
  `rtk`.
- After every repository edit, run `rtk npm run test:unit`, the three required
  `node --check` commands, the generic Playwright list, and `rtk git diff --check`.
- After code edits, update Graphify with the project sequential-update
  workaround, then run `rtk graphify check-update .` plus the required checks.

---

### Task 1: Lock the local-only connection-status contract with renderer tests

**Files:**
- Modify: `tests/unit/renderer.test.js:fixture IDs and LG-device renderer tests`

**Interfaces:**
- Consumes: existing renderer element IDs and `createRendererController()`.
- Produces: failing tests for `tv-device-connection-status`,
  `tv-device-connection-dot`, and `tv-device-check-connection-button`, with no `checkTvDeviceConnection`
  controller or preload API.

- [ ] **Step 1: Add fixture elements and markup assertions before implementation**

  Add the two element IDs to `createRendererFixture()` and the existing HTML
  ID assertion. Add an assertion that the action controls remain buttons with
  `type="button"`, rather than anchors.

  ```js
  "tv-device-connection-status",
  "tv-device-connection-dot",
  "tv-device-check-connection-button",

  assert.match(html, /id="tv-device-add-button"[^>]*type="button"/);
  assert.match(html, /id="tv-device-edit-button"[^>]*type="button"/);
  assert.doesNotMatch(html, /<a[^>]+tv-device-(?:add|edit)-button/);
  ```

- [ ] **Step 2: Add behavior tests that must initially fail**

  Place tests beside the current LG target tests. They must confirm that
  selecting LG with a saved device shows the neutral text and leaves Check
  connection disabled, that selecting another device resets the same text, and
  that no callable live check is exposed.

  ```js
  await controller.selectRunTarget("webos");

  assert.match(
    fixture.elements["tv-device-connection-status"].textContent,
    /Connection not checked/i,
  );
  assert.equal(fixture.elements["tv-device-check-connection-button"].disabled, true);
  assert.equal(controller.checkTvDeviceConnection, undefined);
  assert.equal(fixture.runner.checkTvDeviceConnection, undefined);
  ```

  Change the select value to another saved fixture device, dispatch `change`,
  and make the same neutral/disabled assertions. In a successful fake
  `validateAndSaveTvDevice` response, assert the status is reset after
  `submitTvDeviceDialog()`; do not add a fake validator call beyond the
  existing dialog flow.

- [ ] **Step 3: Run the focused renderer unit file and confirm failure**

  Run: `rtk node --test tests/unit/renderer.test.js`

  Expected: FAIL because the markup and fixture/controller do not yet provide
  the two status controls or reset behavior.

- [ ] **Step 4: Add CSS contract assertions before style implementation**

  Add tests that look for an underlined text-button rule and clear neutral-dot
  rule. Require an accessible visible focus style and a disabled state that
  keeps the existing global disabled behavior.

  ```js
  assert.match(css, /\.tv-device-text-action\s*\{[^}]*text-decoration:\s*underline;/s);
  assert.match(css, /\.tv-device-connection-dot\.not-checked\s*\{[^}]*background:\s*#9aa3b2;/s);
  assert.match(css, /\.tv-device-text-action:focus-visible\s*\{[^}]*outline:/s);
  ```

### Task 2: Implement the local-only panel and neutral renderer state

**Files:**
- Modify: `app/renderer/index.html:LG device panel`
- Modify: `app/renderer/styles.css:LG device actions and connection row`
- Modify: `app/renderer/renderer.js:LG device element lookup, rendering, and event handling`
- Test: `tests/unit/renderer.test.js`

**Interfaces:**
- Consumes: `tvDevices`, `tvDeviceSelect`, `loadTvDevices()`,
  `submitTvDeviceDialog()`, and `syncRunTargetControls()`.
- Produces: `resetTvDeviceConnectionStatus()` internal renderer helper. It
  only renders `{ state: "not-checked", text: "Connection not checked" }` and
  has no side effects beyond DOM state.

- [ ] **Step 1: Add the minimal accessible markup**

  Change only the existing action controls and status area in the LG-device
  panel. Retain their IDs and click handlers. Add the status row and disabled
  check button; it must have no click handler.

  ```html
  <div class="tv-device-actions">
      <button type="button" id="tv-device-add-button" class="tv-device-text-action">+ Add device</button>
      <button type="button" id="tv-device-edit-button" class="tv-device-text-action" disabled>Edit device</button>
  </div>
  <div id="tv-device-connection-status" class="tv-device-connection-status" role="status">
      <span id="tv-device-connection-dot" class="tv-device-connection-dot not-checked" aria-hidden="true"></span>
      <span>Connection not checked</span>
      <button type="button" id="tv-device-check-connection-button" class="secondary-button" disabled>Check connection</button>
  </div>
  <p id="tv-device-status" class="tv-device-status" role="status">Browser runner is selected.</p>
  ```

- [ ] **Step 2: Add narrow styles for the compact controls**

  Replace the space-between action layout with a small inline gap so the two
  actions read as related controls. Keep text-style controls visibly
  underlined, use a distinct focus outline, and make the status row wrap on a
  narrow sidebar. Do not change global button styling.

  ```css
  .tv-device-actions { display: flex; align-items: center; gap: 14px; }
  .tv-device-text-action {
    height: auto; padding: 0; border: 0; background: transparent;
    color: #9fc7ff; text-decoration: underline;
  }
  .tv-device-text-action:focus-visible { outline: 2px solid #6ea8fe; outline-offset: 2px; }
  .tv-device-connection-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .tv-device-connection-dot { width: 8px; height: 8px; border-radius: 999px; }
  .tv-device-connection-dot.not-checked { background: #9aa3b2; }
  ```

- [ ] **Step 3: Implement status rendering with no live operation**

  Read the three new elements alongside the existing LG device elements. Add the
  helper below; call it from `renderTvDevices()`, the select `change` handler,
  and the successful profile-save branch in `submitTvDeviceDialog()`. The
  existing `tv-device-status` may retain explanatory text, but it must not
  claim connection validation has happened.

  ```js
  function resetTvDeviceConnectionStatus() {
      if (tvDeviceConnectionStatus) {
          tvDeviceConnectionStatus.textContent = "Connection not checked";
      }
      tvDeviceConnectionDot?.classList?.remove("connected", "unavailable");
      tvDeviceConnectionDot?.classList?.add("not-checked");
      if (tvDeviceCheckConnectionButton) tvDeviceCheckConnectionButton.disabled = true;
  }
  ```

  Use a child element for the visible text if needed so replacing text does not
  remove the dot or disabled button. Do not add `api.checkTvDeviceConnection`,
  IPC, a listener for the disabled button, an HTTP request, a CLI invocation,
  or a test-run state change.

- [ ] **Step 4: Run the focused renderer unit file and confirm it passes**

  Run: `rtk node --test tests/unit/renderer.test.js`

  Expected: PASS. The added tests prove a saved device stays gray/unverified,
  actions remain accessible buttons, and there is no callable connection check.

- [ ] **Step 5: Run the required repository validation after this edit**

  Run each command separately:

  ```bash
  rtk npm run test:unit
  rtk node --check app/main.js
  rtk node --check app/preload.js
  rtk node --check app/renderer/renderer.js
  rtk npx playwright test tests/run-test-case-mytv.spec.js --list
  rtk git diff --check
  ```

  Expected: all commands exit 0; the generic Playwright list may report its
  existing skipped generic test and must not launch Electron or contact a TV.

- [ ] **Step 6: Update and verify Graphify after the renderer code change**

  Run the documented sequential Graphify rebuild workaround, then:

  ```bash
  rtk graphify check-update .
  ```

  Expected: Graphify reports the graph current. Re-run the six required
  repository validation commands because generated graph output may change.

## Plan self-review

- Spec coverage: Task 1 locks the semantic controls, neutral default, reset
  behavior, and no-live-operation boundary; Task 2 implements each of those
  contracts without IPC or persistence.
- No placeholders: every code/test task names the exact existing files,
  element IDs, helper, assertions, and commands.
- Interface consistency: `resetTvDeviceConnectionStatus()` is renderer-private
  and uses only elements created in Task 2; no later task expects a new public
  API or IPC route.
