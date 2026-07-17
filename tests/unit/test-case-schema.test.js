const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateTestCaseList,
  validateAction,
  normalizeTestCase,
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

test("rejects undeclared action fields", () => {
  assert.throws(
    () => validateAction({action: "open_home", selector: "#home"}),
    /unknown field.*selector/i
  );
});

test("requires id and name", () => {
  assert.throws(
    () => validateTestCaseList([{ name: "missing id", actions: [] }]),
    /id/i
  );
  assert.throws(
    () => validateTestCaseList([{ id: "1", actions: [] }]),
    /name/i
  );
});

test("rejects malformed actions values", () => {
  assert.throws(
    () => validateTestCaseList([{id: "null-actions", name: "Malformed", actions: null}]),
    /actions must be an array/i
  );
});

test("requires actions or qaDescription", () => {
  assert.throws(
    () => validateTestCaseList([{ id: "1", name: "empty" }]),
    /actions|qaDescription/i
  );
  assert.throws(
    () => validateTestCaseList([{id: "2", name: "empty actions", actions: []}]),
    /actions.*qaDescription|qaDescription.*actions/i
  );
});

test("normalizes numeric ids and clones actions without mutating source data", () => {
  const source = [
    {
      id: 12066,
      name: "Case",
      actions: [{ action: "open_home" }],
    },
  ];

  const [item] = validateTestCaseList(source);

  assert.equal(item.id, "12066");
  assert.equal(item.platform, undefined);
  assert.notStrictEqual(item, source[0]);
  assert.notStrictEqual(item.actions, source[0].actions);
  assert.notStrictEqual(item.actions[0], source[0].actions[0]);

  item.actions[0].action = "login";
  assert.equal(source[0].actions[0].action, "open_home");
});

test("normalizes a standalone test case without mutating its action objects", () => {
  const source = {
    id: 7,
    name: "Standalone case",
    actions: [{ action: "open_home" }],
  };

  const item = normalizeTestCase(source);

  assert.equal(item.id, "7");
  assert.notStrictEqual(item, source);
  assert.notStrictEqual(item.actions, source.actions);
  assert.notStrictEqual(item.actions[0], source.actions[0]);
});

test("requires non-empty login credentials", () => {
  assert.throws(
    () => validateAction({ action: "login", username: "", password: "secret" }),
    /username/i
  );
  assert.throws(
    () => validateAction({ action: "login", username: "user", password: "" }),
    /password/i
  );
});

test("requires a service for open_service", () => {
  assert.throws(
    () => validateAction({ action: "open_service", service: "" }),
    /service/i
  );
});

test("requires text for assert_screen", () => {
  assert.throws(
    () => validateAction({ action: "assert_screen", text: "" }),
    /text/i
  );
});

test("accepts only non-negative integer press_back counts", () => {
  assert.doesNotThrow(() => validateAction({ action: "press_back" }));
  assert.doesNotThrow(() =>
    validateAction({ action: "press_back", count: 0 })
  );
  assert.throws(
    () => validateAction({ action: "press_back", count: -1 }),
    /count/i
  );
  assert.throws(
    () => validateAction({ action: "press_back", count: 1.5 }),
    /count/i
  );
});

test("accepts only known wait_for_ready names", () => {
  for (const name of ["app", "home", "content", "player"]) {
    assert.doesNotThrow(() => validateAction({ action: "wait_for_ready", name }));
  }

  assert.throws(
    () => validateAction({ action: "wait_for_ready", name: "unknown" }),
    /name/i
  );
});

test("allows open_home without parameters", () => {
  assert.deepEqual(validateAction({ action: "open_home" }), {
    action: "open_home",
  });
});
