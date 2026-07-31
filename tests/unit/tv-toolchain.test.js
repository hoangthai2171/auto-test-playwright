const test = require("node:test");
const assert = require("node:assert/strict");

const {createTvToolchainInspector} = require("../../app/tv-toolchain");

test("reports a configured local LG toolchain without exposing configuration paths", async () => {
  const commands = [];
  const inspector = createTvToolchainInspector({
    toolchainConfig: {
      async resolve() {
        return {
          webosSdkHome: "/toolchain/webos-sdk",
          appiumHome: "/toolchain/appium-home",
          appiumBin: "/toolchain/appium/bin/appium",
          chromedriverPath: "/toolchain/chromedriver",
        };
      },
      async status() {
        return {
          configured: true,
          source: "managed",
          platform: "webos",
          components: [{id: "webos-sdk", label: "webOS SDK", status: "ready"}],
        };
      },
    },
    existsSync(filePath) {
      return [
        "/toolchain/webos-sdk/CLI/bin/ares",
        "/toolchain/webos-sdk/CLI/bin/ares-setup-device",
        "/toolchain/webos-sdk/CLI/bin/ares-device-info",
        "/toolchain/webos-sdk/CLI/bin/ares-install",
      ].includes(filePath);
    },
    spawnSync(command, args, options) {
      commands.push([command, args, options.env.APPIUM_HOME]);
      if (args[0] === "--version") return {status: 0, stdout: "2.19.0\n"};
      return {
        status: 0,
        stdout: JSON.stringify({
          "appium-lg-webos-driver": {version: "0.5.0"},
        }),
      };
    },
  });

  const result = await inspector.inspect();

  assert.deepEqual(result, {
    ok: true,
    platform: "webos",
    configured: true,
    source: "managed",
    components: [{id: "webos-sdk", label: "webOS SDK", status: "ready"}],
    tools: [
      {id: "webos-cli", label: "webOS CLI", status: "ready"},
      {id: "appium", label: "Appium", status: "ready", version: "2.19.0"},
      {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "ready", version: "0.5.0"},
    ],
  });
  assert.deepEqual(commands, [
    ["/toolchain/appium/bin/appium", ["--version"], "/toolchain/appium-home"],
    ["/toolchain/appium/bin/appium", ["driver", "list", "--installed", "--json"], "/toolchain/appium-home"],
  ]);
  assert.doesNotMatch(JSON.stringify(result), /\/toolchain\//);
});

test("reports an unconfigured local toolchain without invoking Appium", async () => {
  const commands = [];
  const inspector = createTvToolchainInspector({
    toolchainConfig: {
      async resolve() {
        const error = new Error("unavailable");
        error.code = "TOOLCHAIN_NOT_CONFIGURED";
        throw error;
      },
      async status() {
        return {
          configured: false,
          platform: "webos",
          components: [{id: "webos-sdk", label: "webOS SDK", status: "missing"}],
        };
      },
    },
    existsSync: () => false,
    spawnSync(command, args) {
      commands.push([command, args]);
      return {error: new Error("not found")};
    },
  });

  const result = await inspector.inspect();

  assert.deepEqual(result, {
    ok: false,
    platform: "webos",
    configured: false,
    components: [{id: "webos-sdk", label: "webOS SDK", status: "missing"}],
    tools: [
      {id: "webos-cli", label: "webOS CLI", status: "missing"},
      {id: "appium", label: "Appium", status: "missing"},
      {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "missing"},
    ],
  });
  assert.deepEqual(commands, []);
});

test("uses the app-managed Appium executable instead of the fallback binary", async () => {
  const commands = [];
  const inspector = createTvToolchainInspector({
    toolchainConfig: {
      async resolve() {
        return {
          webosSdkHome: "/toolchain/webos-sdk",
          appiumHome: "/user-data/lg-toolchain/appium",
          appiumBin: "/user-data/lg-toolchain/appium/node_modules/.bin/appium",
          chromedriverPath: "/toolchain/chromedriver",
        };
      },
      async status() {
        return {configured: true, source: "managed", platform: "webos", components: []};
      },
    },
    existsSync: () => true,
    spawnSync(command, args) {
      commands.push([command, args]);
      return args[0] === "--version"
        ? {status: 0, stdout: "2.19.0\n"}
        : {status: 0, stdout: JSON.stringify({"appium-lg-webos-driver": {version: "0.5.0"}})};
    },
  });

  await inspector.inspect();

  assert.deepEqual(commands, [
    ["/user-data/lg-toolchain/appium/node_modules/.bin/appium", ["--version"]],
    ["/user-data/lg-toolchain/appium/node_modules/.bin/appium", ["driver", "list", "--installed", "--json"]],
  ]);
});
