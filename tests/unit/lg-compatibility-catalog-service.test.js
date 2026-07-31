"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgCompatibilityCatalogService} = require("../../app/lg-compatibility-catalog-service");

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

function memoryStore(initial = null) {
  let value = initial;
  return {
    async read() { return value; },
    async replace(next) { value = {refreshedAt: "2026-07-30T00:00:00.000Z", catalog: next}; },
  };
}

test("retains the previous valid catalog when a refresh response is invalid", async () => {
  const service = createLgCompatibilityCatalogService({
    bundledCatalog: catalog,
    store: memoryStore({refreshedAt: "2026-07-29T00:00:00.000Z", catalog}),
    fetchCatalog: async () => ({ok: true, catalog: {profiles: []}}),
    now: () => "2026-07-30T00:00:00.000Z",
  });

  assert.deepEqual(
    await service.refresh({apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500}),
    {ok: false, status: "CATALOG_INVALID"},
  );
  assert.equal((await service.select({model: "model-a", firmware: "firmware-a", platform: "darwin"})).status, "verified");
});

test("does not request a catalog without configured API authorization", async () => {
  let requested = false;
  const service = createLgCompatibilityCatalogService({
    bundledCatalog: catalog,
    store: memoryStore(),
    fetchCatalog: async () => { requested = true; return {ok: true, catalog}; },
    now: () => "2026-07-30T00:00:00.000Z",
  });

  assert.deepEqual(await service.refresh({apiDomain: "https://api.example.test", authorization: ""}), {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"});
  assert.equal(requested, false);
  assert.deepEqual(await service.status(), {
    ok: true,
    state: "available",
    source: "bundled",
    refreshedAt: null,
    profileCount: 1,
  });
});
