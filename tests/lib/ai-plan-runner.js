const fs = require("node:fs/promises");
const {
  runStep,
  openServiceFromLeftMenuOrAllServices,
  playAllItemsInFirstRow,
} = require("./mytv-helpers");

async function loadAiPlan(planPath) {
  if (!planPath) {
    throw new Error("AI_PLAN_PATH is required for ai-plan-mytv.");
  }

  const raw = await fs.readFile(planPath, "utf8");
  return validatePlan(JSON.parse(raw));
}

async function runAiPlan(page, testInfo, plan) {
  await testInfo.attach("ai-plan.json", {
    body: JSON.stringify(plan, null, 2),
    contentType: "application/json",
  });

  for (const step of plan.steps) {
    if (step.action === "open_service") {
      await runStep(page, testInfo, `AI: open service ${step.serviceName}`, async () => {
        await openServiceFromLeftMenuOrAllServices(page, step.serviceName, testInfo);
      });
      continue;
    }

    if (step.action === "play_all_items_in_first_row") {
      const rowLabel =
        step.rowName || (step.rowPosition === "last" ? "last row" : Number.isInteger(step.rowIndex) ? `row ${step.rowIndex + 1}` : "first row");
      await runStep(page, testInfo, `AI: play items in ${rowLabel}`, async () => {
        await playAllItemsInFirstRow(page, testInfo, {
          waitSeconds: step.waitSeconds || 6,
          backPresses: step.backPresses || 2,
          rowName: step.rowName || "",
          rowIndex: step.rowIndex,
          rowPosition: step.rowPosition,
          itemLimit: step.itemLimit,
          runtimeBudgetMs: step.runtimeBudgetMs,
        });
      });
      continue;
    }

    throw new Error(`Unsupported AI plan action: ${step.action}`);
  }
}

function validatePlan(plan) {
  const allowedActions = new Set(["open_service", "play_all_items_in_first_row"]);
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error("AI plan is invalid: steps must be a non-empty array.");
  }

  for (const step of plan.steps) {
    if (!allowedActions.has(step.action)) {
      throw new Error(`Unsupported AI plan action: ${step.action}`);
    }

    if (step.action === "open_service" && !step.serviceName) {
      throw new Error("open_service step requires serviceName.");
    }
  }

  return plan;
}

module.exports = {
  loadAiPlan,
  runAiPlan,
};
