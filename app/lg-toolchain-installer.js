"use strict";

const {trustedLgToolchainBundle, trustedLgToolchainManifest} = require("./lg-toolchain-manifest");
const {trustedLgToolchainNpmClosure} = require("./lg-toolchain-npm-closure");

const SAFE_INSTALL_FAILURES = new Set([
  "INSTALL_INPUT_INVALID",
  "DOWNLOAD_FAILED",
  "CHECKSUM_MISMATCH",
  "EXTRACTION_FAILED",
  "DEPENDENCY_INSTALL_FAILED",
  "VERIFICATION_FAILED",
  "ACTIVATION_FAILED",
  "INSTALL_FAILED",
]);
const SAFE_VERIFICATION_RESULTS = new Set(["NODE_UNVERIFIED", "APPIUM_UNVERIFIED", "LG_DRIVER_UNVERIFIED", "CHROMEDRIVER_UNVERIFIED"]);

function publicReview(inspection) {
  const components = Array.isArray(inspection?.components)
    ? inspection.components.map(({id, label, status, version}) => ({id, label, status, version}))
    : [];
  return {
    ok: true,
    state: inspection?.state === "ready" ? "ready" : "installable",
    components,
  };
}

function createLgToolchainInstaller({platform = process.platform, detector, installManagedBundle} = {}) {
  if (!detector || typeof detector.inspect !== "function") {
    throw new Error("An LG toolchain detector is required.");
  }
  if (typeof installManagedBundle !== "function") {
    throw new Error("An LG managed-bundle installer is required.");
  }

  async function plan() {
    return publicReview(await detector.inspect());
  }

  return {
    plan,
    async install({confirmed, chromedriverArtifact, onProgress} = {}) {
      if (confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
      const expectedVersion = typeof chromedriverArtifact?.version === "string" ? chromedriverArtifact.version : undefined;
      const review = publicReview(await detector.inspect({chromedriverVersion: expectedVersion}));
      if (review.state === "ready") return review;
      let bundle;
      try {
        bundle = chromedriverArtifact
          ? trustedLgToolchainManifest(platform).withChromeDriver(chromedriverArtifact)
          : trustedLgToolchainBundle(platform);
      } catch {
        return {ok: false, status: "INSTALL_INPUT_INVALID"};
      }
      const installInput = {
        bundle,
        npmClosure: trustedLgToolchainNpmClosure(),
      };
      if (chromedriverArtifact) installInput.includeChromeDriver = true;
      if (typeof onProgress === "function") installInput.onProgress = onProgress;
      const result = await installManagedBundle(installInput);
      if (result?.ok) return plan();
      const status = SAFE_INSTALL_FAILURES.has(result?.status) ? result.status : "INSTALL_FAILED";
      const verification = status === "VERIFICATION_FAILED" && SAFE_VERIFICATION_RESULTS.has(result?.verification)
        ? result.verification
        : undefined;
      return {ok: false, status, ...(verification ? {verification} : {})};
    },
  };
}

module.exports = {createLgToolchainInstaller};
