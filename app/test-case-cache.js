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

async function writeCacheEntry({cachePath, key, entry}) {
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) throw new Error("A test-case cache key is required.");

  const cache = await readTestCaseCache(cachePath);
  cache[normalizedKey] = entry;
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

async function replaceFolderCacheEntry({cachePath, folder, cases, updatedAt = new Date().toISOString()}) {
  if (!folder || folder.id === undefined || folder.id === null) {
    throw new Error("A folder id is required to write the test-case cache.");
  }

  return writeCacheEntry({cachePath, key: folder.id, entry: {folder, cases, updatedAt}});
}

async function replaceCampaignCacheEntry({cachePath, campaignId, campaign, folder = null, cases, updatedAt = new Date().toISOString()}) {
  const normalizedCampaignId = String(campaignId ?? "").trim();
  if (!normalizedCampaignId) throw new Error("A campaign id is required to write the test-case cache.");

  return writeCacheEntry({
    cachePath,
    key: `campaign:${normalizedCampaignId}`,
    entry: {source: "campaign", campaign, ...(folder ? {folder} : {}), cases, updatedAt},
  });
}

async function readTestCaseCacheEntry({cachePath, key}) {
  const cache = await readTestCaseCache(cachePath);
  return cache[String(key)] || null;
}

async function readFolderCacheEntry({cachePath, folderId}) {
  return readTestCaseCacheEntry({cachePath, key: folderId});
}

async function readCampaignCacheEntry({cachePath, campaignId}) {
  return readTestCaseCacheEntry({cachePath, key: `campaign:${String(campaignId)}`});
}

async function readMostRecentFolderCacheEntry({cachePath}) {
  const cache = await readTestCaseCache(cachePath);
  let mostRecent = null;
  let mostRecentTimestamp = Number.NEGATIVE_INFINITY;

  for (const [key, entry] of Object.entries(cache)) {
    if (key.startsWith("campaign:") || entry?.source === "campaign") continue;
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
  writeCacheEntry,
  replaceFolderCacheEntry,
  replaceCampaignCacheEntry,
  readTestCaseCacheEntry,
  readFolderCacheEntry,
  readCampaignCacheEntry,
  readMostRecentFolderCacheEntry,
};
