"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {Readable} = require("node:stream");

const {createLgManagedInstallDependencies} = require("../../app/lg-managed-install-dependencies");

test("installs the audited Appium closure with the managed npm and scripts disabled", async () => {
  const writes = [];
  const runs = [];
  const npmClosure = {
    lockfileVersion: 3,
    packages: {
      "": {dependencies: {appium: "2.19.0", "appium-lg-webos-driver": "0.5.0"}},
    },
  };
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {
      async writeFile(targetPath, contents, encoding) { writes.push([targetPath, contents, encoding]); },
    },
    async run(command, args, options) { runs.push([command, args, options]); },
  });

  await dependencies.installNpmClosure({
    npmClosure,
    nodeRoot: "/managed/node",
    destination: "/managed/appium",
  });

  assert.deepEqual(writes, [
    ["/managed/appium/package.json", `${JSON.stringify({name: "lg-toolchain-managed-appium", private: true, dependencies: npmClosure.packages[""] .dependencies}, null, 2)}\n`, "utf8"],
    ["/managed/appium/package-lock.json", `${JSON.stringify(npmClosure, null, 2)}\n`, "utf8"],
  ]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0][0], "/managed/node/bin/npm");
  assert.deepEqual(runs[0][1], ["ci", "--ignore-scripts", "--omit=dev", "--prefix", "/managed/appium"]);
  assert.equal(runs[0][2].cwd, "/managed/appium");
  assert.equal(runs[0][2].env.npm_config_audit, "false");
  assert.equal(runs[0][2].env.npm_config_fund, "false");
  assert.equal(runs[0][2].env.npm_config_ignore_scripts, "true");
  assert.equal(runs[0][2].env.PATH.startsWith("/managed/node/bin"), true);
  assert.deepEqual({shell: runs[0][2].shell, windowsHide: runs[0][2].windowsHide}, {shell: false, windowsHide: true});
});

test("extracts the macOS Node archive with a fixed tar command", async () => {
  const runs = [];
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run(command, args, options) { runs.push([command, args, options]); },
  });

  await dependencies.extractNode({
    archivePath: "/staging/node.tgz",
    destination: "/staging/node",
  });

  assert.deepEqual(runs, [[
    "/usr/bin/tar",
    ["-xzf", "/staging/node.tgz", "-C", "/staging/node", "--strip-components", "1"],
    {shell: false, windowsHide: true},
  ]]);
});

test("rejects an unapproved Node source before a download request", async () => {
  const requests = [];
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run() {},
    async fetch(url) { requests.push(url); },
  });

  await assert.rejects(
    dependencies.download({
      artifact: {official: true, version: "24.18.0", archiveName: "node.tgz", url: "http://invalid.example/node.tgz"},
      destination: "/staging",
    }),
    /approved Node artifact/i,
  );
  assert.deepEqual(requests, []);
});

test("downloads the reviewed Node archive without allowing redirects", async () => {
  const requests = [];
  const writes = [];
  const artifact = {
    official: true,
    version: "24.18.0",
    archiveName: "node-v24.18.0-darwin-arm64.tar.gz",
    url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-darwin-arm64.tar.gz",
  };
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {
      async writeFile(targetPath, contents, options) { writes.push([targetPath, contents, options]); },
    },
    async run() {},
    async fetch(url, options) {
      requests.push([url, options]);
      return new Response("reviewed node archive");
    },
  });

  const archivePath = await dependencies.download({artifact, destination: "/staging"});

  assert.equal(archivePath, "/staging/node-v24.18.0-darwin-arm64.tar.gz");
  assert.deepEqual(requests, [[artifact.url, {redirect: "error"}]]);
  assert.deepEqual(writes, [[
    "/staging/node-v24.18.0-darwin-arm64.tar.gz",
    Buffer.from("reviewed node archive"),
    {flag: "wx", mode: 0o600},
  ]]);
});

test("downloads and verifies only the pinned macOS ChromeDriver archive", async () => {
  const requests = [];
  const writes = [];
  const runs = [];
  const artifact = {
    official: true,
    version: "2.36.540469",
    archiveName: "chromedriver_mac64.zip",
    url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_mac64.zip",
    sha256: "a".repeat(64),
  };
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {
      async writeFile(targetPath, contents, options) { writes.push([targetPath, contents, options]); },
    },
    async run(command, args, options) {
      runs.push([command, args, options]);
      if (args[0] === "--version") return {stdout: "ChromeDriver 2.36.540469\n"};
    },
    async fetch(url, options) {
      requests.push([url, options]);
      return new Response("reviewed chromedriver archive");
    },
  });

  const archivePath = await dependencies.downloadChromeDriver({artifact, destination: "/staging"});
  await dependencies.extractChromeDriver({archivePath, destination: "/staging/chromedriver"});

  assert.equal(await dependencies.verifyChromeDriver({chromedriverRoot: "/staging/chromedriver"}), true);
  assert.deepEqual(requests, [[artifact.url, {redirect: "error"}]]);
  assert.deepEqual(writes, [[
    "/staging/chromedriver_mac64.zip",
    Buffer.from("reviewed chromedriver archive"),
    {flag: "wx", mode: 0o600},
  ]]);
  assert.deepEqual(runs, [
    ["/usr/bin/unzip", ["-q", "/staging/chromedriver_mac64.zip", "-d", "/staging/chromedriver"], {shell: false, windowsHide: true}],
    ["/staging/chromedriver/chromedriver", ["--version"], {shell: false, windowsHide: true}],
  ]);
});

