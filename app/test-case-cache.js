const path = require("node:path");
const fs = require("node:fs/promises");

const LATEST_CACHE_KEY = "__latest__";

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

async function writeCacheObject(cachePath, cache) {
  await fs.mkdir(path.dirname(cachePath), {recursive: true});

  const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, cachePath);
  } catch (error) {
    await fs.rm(temporaryPath, {force: true}).catch(() => {});
    throw error;
  }
}

async function writeCacheEntry({cachePath, key, entry, markAsLatest = false}) {
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) throw new Error("A test-case cache key is required.");
  if (normalizedKey === LATEST_CACHE_KEY) throw new Error("The latest test-case cache marker is reserved.");

  const cache = await readTestCaseCache(cachePath);
  cache[normalizedKey] = entry;
  if (markAsLatest) {
    cache[LATEST_CACHE_KEY] = {
      cacheKey: normalizedKey,
      updatedAt: entry?.updatedAt || new Date().toISOString(),
    };
  }
  await writeCacheObject(cachePath, cache);

  return cache;
}

async function replaceFolderCacheEntry({cachePath, folder, cases, updatedAt = new Date().toISOString()}) {
  if (!folder || folder.id === undefined || folder.id === null) {
    throw new Error("A folder id is required to write the test-case cache.");
  }

  return writeCacheEntry({
    cachePath,
    key: folder.id,
    entry: {folder, cases, updatedAt},
    markAsLatest: true,
  });
}

async function replaceCampaignCacheEntry({cachePath, campaignId, campaign, folder = null, cases, updatedAt = new Date().toISOString()}) {
  const normalizedCampaignId = String(campaignId ?? "").trim();
  if (!normalizedCampaignId) throw new Error("A campaign id is required to write the test-case cache.");

  return writeCacheEntry({
    cachePath,
    key: `campaign:${normalizedCampaignId}`,
    entry: {source: "campaign", campaign, ...(folder ? {folder} : {}), cases, updatedAt},
    markAsLatest: true,
  });
}

async function clearTestCaseCache({cachePath}) {
  await writeCacheObject(cachePath, {});
  return {};
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
    if (key === LATEST_CACHE_KEY) continue;
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

function isUsableTestCaseCacheEntry(entry) {
  if (!entry || !Array.isArray(entry.cases)) return false;
  if (entry.source === "campaign") return true;
  return Boolean(entry.folder);
}

async function readMostRecentTestCaseCacheEntry({cachePath}) {
  const cache = await readTestCaseCache(cachePath);
  const hasLatestMarker = Object.prototype.hasOwnProperty.call(cache, LATEST_CACHE_KEY);
  const latestMarker = cache[LATEST_CACHE_KEY];

  if (hasLatestMarker) {
    const latestKey = String(latestMarker?.cacheKey ?? "").trim();
    if (!latestKey) return null;
    const latestEntry = cache[latestKey];
    return isUsableTestCaseCacheEntry(latestEntry) ? {...latestEntry, cacheKey: latestKey} : null;
  }

  // Migrate older cache files that predate the latest-entry marker.
  let mostRecent = null;
  let mostRecentTimestamp = Number.NEGATIVE_INFINITY;
  for (const [key, entry] of Object.entries(cache)) {
    if (key === LATEST_CACHE_KEY || !isUsableTestCaseCacheEntry(entry)) continue;
    const timestamp = Date.parse(entry.updatedAt);
    const comparableTimestamp = Number.isFinite(timestamp)
      ? timestamp
      : Number.NEGATIVE_INFINITY;
    if (!mostRecent || comparableTimestamp >= mostRecentTimestamp) {
      mostRecent = {...entry, cacheKey: key};
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
  clearTestCaseCache,
  readTestCaseCacheEntry,
  readFolderCacheEntry,
  readCampaignCacheEntry,
  readMostRecentFolderCacheEntry,
  readMostRecentTestCaseCacheEntry,
};
