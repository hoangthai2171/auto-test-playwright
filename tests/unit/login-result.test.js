const test = require("node:test");
const assert = require("node:assert/strict");

const {waitForLoginResult, isDeviceLimitDialog} = require("../lib/workflows").__internal;

function createPage() {
  const waits = [];
  return {
    waits,
    page: {
      waitForTimeout: async (durationMs) => {
        waits.push(durationMs);
      },
    },
  };
}

const REFUSAL_DIALOG = {
  id: "dialog_alert_v2",
  text: "Thông báo( SmartTV - Ver LG253.5.0 )Vui lòng kiểm tra lại thông tin đăng nhập!Đóng",
};
const DEVICE_LIMIT_DIALOG = {
  id: "dialog_confirm_v2",
  text: "Tài khoản đã vượt quá số lượng thiết bị cho phép. Tiếp tục để xóa thiết bị cũ nhất?",
};

test("the device-limit dialog is not read as a refusal", () => {
  assert.equal(isDeviceLimitDialog(DEVICE_LIMIT_DIALOG), true);
  assert.equal(isDeviceLimitDialog(REFUSAL_DIALOG), false);
  assert.equal(isDeviceLimitDialog(null), false);
});

test("a refusal dialog ends the wait immediately with the app's own wording", async () => {
  const {page, waits} = createPage();

  await assert.rejects(
    () =>
      waitForLoginResult(page, {
        observeDialog: async () => REFUSAL_DIALOG,
        hasProfileSelection: async () => false,
      }),
    (error) => {
      assert.equal(error.code, "LOGIN_REFUSED");
      assert.match(error.message, /Vui lòng kiểm tra lại thông tin đăng nhập!/u);
      return true;
    }
  );
  // No polling at all: the answer was already on screen.
  assert.deepEqual(waits, []);
});

test("a refusal that arrives a few polls later still ends the wait there", async () => {
  const {page, waits} = createPage();
  let polls = 0;

  await assert.rejects(
    () =>
      waitForLoginResult(page, {
        observeDialog: async () => (++polls >= 3 ? REFUSAL_DIALOG : null),
        hasProfileSelection: async () => false,
        pollMs: 10,
      }),
    (error) => error.code === "LOGIN_REFUSED"
  );
  assert.equal(polls, 3);
  assert.deepEqual(waits, [10, 10]);
});

test("profile selection is the accepted answer", async () => {
  const {page, waits} = createPage();
  let polls = 0;

  await waitForLoginResult(page, {
    observeDialog: async () => null,
    hasProfileSelection: async () => ++polls >= 2,
    pollMs: 10,
  });

  assert.equal(polls, 2);
  assert.deepEqual(waits, [10]);
});

test("the device-limit dialog is also an accepted answer, left for the profile flow", async () => {
  const {page, waits} = createPage();

  await waitForLoginResult(page, {
    observeDialog: async () => DEVICE_LIMIT_DIALOG,
    hasProfileSelection: async () => false,
  });

  assert.deepEqual(waits, []);
});

// The password screen is torn down before either answer arrives, so its absence
// must not be treated as success - that is what let a refused login run on into
// the device-limit and profile-selection timeouts.
test("an app that answers nothing at all times out with a clear reason", async () => {
  const {page} = createPage();

  await assert.rejects(
    () =>
      waitForLoginResult(page, {
        observeDialog: async () => null,
        hasProfileSelection: async () => false,
        timeoutMs: 0,
        pollMs: 1,
      }),
    /không phản hồi mật khẩu đã gửi/u
  );
});
