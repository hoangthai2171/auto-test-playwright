"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgManagedInstallOperations} = require("../../app/lg-managed-install-operations");

const managedRoot = "/user-data/lg-toolchain";
const nodeArtifact = {
  version: "24.18.0",
  url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-darwin-arm64.tar.gz",
  sha256: "a".repeat(64),
};
const bundle = {
  components: {
    node: nodeArtifact,
    webosCli: {operatorSelected: true},
    chromedriver: {
      version: "2.36.540469",
      url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_mac64.zip",
      sha256: "a".repeat(64),
    },
  },
};
const npmClosure = {lockfileVersion: 3, packages: {"": {dependencies: {appium: "2.19.0", "appium-lg-webos-driver": "0.5.0"}}}};

function createMemoryFs() {
  const directories = new Set([managedRoot, `${managedRoot}/webos-cli`, `${managedRoot}/chromedriver`]);
  const files = new Set([
    `${managedRoot}/webos-cli/CLI/bin/ares`,
    `${managedRoot}/chromedriver/chromedriver`,
    `${managedRoot}/node/old-node`,
  ]);
  const contents = new Map();
  const renameCalls = [];
  const writeCalls = [];
  function move(entries, fromPath, toPath) {
    const matches = [...entries].filter((entry) => entry === fromPath || entry.startsWith(`${fromPath}/`));
    if (!matches.length) {
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    }
    for (const entry of matches) {
      entries.delete(entry);
      entries.add(`${toPath}${entry.slice(fromPath.length)}`);
    }
  }
  function moveContents(fromPath, toPath) {
    for (const entry of [...contents.keys()]) {
      if (entry === fromPath || entry.startsWith(`${fromPath}/`)) {
        contents.set(`${toPath}${entry.slice(fromPath.length)}`, contents.get(entry));
        contents.delete(entry);
      }
    }
  }
  function copy(entries, fromPath, toPath) {
    for (const entry of [...entries]) {
      if (entry === fromPath || entry.startsWith(`${fromPath}/`)) entries.add(`${toPath}${entry.slice(fromPath.length)}`);
    }
  }
  function copyContents(fromPath, toPath) {
    for (const [entry, value] of contents.entries()) {
      if (entry === fromPath || entry.startsWith(`${fromPath}/`)) contents.set(`${toPath}${entry.slice(fromPath.length)}`, value);
    }
  }
  return {
    directories,
    files,
    contents,
    renameCalls,
    writeCalls,
    fs: {
      async stat(targetPath) {
        if (directories.has(targetPath)) return {isDirectory: () => true, isFile: () => false};
        if (files.has(targetPath)) return {isDirectory: () => false, isFile: () => true};
        const error = new Error("not found");
        error.code = "ENOENT";
        throw error;
      },
      async mkdir(targetPath) { directories.add(targetPath); },
      async rm(targetPath) {
        for (const entries of [directories, files]) {
          for (const entry of [...entries]) {
            if (entry === targetPath || entry.startsWith(`${targetPath}/`)) entries.delete(entry);
          }
        }
        for (const entry of [...contents.keys()]) {
          if (entry === targetPath || entry.startsWith(`${targetPath}/`)) contents.delete(entry);
        }
      },
      async cp(fromPath, toPath) {
        copy(directories, fromPath, toPath);
        copy(files, fromPath, toPath);
        copyContents(fromPath, toPath);
      },
      async rename(fromPath, toPath) {
        renameCalls.push([fromPath, toPath]);
        move(directories, fromPath, toPath);
        move(files, fromPath, toPath);
        moveContents(fromPath, toPath);
      },
      async readFile(targetPath) {
        if (contents.has(targetPath)) return contents.get(targetPath);
        const error = new Error("not found");
        error.code = "ENOENT";
        throw error;
      },
      async writeFile(targetPath, value) {
        writeCalls.push([targetPath, value]);
        contents.set(targetPath, String(value));
        files.add(targetPath);
      },
    },
  };
}

