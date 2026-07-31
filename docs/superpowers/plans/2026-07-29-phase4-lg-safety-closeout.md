# Phase 4 LG Safety Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the current LG-only Phase 4 safety increment with verified target-specific preview behavior and an accurate gate record, without operating or altering a physical TV.

**Architecture:** The renderer owns target-specific presentation only; it continues to call the main process through preload IPC for saved-profile validation. Browser preview controls must have no effect while the selected target is LG, and no runtime connection data reaches the renderer. The Phase 4 legacy device-modal/install backlog remains separate because direct-IP design is material UI work and installation is outside the authorized scope.

**Tech Stack:** Electron renderer, CommonJS Node.js, Node built-in test runner.

## Global Constraints

- LG-only; do not investigate or operate Samsung.
- Do not deploy, uninstall, reset, pair, navigate, or otherwise alter the LG app.
- No live-TV operation without a separate explicit approval and read-only preflight.
- Keep hosts, credentials, pairing material, and screenshots out of source and retained evidence.
- Use `appium:rcMode: rc` only for any future physical-TV navigation; this plan performs none.
- Preserve Browser as the default target and keep LG execution disabled.

---

### Task 1: Verify target-specific preview controls in Electron

**Files:**
- Modify: none
- Test: `tests/unit/renderer.test.js`

**Interfaces:**
- Consumes: `selectRunTarget("webos")` and the Preview Type radio inputs.
- Produces: manual accessibility evidence that LG shows no Browser preview, disables Browser-only Preview Type controls, and keeps Run disabled.

- [x] **Step 1: Launch the local Electron app from this worktree.**

Run: `rtk npm run app:dev`

Expected: the desktop app opens with Browser selected.

- [x] **Step 2: Select LG without validating or running.**

Expected: the no-TV-preview explanation is visible, all Preview Type radio controls are disabled, the explanatory Browser-only note is visible, and Run remains disabled.

- [x] **Step 3: Restore Browser and close the app.**

Expected: Preview Type controls are enabled again, the Browser-only note is hidden, and the launch process exits. No TV command is issued.

### Task 2: Record the scoped LG Phase 4 gate result

**Files:**
- Modify: `docs/real-tv-appium/phases.md`

**Interfaces:**
- Consumes: the Task 1 accessibility result and current source-of-truth scope.
- Produces: a dated LG-only gate note that separates completed safety work from the still-unapproved direct-IP/package backlog.

- [x] **Step 1: Add a concise Phase 4 LG-only completion note.**

Record that the target persists locally, saved-profile validation is read-only and redacted, LG run remains disabled, Browser preview is cleared for LG, and Browser-only Preview Type controls are disabled.

- [x] **Step 2: Preserve the legacy unchecked backlog.**

Do not mark direct-IP/modal or package installation work complete: the former needs an explicit UX decision and the latter is prohibited by the current no-deployment scope.

- [x] **Step 3: Run required repository validation.**

Run:

```text
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: all commands exit successfully.

### Task 3: Hold the material direct-IP/device-modal expansion for confirmation

**Files:**
- Modify: none

**Interfaces:**
- Consumes: the legacy Phase 4 direct-IP/device-modal requirements.
- Produces: an explicit decision point before changing the Electron information architecture or creating a one-off target flow.

- [x] **Step 1: Do not implement direct-IP, scan, package-path, or install/update UI under this closeout.**

These requirements add a new device-management interaction model; package installation is additionally disallowed by the current LG safety scope.

- [ ] **Step 2: Report the remaining gate boundary.**

Ask for a dedicated UX/scope decision only after all local LG safety work is complete.
