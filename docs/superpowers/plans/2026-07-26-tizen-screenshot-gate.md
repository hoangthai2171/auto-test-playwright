# Tizen Screenshot Gate Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the Samsung Tizen screenshot investigation without weakening the genuine-Appium-screenshot gate or changing product behavior.

**Architecture:** The command-line POC remains the sole Phase 1 surface. Its Appium driver proxies standard screenshot requests to ChromeDriver; the observed ChromeDriver and direct DevTools failures are recorded as a renderer limitation, while the existing test-app-only and production-app block remains unchanged.

**Tech Stack:** Markdown documentation, local installed Appium Tizen TV driver source, Appium/ChromeDriver, Samsung Tizen Studio/SDB.

## Global Constraints

- macOS physical-TV command-line POC only; do not modify the Electron GUI.
- Never select, deploy, launch, uninstall, or override protection for Samsung production app `PP2MTMRMs9.MyTV`.
- Samsung test app only: `PP2MTMRMs8.MyTV`.
- Do not start LG work or claim any Samsung model is supported.
- Screenshots and diagnostics remain local and redacted; no artifact upload.
- Only a genuine Appium screenshot can satisfy the screenshot gate; do not add html2canvas, DOM, synthetic, or DevTools image fallbacks.

---

### Task 1: Record the screenshot-capture investigation

**Files:**
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`

**Interfaces:**
- Consumes: Existing test-app-only Samsung POC findings, the installed `appium-tizen-tv-driver@0.18.1` command routing, and Samsung TV capture guidance.
- Produces: A consistent Phase 1 record that blocks remote keys, account login/logout, and support claims until `GET /screenshot` succeeds and the session can close cleanly.

- [ ] **Step 1: Establish the baseline failure record**

Confirm the documents state that ChromeDriver `2.44`, `2.43`, `2.42`, and fallback `2.36` attach and expose DOM state, while Appium `GET /screenshot` and direct DevTools `Page.captureScreenshot` time out.

- [ ] **Step 2: Verify the driver transport boundary**

Read `appium-tizen-tv-driver@0.18.1` locally. Confirm the driver does not implement a native `getScreenshot` command and proxies unlisted WebDriver endpoints, including `/screenshot`, to ChromeDriver.

- [ ] **Step 3: Add only evidence-backed documentation**

State that the driver release is current, Samsung has no documented application screen-capture API, and no compliant alternative exists for this device under the genuine-Appium-screenshot requirement. Do not describe an untested workaround as a candidate.

- [ ] **Step 4: Preserve the POC gates**

Keep the model unsupported. Explicitly retain the prohibition on remote keys, dedicated-account login/logout, full POC completion, or clean-session claims until genuine Appium capture and normal WebDriver close both succeed.

- [ ] **Step 5: Validate the documentation change**

Run `node --check scripts/real-tv-appium/tizen-poc.js`, `npm run test:unit -- --test-name-pattern='Samsung POC'`, and `git diff --check`. Inspect `git diff -- docs/real-tv-appium/` to confirm only the evidence records changed.
