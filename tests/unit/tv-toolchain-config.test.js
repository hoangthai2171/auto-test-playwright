"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createTvToolchainConfig} = require("../../app/tv-toolchain-config");

const filePath = "/user-data/tv-toolchain.json";
const managedRoot = "/user-data/lg-toolchain";
const validConfiguration = {
  webosSdkHome: "/toolchain/webos-sdk",
  appiumHome: "/toolchain/appium-home",
  appiumBin: "/toolchain/appium/bin/appium",
  chromedriverPath: "/toolchain/chromedriver",
};

function fileStats({directories = [], files = []} = {}) {
  const directorySet = new Set(directories);
  const fileSet = new Set(files);
  return async (targetPath) => {
    if (directorySet.has(targetPath)) return {isDirectory: () => true, isFile: () => false};
    if (fileSet.has(targetPath)) return {isDirectory: () => false, isFile: () => true};
    const error = new Error("not found");
    error.code = "ENOENT";
    throw error;
  };
}

function validStats() {
  return fileStats({
    directories: [validConfiguration.webosSdkHome, validConfiguration.appiumHome],
    files: [
      validConfiguration.chromedriverPath,
      validConfiguration.appiumBin,
      "/toolchain/webos-sdk/CLI/bin/ares",
      "/toolchain/webos-sdk/CLI/bin/ares-setup-device",
      "/toolchain/webos-sdk/CLI/bin/ares-device-info",
      "/toolchain/webos-sdk/CLI/bin/ares-install",
    ],
  });
}

function createMemoryFs({stat = validStats()} = {}) {
  const files = new Map();
  const writes = [];
  return {
    files,
    writes,
    fs: {
      async readFile(targetPath) {
        if (!files.has(targetPath)) {
          const error = new Error("not found");
          error.code = "ENOENT";
          throw error;
        }
        return files.get(targetPath);
      },
      async writeFile(targetPath, contents) {
        writes.push(["write", targetPath]);
        files.set(targetPath, contents);
      },
      async rename(fromPath, toPath) {
        writes.push(["rename", fromPath, toPath]);
        files.set(toPath, files.get(fromPath));
        files.delete(fromPath);
      },
      stat,
    },
  };
}

