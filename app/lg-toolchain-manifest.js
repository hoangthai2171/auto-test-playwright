"use strict";

const bundledCatalog = require("../DEVICE-COMPATIBILITY.json");
const {selectChromeDriver, validateChromeDriverArtifact, validateLgCompatibilityCatalog} = require("./lg-compatibility-catalog");

const SUPPORTED_PLATFORMS = new Set(["darwin", "win32"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const LG_CLI_HELP_HOST = "webostv.developer.lge.com";
const LG_CLI_HELP_URL = "https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation#step1";
const TRUSTED_LG_CLI_ARCHIVES = Object.freeze({
  darwin: Object.freeze({
    version: "1.12.4",
    operatorSelected: true,
    helpUrl: LG_CLI_HELP_URL,
    archiveName: "webOS_TV_CLI_mac_1.12.4-j27.tgz",
    sha256: "50b1d66afc52b3b1aee57fce4c7b8b59b49b3d026be4262d811af45132d61525",
  }),
  win32: Object.freeze({
    version: "1.12.4",
    operatorSelected: true,
    helpUrl: LG_CLI_HELP_URL,
    archiveName: "webOS_TV_CLI_win_1.12.4-j27.zip",
    sha256: "87764cf85f0314d593edb1bc93cd9f8c52745a1f3528bde94224d92403d91870",
  }),
});
const TRUSTED_BASELINE_CATALOG = validateLgCompatibilityCatalog(bundledCatalog);
const TRUSTED_CHROMEDRIVER_ARCHIVES = Object.freeze(Object.fromEntries(
  ["darwin", "win32"].map((platform) => [
    platform,
    Object.freeze(selectChromeDriver(TRUSTED_BASELINE_CATALOG, {
      model: TRUSTED_BASELINE_CATALOG.profiles[0].model,
      firmware: TRUSTED_BASELINE_CATALOG.profiles[0].firmware,
      platform,
    }).artifact),
  ]),
));
const TRUSTED_LG_TOOLCHAIN_BUNDLES = Object.freeze({
  darwin: Object.freeze({
    id: "lg-verified-darwin",
    components: Object.freeze({
      node: Object.freeze({
        version: "24.18.0",
        official: true,
        url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-darwin-arm64.tar.gz",
        archiveName: "node-v24.18.0-darwin-arm64.tar.gz",
        sha256: "e1a97e14c99c803e96c7339403282ea05a499c32f8d83defe9ef5ec66f979ed1",
      }),
      webosCli: TRUSTED_LG_CLI_ARCHIVES.darwin,
      appium: Object.freeze({
        version: "2.19.0",
        official: true,
        url: "https://registry.npmjs.org/appium/-/appium-2.19.0.tgz",
        archiveName: "appium-2.19.0.tgz",
        sha256: "ab8ab9723dd44d3a0adfa14e4320d9578a9127576f7fb862048d2335c9376f14",
      }),
      lgDriver: Object.freeze({
        version: "0.5.0",
        official: true,
        url: "https://registry.npmjs.org/appium-lg-webos-driver/-/appium-lg-webos-driver-0.5.0.tgz",
        archiveName: "appium-lg-webos-driver-0.5.0.tgz",
        sha256: "100a2017e21be3200fdd182de2f00b3bc09731e865c4a17a2d258b69c2de1266",
      }),
      chromedriver: Object.freeze({...TRUSTED_CHROMEDRIVER_ARCHIVES.darwin, official: true}),
    }),
  }),
  win32: Object.freeze({
    id: "lg-verified-win32",
    components: Object.freeze({
      node: Object.freeze({
        version: "24.18.0",
        official: true,
        url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-win-x64.zip",
        archiveName: "node-v24.18.0-win-x64.zip",
        sha256: "0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821",
      }),
      webosCli: TRUSTED_LG_CLI_ARCHIVES.win32,
      appium: Object.freeze({
        version: "2.19.0",
        official: true,
        url: "https://registry.npmjs.org/appium/-/appium-2.19.0.tgz",
        archiveName: "appium-2.19.0.tgz",
        sha256: "ab8ab9723dd44d3a0adfa14e4320d9578a9127576f7fb862048d2335c9376f14",
      }),
      lgDriver: Object.freeze({
        version: "0.5.0",
        official: true,
        url: "https://registry.npmjs.org/appium-lg-webos-driver/-/appium-lg-webos-driver-0.5.0.tgz",
        archiveName: "appium-lg-webos-driver-0.5.0.tgz",
        sha256: "100a2017e21be3200fdd182de2f00b3bc09731e865c4a17a2d258b69c2de1266",
      }),
      chromedriver: Object.freeze({...TRUSTED_CHROMEDRIVER_ARCHIVES.win32, official: true}),
    }),
  }),
});

function cloned(value) {
  return structuredClone(value);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validateAutomaticArtifact(artifact) {
  if (!artifact?.official || !isHttpsUrl(artifact.url) || !SHA256.test(artifact.sha256 || "")) {
    throw new Error("Each LG toolchain artifact must be a pinned official artifact.");
  }
  return cloned(artifact);
}

function expectedCliArchiveName(platform, version) {
  const suffix = platform === "darwin" ? "mac" : "win";
  const extension = platform === "darwin" ? "tgz" : "zip";
  return `webOS_TV_CLI_${suffix}_${version}-j27.${extension}`;
}

function validateSelectedCliArtifact(platform, artifact) {
  let helpUrl;
  try {
    helpUrl = new URL(artifact?.helpUrl);
  } catch {
    helpUrl = undefined;
  }
  if (
    !artifact?.operatorSelected
    || helpUrl?.protocol !== "https:"
    || helpUrl.hostname !== LG_CLI_HELP_HOST
    || artifact.archiveName !== expectedCliArchiveName(platform, artifact.version)
    || !SHA256.test(artifact.sha256 || "")
  ) {
    throw new Error("Each selected LG CLI artifact must be pinned and reviewed.");
  }
  return cloned(artifact);
}

function trustedLgCliArchive(platform) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error("LG toolchain setup supports only macOS and Windows.");
  }
  return cloned(TRUSTED_LG_CLI_ARCHIVES[platform]);
}

function trustedChromeDriverArchive(platform) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error("LG toolchain setup supports only macOS and Windows.");
  }
  return cloned(TRUSTED_CHROMEDRIVER_ARCHIVES[platform]);
}

