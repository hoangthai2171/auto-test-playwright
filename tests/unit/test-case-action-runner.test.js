const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createActionRunner,
  createDefaultActionHandlers,
  runTestCase,
  assertVisibleScreenText,
} = require("../lib/test-case-action-runner");
const defaultHelpers = require("../lib/mytv-helpers");
const workflows = require("../lib/workflows");

function createTestInfo() {
  const attachments = [];

  return {
    attachments,
    async attach(name, payload) {
      attachments.push({ name, ...payload });
    },
  };
}

function createHandlerHelpers(overrides = {}) {
  return {
    openAppAndEnterLoginPage: async () => {},
    loginWithAccount: async () => {},
    chooseFirstProfileAndEnterHome: async () => {},
    closeHomePopupsAndVerifyHome: async () => {},
    openServiceFromLeftMenuOrAllServices: async () => {},
    waitForContentVisible: async () => {},
    waitForPlayerReady: async () => {},
    getFocusedState: async () => ({ id: "focused" }),
    getPlayerState: async () => ({
      hasVideo: true,
      isProbablyPlaying: true,
    }),
    __internal: {
      getVisiblePopup: async () => null,
    },
    ...overrides,
  };
}

function replaceWorkflowInternals(overrides) {
  const originals = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, workflows.__internal[key]])
  );
  Object.assign(workflows.__internal, overrides);

  return () => Object.assign(workflows.__internal, originals);
}

test("runs each declared action through its handler in order", async () => {
  const events = [];
  const page = { id: "page" };
  const testInfo = createTestInfo();
  const testCase = {
    id: "12066",
    name: "Vào phim truyện",
    actions: [
      { action: "open_home" },
      { action: "open_service", service: "Phim truyện" },
    ],
  };
  const runTestCase = createActionRunner({
    handlers: {
      open_home: async (context) => {
        events.push(`handler:${context.action.action}`);
        assert.equal(context.page, page);
        assert.equal(context.testInfo, testInfo);
        assert.equal(context.testCase.name, testCase.name);
        assert.deepEqual(context.options, { source: "server" });
      },
      open_service: async ({ action }) => {
        events.push(`handler:${action.action}:${action.service}`);
      },
    },
    stepRunner: async (_page, _testInfo, label, callback) => {
      events.push(`step:${label}`);
      return callback();
    },
  });

  const result = await runTestCase(page, testInfo, testCase, {
    source: "server",
  });

  assert.deepEqual(events, [
    "step:open_home",
    "handler:open_home",
    "step:open_service",
    "handler:open_service:Phim truyện",
  ]);
  assert.equal(result.testCaseId, "12066");
  assert.equal(result.status, "passed");
  assert.equal(result.source, "server");
  assert.deepEqual(result.steps.map(({ index, action, status, message }) => ({
    index,
    action,
    status,
    message,
  })), [
    { index: 0, action: "open_home", status: "passed", message: "" },
    { index: 1, action: "open_service", status: "passed", message: "" },
  ]);
});

test("fails before execution when an action handler is missing", async () => {
  const events = [];
  const runTestCase = createActionRunner({
    handlers: {
      open_home: async () => events.push("handler:open_home"),
    },
    stepRunner: async (_page, _testInfo, label, callback) => {
      events.push(`step:${label}`);
      return callback();
    },
  });

  await assert.rejects(
    () =>
      runTestCase(
        {},
        createTestInfo(),
        {
          id: "missing-handler",
          name: "Missing handler",
          actions: [
            { action: "open_home" },
            { action: "open_service", service: "Phim truyện" },
          ],
        }
      ),
    /open_service/
  );
  assert.deepEqual(events, []);
});

test("records and attaches a failed step before rethrowing the original error", async () => {
  const error = new Error("service navigation failed");
  const testInfo = createTestInfo();
  const time = [100, 107];
  const originalDateNow = Date.now;
  Date.now = () => time.shift();

  try {
    const runTestCase = createActionRunner({
      handlers: {
        open_service: async () => {
          throw error;
        },
      },
      stepRunner: async (page, receivedTestInfo, label, callback) => {
        assert.deepEqual([page, receivedTestInfo, label], [
          { id: "page" },
          testInfo,
          "open_service",
        ]);
        return callback();
      },
    });

    let caught;
    try {
      await runTestCase(
        { id: "page" },
        testInfo,
        {
          id: "failure-case",
          name: "Failure case",
          actions: [{ action: "open_service", service: "Phim truyện" }],
        }
      );
    } catch (caughtError) {
      caught = caughtError;
    }

    assert.strictEqual(caught, error);
    const resultAttachment = testInfo.attachments.find(
      ({ name }) => name === "test-case-result.json"
    );
    assert.ok(resultAttachment);
    assert.deepEqual(JSON.parse(resultAttachment.body), {
      testCaseId: "failure-case",
      name: "Failure case",
      status: "failed",
      source: "local",
      steps: [{
        index: 0,
        action: "open_service",
        status: "failed",
        durationMs: 7,
        message: "service navigation failed",
      }],
      expectedResult: "",
    });
  } finally {
    Date.now = originalDateNow;
  }
});

