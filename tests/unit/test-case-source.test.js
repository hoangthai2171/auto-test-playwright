const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  loadLocalTestCases,
  findTestCaseById,
} = require("../lib/test-case-source");

test("loads local JSON test cases and finds a case by id", async () => {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mytv-test-case-source-")
  );
  const filePath = path.join(tempDirectory, "test-cases.json");

  await fs.writeFile(
    filePath,
    JSON.stringify([
      {
        id: "local-1",
        name: "Local case",
        actions: [{ action: "open_service", service: "Phim truyện" }],
      },
    ])
  );

  try {
    const cases = await loadLocalTestCases(filePath);

    assert.equal(cases.length, 1);
    assert.equal(findTestCaseById(cases, "local-1").name, "Local case");
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});