test("saves a valid toolchain atomically while exposing only availability", async () => {
  const memory = createMemoryFs();
  const config = createTvToolchainConfig({filePath, fs: memory.fs});

  const status = await config.save(validConfiguration);

  assert.deepEqual(status, {
    configured: true,
    source: "advanced",
    platform: "webos",
    components: [
      {id: "webos-sdk", label: "webOS SDK", status: "ready"},
      {id: "appium-home", label: "Appium home", status: "ready"},
      {id: "chromedriver", label: "ChromeDriver", status: "ready"},
    ],
  });
  assert.deepEqual(memory.writes, [
    ["write", `${filePath}.tmp`],
    ["rename", `${filePath}.tmp`, filePath],
  ]);
  assert.equal(memory.files.has(`${filePath}.tmp`), false);
  assert.equal(
    memory.files.get(filePath),
    `${JSON.stringify({version: 2, source: "advanced", advanced: validConfiguration}, null, 2)}\n`,
  );
  assert.doesNotMatch(JSON.stringify(status), /\/toolchain\//);
  assert.deepEqual(await config.resolve(), validConfiguration);
});

test("rejects an incomplete toolchain before it writes persistent configuration", async () => {
  const memory = createMemoryFs({
    stat: fileStats({
      directories: [validConfiguration.webosSdkHome, validConfiguration.appiumHome],
      files: [
        validConfiguration.chromedriverPath,
        validConfiguration.appiumBin,
        "/toolchain/webos-sdk/CLI/bin/ares",
        "/toolchain/webos-sdk/CLI/bin/ares-setup-device",
        "/toolchain/webos-sdk/CLI/bin/ares-device-info",
      ],
    }),
  });
  const config = createTvToolchainConfig({filePath, fs: memory.fs});

  await assert.rejects(
    config.save(validConfiguration),
    (error) => error.code === "TOOLCHAIN_INVALID" && !/\/toolchain\//.test(error.message),
  );
  assert.deepEqual(memory.writes, []);
});

test("requires an explicit Advanced Appium executable instead of a fallback path", async () => {
  const memory = createMemoryFs({
    stat: fileStats({
      directories: [validConfiguration.webosSdkHome, validConfiguration.appiumHome],
      files: [
        validConfiguration.chromedriverPath,
        validConfiguration.appiumBin,
        "/toolchain/webos-sdk/CLI/bin/ares",
        "/toolchain/webos-sdk/CLI/bin/ares-setup-device",
        "/toolchain/webos-sdk/CLI/bin/ares-device-info",
        "/toolchain/webos-sdk/CLI/bin/ares-install",
      ],
    }),
  });
  const config = createTvToolchainConfig({filePath, fs: memory.fs});

  await assert.rejects(config.save({...validConfiguration, appiumBin: ""}), /incomplete/i);

  assert.deepEqual(memory.writes, []);
});

test("reports an unconfigured local toolchain without creating a file", async () => {
  const memory = createMemoryFs();
  const config = createTvToolchainConfig({filePath, fs: memory.fs});

  assert.deepEqual(await config.status(), {
    configured: false,
    platform: "webos",
    components: [
      {id: "webos-sdk", label: "webOS SDK", status: "missing"},
      {id: "appium-home", label: "Appium home", status: "missing"},
      {id: "chromedriver", label: "ChromeDriver", status: "missing"},
    ],
  });
  assert.deepEqual(memory.writes, []);
  await assert.rejects(config.resolve(), (error) => error.code === "TOOLCHAIN_NOT_CONFIGURED");
});

test("resolves a verified user-imported LG CLI for read-only checks without a full execution toolchain", async () => {
  const memory = createMemoryFs({
    stat: fileStats({
      directories: [`${managedRoot}/webos-cli`],
      files: [
        `${managedRoot}/webos-cli/CLI/bin/ares`,
        `${managedRoot}/webos-cli/CLI/bin/ares-setup-device`,
        `${managedRoot}/webos-cli/CLI/bin/ares-device-info`,
        `${managedRoot}/webos-cli/CLI/bin/ares-install`,
      ],
    }),
  });
  const config = createTvToolchainConfig({filePath, fs: memory.fs, managedRoot});

  assert.equal(await config.resolveReadOnlyWebOsCli(), `${managedRoot}/webos-cli`);
  await assert.rejects(config.resolve(), (error) => error.code === "TOOLCHAIN_NOT_CONFIGURED");
  assert.deepEqual(memory.writes, []);
});

test("resolves a managed compatibility Appium runtime without requiring a saved ChromeDriver source", async () => {
  const memory = createMemoryFs({
    stat: fileStats({
      directories: [`${managedRoot}/webos-cli`, `${managedRoot}/appium`],
      files: [
        `${managedRoot}/appium/node_modules/.bin/appium`,
        `${managedRoot}/webos-cli/CLI/bin/ares`,
        `${managedRoot}/webos-cli/CLI/bin/ares-setup-device`,
        `${managedRoot}/webos-cli/CLI/bin/ares-device-info`,
        `${managedRoot}/webos-cli/CLI/bin/ares-install`,
      ],
    }),
  });
  const config = createTvToolchainConfig({filePath, fs: memory.fs, platform: "darwin", managedRoot});

  assert.deepEqual(await config.resolveCompatibilityRuntime(), {
    webosSdkHome: `${managedRoot}/webos-cli`,
    appiumHome: `${managedRoot}/appium`,
    appiumBin: `${managedRoot}/appium/node_modules/.bin/appium`,
  });
  await assert.rejects(config.resolve(), (error) => error.code === "TOOLCHAIN_NOT_CONFIGURED");
  assert.deepEqual(memory.writes, []);
});

test("activates a verified app-managed source without persisting its resolved paths", async () => {
  const memory = createMemoryFs({
    stat: fileStats({
      directories: [`${managedRoot}/webos-cli`, `${managedRoot}/appium`],
      files: [
        `${managedRoot}/chromedriver/chromedriver`,
        `${managedRoot}/appium/node_modules/.bin/appium`,
        `${managedRoot}/webos-cli/CLI/bin/ares`,
        `${managedRoot}/webos-cli/CLI/bin/ares-setup-device`,
        `${managedRoot}/webos-cli/CLI/bin/ares-device-info`,
        `${managedRoot}/webos-cli/CLI/bin/ares-install`,
      ],
    }),
  });
  const config = createTvToolchainConfig({filePath, fs: memory.fs, platform: "darwin", managedRoot});

  const status = await config.activateManaged();

  assert.deepEqual(status, {
    configured: true,
    source: "managed",
    platform: "webos",
    components: [
      {id: "webos-sdk", label: "webOS SDK", status: "ready"},
      {id: "appium-home", label: "Appium home", status: "ready"},
      {id: "chromedriver", label: "ChromeDriver", status: "ready"},
    ],
  });
  assert.deepEqual(await config.resolve(), {
    webosSdkHome: `${managedRoot}/webos-cli`,
    appiumHome: `${managedRoot}/appium`,
    appiumBin: `${managedRoot}/appium/node_modules/.bin/appium`,
    chromedriverPath: `${managedRoot}/chromedriver/chromedriver`,
  });
  assert.equal(memory.files.get(filePath), `${JSON.stringify({version: 2, source: "managed"}, null, 2)}\n`);
  assert.doesNotMatch(JSON.stringify(status), /\/user-data\//);
});

test("resolves a legacy advanced-path record without rewriting it", async () => {
  const memory = createMemoryFs();
  memory.files.set(filePath, `${JSON.stringify({version: 1, ...validConfiguration})}\n`);
  const config = createTvToolchainConfig({filePath, fs: memory.fs});

  assert.deepEqual(await config.resolve(), validConfiguration);
  assert.deepEqual(memory.writes, []);
});
