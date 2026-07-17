const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compileTestCase,
  compileQaDescription,
} = require("../lib/test-case-compiler");

test("compiles a test case while preserving server metadata and actions", () => {
  const testCase = {
    id: "12066",
    name: "Vào phim truyện",
    qaDescription: "B1. Vào dịch vụ phim truyện",
    actions: [{ action: "open_service", service: "Phim truyện" }],
  };

  const compiled = compileTestCase(testCase);

  assert.equal(compiled.id, testCase.id);
  assert.equal(compiled.name, testCase.name);
  assert.equal(compiled.qaDescription, testCase.qaDescription);
  assert.deepEqual(compiled.actions, testCase.actions);
});

test("compiles login, home, and service Vietnamese steps", () => {
  const result = compileQaDescription(
    "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ\nB3. Vào dịch vụ phim truyện"
  );

  assert.deepEqual(result, [
    { action: "login", username: "ts1", password: "111222" },
    { action: "open_home" },
    { action: "open_service", service: "phim truyện" },
  ]);
});

test("compiles the description when actions is an empty array", () => {
  const result = compileTestCase({
    id: "2",
    name: "Description fallback",
    qaDescription: "B1. Vào trang chủ",
    actions: [],
  });

  assert.deepEqual(result.actions, [{ action: "open_home" }]);
});

test("rejects an empty action list without a description using the case id", () => {
  assert.throws(
    () =>
      compileTestCase({
        id: "empty-actions-case",
        name: "Empty actions",
        actions: [],
      }),
    /empty-actions-case.*actions/i
  );
});

test("does not parse a description when explicit actions are present", () => {
  const result = compileTestCase({
    id: "1",
    name: "Explicit",
    qaDescription: "B1. unsupported text",
    actions: [{ action: "open_home" }],
  });

  assert.deepEqual(result.actions, [{ action: "open_home" }]);
});

test("reports the original unsupported line and case id", () => {
  assert.throws(
    () =>
      compileTestCase({
        id: "12066",
        name: "Unsupported",
        qaDescription: "B1. Xóa toàn bộ dữ liệu",
      }),
    /12066.*Xóa toàn bộ dữ liệu/i
  );
});

test("compiles every supported back and readiness form", () => {
  const result = compileQaDescription(
    "B1. Quay lại\nB2. Quay về\nB3. Nhấn back\nB4. Chờ app\nB5. Chờ home\nB6. Chờ content\nB7. Chờ player"
  );

  assert.deepEqual(result, [
    { action: "press_back" },
    { action: "press_back" },
    { action: "press_back" },
    { action: "wait_for_ready", name: "app" },
    { action: "wait_for_ready", name: "home" },
    { action: "wait_for_ready", name: "content" },
    { action: "wait_for_ready", name: "player" },
  ]);
});

test("preserves literal punctuation in credential and service values", () => {
  const result = compileQaDescription(
    "B1. Đăng nhập app với tài khoản User_Đ/PaSS123.\nB2. Vào dịch vụ VTVcab ON)."
  );

  assert.deepEqual(result, [
    { action: "login", username: "User_Đ", password: "PaSS123." },
    { action: "open_service", service: "VTVcab ON)." },
  ]);
});

test("rejects the unsupported trang chu app form", () => {
  assert.throws(
    () =>
      compileQaDescription("B1. Vào trang chủ app", {
        caseId: "home-grammar-case",
      }),
    /home-grammar-case.*unsupported.*Vào trang chủ app/i
  );
});

test("does not treat command-like words inside a service label as ambiguous", () => {
  assert.deepEqual(
    compileQaDescription("B1. Vào dịch vụ Vào home"),
    [{ action: "open_service", service: "Vào home" }]
  );
});

test("rejects a line that matches multiple supported patterns", () => {
  const originalLine = "B1. Vào home và vào dịch vụ phim truyện";

  assert.throws(
    () =>
      compileQaDescription(originalLine, {
        caseId: "ambiguous-case",
      }),
    /ambiguous-case.*ambiguous.*Vào home.*vào dịch vụ phim truyện/i
  );
});
