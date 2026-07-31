"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  publicCatalogStatus,
  selectChromeDriver,
  validateLgCompatibilityCatalog,
} = require("../../app/lg-compatibility-catalog");

const validCatalog = {
  profiles: [{
    model: "model-a",
    firmware: "firmware-a",
    chromedriver: {
      darwin: {
        version: "2.36.540469",
        url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_mac64.zip",
        archiveName: "chromedriver_mac64.zip",
        sha256: "a".repeat(64),
      },
      win32: {
        version: "2.36.540469",
        url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_win32.zip",
        archiveName: "chromedriver_win32.zip",
        sha256: "b".repeat(64),
      },
    },
  }],
};

test("selects only the exact matching current-platform artifact", () => {
  const catalog = validateLgCompatibilityCatalog(validCatalog);

  assert.deepEqual(
    selectChromeDriver(catalog, {model: "model-a", firmware: "firmware-a", platform: "win32"}),
    {
      status: "verified",
      artifact: {
        version: "2.36.540469",
        url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_win32.zip",
        archiveName: "chromedriver_win32.zip",
        sha256: "b".repeat(64),
      },
    },
  );
  assert.deepEqual(
    selectChromeDriver(catalog, {model: "model-a", firmware: "different", platform: "darwin"}),
    {status: "COMPATIBILITY_PROFILE_UNVERIFIED"},
  );
});

test("rejects duplicate device pairs and incomplete platform artifacts", () => {
  assert.throws(
    () => validateLgCompatibilityCatalog({...validCatalog, profiles: [validCatalog.profiles[0], validCatalog.profiles[0]]}),
    /duplicate/i,
  );
  assert.throws(
    () => validateLgCompatibilityCatalog({
      profiles: [{...validCatalog.profiles[0], chromedriver: {darwin: validCatalog.profiles[0].chromedriver.darwin}}],
    }),
    /win32/i,
  );
});

test("accepts only the reviewed official ChromeDriver vendors", () => {
  const catalog = structuredClone(validCatalog);
  catalog.profiles[0].chromedriver.darwin.url = "https://unreviewed.example.test/chromedriver.zip";

  assert.throws(() => validateLgCompatibilityCatalog(catalog), /official/i);
});

test("projects only public catalog state", () => {
  const status = publicCatalogStatus({
    source: "bundled",
    refreshedAt: null,
    catalog: validateLgCompatibilityCatalog(validCatalog),
  });

  assert.deepEqual(status, {
    ok: true,
    state: "available",
    source: "bundled",
    refreshedAt: null,
    profileCount: 1,
  });
  assert.doesNotMatch(JSON.stringify(status), /chromedriver|https?:|sha256/i);
});
