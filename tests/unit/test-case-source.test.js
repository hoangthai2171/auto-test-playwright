const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  loadLocalTestCases,
  loadCachedTestCases,
  findTestCaseById,
} = require("../lib/test-case-source");

async function writeTempJson(value) {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mytv-test-case-source-")
  );
  const filePath = path.join(tempDirectory, "test-cases.json");

  await fs.writeFile(filePath, JSON.stringify(value), "utf8");

  return { tempDirectory, filePath };
}

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

test("loads an array from a local JSON file and finds a case by id", async () => {
  const { tempDirectory, filePath } = await writeTempJson([
    { id: "1", name: "Case", actions: [{ action: "open_home" }] },
  ]);

  try {
    const cases = await loadLocalTestCases(filePath);

    assert.equal(findTestCaseById(cases, "1").name, "Case");
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});

test("does not require a screen assertion after opening the service in the fixture", async () => {
  const fixturePath = path.resolve(__dirname, "../../testcased.json");
  const cases = await loadLocalTestCases(fixturePath);
  const testCase = findTestCaseById(cases, "12066");

  assert.deepEqual(testCase.actions.at(-1), {
    action: "open_service",
    service: "Phim truyện",
  });
  assert.equal(
    testCase.actions.some(({ action }) => action === "assert_screen"),
    false
  );
});

test("does not modify a local fixture while loading it", async () => {
  const { tempDirectory, filePath } = await writeTempJson([
    { id: "1", name: "Case", actions: [{ action: "open_home" }] },
  ]);
  const before = await fs.readFile(filePath, "utf8");

  try {
    await loadLocalTestCases(filePath);

    assert.equal(await fs.readFile(filePath, "utf8"), before);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});

test("compares test case ids as strings and reports missing ids", () => {
  const cases = [{ id: 12066, name: "Numeric id" }];

  assert.equal(findTestCaseById(cases, "12066").name, "Numeric id");
  assert.throws(
    () => findTestCaseById(cases, "missing-id"),
    /missing-id/i
  );
});

test("wraps local file errors with the requested path", async () => {
  const missingFile = path.join(os.tmpdir(), "missing-test-cases.json");

  await assert.rejects(
    () => loadLocalTestCases(missingFile),
    new RegExp(`Could not load test cases from ${missingFile.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`)
  );
});

test("loads and validates cases from a folder-keyed cache", async () => {
  const {tempDirectory, filePath} = await writeTempJson({
    "12": {
      folder: {id: "12", name: "Root", fullPath: "/Root"},
      cases: [{id: "cached-1", name: "Cached case", actions: [{action: "open_home"}]}],
    },
  });

  try {
    const cases = await loadCachedTestCases(filePath, "12");
    assert.equal(cases[0].name, "Cached case");
    await assert.rejects(
      () => loadCachedTestCases(filePath, "missing"),
      /Test case cache entry for folder "missing" not found/
    );
  } finally {
    await fs.rm(tempDirectory, {recursive: true, force: true});
  }
});
