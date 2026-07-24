const test = require("node:test");
const assert = require("node:assert/strict");

const {logoutApp} = require("../lib/app-cleanup");

test("calls and awaits the app logout function", async () => {
  const calls = [];
  const originalWindow = global.window;
  global.window = {
    async processLogOut() {
      calls.push("logout-start");
      await Promise.resolve();
      calls.push("logout-end");
    },
  };

  try {
    const result = await logoutApp({
      isClosed: () => false,
      evaluate: (callback) => callback(),
    });

    assert.deepEqual(result, {status: "passed"});
    assert.deepEqual(calls, ["logout-start", "logout-end"]);
  } finally {
    global.window = originalWindow;
  }
});

test("fails when the app logout function is unavailable", async () => {
  const originalWindow = global.window;
  global.window = {};

  try {
    await assert.rejects(
      () =>
        logoutApp({
          isClosed: () => false,
          evaluate: (callback) => callback(),
        }),
      /window\.processLogOut is not available/
    );
  } finally {
    global.window = originalWindow;
  }
});

test("skips cleanup when the page is already closed", async () => {
  let evaluated = false;

  const result = await logoutApp({
    isClosed: () => true,
    evaluate: async () => {
      evaluated = true;
    },
  });

  assert.deepEqual(result, {status: "skipped", reason: "page-closed"});
  assert.equal(evaluated, false);
});
