const test = require("node:test");
const assert = require("node:assert/strict");

const { createActionRunner } = require("../lib/test-case-action-runner");

function createTestInfo() {
  const attachments = [];

  return {
    attachments,
    async attach(name, payload) {
      attachments.push({ name, ...payload });
    },
  };
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
  assert.equal(testInfo.attachments[0].contentType, "application/json");
  assert.equal(testInfo.attachments[1].contentType, "application/json");
});
