# Tizen No-Screenshot POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue safe Samsung Phase 1 POC checks without requesting a screenshot only when the operator explicitly opts in, while retaining the full screenshot gate for support.

**Architecture:** Move screenshot evidence policy into a small pure helper in `tizen-poc-core.js` so it can be tested without a TV. `tizen-poc.js` passes its Appium request and DOM reader to that helper; an explicit CLI flag chooses DOM-only evidence and a partial outcome message, never a full POC pass.

**Tech Stack:** Node.js CommonJS, `node:test`, Appium HTTP API, Samsung Tizen POC harness.

## Global Constraints

- macOS physical-TV command-line POC only; do not modify Electron GUI.
- The Samsung production app `PP2MTMRMs9.MyTV` stays non-overridable and ineligible.
- The only eligible Samsung app is `PP2MTMRMs8.MyTV`.
- The new mode never creates an image, invokes HTML/DOM capture, or makes an unsupported screenshot substitute pass the gate.
- A no-screenshot run remains unsupported and cannot claim a complete POC or model support.
- Remote keys remain real Appium `tizen: pressKey` commands; credentials remain separately runtime-only opt-in.
- Keep evidence local/redacted and do not begin LG work.

---

### Task 1: Test screenshot-policy behavior

**Files:**
- Modify: `tests/unit/tizen-poc-core.test.js`
- Modify: `scripts/real-tv-appium/tizen-poc-core.js`

**Interfaces:**
- Consumes: `redactDomState(state, secrets)` and an evidence writer with `writeJson(name, value)` and `writeScreenshot(name, base64Png)`.
- Produces: `capturePocEvidence({label, readDomState, requestScreenshot, writer, secrets, skipScreenshotGate})`, resolving the redacted DOM state or throwing a redacted screenshot error in normal mode.

- [ ] **Step 1: Write failing default-gate test**

Add this test to `tests/unit/tizen-poc-core.test.js`:

```js
test("Samsung POC default evidence requires a genuine Appium screenshot", async () => {
  const { capturePocEvidence } = require("../../scripts/real-tv-appium/tizen-poc-core");
  const writes = [];
  await assert.rejects(
    capturePocEvidence({
      label: "01-after-reset",
      readDomState: async () => ({ bodyText: "Welcome", focused: "", active: "", screenUrl: "" }),
      requestScreenshot: async () => { throw new Error("GET /screenshot timed out after 20000ms."); },
      writer: { writeJson: (...args) => writes.push(["json", ...args]), writeScreenshot: () => writes.push(["png"]) },
      secrets: [],
      skipScreenshotGate: false,
    }),
    /GET \/screenshot timed out/
  );
  assert.deepEqual(writes[0][0], "json");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `rtk npm run test:unit -- --test-name-pattern='default evidence requires'`

Expected: failure because `capturePocEvidence` is not exported.

- [ ] **Step 3: Implement the minimal shared evidence helper**

In `scripts/real-tv-appium/tizen-poc-core.js`, add and export:

```js
async function capturePocEvidence({ label, readDomState, requestScreenshot, writer, secrets = [], skipScreenshotGate = false }) {
  const dom = redactDomState(await readDomState(), secrets);
  writer.writeJson(`${label}.dom.json`, dom);
  if (skipScreenshotGate) return { dom, screenshotSkipped: true };
  try {
    writer.writeScreenshot(`${label}.png`, await requestScreenshot());
    return { dom, screenshotSkipped: false };
  } catch (error) {
    error.appiumScreenshotError = redactValue(error?.message || String(error), secrets);
    throw error;
  }
}
```

- [ ] **Step 4: Run the default-gate test and verify GREEN**

Run: `rtk npm run test:unit -- --test-name-pattern='default evidence requires'`

Expected: pass; the default path preserves the timeout failure.

- [ ] **Step 5: Write failing opt-in test**

Add this test:

```js
test("Samsung POC skip mode records DOM without requesting a screenshot", async () => {
  const { capturePocEvidence } = require("../../scripts/real-tv-appium/tizen-poc-core");
  let requests = 0;
  const result = await capturePocEvidence({
    label: "02-after-up",
    readDomState: async () => ({ bodyText: "password=secret", focused: "", active: "", screenUrl: "" }),
    requestScreenshot: async () => { requests += 1; return "not-used"; },
    writer: { writeJson() {}, writeScreenshot() { throw new Error("must not write PNG"); } },
    secrets: ["secret"],
    skipScreenshotGate: true,
  });
  assert.equal(requests, 0);
  assert.equal(result.screenshotSkipped, true);
  assert.doesNotMatch(result.dom.bodyText, /secret/);
});
```

- [ ] **Step 6: Run the opt-in test and verify RED**

Run: `rtk npm run test:unit -- --test-name-pattern='skip mode records DOM'`

Expected: failure until the helper honors `skipScreenshotGate`.

- [ ] **Step 7: Run both evidence-policy tests and verify GREEN**

Run: `rtk npm run test:unit -- --test-name-pattern='Samsung POC.*(default evidence|skip mode)'`

Expected: both tests pass.

### Task 2: Wire the explicit partial-POC mode

**Files:**
- Modify: `scripts/real-tv-appium/tizen-poc.js`
- Modify: `tests/unit/tizen-poc-core.test.js`

**Interfaces:**
- Consumes: `capturePocEvidence` and boolean CLI argument `args["skip-screenshot-gate"]`.
- Produces: Manifest `checks.appiumScreenshot` with an explicit skipped value and `status: "passed_without_screenshot_gate"`; the normal mode keeps `status: "passed"`.

- [ ] **Step 1: Write failing outcome-policy test**

Add a pure test for a new exported `pocCompletion({skipScreenshotGate, evidenceDir})` helper:

```js
test("Samsung POC skip mode cannot report a complete screenshot-gated pass", () => {
  const { pocCompletion } = require("../../scripts/real-tv-appium/tizen-poc-core");
  assert.deepEqual(
    pocCompletion({ skipScreenshotGate: true, evidenceDir: "/private/evidence" }),
    {
      status: "passed_without_screenshot_gate",
      message: "Samsung Tizen partial POC passed without the screenshot gate. Redacted local evidence: /private/evidence",
    }
  );
});
```

- [ ] **Step 2: Run the outcome-policy test and verify RED**

Run: `rtk npm run test:unit -- --test-name-pattern='cannot report a complete screenshot-gated pass'`

Expected: failure because `pocCompletion` is not exported.

- [ ] **Step 3: Implement the minimal outcome helper and wire it**

In `tizen-poc-core.js`, add and export `pocCompletion`:

```js
function pocCompletion({ skipScreenshotGate, evidenceDir }) {
  return skipScreenshotGate
    ? { status: "passed_without_screenshot_gate", message: `Samsung Tizen partial POC passed without the screenshot gate. Redacted local evidence: ${evidenceDir}` }
    : { status: "passed", message: `Samsung Tizen POC passed. Redacted local evidence: ${evidenceDir}` };
}
```

In `tizen-poc.js`:

1. Recognize `--skip-screenshot-gate` as a boolean flag and document it in `usage()`.
2. Pass `skipScreenshotGate` to every evidence capture call.
3. In skip mode, set `manifest.checks.appiumScreenshot` to `{ passed: false, skipped: "Operator selected --skip-screenshot-gate; no Appium screenshot request was made." }` before remote-key actions.
4. Use `pocCompletion` for the terminal message and final manifest status.

- [ ] **Step 4: Run focused POC tests and verify GREEN**

Run: `rtk npm run test:unit -- --test-name-pattern='Samsung POC'`

Expected: all Samsung POC tests pass.

### Task 3: Update runbook gates and validate locally

**Files:**
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`

