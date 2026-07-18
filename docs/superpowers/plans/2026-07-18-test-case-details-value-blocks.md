# Test Case Details Value Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each Test Case Details modal value easier to scan by rendering it as a padded, slightly darker block.

**Architecture:** Keep the existing renderer-generated `.test-case-detail-row` markup and data flow. Add presentation-only styles to the existing `.test-case-detail-row span` selector; labels, modal layout, scrolling, masking, and IPC remain unchanged.

**Tech Stack:** Electron renderer HTML/CSS, CommonJS Node test runner, Node `fs` assertions.

## Global Constraints

- Keep the existing field labels and values unchanged.
- Preserve whitespace and wrapping for multiline descriptions, JSON metadata, and action previews.
- Do not change renderer logic, IPC, cache behavior, or modal dimensions.
- Do not execute deployment scripts under `bash-script/`.

---

### Task 1: Add the failing stylesheet contract test

**Files:**
- Modify: `tests/unit/renderer.test.js` near the existing stylesheet contract tests

**Interfaces:**
- Consumes: `app/renderer/styles.css` as plain text.
- Produces: A regression test requiring the existing detail-value selector to render a block with darker background, border, padding, and wrapping.

- [ ] **Step 1: Write the failing test**

Append this test after the existing `.test-case-table-wrap` stylesheet test:

```js
test("styles each test-case detail value as a readable block", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "../../app/renderer/styles.css"),
    "utf8"
  );

  assert.match(css, /\.test-case-detail-row span\s*\{[^}]*display:\s*block;[^}]*padding:\s*8px 10px;[^}]*border:\s*1px solid #2b313d;[^}]*border-radius:\s*6px;[^}]*background:\s*#1a1e27;[^}]*white-space:\s*pre-wrap;[^}]*word-break:\s*break-word;/s);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk test node --test tests/unit/renderer.test.js
```

Expected: the new test fails because the current `.test-case-detail-row span` rule has wrapping only and no display, block surface, border, or padding declarations.

### Task 2: Add the value block styling

**Files:**
- Modify: `app/renderer/styles.css:317-320`

**Interfaces:**
- Consumes: Existing `.test-case-detail-row span` elements created by `renderField()` in `app/renderer/renderer.js`.
- Produces: A visual block for every field value in the Test Case Details modal.

- [ ] **Step 1: Write the minimal implementation**

Replace the existing selector body with:

```css
.test-case-detail-row span {
  display: block;
  padding: 8px 10px;
  border: 1px solid #2b313d;
  border-radius: 6px;
  background: #1a1e27;
  white-space: pre-wrap;
  word-break: break-word;
}
```

This keeps the existing wrapping behavior and adds only the requested visual distinction.

- [ ] **Step 2: Run the focused test to verify it passes**

Run:

```bash
rtk test node --test tests/unit/renderer.test.js
```

Expected: all renderer tests pass, including `styles each test-case detail value as a readable block`.

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

Expected: 93 existing unit tests plus the new stylesheet test pass, the renderer syntax check exits successfully, and `git diff --check` prints no errors.

- [ ] **Step 2: Commit the change**

```bash
rtk git add app/renderer/styles.css tests/unit/renderer.test.js docs/superpowers/specs/2026-07-18-test-case-details-value-blocks-design.md docs/superpowers/plans/2026-07-18-test-case-details-value-blocks.md
rtk git commit -m "ui: improve test case detail value clarity"
```
