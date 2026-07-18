# Test Case Details Actions Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the complete ordered Action list in the Test Case Details modal as one slightly darker value block.

**Architecture:** Keep the renderer's existing `.action-preview` ordered list and action formatting unchanged. Add presentation-only surface styles to that list so numbering, monospace text, whitespace, and wrapping continue to work.

**Tech Stack:** Electron renderer CSS, CommonJS Node test runner, Node `fs` assertions.

## Global Constraints

- Keep the Action list grouped as one field-level block.
- Preserve action numbering, monospace text, whitespace preservation, and wrapping.
- Do not change renderer logic, IPC, data, or modal dimensions.
- Do not execute deployment scripts under `bash-script/`.

---

### Task 1: Add the failing Action-list stylesheet contract test

**Files:**
- Modify: `tests/unit/renderer.test.js` after the existing detail-value stylesheet test

**Interfaces:**
- Consumes: `app/renderer/styles.css` as plain text.
- Produces: A regression test requiring `.action-preview` to have a darker block surface while retaining its ordered-list layout.

- [ ] **Step 1: Write the failing test**

Append this test:

```js
test("styles the action preview as a grouped readable block", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "../../app/renderer/styles.css"),
    "utf8"
  );

  assert.match(css, /\.action-preview\s*\{[^}]*display:\s*grid;[^}]*padding:\s*8px 10px 8px 32px;[^}]*border:\s*1px solid #2b313d;[^}]*border-radius:\s*6px;[^}]*background:\s*#1a1e27;/s);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk test node --test tests/unit/renderer.test.js
```

Expected: the new test fails because `.action-preview` currently has only layout, gap, margin, and left-padding declarations.

### Task 2: Add the grouped Action-list block styling

**Files:**
- Modify: `app/renderer/styles.css:327-332`

**Interfaces:**
- Consumes: The ordered list created as `.action-preview` by `renderCaseDetails()` in `app/renderer/renderer.js`.
- Produces: One darker field-level block containing the numbered actions.

- [ ] **Step 1: Write the minimal implementation**

Update `.action-preview` to:

```css
.action-preview {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 8px 10px 8px 32px;
  border: 1px solid #2b313d;
  border-radius: 6px;
  background: #1a1e27;
}
```

The larger left padding keeps ordered-list markers readable inside the block.

- [ ] **Step 2: Run the focused test to verify it passes**

Run:

```bash
rtk test node --test tests/unit/renderer.test.js
```

Expected: all renderer tests pass, including `styles the action preview as a grouped readable block`.

### Task 3: Verify and commit

**Files:**
- Modify: `tests/unit/renderer.test.js`
- Modify: `app/renderer/styles.css`

- [ ] **Step 1: Run the full verification commands**

Run:

```bash
rtk npm run test:unit
rtk proxy node --check app/renderer/renderer.js
rtk git diff --check
```

Expected: 95 unit tests pass, the renderer syntax check exits successfully, and `git diff --check` prints no errors.

- [ ] **Step 2: Commit the change**

```bash
rtk git add app/renderer/styles.css tests/unit/renderer.test.js docs/superpowers/specs/2026-07-18-test-case-details-actions-block-design.md docs/superpowers/plans/2026-07-18-test-case-details-actions-block.md
rtk git commit -m "ui: style test case actions block"
```
