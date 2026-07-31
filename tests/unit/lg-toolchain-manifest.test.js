"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgToolchainManifest, trustedLgCliArchive, trustedChromeDriverArchive, trustedLgToolchainBundle, trustedLgToolchainManifest} = require("../../app/lg-toolchain-manifest");

const SHA = "a".repeat(64);
const LG_CLI_PAGE = "https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation#step1";

function automaticArtifact(version) {
  return {version, official: true, url: `https://downloads.example.test/${version}.tgz`, sha256: SHA};
}

function fixedManifest() {
  return {
    version: 1,
    bundles: {
      darwin: {
        id: "lg-verified-darwin",
        components: {
          node: automaticArtifact("24.18.0"),
          webosCli: {
            version: "1.12.4",
            operatorSelected: true,
            helpUrl: LG_CLI_PAGE,
            archiveName: "webOS_TV_CLI_mac_1.12.4-j27.tgz",
            sha256: SHA,
          },
          appium: automaticArtifact("2.19.0"),
          lgDriver: automaticArtifact("0.5.0"),
          chromedriver: automaticArtifact("2.36.540469"),
        },
      },
    },
    profiles: [{model: "verified-model", firmware: "verified-firmware", appId: "com.mytvb2c.app", chromedriver: "2.36.540469"}],
  };
}

test("returns the pinned host bundle without mutating its manifest", () => {
  const source = fixedManifest();
  const manifest = createLgToolchainManifest({platform: "darwin", manifest: source});

  const bundle = manifest.bundle();
  bundle.components.node.version = "mutated";

  assert.deepEqual(manifest.bundle().components.node, automaticArtifact("24.18.0"));
  assert.equal(manifest.bundle().components.webosCli.operatorSelected, true);
  assert.doesNotMatch(JSON.stringify(manifest.bundle()), /latest/i);
});

test("rejects an automatic artifact without a reviewed official HTTPS source", () => {
  const source = fixedManifest();
  source.bundles.darwin.components.node = {
    version: "24.18.0",
    official: false,
    url: "http://mirror.invalid/node.tgz",
    sha256: "",
  };

  assert.throws(
    () => createLgToolchainManifest({platform: "darwin", manifest: source}),
    /pinned official artifact/i,
  );
});

test("rejects a selected LG CLI archive missing a reviewed hash", () => {
  const source = fixedManifest();
  source.bundles.darwin.components.webosCli.sha256 = "";

  assert.throws(
    () => createLgToolchainManifest({platform: "darwin", manifest: source}),
    /selected LG CLI artifact/i,
  );
});

test("does not authorize ChromeDriver from a static app-ID profile", () => {
  const manifest = createLgToolchainManifest({platform: "darwin", manifest: fixedManifest()});

  assert.deepEqual(
    manifest.selectCompatibilityProfile({model: "verified-model", firmware: "verified-firmware", appId: "com.mytvb2c.app"}),
    {status: "COMPATIBILITY_PROFILE_UNVERIFIED"},
  );
  assert.deepEqual(
    manifest.selectCompatibilityProfile({model: "unknown", firmware: "unknown", appId: "com.mytvb2c.app"}),
    {status: "COMPATIBILITY_PROFILE_UNVERIFIED"},
  );
});

test("accepts ChromeDriver only through a separately reviewed artifact", () => {
  const manifest = createLgToolchainManifest({platform: "darwin", manifest: fixedManifest()});
  const artifact = {
    version: "120.0",
    url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/mac-arm64/chromedriver-mac-arm64.zip",
    archiveName: "chromedriver-mac-arm64.zip",
    sha256: SHA,
  };

  assert.deepEqual(manifest.withChromeDriver(artifact).components.chromedriver, {...artifact, official: true});
  assert.throws(() => manifest.withChromeDriver({...artifact, url: "https://unreviewed.example.test/chromedriver.zip"}), /official/i);
});

test("trusted compatibility catalog does not infer a ChromeDriver profile", () => {
  const manifest = trustedLgToolchainManifest("darwin");

  assert.deepEqual(
    manifest.selectCompatibilityProfile({
      model: "observed-model",
      firmware: "observed-firmware",
      appId: "com.mytvb2c.app",
    }),
    {status: "COMPATIBILITY_PROFILE_UNVERIFIED"},
  );
});

test("returns a cloned audited LG CLI archive record for each supported host", () => {
  const mac = trustedLgCliArchive("darwin");
  const windows = trustedLgCliArchive("win32");
  mac.sha256 = "mutated";

  assert.deepEqual(trustedLgCliArchive("darwin"), {
    version: "1.12.4",
    operatorSelected: true,
    helpUrl: LG_CLI_PAGE,
    archiveName: "webOS_TV_CLI_mac_1.12.4-j27.tgz",
    sha256: "50b1d66afc52b3b1aee57fce4c7b8b59b49b3d026be4262d811af45132d61525",
  });
  assert.deepEqual(windows, {
    version: "1.12.4",
    operatorSelected: true,
    helpUrl: LG_CLI_PAGE,
    archiveName: "webOS_TV_CLI_win_1.12.4-j27.zip",
    sha256: "87764cf85f0314d593edb1bc93cd9f8c52745a1f3528bde94224d92403d91870",
  });
  assert.throws(() => trustedLgCliArchive("linux"), /macOS and Windows/i);
});

test("returns a cloned audited legacy ChromeDriver archive for each supported host", () => {
  const mac = trustedChromeDriverArchive("darwin");
  const windows = trustedChromeDriverArchive("win32");
  mac.sha256 = "mutated";

  assert.deepEqual(trustedChromeDriverArchive("darwin"), {
    version: "2.36.540469",
    archiveName: "chromedriver_mac64.zip",
    url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_mac64.zip",
    sha256: "5fdf19698b213df76bdb5b8731b9a3c0394da4a40dc040b0554af64d6b251a86",
  });
  assert.deepEqual(windows, {
    version: "2.36.540469",
    archiveName: "chromedriver_win32.zip",
    url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_win32.zip",
    sha256: "a5992057ceaae52eb9b3f8e1fead7df5ca7e8c366a3cc3243c3dd8e6200c8a74",
  });
  assert.throws(() => trustedChromeDriverArchive("linux"), /macOS and Windows/i);
});

test("returns a cloned pinned LG bundle with exact automatic artifact records", () => {
  const mac = trustedLgToolchainBundle("darwin");
  const windows = trustedLgToolchainBundle("win32");
  mac.components.node.version = "mutated";

  assert.deepEqual(Object.keys(trustedLgToolchainBundle("darwin").components), ["node", "webosCli", "appium", "lgDriver", "chromedriver"]);
  assert.equal(trustedLgToolchainBundle("darwin").components.node.version, "24.18.0");
  assert.match(trustedLgToolchainBundle("darwin").components.node.url, /node-v24\.18\.0-darwin-arm64\.tar\.gz$/);
  assert.match(windows.components.node.url, /node-v24\.18\.0-win-x64\.zip$/);
  for (const bundle of [trustedLgToolchainBundle("darwin"), windows]) {
    assert.match(bundle.components.appium.url, /registry\.npmjs\.org\/appium\/-\/appium-2\.19\.0\.tgz$/);
    assert.match(bundle.components.lgDriver.url, /registry\.npmjs\.org\/appium-lg-webos-driver\/-\/appium-lg-webos-driver-0\.5\.0\.tgz$/);
    for (const component of Object.values(bundle.components)) {
      assert.match(component.sha256, /^[a-f0-9]{64}$/u);
    }
  }
  assert.throws(() => trustedLgToolchainBundle("linux"), /macOS and Windows/i);
});