function createHarness({hash = nodeArtifact.sha256, download: downloadOverride, extractNode: extractNodeOverride, installNpmClosure: installNpmClosureOverride, verify: verifyOverride, downloadChromeDriver: downloadChromeDriverOverride, extractChromeDriver: extractChromeDriverOverride, verifyChromeDriver: verifyChromeDriverOverride} = {}) {
  const memory = createMemoryFs();
  const calls = [];
  const operations = createLgManagedInstallOperations({
    platform: "darwin",
    managedRoot,
    fs: memory.fs,
    async download({artifact, destination}) {
      calls.push(["download", artifact, destination]);
      if (downloadOverride) return downloadOverride({artifact, destination});
      const archivePath = `${destination}/node.tgz`;
      memory.files.add(archivePath);
      return archivePath;
    },
    async hashFile() { return hash; },
    async extractNode({destination}) {
      calls.push(["extract-node", destination]);
      if (extractNodeOverride) return extractNodeOverride({destination});
      memory.directories.add(destination);
      memory.files.add(`${destination}/bin/node`);
    },
    async installNpmClosure({npmClosure: receivedClosure, nodeRoot, destination}) {
      calls.push(["install-npm", receivedClosure, nodeRoot, destination]);
      if (installNpmClosureOverride) return installNpmClosureOverride({npmClosure: receivedClosure, nodeRoot, destination, memory});
      memory.directories.add(destination);
      memory.files.add(`${destination}/node_modules/.bin/appium`);
    },
    async verify({nodeRoot, appiumRoot}) {
      calls.push(["verify", nodeRoot, appiumRoot]);
      if (verifyOverride) return verifyOverride({nodeRoot, appiumRoot});
      return true;
    },
    async downloadChromeDriver({artifact, destination}) {
      calls.push(["download-chromedriver", artifact, destination]);
      if (downloadChromeDriverOverride) return downloadChromeDriverOverride({artifact, destination});
      const archivePath = `${destination}/chromedriver.zip`;
      memory.files.add(archivePath);
      return archivePath;
    },
    async extractChromeDriver({archivePath, destination}) {
      calls.push(["extract-chromedriver", archivePath, destination]);
      if (extractChromeDriverOverride) return extractChromeDriverOverride({archivePath, destination});
      memory.files.add(`${destination}/chromedriver`);
    },
    async verifyChromeDriver({chromedriverRoot}) {
      calls.push(["verify-chromedriver", chromedriverRoot]);
      if (verifyChromeDriverOverride) return verifyChromeDriverOverride({chromedriverRoot});
      return true;
    },
  });
  return {operations, memory, calls};
}

test("keeps the current managed root when the pinned Node archive checksum fails", async () => {
  const {operations, memory, calls} = createHarness({hash: "b".repeat(64)});

  const result = await operations.install({bundle, npmClosure});

  assert.deepEqual(result, {ok: false, status: "CHECKSUM_MISMATCH"});
  assert.equal(memory.files.has(`${managedRoot}/node/old-node`), true);
  assert.equal(memory.directories.has(`${managedRoot}.auto.staging`), false);
  assert.deepEqual(calls.map(([name]) => name), ["download"]);
});

test("classifies a reviewed Node download failure without replacing the managed root", async () => {
  const {operations, memory, calls} = createHarness({
    download: async () => { throw new Error("network unavailable"); },
  });

  const result = await operations.install({bundle, npmClosure});

  assert.deepEqual(result, {ok: false, status: "DOWNLOAD_FAILED"});
  assert.equal(memory.files.has(`${managedRoot}/node/old-node`), true);
  assert.equal(memory.directories.has(`${managedRoot}.auto.staging`), false);
  assert.deepEqual(calls.map(([name]) => name), ["download"]);
});

test("creates the staged Node destination before extracting the reviewed archive", async () => {
  const {operations, memory} = createHarness({
    extractNode: async ({destination}) => {
      assert.equal(memory.directories.has(destination), true);
    },
  });

  assert.deepEqual(await operations.install({bundle, npmClosure}), {ok: true, status: "LG_TOOLCHAIN_INSTALLED"});
});

test("creates the staged Appium destination before writing the reviewed closure", async () => {
  const {operations, memory} = createHarness({
    installNpmClosure: async ({destination}) => {
      assert.equal(memory.directories.has(destination), true);
    },
  });

  assert.deepEqual(await operations.install({bundle, npmClosure}), {ok: true, status: "LG_TOOLCHAIN_INSTALLED"});
});

