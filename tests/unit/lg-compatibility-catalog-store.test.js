"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {createLgCompatibilityCatalogStore} = require("../../app/lg-compatibility-catalog-store");

const catalog = {
  profiles: [{
    model: "model-a",
    firmware: "firmware-a",
    chromedriver: {
      darwin: {version: "120.0", url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/darwin/chromedriver.zip", archiveName: "chromedriver.zip", sha256: "a".repeat(64)},
      win32: {version: "120.0", url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/win32/chromedriver.zip", archiveName: "chromedriver.zip", sha256: "b".repeat(64)},
    },
  }],
};

async function withTemporaryStore(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mytv-lg-catalog-test-"));
  try {
    return await callback(path.join(directory, "nested", "catalog.json"));
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
}

test("atomically replaces and reads the per-user catalog envelope", async () => {
  await withTemporaryStore(async (filePath) => {
    const store = createLgCompatibilityCatalogStore({filePath, fs, now: () => "2026-07-30T00:00:00.000Z"});

    assert.equal(await store.read(), null);
    await store.replace(catalog);

    assert.deepEqual(await store.read(), {refreshedAt: "2026-07-30T00:00:00.000Z", catalog});
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), {refreshedAt: "2026-07-30T00:00:00.000Z", catalog});
  });
});

test("treats a malformed cache as unavailable without rewriting it", async () => {
  await withTemporaryStore(async (filePath) => {
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, "not-json", "utf8");
    const store = createLgCompatibilityCatalogStore({filePath, fs, now: () => "2026-07-30T00:00:00.000Z"});

    assert.equal(await store.read(), null);
    assert.equal(await fs.readFile(filePath, "utf8"), "not-json");
  });
});
