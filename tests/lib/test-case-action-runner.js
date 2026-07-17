const { compileTestCase } = require("./test-case-compiler");
const workflows = require("./workflows");
const { normalizeVietnameseText } = require("./text-utils");

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

    await attachJson(testInfo, "test-case-result.json", result);
    return result;
  };
}

async function resolveReadyWait(helpers, page, testInfo, name) {
  switch (name) {
    case "app":
      return workflows.__internal.waitForAppReady(page, testInfo);
    case "home":
      return workflows.__internal.waitForHomeReady(page, testInfo);
    case "content":
      return helpers.waitForContentVisible(page, {
        name: "action-content-ready",
        testInfo,
        getContentState: workflows.__internal.observeVisibleContentRows,
        getFocusedState: helpers.getFocusedState,
      });
    case "player":
      return helpers.waitForPlayerReady(page, {
        name: "action-player-ready",
        testInfo,
        getVisiblePopup: helpers.__internal.getVisiblePopup,
        getPlayerState: helpers.getPlayerState,
      });
    default:
      throw new Error(`Unsupported readiness target: ${name}`);
  }
}

function createDefaultActionHandlers({ helpers }) {
  return {
    login: async ({ page, testInfo, action, options }) => {
      const account = {
        ...options,
        USERNAME: action.username,
        PASSWORD: action.password,
      };
      await helpers.openAppAndEnterLoginPage(page, account, testInfo);
      await helpers.loginWithAccount(page, account, testInfo);
      await helpers.chooseFirstProfileAndEnterHome(page, testInfo);
      await helpers.closeHomePopupsAndVerifyHome(page, testInfo);
    },
    open_home: ({ page, testInfo }) =>
      workflows.__internal.waitForHomeReady(page, testInfo),
    open_service: ({ page, testInfo, action }) =>
      helpers.openServiceFromLeftMenuOrAllServices(
        page,
        action.service,
        testInfo
      ),
    press_back: async ({ page, action }) => {
      for (let index = 0; index < (action.count ?? 1); index += 1) {
        await page.keyboard.press("Backspace");
      }
    },
    assert_screen: async ({ page, action }) => {
      const expected = normalizeVietnameseText(action.text);
      const visible = await page.evaluate((needle) => {
        const normalize = (value) => value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/gi, "d")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        return Array.from(document.querySelectorAll("body *")).some((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            normalize(element.innerText || "").includes(needle)
          );
        });
      }, expected);
      if (!visible) {
        throw new Error(`Visible screen text not found: ${action.text}`);
      }
    },
    wait_for_ready: ({ page, testInfo, action }) =>
      resolveReadyWait(helpers, page, testInfo, action.name),
  };
}

async function runTestCase(page, testInfo, testCase, options = {}) {
  const helpers = options.helpers || require("./mytv-helpers");
  const handlers = options.handlers || createDefaultActionHandlers({ helpers });
  const stepRunner = options.stepRunner || helpers.runStep;

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
