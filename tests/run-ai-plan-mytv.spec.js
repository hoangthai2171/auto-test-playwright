const { test } = require("./fixtures/mytv-session-fixture");
const { loadAiPlan, runAiPlan } = require("./lib/ai-plan-runner");

test("ai-plan-mytv", async ({ page, options }, testInfo) => {
  const plan = await loadAiPlan(options.AI_PLAN_PATH);
  await runAiPlan(page, testInfo, plan);
});