test("downloads and verifies a catalog-approved Chrome-for-Testing artifact by its exact version", async () => {
  const requests = [];
  const dynamicArtifact = {
    official: true,
    version: "120.0",
    archiveName: "chromedriver-mac-arm64.zip",
    url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/mac-arm64/chromedriver-mac-arm64.zip",
    sha256: "a".repeat(64),
  };
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run(_command, args) {
      return args[0] === "--version" ? {stdout: "ChromeDriver 120.0\n"} : {stdout: ""};
    },
    async fetch(url, options) {
      requests.push([url, options]);
      return new Response("reviewed chromedriver archive");
    },
  });

  await dependencies.downloadChromeDriver({artifact: dynamicArtifact, destination: "/staging"});
  assert.equal(await dependencies.verifyChromeDriver({chromedriverRoot: "/staging/chromedriver", version: dynamicArtifact.version}), true);
  assert.deepEqual(requests, [[dynamicArtifact.url, {redirect: "error"}]]);
});

test("hashes a staged archive with SHA-256 before activation", async () => {
  const algorithms = [];
  const chunks = [];
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run() {},
    createReadStream(archivePath) {
      assert.equal(archivePath, "/staging/node.tgz");
      return Readable.from([Buffer.from("reviewed "), Buffer.from("archive")]);
    },
    createHash(algorithm) {
      algorithms.push(algorithm);
      return {
        update(chunk) { chunks.push(chunk.toString()); },
        digest(encoding) {
          assert.equal(encoding, "hex");
          return "verified-digest";
        },
      };
    },
  });

  const digest = await dependencies.hashFile("/staging/node.tgz");

  assert.equal(digest, "verified-digest");
  assert.deepEqual(algorithms, ["sha256"]);
  assert.deepEqual(chunks, ["reviewed ", "archive"]);
});

test("verifies the LG driver under its Appium driver name", async () => {
  const runs = [];
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run(command, args, options) {
      runs.push([command, args, options]);
      if (args[0] === "--version" && command.endsWith("/node")) return {stdout: "v24.18.0\n"};
      if (args[0] === "--version") return {stdout: "2.19.0\n"};
      return {stdout: JSON.stringify({webos: {version: "0.5.0"}})};
    },
  });

  const verified = await dependencies.verify({nodeRoot: "/managed/node", appiumRoot: "/managed/appium"});

  assert.deepEqual(verified, {ok: true});
  assert.deepEqual(runs.map(([command, args]) => [command, args]), [
    ["/managed/node/bin/node", ["--version"]],
    ["/managed/appium/node_modules/.bin/appium", ["--version"]],
    ["/managed/appium/node_modules/.bin/appium", ["driver", "list", "--installed", "--json"]],
  ]);
  assert.equal(runs.every(([, , options]) => options.shell === false && options.windowsHide === true), true);
  assert.equal(runs.every(([, , options]) => options.env.APPIUM_HOME === "/managed/appium"), true);
  assert.equal(/host|deviceName|appium:rcMode|clearApp/i.test(JSON.stringify(runs)), false);
});

test("rejects the legacy nested driver response instead of guessing a driver layout", async () => {
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run(command, args) {
      if (args[0] === "--version" && command.endsWith("/node")) return {stdout: "v24.18.0\n"};
      if (args[0] === "--version") return {stdout: "2.19.0\n"};
      return {stdout: JSON.stringify({drivers: {webos: {version: "0.5.0"}}})};
    },
  });

  assert.deepEqual(await dependencies.verify({nodeRoot: "/managed/node", appiumRoot: "/managed/appium"}), {
    ok: false,
    verification: "LG_DRIVER_UNVERIFIED",
  });
});

test("reports an unregistered LG driver without exposing command output", async () => {
  const dependencies = createLgManagedInstallDependencies({
    platform: "darwin",
    fs: {async writeFile() {}},
    async run(command, args) {
      if (args[0] === "--version" && command.endsWith("/node")) return {stdout: "v24.18.0\n"};
      if (args[0] === "--version") return {stdout: "2.19.0\n"};
      return {stdout: JSON.stringify({drivers: {}})};
    },
  });

  assert.deepEqual(await dependencies.verify({nodeRoot: "/managed/node", appiumRoot: "/managed/appium"}), {
    ok: false,
    verification: "LG_DRIVER_UNVERIFIED",
  });
});
