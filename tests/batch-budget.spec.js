const fs = require("fs");
const path = require("path");
const {test, expect} = require("playwright/test");
const {
  DEFAULT_BATCH_MAX_ITEMS,
  DEFAULT_BATCH_RUNTIME_BUDGET_MS,
  normalizeBatchLimits,
  createBatchBudget,
} = require("./lib/batch-budget");

test("batch limits default to 10 and preserve positive, zero, and legacy overrides", () => {
  expect(DEFAULT_BATCH_MAX_ITEMS).toBe(10);
  expect(DEFAULT_BATCH_RUNTIME_BUDGET_MS).toBeGreaterThan(0);
  expect(normalizeBatchLimits()).toMatchObject({itemLimit: 10, maxItems: 10});
  expect(normalizeBatchLimits({itemLimit: 3})).toMatchObject({itemLimit: 3, maxItems: 3, explicitItemLimit: true});
  expect(normalizeBatchLimits({itemLimit: 0})).toMatchObject({itemLimit: 0, maxItems: Infinity, explicitItemLimit: true});
  expect(normalizeBatchLimits({maxItems: 4})).toMatchObject({itemLimit: 4, maxItems: 4});
});

test("runtime budget stops before an over-budget item and reports partial work", () => {
  let now = 0;
  const budget = createBatchBudget({
    itemLimit: 0,
    runtimeBudgetMs: 100,
    startedAt: 0,
    now: () => now,
  });

  expect(budget.canStart({completed: 0, attempted: 0, estimatedDurationMs: 60}).allowed).toBe(true);
  now = 50;
  expect(budget.canStart({completed: 1, attempted: 1, estimatedDurationMs: 60})).toMatchObject({
    allowed: false,
    reason: "runtime-budget",
  });

  const report = budget.report({completed: 1, attempted: 1, reason: "runtime-budget", budgetLimited: true});
  expect(report).toMatchObject({
    completed: 1,
    attempted: 1,
    elapsedMs: 50,
    budgetMs: 100,
    budgetLimited: true,
    reason: "runtime-budget",
  });
});

test("item limit blocks another start without throwing", () => {
  const budget = createBatchBudget({itemLimit: 2, startedAt: 0, now: () => 0});
  expect(budget.canStart({completed: 0, attempted: 0}).allowed).toBe(true);
  expect(budget.canStart({completed: 2, attempted: 2})).toMatchObject({allowed: false, reason: "item-limit"});
});

test("active batch workflow uses the shared budget and preserves playback artifacts", () => {
  const workflows = fs.readFileSync(path.join(__dirname, "lib", "workflows.js"), "utf8");
  expect(workflows).toContain("createBatchBudget");
  expect(workflows).toContain("ai-first-row-playback-budget.json");
  expect(workflows).toContain("attachFirstRowPlaybackReport(testInfo, results)");
  expect(workflows).not.toContain("options.maxItems || 60");

  const main = fs.readFileSync(path.join(__dirname, "..", "app", "main.js"), "utf8");
  expect(main).toContain("Number.isFinite(itemLimit) && itemLimit >= 0");
});