test("attaches the original case and compiled action payloads", async () => {
  const testInfo = createTestInfo();
  const originalCase = {
    id: 12066,
    name: "Compiled home case",
    qaDescription: "B1. Vào trang chủ",
    expectedResult: "Home is visible",
  };
  const runTestCase = createActionRunner({
    handlers: {
      open_home: async () => {},
    },
    stepRunner: async (_page, _testInfo, _label, callback) => callback(),
  });

  const result = await runTestCase({}, testInfo, originalCase);

  assert.equal(result.expectedResult, "Home is visible");
  assert.deepEqual(
    JSON.parse(testInfo.attachments.find(({ name }) => name === "test-case.json").body),
    originalCase
  );
  assert.deepEqual(
    JSON.parse(
      testInfo.attachments.find(({ name }) => name === "normalized-actions.json").body
    ),
    [{ action: "open_home" }]
  );
  assert.deepEqual(
    JSON.parse(
      testInfo.attachments.find(({ name }) => name === "test-case-result.json").body
    ),
    {
      testCaseId: "12066",
      name: "Compiled home case",
      status: "passed",
      source: "local",
      steps: [{
        index: 0,
        action: "open_home",
        status: "passed",
        durationMs: 0,
        message: "",
      }],
      expectedResult: "Home is visible",
    }
  );
  assert.equal(testInfo.attachments[0].contentType, "application/json");
  assert.equal(testInfo.attachments[1].contentType, "application/json");
});

test("creates exactly the default handlers and logs in with action credentials in helper order", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const options = {
    APP_URL: "https://example.test/",
    USERNAME: "environment-user",
    PASSWORD: "environment-password",
    source: "server",
  };
  const action = {
    action: "login",
    username: "case-user",
    password: "case-password",
  };
  const helpers = createHandlerHelpers({
    openAppAndEnterLoginPage: async (...args) => {
      calls.push(["openAppAndEnterLoginPage", ...args]);
    },
    loginWithAccount: async (...args) => {
      calls.push(["loginWithAccount", ...args]);
    },
    chooseFirstProfileAndEnterHome: async (...args) => {
      calls.push(["chooseFirstProfileAndEnterHome", ...args]);
    },
    closeHomePopupsAndVerifyHome: async (...args) => {
      calls.push(["closeHomePopupsAndVerifyHome", ...args]);
    },
  });
  const handlers = createDefaultActionHandlers({ helpers });
  const account = {
    ...options,
    USERNAME: action.username,
    PASSWORD: action.password,
  };

  assert.deepEqual(Object.keys(handlers).sort(), [
    "assert_screen",
    "login",
    "open_home",
    "open_service",
    "press_back",
    "wait_for_ready",
  ]);

  await handlers.login({ page, testInfo, action, options });

  assert.deepEqual(calls, [
    ["openAppAndEnterLoginPage", page, account, testInfo],
    ["loginWithAccount", page, account, testInfo],
    ["chooseFirstProfileAndEnterHome", page, testInfo],
    ["closeHomePopupsAndVerifyHome", page, testInfo],
  ]);
});

test("opens a service with the action service and test context", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const helpers = createHandlerHelpers({
    openServiceFromLeftMenuOrAllServices: async (...args) => {
      calls.push(args);
    },
  });
  const handlers = createDefaultActionHandlers({ helpers });

  await handlers.open_service({
    page,
    testInfo,
    action: { action: "open_service", service: "Phim truyện" },
  });

  assert.deepEqual(calls, [[page, "Phim truyện", testInfo]]);
});

test("presses Backspace sequentially for every requested back press", async () => {
  const events = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });
  const page = {
    keyboard: {
      async press(key) {
        events.push(`start:${key}`);
        await Promise.resolve();
        events.push(`end:${key}`);
      },
    },
  };

  await handlers.press_back({
    page,
    action: { action: "press_back", count: 3 },
  });

  assert.deepEqual(events, [
    "start:Backspace",
    "end:Backspace",
    "start:Backspace",
    "end:Backspace",
    "start:Backspace",
    "end:Backspace",
  ]);
});

test("presses Backspace once when the action count is omitted", async () => {
  const events = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });
  const page = {
    keyboard: {
      async press(key) {
        events.push(key);
      },
    },
  };

  await handlers.press_back({
    page,
    action: { action: "press_back" },
  });

  assert.deepEqual(events, ["Backspace"]);
});

test("does not press Backspace when the action count is zero", async () => {
  const events = [];
  const handlers = createDefaultActionHandlers({helpers: createHandlerHelpers()});
  await handlers.press_back({
    page: {keyboard: {press: async (key) => events.push(key)}},
    action: {action: "press_back", count: 0},
  });
  assert.deepEqual(events, []);
});

