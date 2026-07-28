# Tizen Partial POC Cleanup Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a no-screenshot Samsung partial POC from reporting success when required local cleanup fails, while recording the observed post-logout UI alert without treating it as screenshot-gated support evidence.

**Architecture:** Keep cleanup-status normalization in `tizen-poc-core.js`, where it is deterministic and unit-testable. The command runner records each cleanup outcome through that helper; the three Phase 1 records distinguish a resolved trusted logout call from a clean user-visible post-logout screen.

**Tech Stack:** Node.js CommonJS, `node:test`, Markdown.

## Global Constraints

- macOS command-line Samsung POC only; do not modify Electron GUI or begin LG work.
- Never select, deploy, launch, uninstall, or override Samsung production app `PP2MTMRMs9.MyTV`; the only eligible test app is `PP2MTMRMs8.MyTV`.
- Preserve the unresolved genuine-Appium screenshot gate and unsupported Samsung-model status.
- Do not run any live TV, playback, search, or other product flow for this change; evidence remains local and redacted.
- Preserve unrelated dirty-worktree changes and do not run `bash-script/*.sh`.

---

### Task 1: Make partial-success cleanup status truthful and record the scope boundary

**Files:**
- Modify: `tests/unit/tizen-poc-core.test.js`
- Modify: `scripts/real-tv-appium/tizen-poc-core.js`
- Modify: `scripts/real-tv-appium/tizen-poc.js`
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`

**Interfaces:**
- Consumes: `manifest.status`, `manifest.checks`, and a cleanup check with a boolean `passed` field.
- Produces: `recordPocCleanup(manifest, checkName, check)`; it records the check and changes any `passed` or `passed_without_screenshot_gate` status to `failed` if that check fails.

- [ ] **Step 1: Write the failing test**

Add this focused test to `tests/unit/tizen-poc-core.test.js`:

```js
test("Samsung partial POC fails when required cleanup fails", () => {
  const manifest = { status: "passed_without_screenshot_gate", checks: {} };
  recordPocCleanup(manifest, "sessionClosed", { passed: false, error: "close failed" });

  assert.equal(manifest.checks.sessionClosed.passed, false);
  assert.equal(manifest.status, "failed");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/tizen-poc-core.test.js`

Expected: failure because `recordPocCleanup` is not exported yet.

- [ ] **Step 3: Add the minimal cleanup-status helper and use it**

In `scripts/real-tv-appium/tizen-poc-core.js`, export:

```js
function recordPocCleanup(manifest, checkName, check) {
  manifest.checks[checkName] = check;
  if (!check.passed && /^(passed|passed_without_screenshot_gate)$/.test(manifest.status)) {
    manifest.status = "failed";
  }
}
```

In `scripts/real-tv-appium/tizen-poc.js`, use it for `sessionClosed` and `sdbForwardsReleased` results instead of separately assigning each check and conditionally changing only a full `passed` status.

- [ ] **Step 4: Run focused and full local verification**

Run:

```bash
node --test tests/unit/tizen-poc-core.test.js
npm run test:unit
node --check scripts/real-tv-appium/tizen-poc.js
node --check scripts/real-tv-appium/tizen-poc-core.js
node --check scripts/real-tv-appium/tizen-poc-login.js
git diff --check
```

Expected: all commands pass. No live TV command is run.

- [ ] **Step 5: Update Phase 1 records**

In the three requested documents, record these exact facts:

- The retained `2026-07-26T04-36-53-108Z` local manifest has `passed_without_screenshot_gate`, all required cleanup checks passed, and no screenshot request was made.
- The trusted `window.processLogOut` call resolved, but its retained post-call DOM contained app alert `Mã lỗi: 3000`; this does not prove a clean visible post-logout screen and is not a product-flow pass/fail assertion in the partial POC.
- The local cleanup-status contract prevents any later failed session close or SDB-forward cleanup from retaining a partial-success status.
- The genuine screenshot gate, full POC, and Samsung support remain unresolved; LG remains unstarted.

- [ ] **Step 6: Commit**

Do not commit in this shared dirty worktree unless the user explicitly requests it. Report the touched files and validation evidence instead.
