"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgToolchainDetector} = require("../../app/lg-toolchain-detector");

const managedRoot = "/user-data/lg-toolchain";

function createFs(paths = []) {
  const available = new Set(paths);
  const reads = [];
  return {
    reads,
    fs: {
      async stat(targetPath) {
        reads.push(targetPath);
        if (available.has(targetPath)) return {isFile: () => true};
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    },
  };
}

test("reports every missing managed component without writing or spawning", async () => {
  const memory = createFs();
  const detector = createLgToolchainDetector({platform: "darwin", managedRoot, fs: memory.fs});

  assert.deepEqual(await detector.inspect(), {
    source: "managed",
    state: "missing",
    components: [
      {id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"},
      {id: "webos-cli", label: "webOS CLI", status: "missing", version: "1.12.4"},
      {id: "appium", label: "Appium", status: "missing", version: "2.19.0"},
      {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "missing", version: "0.5.0"},
      {id: "chromedriver", label: "ChromeDriver", status: "missing", version: "2.36.540469"},
    ],
  });
  assert.equal(memory.reads.length > 0, true);
});

test("reports a complete app-managed bundle as ready", async () => {
  const memory = createFs([
    `${managedRoot}/node/bin/node`, `${managedRoot}/node/bin/npm`,
    `${managedRoot}/webos-cli/CLI/bin/ares`, `${managedRoot}/webos-cli/CLI/bin/ares-setup-device`,
    `${managedRoot}/webos-cli/CLI/bin/ares-device-info`, `${managedRoot}/webos-cli/CLI/bin/ares-install`,
    `${managedRoot}/appium/node_modules/.bin/appium`, `${managedRoot}/appium/node_modules/appium-lg-webos-driver/package.json`,
    `${managedRoot}/chromedriver/chromedriver`,
  ]);
  const detector = createLgToolchainDetector({platform: "darwin", managedRoot, fs: memory.fs});

  const result = await detector.inspect();

  assert.equal(result.state, "ready");
  assert.equal(result.components.every((component) => component.status === "ready"), true);
  assert.doesNotMatch(JSON.stringify(result), /\/user-data\//);
});

test("marks a different installed ChromeDriver as repair-needed for the selected catalog version", async () => {
  const memory = createFs([
    `${managedRoot}/node/bin/node`, `${managedRoot}/node/bin/npm`,
    `${managedRoot}/webos-cli/CLI/bin/ares`, `${managedRoot}/webos-cli/CLI/bin/ares-setup-device`,
    `${managedRoot}/webos-cli/CLI/bin/ares-device-info`, `${managedRoot}/webos-cli/CLI/bin/ares-install`,
    `${managedRoot}/appium/node_modules/.bin/appium`, `${managedRoot}/appium/node_modules/appium-lg-webos-driver/package.json`,
    `${managedRoot}/chromedriver/chromedriver`,
  ]);
  const detector = createLgToolchainDetector({platform: "darwin", managedRoot, fs: memory.fs});

  const result = await detector.inspect({chromedriverVersion: "120.0"});

  assert.deepEqual(result.components.find((component) => component.id === "chromedriver"), {
    id: "chromedriver",
    label: "ChromeDriver",
    status: "repair-needed",
    version: "120.0",
  });
});
