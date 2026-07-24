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

async function replaceFolderCacheEntry({cachePath, folder, cases, updatedAt = new Date().toISOString()}) {
  if (!folder || folder.id === undefined || folder.id === null) {
    throw new Error("A folder id is required to write the test-case cache.");
  }

  const cache = await readTestCaseCache(cachePath);
  cache[String(folder.id)] = {folder, cases, updatedAt};
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

async function readMostRecentFolderCacheEntry({cachePath}) {
  const cache = await readTestCaseCache(cachePath);
  let mostRecent = null;
  let mostRecentTimestamp = Number.NEGATIVE_INFINITY;

  for (const entry of Object.values(cache)) {
    if (!entry?.folder || !Array.isArray(entry.cases)) continue;
    const timestamp = Date.parse(entry.updatedAt);
    const comparableTimestamp = Number.isFinite(timestamp)
      ? timestamp
      : Number.NEGATIVE_INFINITY;
    if (!mostRecent || comparableTimestamp >= mostRecentTimestamp) {
      mostRecent = entry;
      mostRecentTimestamp = comparableTimestamp;
    }
  }

  return mostRecent;
}

module.exports = {
  readTestCaseCache,
  replaceFolderCacheEntry,
  readFolderCacheEntry,
  readMostRecentFolderCacheEntry,
};