test("preserves the safe component verification result", async () => {
  const {operations} = createHarness({
    verify: async () => ({ok: false, verification: "LG_DRIVER_UNVERIFIED"}),
  });

  assert.deepEqual(await operations.install({bundle, npmClosure}), {
    ok: false,
    status: "VERIFICATION_FAILED",
    verification: "LG_DRIVER_UNVERIFIED",
  });
});

test("atomically stages Node and the audited npm closure without replacing imported components", async () => {
  const {operations, memory, calls} = createHarness();

  const result = await operations.install({bundle, npmClosure});

  assert.deepEqual(result, {ok: true, status: "LG_TOOLCHAIN_INSTALLED"});
  assert.deepEqual(calls.map(([name]) => name), ["download", "extract-node", "install-npm", "verify"]);
  assert.equal(calls[0][1], nodeArtifact);
  assert.equal(calls[2][1], npmClosure);
  assert.equal(memory.files.has(`${managedRoot}/node/bin/node`), true);
  assert.equal(memory.files.has(`${managedRoot}/appium/node_modules/.bin/appium`), true);
  assert.equal(memory.files.has(`${managedRoot}/webos-cli/CLI/bin/ares`), true);
  assert.equal(memory.files.has(`${managedRoot}/chromedriver/chromedriver`), true);
  assert.equal(memory.directories.has(`${managedRoot}.auto.staging`), false);
});

test("rewrites the Appium extension registry from the staging path to the activated managed root", async () => {
  const registryPath = `${managedRoot}/appium/node_modules/.cache/appium/extensions.yaml`;
  const {operations, memory} = createHarness({
    installNpmClosure: async ({destination, memory: stagedMemory}) => {
      stagedMemory.directories.add(destination);
      stagedMemory.files.add(`${destination}/node_modules/.bin/appium`);
      stagedMemory.files.add(`${destination}/node_modules/appium-lg-webos-driver/package.json`);
      await stagedMemory.fs.writeFile(
        `${destination}/node_modules/.cache/appium/extensions.yaml`,
        [
          "drivers:",
          "  webos:",
          "    installPath: /user-data/lg-toolchain.auto.staging/appium/node_modules/appium-lg-webos-driver",
          "plugins: {}",
        ].join("\n"),
        "utf8",
      );
    },
  });

  assert.deepEqual(await operations.install({bundle, npmClosure}), {ok: true, status: "LG_TOOLCHAIN_INSTALLED"});

  assert.equal(memory.contents.get(registryPath), [
    "drivers:",
    "  webos:",
    "    installPath: /user-data/lg-toolchain/appium/node_modules/appium-lg-webos-driver",
    "plugins: {}",
  ].join("\n"));
});

test("adds a catalog-selected ChromeDriver and records its verified version before activation", async () => {
  const {operations, memory, calls} = createHarness();

  const result = await operations.install({bundle, npmClosure, includeChromeDriver: true});

  assert.deepEqual(result, {ok: true, status: "LG_TOOLCHAIN_INSTALLED"});
  assert.deepEqual(calls.map(([name]) => name), [
    "download",
    "extract-node",
    "install-npm",
    "verify",
    "download-chromedriver",
    "extract-chromedriver",
    "verify-chromedriver",
  ]);
  assert.equal(memory.files.has(`${managedRoot}/chromedriver/chromedriver`), true);
  assert.equal(memory.files.has(`${managedRoot}/chromedriver/metadata.json`), true);
  assert.match(memory.writeCalls[0][1], /2\.36\.540469/);
});

test("emits ordered safe milestones while installing the reviewed managed bundle", async () => {
  const {operations} = createHarness();
  const progress = [];

  const result = await operations.install({
    bundle,
    npmClosure,
    onProgress: (event) => progress.push(event),
  });

  assert.deepEqual(result, {ok: true, status: "LG_TOOLCHAIN_INSTALLED"});
  assert.deepEqual(progress, [
    {code: "preparing"},
    {code: "downloading-node"},
    {code: "verifying-node"},
    {code: "extracting-node"},
    {code: "installing-appium"},
    {code: "verifying-lg-driver"},
    {code: "activating"},
    {code: "complete"},
  ]);
  assert.doesNotMatch(JSON.stringify(progress), /user-data|node\.tgz|https?:\/\//i);
});
