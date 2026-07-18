const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  readTestCaseCache,
  replaceFolderCacheEntry,
  readFolderCacheEntry,
} = require("../../app/test-case-cache");

async function withTempCache(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mytv-cache-test-"));
  const cachePath = path.join(directory, "nested", "testcases-cache.json");
  try {
    return await callback(cachePath);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
}

test("reads a missing cache as an empty object", async () => {
  await withTempCache(async (cachePath) => {
    assert.deepEqual(await readTestCaseCache(cachePath), {});
  });
});

test("replaces one folder cache entry without removing other folders", async () => {
  await withTempCache(async (cachePath) => {
    const folder9 = {id: "9", name: "Other", fullPath: "/Other"};
    const folder12 = {id: "12", name: "Old", fullPath: "/Root"};
    await replaceFolderCacheEntry({cachePath, folder: folder9, cases: [{id: "case-9", name: "Other", actions: []}]});
    await replaceFolderCacheEntry({cachePath, folder: folder12, cases: [{id: "old", name: "Old", actions: []}]});
    await replaceFolderCacheEntry({
      cachePath,
      folder: {...folder12, name: "New"},
      cases: [{id: "new", name: "New", actions: []}],
    });

    assert.deepEqual(await readFolderCacheEntry({cachePath, folderId: "9"}), {
      folder: folder9,
      cases: [{id: "case-9", name: "Other", actions: []}],
    });
    assert.deepEqual(await readFolderCacheEntry({cachePath, folderId: "12"}), {
      folder: {...folder12, name: "New"},
      cases: [{id: "new", name: "New", actions: []}],
    });
    assert.deepEqual(JSON.parse(await fs.readFile(cachePath, "utf8")), {
      "9": {folder: folder9, cases: [{id: "case-9", name: "Other", actions: []}]},
      "12": {folder: {...folder12, name: "New"}, cases: [{id: "new", name: "New", actions: []}]},
    });
  });
});