test("asserts that the page body contains the requested screen text", async () => {
  const calls = [];
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });
  const page = {
    async evaluate(callback, expected) {
      calls.push([callback, expected]);
      return true;
    },
  };

  await handlers.assert_screen({
    page,
    action: { action: "assert_screen", text: "Trang chủ" },
  });

  assert.equal(typeof calls[0][0], "function");
  assert.equal(calls[0][1], "trang chu");
});

test("rejects screen text that exists only in hidden content", async () => {
  const page = {
    async evaluate() {
      return false;
    },
  };

  await assert.rejects(
    () => assertVisibleScreenText(page, "Trang chủ", {timeoutMs: 1, pollIntervalMs: 1}),
    /Timeout.*predicate|Expected: true/s
  );
});

test("retries screen assertions while the page becomes ready", async () => {
  let evaluations = 0;
  const page = {
    async evaluate() {
      evaluations += 1;
      return evaluations > 1;
    },
  };

  await assertVisibleScreenText(page, "Trang chủ", {timeoutMs: 1000, pollIntervalMs: 1});
  assert.ok(evaluations > 1);
});

test("waits for app readiness through the workflow helper", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const restore = replaceWorkflowInternals({
    waitForAppReady: async (...args) => {
      calls.push(args);
    },
  });

  try {
    const handlers = createDefaultActionHandlers({
      helpers: createHandlerHelpers(),
    });

    await handlers.wait_for_ready({
      page,
      testInfo,
      action: { action: "wait_for_ready", name: "app" },
    });
  } finally {
    restore();
  }

  assert.deepEqual(calls, [[page, testInfo]]);
});

test("waits for home readiness through the workflow helper", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const restore = replaceWorkflowInternals({
    waitForHomeReady: async (...args) => {
      calls.push(args);
    },
  });

  try {
    const handlers = createDefaultActionHandlers({
      helpers: createHandlerHelpers(),
    });

    await handlers.wait_for_ready({
      page,
      testInfo,
      action: { action: "wait_for_ready", name: "home" },
    });
  } finally {
    restore();
  }

  assert.deepEqual(calls, [[page, testInfo]]);
});

test("waits for content readiness with the visible-content observer", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const getContentState = async () => ({ visible: true });
  const restore = replaceWorkflowInternals({ observeVisibleContentRows: getContentState });
  const helpers = createHandlerHelpers({
    waitForContentVisible: async (...args) => {
      calls.push(args);
    },
  });

  try {
    const handlers = createDefaultActionHandlers({ helpers });

    await handlers.wait_for_ready({
      page,
      testInfo,
      action: { action: "wait_for_ready", name: "content" },
    });
  } finally {
    restore();
  }

  assert.deepEqual(calls, [[page, {
    name: "action-content-ready",
    testInfo,
    getContentState,
    getFocusedState: helpers.getFocusedState,
  }]]);
});

test("waits for player readiness with MyTV popup and player observers", async () => {
  const calls = [];
  const page = { id: "page" };
  const testInfo = { id: "test-info" };
  const getVisiblePopup = async () => null;
  const getPlayerState = async () => ({
    hasVideo: true,
    isProbablyPlaying: true,
  });
  const helpers = createHandlerHelpers({
    waitForPlayerReady: async (...args) => {
      calls.push(args);
    },
    getPlayerState,
    __internal: { getVisiblePopup },
  });
  const handlers = createDefaultActionHandlers({ helpers });

  await handlers.wait_for_ready({
    page,
    testInfo,
    action: { action: "wait_for_ready", name: "player" },
  });

  assert.deepEqual(calls, [[page, {
    name: "action-player-ready",
    testInfo,
    getVisiblePopup,
    getPlayerState,
  }]]);
});

test("rejects unsupported readiness targets", async () => {
  const handlers = createDefaultActionHandlers({
    helpers: createHandlerHelpers(),
  });

  await assert.rejects(
    () =>
      handlers.wait_for_ready({
        action: { action: "wait_for_ready", name: "unknown" },
      }),
    /Unsupported readiness target: unknown/
  );
});

test("runTestCase uses default handlers through the existing helpers.runStep", async () => {
  const events = [];
  const page = { id: "page" };
  const testInfo = createTestInfo();
  const originalRunStep = defaultHelpers.runStep;
  const restore = replaceWorkflowInternals({
    waitForHomeReady: async (...args) => {
      events.push(["waitForHomeReady", ...args]);
    },
  });
  defaultHelpers.runStep = async (_page, _testInfo, label, callback) => {
    events.push(["runStep", _page, _testInfo, label]);
    return callback();
  };

  try {
    const result = await runTestCase(page, testInfo, {
      id: "default-runner",
      name: "Default runner",
      actions: [{ action: "open_home" }],
    });

    assert.deepEqual(events, [
      ["runStep", page, testInfo, "open_home"],
      ["waitForHomeReady", page, testInfo],
    ]);
    assert.equal(result.status, "passed");
  } finally {
    defaultHelpers.runStep = originalRunStep;
    restore();
  }
});
