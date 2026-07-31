"use strict";

const {publicCatalogStatus, selectChromeDriver, validateLgCompatibilityCatalog} = require("./lg-compatibility-catalog");

function createLgCompatibilityCatalogService({bundledCatalog, store, fetchCatalog, now = () => new Date().toISOString()} = {}) {
  const baseline = validateLgCompatibilityCatalog(bundledCatalog);
  if (!store || typeof store.read !== "function" || typeof store.replace !== "function") {
    throw new Error("A compatibility catalog store is required.");
  }
  if (typeof fetchCatalog !== "function") {
    throw new Error("A compatibility catalog fetcher is required.");
  }
  let current;

  async function load() {
    if (current) return current;
    const cached = await store.read();
    current = cached?.catalog
      ? {source: "cached", refreshedAt: cached.refreshedAt, catalog: cached.catalog}
      : {source: "bundled", refreshedAt: null, catalog: baseline};
    return current;
  }

  async function status() {
    return publicCatalogStatus(await load());
  }

  async function select(request) {
    return selectChromeDriver((await load()).catalog, request);
  }

  async function refresh({apiDomain, authorization, timeoutMs} = {}) {
    if (!String(apiDomain || "").trim() || !String(authorization || "").trim()) {
      return {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"};
    }
    let response;
    try {
      response = await fetchCatalog({apiDomain, authorization, timeoutMs});
    } catch {
      return {ok: false, status: "CATALOG_REFRESH_FAILED"};
    }
    if (!response?.ok) return {ok: false, status: "CATALOG_REFRESH_FAILED"};
    let catalog;
    try {
      catalog = validateLgCompatibilityCatalog(response.catalog);
    } catch {
      return {ok: false, status: "CATALOG_INVALID"};
    }
    try {
      const envelope = await store.replace(catalog);
      current = {
        source: "cached",
        refreshedAt: envelope?.refreshedAt || now(),
        catalog,
      };
      return publicCatalogStatus(current);
    } catch {
      return {ok: false, status: "CATALOG_REFRESH_FAILED"};
    }
  }

  return Object.freeze({status, refresh, select});
}

module.exports = {createLgCompatibilityCatalogService};
