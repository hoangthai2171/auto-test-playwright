"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createLgProductGateCase, parseLgCaseRunnerArgs, withoutLgProductGateCredentials} = require("../../scripts/real-tv-appium/lg-webos-case-runner-core");

test("creates the credentialed LG product gate from runtime values only", () => {
  const testCase = createLgProductGateCase({
    username: "runtime-user",
    password: "runtime-password",
    searchName: "VTV3 HD",
    contentType: "channel",
  });

  assert.equal(testCase.id, "lg-product-gate");
  assert.deepEqual(testCase.actions.map((action) => action.action), ["login", "open_search", "search_content", "play_search_result"]);
  assert.equal(testCase.actions[2].name, "VTV3 HD");
  assert.equal(testCase.actions[2].type, "channel");
  assert.equal(Object.hasOwn(testCase, "host"), false);
});

test("accepts only an explicit LG product-gate runtime configuration", () => {
  const args = parseLgCaseRunnerArgs([
    "--device", "LG2022",
    "--host", "runtime-tv.invalid",
    "--model", "55QNED80SRA",
    "--app-id", "com.mytvb2c.app",
    "--chromedriver", "/runtime/chromedriver",
    "--search-name", "VTV3 HD",
    "--content-type", "channel",
    "--secure-websocket",
    "--allow-self-signed-tls",
  ]);

  assert.equal(args["content-type"], "channel");
  assert.throws(() => parseLgCaseRunnerArgs(["--skip-screenshot-gate"]), /does not support/i);
});

test("removes LG product credentials before creating vendor subprocess environments", () => {
  assert.deepEqual(withoutLgProductGateCredentials({
    PATH: "/usr/bin",
    MYTV_LG_TEST_USERNAME: "runtime-user",
    MYTV_LG_TEST_PASSWORD: "runtime-password",
  }), {PATH: "/usr/bin"});
});
