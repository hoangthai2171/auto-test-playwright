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
    () => validateTestCaseList([{id: "malformed-actions", name: "Malformed", actions: {}}]),
    /actions must be an array/i
  );
});

test("normalizes null actions to the description fallback", () => {
  const [testCase] = validateTestCaseList([{
    id: "null-actions",
    name: "Description fallback",
    actions: null,
    qaDescription: "B1. Vào trang chủ",
  }]);

  assert.deepEqual(testCase.actions, []);
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
  assert.throws(
    () => validateTestCaseList([{id: "3", name: "null actions", actions: null}]),
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

test("validates named playback actions", () => {
  assert.deepEqual(
    validateAction({action: "play_content", name: "VTV1 HD", type: "channel"}),
    {action: "play_content", name: "VTV1 HD", type: "channel"}
  );
  assert.deepEqual(
    validateAction({action: "play_row", rowIndex: 2, count: 3}),
    {action: "play_row", rowIndex: 2, count: 3}
  );
  assert.deepEqual(
    validateAction({action: "play_row", rowName: "Phim song song"}),
    {action: "play_row", rowName: "Phim song song"}
  );
  assert.deepEqual(
    validateAction({action: "play_home_trailers"}),
    {action: "play_home_trailers"}
  );
  assert.throws(
    () => validateAction({action: "play_home_trailers", count: 2}),
    /unknown field.*count/i
  );
  assert.deepEqual(
    validateAction({action: "play_all_contents"}),
    {action: "play_all_contents"}
  );
  assert.deepEqual(
    validateAction({action: "play_all_contents", count: 12}),
    {action: "play_all_contents", count: 12}
  );
  assert.deepEqual(
    validateAction({action: "play_all_contents", rowCount: 3}),
    {action: "play_all_contents", rowCount: 3}
  );
});

test("validates global search actions", () => {
  assert.deepEqual(validateAction({action: "open_search"}), {action: "open_search"});
  assert.deepEqual(
    validateAction({action: "search_content", name: "Căn phòng tử thần", type: "movie"}),
    {action: "search_content", name: "Căn phòng tử thần", type: "movie"}
  );
  assert.deepEqual(
    validateAction({action: "play_search_result", type: "movie"}),
    {action: "play_search_result", type: "movie"}
  );
  assert.deepEqual(
    validateAction({action: "play_search_result"}),
    {action: "play_search_result"}
  );
});

test("rejects malformed playback action targets", () => {
  assert.throws(
    () => validateAction({action: "play_content", name: "VTV1 HD", type: "series"}),
    /type.*channel.*movie.*content/i
  );
  assert.throws(
    () => validateAction({action: "play_row", rowIndex: 0}),
    /rowIndex.*positive.*1-based/i
  );
  assert.throws(
    () => validateAction({action: "play_row", rowIndex: 1, rowName: "VTV"}),
    /exactly one.*rowIndex.*rowName/i
  );
  assert.throws(
    () => validateAction({action: "play_row", rowName: "VTV", count: 0}),
    /count.*positive/i
  );
  assert.throws(
    () => validateAction({action: "play_all_contents", count: 2, rowCount: 1}),
    /at most one.*count.*rowCount/i
  );
  assert.throws(
    () => validateAction({action: "play_all_contents", count: 0}),
    /count.*positive/i
  );
  assert.throws(
    () => validateAction({action: "play_all_contents", rowCount: -1}),
    /rowCount.*positive/i
  );
  assert.throws(
    () => validateAction({action: "play_all_contents", rowName: "VTV"}),
    /unknown field.*rowName/i
  );
});

test("requires text for assert_screen", () => {
  assert.throws(
    () => validateAction({ action: "assert_screen", text: "" }),
    /text/i
  );
});

test("validates the named focus and remote OK actions", () => {
  assert.deepEqual(
    validateAction({action: "focus_row", rowName: "Thịnh hành"}),
    {action: "focus_row", rowName: "Thịnh hành"}
  );
  assert.deepEqual(
    validateAction({action: "focus_row", rowName: "HTV", itemIndex: 4}),
    {action: "focus_row", rowName: "HTV", itemIndex: 4}
  );
  assert.deepEqual(
    validateAction({action: "focus_text", text: "Xem ngay"}),
    {action: "focus_text", text: "Xem ngay"}
  );
  assert.deepEqual(validateAction({action: "press_ok"}), {action: "press_ok"});
  assert.throws(
    () => validateAction({action: "focus_text", text: ""}),
    /text.*non-empty/i
  );
  assert.throws(
    () => validateAction({action: "focus_row", rowName: ""}),
    /rowName.*non-empty/i
  );
  assert.throws(
    () => validateAction({action: "focus_row", rowName: "HTV", itemIndex: 0}),
    /itemIndex.*positive.*1-based/i
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
