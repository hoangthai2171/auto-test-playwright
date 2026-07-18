# Header Brand and Window Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the MyTV brand text into the fixed header and increase the default Electron window height.

**Architecture:** Keep the existing header and toolbar structure, adding a left-aligned brand block while retaining Settings and Logs on the right. Remove only the duplicate sidebar markup, update the BrowserWindow size constants, and cover both contracts with existing Node unit tests.

**Tech Stack:** CommonJS JavaScript, Electron, static HTML/CSS, Node `node:test`.

## Global Constraints

- Brand copy remains exactly `MyTV Auto Test` and `Chạy Playwright test bằng giao diện desktop.`.
- Default window size is `1040 × 900`; minimum window size is `920 × 760`.
- Preserve existing Settings/Logs controls, sidebar folder/test-case controls, and responsive workspace behavior.
- Do not change API, cache, test execution, or TV navigation behavior.

---

### Task 1: Add failing layout and window contract tests

**Files:**
- Modify: `tests/unit/renderer.test.js`
- Test: `tests/unit/renderer.test.js`

**Interfaces:**
- Markup assertions read `app/renderer/index.html`.
- Window assertions read `app/main.js` as text because Electron window construction is not imported by the lightweight unit test process.

- [ ] **Step 1: Write the failing assertions.**

Add a test that asserts the header contains `class="app-brand"`, both brand strings, Settings and Logs, and that the sidebar no longer contains the brand class. Add a test that asserts `width: 1040`, `height: 900`, `minWidth: 920`, and `minHeight: 760` appear in the `new BrowserWindow` configuration.

- [ ] **Step 2: Run the targeted tests and verify the expected red failure.**

Run: `node --test tests/unit/renderer.test.js`

Expected: the new header/window assertions fail because the brand is still in the sidebar and `app/main.js` still uses height `760`/minimum height `680`.

---

### Task 2: Implement the header brand and taller default window

**Files:**
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/styles.css`
- Modify: `app/main.js`

**Interfaces:**
- The header gains `.app-brand` with the existing two-line copy.
- The sidebar no longer renders the brand block.
- `BrowserWindow` uses `{width: 1040, height: 900, minWidth: 920, minHeight: 760}`.

- [ ] **Step 1: Move the brand markup into the header.**

Place this block before the Settings button:

```html
<div class="app-brand">
    <strong>MyTV Auto Test</strong>
    <span>Chạy Playwright test bằng giao diện desktop.</span>
</div>
```

Remove the existing sidebar `<div>` containing the `h1` and `.muted` subtitle. Keep the sidebar’s form as its first content element.

- [ ] **Step 2: Add fixed header styling.**

Change `.toolbar` from right-only alignment to `justify-content: space-between`, add `.app-brand` as a compact two-row block with `flex: 0 1 auto`, and style its subtitle using the existing muted color. Keep the existing toolbar button styling and prevent the brand from shifting the buttons off-screen with `min-width: 0` and text overflow rules.

- [ ] **Step 3: Increase the Electron window defaults.**

Update the `BrowserWindow` options in `createWindow()` to:

```js
width: 1040,
height: 900,
minWidth: 920,
minHeight: 760,
```

- [ ] **Step 4: Run the targeted tests and verify green.**

Run: `node --test tests/unit/renderer.test.js`

Expected: all renderer tests, including the new header/window assertions, pass.

---

### Task 3: Verify and commit the isolated change

**Files:**
- Verify: `app/main.js`
- Verify: `app/renderer/index.html`
- Verify: `app/renderer/styles.css`
- Verify: `tests/unit/renderer.test.js`

- [ ] **Step 1: Run final checks.**

Run: `npm run test:unit`

Run: `node --check app/main.js && node --check app/renderer/renderer.js`

Run: `git diff --check`

Expected: all unit tests pass, syntax checks pass, and diff check is clean.

- [ ] **Step 2: Commit the implementation.**

Stage only the UI, main-process, and renderer test files and commit:

```bash
git add app/main.js app/renderer/index.html app/renderer/styles.css tests/unit/renderer.test.js
git commit -m "ui: move brand into header and increase window height"
```
