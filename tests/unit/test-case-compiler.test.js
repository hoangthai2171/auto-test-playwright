const test = require("node:test");
const assert = require("node:assert/strict");

const { compileTestCase } = require("../lib/test-case-compiler");

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

