const path = require("node:path");
const fs = require("node:fs/promises");

async function readTestCaseCache(cachePath) {
  try {
    const contents = await fs.readFile(cachePath, "utf8");
    const cache = JSON.parse(contents);
    if (!cache || typeof cache !== "object" || Array.isArray(cache)) {
      throw new Error("Test-case cache must contain an object.");
    }
    return cache;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`Could not read test-case cache ${cachePath}: ${error.message}`, {cause: error});
  }
}

async function replaceFolderCacheEntry({cachePath, folder, cases}) {
  if (!folder || folder.id === undefined || folder.id === null) {
    throw new Error("A folder id is required to write the test-case cache.");
  }

  const cache = await readTestCaseCache(cachePath);
  cache[String(folder.id)] = {folder, cases};
  await fs.mkdir(path.dirname(cachePath), {recursive: true});

  const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, cachePath);
  } catch (error) {
    await fs.rm(temporaryPath, {force: true}).catch(() => {});
    throw error;
  }

  return cache;
}

async function readFolderCacheEntry({cachePath, folderId}) {
  const cache = await readTestCaseCache(cachePath);
  return cache[String(folderId)] || null;
}

module.exports = {readTestCaseCache, replaceFolderCacheEntry, readFolderCacheEntry};