function trustedLgToolchainBundle(platform) {
  return trustedLgToolchainManifest(platform).bundle();
}

function trustedLgToolchainManifest(platform) {
  return createLgToolchainManifest({
    platform,
    manifest: {
      bundles: TRUSTED_LG_TOOLCHAIN_BUNDLES,
    },
  });
}

function createLgToolchainManifest({platform, manifest} = {}) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error("LG toolchain setup supports only macOS and Windows.");
  }
  const bundle = manifest?.bundles?.[platform];
  if (!bundle?.id || !bundle?.components) {
    throw new Error("The pinned LG toolchain bundle is unavailable.");
  }
  const components = {};
  for (const [id, artifact] of Object.entries(bundle.components)) {
    components[id] = id === "webosCli"
      ? validateSelectedCliArtifact(platform, artifact)
      : validateAutomaticArtifact(artifact);
  }
  if (!components.chromedriver) {
    throw new Error("The pinned LG toolchain bundle is unavailable.");
  }
  return Object.freeze({
    bundle() {
      return {id: bundle.id, components: cloned(components)};
    },
    installationPlan(detected = []) {
      const readyIds = new Set(
        Array.isArray(detected)
          ? detected.filter((component) => component?.status === "ready").map((component) => component.id)
          : [],
      );
      return {
        status: Object.keys(components).every((id) => readyIds.has(id)) ? "ready" : "installable",
        components: cloned(components),
      };
    },
    withChromeDriver(artifact) {
      const validatedArtifact = validateChromeDriverArtifact(artifact);
      return {
        id: bundle.id,
        components: cloned({...components, chromedriver: {...validatedArtifact, official: true}}),
      };
    },
    selectCompatibilityProfile() {
      return {status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
    },
  });
}

module.exports = {createLgToolchainManifest, trustedLgCliArchive, trustedChromeDriverArchive, trustedLgToolchainBundle, trustedLgToolchainManifest};
