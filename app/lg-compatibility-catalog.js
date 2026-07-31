"use strict";

const PLATFORM_KEYS = new Set(["darwin", "win32"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const LEGACY_HOST = "chromedriver.storage.googleapis.com";
const CHROME_FOR_TESTING_HOST = "storage.googleapis.com";
const CHROME_FOR_TESTING_PREFIX = "/chrome-for-testing-public/";

function clone(value) {
  return structuredClone(value);
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Compatibility catalog ${label} is required.`);
  }
  return value.trim();
}

function approvedChromeDriverUrl(value) {
  let url;
  try {
    url = new URL(requiredText(value, "artifact URL"));
  } catch {
    throw new Error("Compatibility catalog ChromeDriver URL must be official HTTPS.");
  }
  const approved = url.protocol === "https:"
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && (
      url.hostname === LEGACY_HOST
      || (url.hostname === CHROME_FOR_TESTING_HOST && url.pathname.startsWith(CHROME_FOR_TESTING_PREFIX))
    );
  if (!approved) {
    throw new Error("Compatibility catalog ChromeDriver URL must use an approved official vendor.");
  }
  return url;
}

function validateChromeDriverArtifact(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    throw new Error("Compatibility catalog ChromeDriver artifact is required.");
  }
  const version = requiredText(artifact.version, "artifact version");
  const archiveName = requiredText(artifact.archiveName, "artifact archive name");
  if (archiveName !== archiveName.split(/[\\/]/u).at(-1)) {
    throw new Error("Compatibility catalog ChromeDriver archive name is invalid.");
  }
  const url = approvedChromeDriverUrl(artifact.url);
  if (url.pathname.split("/").at(-1) !== archiveName) {
    throw new Error("Compatibility catalog ChromeDriver archive name must match its URL.");
  }
  if (!SHA256.test(artifact.sha256 || "")) {
    throw new Error("Compatibility catalog ChromeDriver hash must be an audited SHA-256 value.");
  }
  return {version, url: url.toString(), archiveName, sha256: artifact.sha256};
}

function validateLgCompatibilityCatalog(document) {
  if (!document || typeof document !== "object" || Array.isArray(document) || !Array.isArray(document.profiles)) {
    throw new Error("Compatibility catalog profiles are required.");
  }
  if (document.profiles.length === 0) {
    throw new Error("Compatibility catalog requires at least one profile.");
  }
  const pairs = new Set();
  const profiles = document.profiles.map((profile) => {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new Error("Compatibility catalog profile is invalid.");
    }
    const model = requiredText(profile.model, "model");
    const firmware = requiredText(profile.firmware, "firmware");
    const pair = `${model}\u0000${firmware}`;
    if (pairs.has(pair)) {
      throw new Error("Compatibility catalog contains a duplicate model and firmware pair.");
    }
    pairs.add(pair);
    const chromedriver = profile.chromedriver;
    if (!chromedriver || typeof chromedriver !== "object" || Array.isArray(chromedriver)) {
      throw new Error("Compatibility catalog ChromeDriver artifacts are required.");
    }
    for (const platform of PLATFORM_KEYS) {
      if (!chromedriver[platform]) {
        throw new Error(`Compatibility catalog ChromeDriver ${platform} artifact is required.`);
      }
    }
    return {
      model,
      firmware,
      chromedriver: Object.fromEntries(
        [...PLATFORM_KEYS].map((platform) => [platform, validateChromeDriverArtifact(chromedriver[platform])]),
      ),
    };
  });
  return freeze({profiles});
}

function selectChromeDriver(catalog, {model, firmware, platform} = {}) {
  const profile = catalog?.profiles?.find((entry) => entry.model === model && entry.firmware === firmware);
  if (!profile || !PLATFORM_KEYS.has(platform)) {
    return {status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
  }
  return {status: "verified", artifact: clone(profile.chromedriver[platform])};
}

function publicCatalogStatus({source, refreshedAt, catalog} = {}) {
  return {
    ok: true,
    state: "available",
    source: source === "cached" ? "cached" : "bundled",
    refreshedAt: typeof refreshedAt === "string" ? refreshedAt : null,
    profileCount: Array.isArray(catalog?.profiles) ? catalog.profiles.length : 0,
  };
}

module.exports = {
  publicCatalogStatus,
  selectChromeDriver,
  validateChromeDriverArtifact,
  validateLgCompatibilityCatalog,
};
