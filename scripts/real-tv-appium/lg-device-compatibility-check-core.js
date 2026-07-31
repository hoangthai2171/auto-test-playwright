"use strict";

const {validateLgCompatibilityCatalog} = require("../../app/lg-compatibility-catalog");
const {EXPECTED_LG_APP_ID} = require("./lg-webos-poc-core");

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function parseCompatibilityCandidate(input) {
  return validateLgCompatibilityCatalog({profiles: [input]}).profiles[0];
}

function parseCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) || !Array.isArray(catalog.profiles)) {
    throw new Error("Compatibility catalog profiles are required.");
  }
  if (catalog.profiles.length === 0) return {profiles: []};
  return validateLgCompatibilityCatalog(catalog);
}

function buildCandidateGateArgs({candidate, runtime} = {}) {
  const safeCandidate = parseCompatibilityCandidate(candidate);
  const deviceName = requiredText(runtime?.deviceName, "Registered LG device name");
  const chromedriverPath = requiredText(runtime?.chromedriverPath, "Temporary ChromeDriver path");
  const model = requiredText(runtime?.model, "Observed LG model");
  if (model !== safeCandidate.model) throw new Error("Observed LG model must match the compatibility candidate.");
  const searchName = requiredText(runtime?.searchName, "LG search name");
  const contentType = requiredText(runtime?.contentType, "LG content type");
  const runtimeRoot = requiredText(runtime?.runtimeRoot, "LG runtime root");
  return [
    "scripts/real-tv-appium/lg-webos-case-runner.js",
    "--device", deviceName,
    "--model", model,
    "--app-id", EXPECTED_LG_APP_ID,
    "--chromedriver", chromedriverPath,
    "--search-name", searchName,
    "--content-type", contentType,
    "--runtime-root", runtimeRoot,
    "--secure-websocket",
    "--allow-self-signed-tls",
  ];
}

function compareProfiles(left, right) {
  return `${left.model}\u0000${left.firmware}`.localeCompare(`${right.model}\u0000${right.firmware}`);
}

function applyCompatibilityProfile({catalog, candidate, confirmed, replaceExisting} = {}) {
  if (confirmed !== true) throw new Error("Record confirmation is required.");
  const safeCatalog = parseCatalog(catalog);
  const safeCandidate = parseCompatibilityCandidate(candidate);
  const existingIndex = safeCatalog.profiles.findIndex((entry) => (
    entry.model === safeCandidate.model && entry.firmware === safeCandidate.firmware
  ));
  if (existingIndex >= 0 && replaceExisting !== true) {
    throw new Error("Update confirmation is required for this existing model and firmware.");
  }
  const profiles = existingIndex >= 0
    ? safeCatalog.profiles.map((entry, index) => index === existingIndex ? safeCandidate : entry)
    : [...safeCatalog.profiles, safeCandidate];
  return validateLgCompatibilityCatalog({profiles: profiles.sort(compareProfiles)});
}

module.exports = {
  applyCompatibilityProfile,
  buildCandidateGateArgs,
  parseCompatibilityCandidate,
};
