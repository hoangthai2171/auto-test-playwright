const { compileTestCase } = require("./test-case-compiler");
const { expect } = require("playwright/test");

function attachJson(testInfo, name, value) {
  if (!testInfo || typeof testInfo.attach !== "function") return Promise.resolve();

  return testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

function actionName(action) {
  return action.action;
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function createActionRunner({ handlers = {}, stepRunner }) {
  if (typeof stepRunner !== "function") {
    throw new TypeError("stepRunner must be a function");
  }

  return async function runActionRunner(page, testInfo, testCase, options = {}) {
    const compiledTestCase = compileTestCase(testCase);
    const steps = [];
    const result = {
      testCaseId: String(testCase.id),
      name: testCase.name,
      status: "passed",
      source: options.source || "local",
      steps,
      expectedResult: testCase.expectedResult || "",
    };

    await attachJson(testInfo, "test-case.json", testCase);
    await attachJson(testInfo, "normalized-actions.json", compiledTestCase.actions);

    for (const action of compiledTestCase.actions) {
      if (typeof handlers[actionName(action)] !== "function") {
        throw new Error(`Missing handler for action "${actionName(action)}"`);
      }
    }

    for (const [index, action] of compiledTestCase.actions.entries()) {
      const label = actionName(action);
      const step = {
        index,
        action: label,
        status: "passed",
        durationMs: 0,
        message: "",
      };
      const startedAt = Date.now();

      try {
        await stepRunner(page, testInfo, label, () =>
          handlers[label]({ page, testInfo, action, testCase: compiledTestCase, options })
        );
        step.durationMs = Date.now() - startedAt;
      } catch (error) {
        step.status = "failed";
        step.durationMs = Date.now() - startedAt;
        step.message = errorMessage(error);
        result.status = "failed";
        steps.push(step);

        try {
          await attachJson(testInfo, "test-case-result.json", result);
        } catch (_attachmentError) {
          // Preserve the action error if reporting is unavailable.
        }

        throw error;
      }

      steps.push(step);
    }

    return result;
  };
}

function createDefaultActionHandlers({ helpers: actionHelpers }) {
  return {
    login: async ({ page, testInfo, action, options }) => {
      const account = {
        ...options,
        USERNAME: action.username,
        PASSWORD: action.password,
      };
      await actionHelpers.openAppAndEnterLoginPage(page, account, testInfo);
      await actionHelpers.loginWithAccount(page, account, testInfo);
      await actionHelpers.chooseFirstProfileAndEnterHome(page, testInfo);
      await actionHelpers.closeHomePopupsAndVerifyHome(page, testInfo);
    },
    open_service: ({ page, testInfo, action }) =>
      actionHelpers.openServiceFromLeftMenuOrAllServices(
        page,
        action.service,
        testInfo
      ),
    press_back: async ({ page, action }) => {
      for (let index = 0; index < (action.count || 1); index += 1) {
        await page.keyboard.press("Backspace");
      }
    },
    assert_screen: async ({ page, action }) => {
      await expect(page.locator("body")).toContainText(action.text);
    },
  };
}

async function runTestCase(page, testInfo, testCase, options = {}) {
  const handlers = options.handlers || createDefaultActionHandlers({
    helpers: options.helpers,
  });
  const stepRunner =
    options.stepRunner ||
    (async (_page, _testInfo, _label, callback) => callback());

  return createActionRunner({ handlers, stepRunner })(
    page,
    testInfo,
    testCase,
    options
  );
}

module.exports = {
  createActionRunner,
  createDefaultActionHandlers,
  runTestCase,
};
