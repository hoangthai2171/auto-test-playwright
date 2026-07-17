const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateTestCaseList,
  validateAction,
} = require("../lib/test-case-schema");

test("validates a server-shaped list and preserves explicit actions", () => {
  const cases = validateTestCaseList(
    [
      {
        id: "12066",
        name: "Vào phim truyện",
        qaDescription: "B1. Vào dịch vụ phim truyện",
        actions: [{ action: "open_service", service: "Phim truyện" }],
      },
    ],
    "fixture"
  );

  assert.equal(cases[0].id, "12066");
  assert.deepEqual(cases[0].actions, [
    { action: "open_service", service: "Phim truyện" },
  ]);
});

test("rejects an unknown action", () => {
  assert.throws(
    () =>
      validateAction(
        { action: "execute_javascript" },
        "testCases[0].actions[0]"
      ),
    /unsupported action.*execute_javascript/i
  );
});

