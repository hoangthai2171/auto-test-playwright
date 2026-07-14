const DEFAULT_BATCH_MAX_ITEMS = 10;
const DEFAULT_BATCH_RUNTIME_BUDGET_MS = 120000;

function hasExplicitItemLimit(options) {
  return Object.prototype.hasOwnProperty.call(options, "itemLimit") &&
    options.itemLimit !== undefined &&
    options.itemLimit !== null &&
    options.itemLimit !== "";
}

function normalizeBatchLimits(options = {}) {
  const explicitItemLimit = hasExplicitItemLimit(options);
  const rawItemLimit = explicitItemLimit ? Number(options.itemLimit) : NaN;
  const legacyMaxItems = Number(options.maxItems);

  if (explicitItemLimit && Number.isFinite(rawItemLimit) && rawItemLimit >= 0) {
    return {
      itemLimit: Math.floor(rawItemLimit),
      maxItems: rawItemLimit === 0 ? Number.POSITIVE_INFINITY : Math.floor(rawItemLimit),
      explicitItemLimit: true,
    };
  }

  if (!explicitItemLimit && Number.isFinite(legacyMaxItems) && legacyMaxItems > 0) {
    return {
      itemLimit: Math.floor(legacyMaxItems),
      maxItems: Math.floor(legacyMaxItems),
      explicitItemLimit: false,
      legacyMaxItems: true,
    };
  }

  return {
    itemLimit: DEFAULT_BATCH_MAX_ITEMS,
    maxItems: DEFAULT_BATCH_MAX_ITEMS,
    explicitItemLimit: false,
  };
}

function createBatchBudget(options = {}) {
  const clock = typeof options.now === "function" ? options.now : () => Date.now();
  const startedAt = Number.isFinite(options.startedAt) ? options.startedAt : clock();
  const limits = normalizeBatchLimits(options);
  const configuredBudgetMs = Number(options.runtimeBudgetMs);
  const runtimeBudgetMs = Number.isFinite(configuredBudgetMs) && configuredBudgetMs > 0
    ? configuredBudgetMs
    : DEFAULT_BATCH_RUNTIME_BUDGET_MS;

  function elapsedMs() {
    return Math.max(0, clock() - startedAt);
  }

  function canStart({completed = 0, attempted = 0, estimatedDurationMs = 0} = {}) {
    if (attempted >= limits.maxItems || completed >= limits.maxItems) {
      return {allowed: false, reason: "item-limit"};
    }

    const elapsed = elapsedMs();
    const estimated = Math.max(0, Number(estimatedDurationMs) || 0);
    if (elapsed >= runtimeBudgetMs || elapsed + estimated > runtimeBudgetMs) {
      return {allowed: false, reason: "runtime-budget", elapsedMs: elapsed};
    }

    return {allowed: true, reason: "within-budget", elapsedMs: elapsed};
  }

  function report({completed = 0, attempted = 0, reason = "", budgetLimited = false} = {}) {
    return {
      completed,
      attempted,
      elapsedMs: elapsedMs(),
      budgetMs: runtimeBudgetMs,
      itemLimit: limits.itemLimit,
      maxItems: Number.isFinite(limits.maxItems) ? limits.maxItems : null,
      budgetLimited: Boolean(budgetLimited),
      reason,
    };
  }

  return {
    ...limits,
    startedAt,
    runtimeBudgetMs,
    elapsedMs,
    canStart,
    report,
  };
}

module.exports = {
  DEFAULT_BATCH_MAX_ITEMS,
  DEFAULT_BATCH_RUNTIME_BUDGET_MS,
  normalizeBatchLimits,
  createBatchBudget,
};
