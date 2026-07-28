# Samsung Tizen DOM Semantic POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the Samsung test-app-only Phase 1 DOM semantic search and playback POC without visual-capture fallback.

**Architecture:** A focused Tizen semantic adapter consumes the existing remote-page and virtual-keyboard primitives. `tizen-poc.js` validates an explicit semantic request, invokes it only after the dedicated runtime-only login, records redacted DOM/player facts, and retains trusted logout and cleanup.

**Tech Stack:** Node.js CommonJS, `node:test`, Appium WebDriver execute endpoint, existing MyTV remote-navigation primitives.

## Global Constraints

- macOS physical-TV Samsung command-line POC only; do not modify Electron GUI or begin LG work.
- Reject `PP2MTMRMs9.MyTV` unconditionally; run only `PP2MTMRMs8.MyTV`.
- No deployment, pairing change, live TV command, credential storage, screenshot request, synthetic capture, or external artifact upload in this implementation task.
- Search and login must use real remote keys and MyTV's virtual keyboard character by character.
- Evidence must be local/redacted JSON only and retain `visualCapture: unavailable` in skip-screenshot mode.
- Preserve unrelated dirty-worktree changes; do not commit unless the user explicitly asks.

---

### Task 1: Define and test the semantic request boundary

**Files:**
- Create: `tests/unit/tizen-poc-semantic.test.js`
- Create: `scripts/real-tv-appium/tizen-poc-semantic.js`

**Interfaces:**
- Produces: `parseSemanticRequest(args)`, returning `null` when no semantic flags are supplied or `{name, type}` when both valid fields are supplied.
- Rejects: a lone semantic field, unsupported type, or semantic request without `login-from-env` and `verify-logout`.

- [ ] **Step 1: Write the failing request-boundary tests**

```js
const { parseSemanticRequest } = require("../../scripts/real-tv-appium/tizen-poc-semantic");

test("Samsung semantic POC requires a complete dedicated-account request", () => {
  assert.equal(parseSemanticRequest({}), null);
  assert.throws(() => parseSemanticRequest({"search-name": "VTV1"}), /search-name.*content-type/i);
  assert.throws(() => parseSemanticRequest({"search-name": "VTV1", "content-type": "channel"}), /login-from-env.*verify-logout/i);
  assert.deepEqual(parseSemanticRequest({
    "search-name": "VTV1", "content-type": "channel", "login-from-env": true, "verify-logout": true,
  }), {name: "VTV1", type: "channel"});
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm run test:unit -- --test-name-pattern='semantic POC requires a complete'`

Expected: failure because the module does not exist.

- [ ] **Step 3: Implement only `parseSemanticRequest`**

```js
const CONTENT_TYPES = new Set(["channel", "movie", "content"]);

function parseSemanticRequest(args) {
  const hasName = Object.prototype.hasOwnProperty.call(args, "search-name");
  const hasType = Object.prototype.hasOwnProperty.call(args, "content-type");
  if (!hasName && !hasType) return null;
  if (!hasName || !hasType) throw new Error("--search-name and --content-type must be supplied together.");
  const name = String(args["search-name"] || "").trim();
  const type = String(args["content-type"] || "").trim();
  if (!name) throw new Error("--search-name must not be empty.");
  if (!CONTENT_TYPES.has(type)) throw new Error("--content-type must be channel, movie, or content.");
  if (!args["login-from-env"] || !args["verify-logout"]) throw new Error("Semantic POC requires --login-from-env and --verify-logout.");
  return {name, type};
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `rtk npm run test:unit -- --test-name-pattern='semantic POC requires a complete'`

Expected: pass.

### Task 2: Add remote-only search-result selection and player observation

**Files:**
- Modify: `scripts/real-tv-appium/tizen-poc-semantic.js`
- Modify: `tests/unit/tizen-poc-semantic.test.js`

**Interfaces:**
- Produces: `selectBestSearchResult(candidates, request)` and `runSemanticSearchPlayback({execute, request})`.
- Consumes: the existing `createRemotePage` and MyTV virtual-keyboard navigation primitives.
- Returns: `{searchResult, player}` after real remote search/Enter and DOM-only player observation.

- [ ] **Step 1: Write a failing matching-result test**

```js
test("Samsung semantic POC prefers the matching visible result", () => {
  const result = selectBestSearchResult([
    {id: "searchRow_0_1", visible: true, type: "movie", label: "Tin tức"},
    {id: "searchRow_0_0", visible: true, type: "channel", label: "VTV1 HD"},
  ], {name: "VTV1", type: "channel"});
  assert.equal(result.id, "searchRow_0_0");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm run test:unit -- --test-name-pattern='prefers the matching visible result'`

Expected: failure because `selectBestSearchResult` is not exported.

- [ ] **Step 3: Implement minimal remote-only helpers**

Implement a DOM collector that returns visible result metadata and uses only
`page.evaluate`; focus its selected ID through `navigation.remoteFocusById` and
activate it with `page.keyboard.press("Enter")`. Use a two-sample `video` DOM
observer after a six-second wait. Reject a missing player, visible error popup,
paused/ended player, insufficient data, or no clock/frame evidence. Never
import Playwright workflow or screenshot helpers.

- [ ] **Step 4: Run semantic focused tests and verify GREEN**

Run: `rtk npm run test:unit -- --test-name-pattern='Samsung semantic POC'`

Expected: all focused tests pass.

### Task 3: Wire the opt-in POC command and documentation

**Files:**
- Modify: `scripts/real-tv-appium/tizen-poc.js`
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`

**Interfaces:**
- Consumes: `--search-name <known-playable-title> --content-type <channel|movie|content>` with the existing account/logout and skip-screenshot flags.
- Produces: redacted manifest `semanticSearch` and `semanticPlayback` checks, or a failed run with no screenshot artifact.

- [ ] **Step 1: Write the focused command-boundary test**

Extend the semantic request test to show that a request cannot be represented
without the mandatory account/logout flags. This is already the public CLI
contract, so no direct import of the executable runner is needed.

- [ ] **Step 2: Wire the semantic request after login**

Parse the request before the session begins. After successful
`loginWithDedicatedAccount`, call `runSemanticSearchPlayback` with the session
execute adapter, store its redacted result in separate manifest checks, and
leave trusted logout immediately afterward. Add the two flags to `usage()`.

- [ ] **Step 3: Update Phase 1 records**

Document the exact opt-in command shape, the DOM-only player criteria, and the
fact that the harness is merely prepared—not physically proven—until a real
run creates a redacted manifest. Keep the screenshot gate unresolved, model
support unsupported, and LG unstarted.

- [ ] **Step 4: Run complete local validation**

Run:

```bash
rtk npm run test:unit
rtk node --check scripts/real-tv-appium/tizen-poc.js
rtk node --check scripts/real-tv-appium/tizen-poc-login.js
rtk node --check scripts/real-tv-appium/tizen-poc-semantic.js
rtk git diff --check
```

Expected: all unit tests pass, every changed script parses, and the whitespace
check is empty. Do not run a physical-TV search/playback command in this task.