**Interfaces:**
- Consumes: `--skip-screenshot-gate` partial outcome semantics.
- Produces: Explicit instructions for partial Phase 1 remote-key/DOM/cleanup validation that retain the unsupported/support gate.

- [ ] **Step 1: Document the exact partial-run command shape**

Add `--skip-screenshot-gate` to the Samsung command example and state that it omits all screenshot requests; it must not be combined with any claim of full POC pass or support.

- [ ] **Step 2: Document remaining scope**

Record that the next permitted run uses no deployment flag and no login flags, proves reset/restart, real keys, DOM inspection, and normal session/server cleanup on `PP2MTMRMs8.MyTV`, and keeps dedicated-account login/logout pending separate credentials.

- [ ] **Step 3: Run complete local validation**

Run:

```bash
rtk node --check scripts/real-tv-appium/tizen-poc.js
rtk npm run test:unit
rtk git diff --check
```

Expected: syntax succeeds, all unit tests pass, and whitespace check has no output.

- [ ] **Step 4: Run the safe physical partial POC**

After local validation, invoke the explicit test-app-only command with the live SDB serial and compatible local ChromeDriver, but without `--deploy`, `--login-from-env`, or `--verify-logout`:

```bash
rtk npm run tv:poc:tizen -- --host <current-TV-ip> --sdb-serial <live-sdb-serial> --model QA65Q70TAKXXV --model-year 2020 --app-id PP2MTMRMs8.MyTV --chromedriver <local-chromedriver> --skip-screenshot-gate
```

Expected: a local-only redacted manifest reports `passed_without_screenshot_gate` only if reset/restart, remote keys, DOM inspection, normal WebDriver close, Appium stop, and SDB-forward cleanup all pass. Any failure stays a failure and never alters support status.

- [ ] **Step 5: Record only observed physical-TV results**

Update the same three Phase 1 documents with the redacted manifest facts. Do not record IP addresses, serials, tokens, credentials, or screenshots, and do not state that any Samsung model is supported.
