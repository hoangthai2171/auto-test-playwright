"use strict";

const navigation = require("../../tests/lib/navigation");

const REMOTE_KEY_CODES = Object.freeze({
  ArrowUp: "KEY_UP",
  ArrowDown: "KEY_DOWN",
  ArrowLeft: "KEY_LEFT",
  ArrowRight: "KEY_RIGHT",
  Enter: "KEY_ENTER",
  Backspace: "KEY_RETURN",
  Escape: "KEY_RETURN",
});

function chrome69CompatibleScript(source) {
  let compatible = source;
  let previous;
  do {
    previous = compatible;
    compatible = compatible.replace(
      /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\?\.([A-Za-z_$][\w$]*)/g,
      "($1 && $1.$2)"
    );
  } while (compatible !== previous);
  return compatible;
}

function requireDedicatedAccount(environment = process.env) {
  const username = String(environment.MYTV_TIZEN_TEST_USERNAME || "").trim();
  const password = String(environment.MYTV_TIZEN_TEST_PASSWORD || "");
  if (!username || !password) {
    throw new Error(
      "MYTV_TIZEN_TEST_USERNAME and MYTV_TIZEN_TEST_PASSWORD are required for --login-from-env; do not put them in source control."
    );
  }
  return { username, password };
}

function createRemotePage({ execute, pressKey }) {
  return {
    keyboard: {
      async press(key) {
        const remoteKey = REMOTE_KEY_CODES[key];
        if (!remoteKey) throw new Error(`Unsupported POC navigation key ${key}.`);
        await pressKey(remoteKey);
      },
    },
    async waitForTimeout(timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    },
  async evaluate(script, argument) {
      const source = typeof script === "function"
        ? `return (${script.toString()}).apply(null, arguments);`
        : script;
      return execute(chrome69CompatibleScript(source), argument === undefined ? [] : [argument]);
    },
  };
}

async function waitFor(execute, predicateScript, { timeoutMs = 20_000, label }) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() <= deadline) {
    lastValue = await execute(predicateScript);
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label || "required MyTV state"}.`);
}

const LOGIN_METHOD_VISIBLE = `return (() => {
  const element = document.getElementById('remote-login-method');
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
})();`;

const WELCOME_LOGIN_VISIBLE = `return (() => {
  const element = document.getElementById('btn-welcome-0-1');
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
})();`;

function inputLabelContains(text) {
  return `return ((document.getElementById('new_ui_login_input_label') || {}).innerText || '').includes(${JSON.stringify(text)});`;
}

const ACCOUNT_LOGIN_COMPLETE = `return (() => {
  const text = (document.body && document.body.innerText) || '';
  return typeof window.processLogOut === 'function' && !text.includes('Nhập mật khẩu');
})();`;

async function pressRemote(execute, key) {
  await execute("tizen: pressKey", [{ key }]);
}

async function resetForDedicatedLogin({ execute, appId, packageId }) {
  await execute("tizen: terminateApp", [{ pkgId: packageId }]);
  await execute("tizen: activateApp", [{ appPackage: appId, debug: true }]);
  await execute("tizen: clearApp", []);
  await waitFor(execute, WELCOME_LOGIN_VISIBLE, {
    label: "the MyTV welcome login control after test-app reset",
  });
}

async function prepareDedicatedLogin({ execute, appId, packageId, initialWelcomeReady = false }) {
  if (!initialWelcomeReady) {
    return resetForDedicatedLogin({execute, appId, packageId});
  }
  await execute("tizen: pressKey", [{key: "KEY_UP"}]);
  return waitFor(execute, WELCOME_LOGIN_VISIBLE, {
    label: "the MyTV welcome login control after the initial neutral remote key",
  });
}

async function loginWithDedicatedAccount({ execute, credentials }) {
  const page = createRemotePage({ execute, pressKey: (key) => pressRemote(execute, key) });
  await navigation.remoteFocusById(page, "btn-welcome-0-1");
  await page.keyboard.press("Enter");
  await waitFor(execute, LOGIN_METHOD_VISIBLE, { label: "the MyTV account-login control" });
  await navigation.remoteFocusById(page, "remote-login-method");
  await page.keyboard.press("Enter");
  await waitFor(execute, inputLabelContains("Nhập số điện thoại / Tài khoản MyTV"), {
    label: "the MyTV account-name virtual keyboard",
  });
  await navigation.enterWithVirtualKeyboard(page, credentials.username);

  await navigation.remoteFocusById(page, "new_ui_login_btn_ok");
  await page.keyboard.press("Enter");
  await waitFor(execute, inputLabelContains("Nhập mật khẩu"), {
    label: "the MyTV password virtual keyboard",
  });
  await navigation.enterWithVirtualKeyboard(page, credentials.password);

  await navigation.remoteFocusById(page, "new_ui_login_btn_ok");
  await page.keyboard.press("Enter");
  // The existing browser workflow gives the authentication response time to
  // surface the device-limit dialog before deciding whether it must be handled.
  await page.waitForTimeout(5_000);

  const deviceLimitVisible = await execute(`return (() => {
    const text = (document.body && document.body.innerText) || '';
    return text.includes('Vượt quá số lượng thiết bị cho phép');
  })();`);
  if (deviceLimitVisible) {
    await navigation.remoteFocusByText(page, /Tiếp tục/i);
    await page.keyboard.press("Enter");
  }

  await waitFor(execute, ACCOUNT_LOGIN_COMPLETE, {
    timeoutMs: 30_000,
    label: "successful dedicated-account login",
  });
}

async function logoutToLoginScreen({execute, wait = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs))} = {}) {
  if (typeof execute !== "function") throw new Error("A WebDriver execute adapter is required for logout.");
  await execute("return window.processLogOut ? window.processLogOut() : Promise.reject(new Error('window.processLogOut is unavailable'));", []);
  await wait(2_000);
  await waitFor(execute, LOGIN_METHOD_VISIBLE, {
    timeoutMs: 30_000,
    label: "the MyTV account-login control after trusted logout",
  });
  await execute("return (() => { window.localStorage.clear(); return true; })();", []);
}

module.exports = {
  createRemotePage,
  loginWithDedicatedAccount,
  logoutToLoginScreen,
  prepareDedicatedLogin,
  resetForDedicatedLogin,
  requireDedicatedAccount,
};
