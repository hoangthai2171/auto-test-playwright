const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createRemotePage,
  logoutToLoginScreen,
  prepareDedicatedLogin,
  resetForDedicatedLogin,
  requireDedicatedAccount,
} = require("../../scripts/real-tv-appium/tizen-poc-login");

test("Samsung POC login credentials are runtime-only and require both dedicated-account values", () => {
  assert.throws(() => requireDedicatedAccount({}), /MYTV_TIZEN_TEST_USERNAME/i);
  assert.throws(() => requireDedicatedAccount({ MYTV_TIZEN_TEST_USERNAME: "qa-account" }), /MYTV_TIZEN_TEST_USERNAME/i);
  assert.deepEqual(requireDedicatedAccount({
    MYTV_TIZEN_TEST_USERNAME: "qa-account",
    MYTV_TIZEN_TEST_PASSWORD: "private-password",
  }), {
    username: "qa-account",
    password: "private-password",
  });
});

test("Samsung POC login adapter maps browser navigation to real Tizen remote keys", async () => {
  const calls = [];
  const page = createRemotePage({
    execute: async (script, args) => {
      calls.push({ script, args });
      return true;
    },
    pressKey: async (key) => calls.push({ key }),
  });

  await page.keyboard.press("ArrowRight");
  await page.evaluate((value) => value === "expected", "expected");
  await page.evaluate((focused) => Array.from(focused.parentElement?.children || []), {});

  assert.deepEqual(calls[0], { key: "KEY_RIGHT" });
  assert.match(calls[1].script, /value === "expected"/);
  assert.deepEqual(calls[1].args, ["expected"]);
  assert.doesNotMatch(calls[2].script, /\?\./);
  assert.match(calls[2].script, /focused\.parentElement && focused\.parentElement\.children/);
});

test("Samsung POC restores the test app to the account-login start before using credentials", async () => {
  const calls = [];
  await resetForDedicatedLogin({
    appId: "PP2MTMRMs8.MyTV",
    packageId: "PP2MTMRMs8",
    execute: async (script, args) => {
      calls.push({ script, args });
      return true;
    },
  });

  assert.deepEqual(calls.slice(0, 3), [
    { script: "tizen: terminateApp", args: [{ pkgId: "PP2MTMRMs8" }] },
    { script: "tizen: activateApp", args: [{ appPackage: "PP2MTMRMs8.MyTV", debug: true }] },
    { script: "tizen: clearApp", args: [] },
  ]);
  assert.match(calls[3].script, /btn-welcome-0-1/);
});

test("Samsung POC does not reset the test app again when the initial welcome login is ready", async () => {
  const calls = [];
  await prepareDedicatedLogin({
    appId: "PP2MTMRMs8.MyTV",
    packageId: "PP2MTMRMs8",
    initialWelcomeReady: true,
    execute: async (script, args) => {
      calls.push({script, args});
      return true;
    },
  });

  assert.deepEqual(calls[0], {script: "tizen: pressKey", args: [{key: "KEY_UP"}]});
  assert.match(calls[1].script, /btn-welcome-0-1/);
});

test("Samsung POC treats the account login screen as logout success before clearing local storage", async () => {
  const calls = [];
  const waits = [];

  await logoutToLoginScreen({
    execute: async (script, args) => {
      calls.push({script, args});
      return /remote-login-method/.test(script);
    },
    wait: async (timeoutMs) => waits.push(timeoutMs),
  });

  const logoutIndex = calls.findIndex(({script}) => /processLogOut/.test(script));
  const loginScreenIndex = calls.findIndex(({script}) => /remote-login-method/.test(script));
  const clearStorageIndex = calls.findIndex(({script}) => /localStorage\.clear\(\)/.test(script));
  assert.deepEqual(waits, [2_000]);
  assert.ok(logoutIndex >= 0);
  assert.ok(loginScreenIndex > logoutIndex);
  assert.ok(clearStorageIndex > loginScreenIndex);
});
