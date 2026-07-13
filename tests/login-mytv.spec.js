const { test } = require("./fixtures/mytv-session-fixture");
const {
  runStep,
  openAppAndEnterLoginPage,
  loginWithAccount,
  chooseFirstProfileAndEnterHome,
  closeHomePopupsAndVerifyHome,
} = require("./lib/mytv-helpers");

test("Login MyTV", async ({ page, options }, testInfo) => {
  await runStep(page, testInfo, "Open app and enter login page", async () => {
    await openAppAndEnterLoginPage(page, options, testInfo);
  });

  await runStep(page, testInfo, "Login with account and password", async () => {
    await loginWithAccount(page, options, testInfo);
  });

  await runStep(page, testInfo, "Choose first profile and enter home", async () => {
    await chooseFirstProfileAndEnterHome(page, testInfo);
  });

  await runStep(page, testInfo, "Close home popups and verify Xem ngay focus", async () => {
    await closeHomePopupsAndVerifyHome(page, testInfo);
  });
});
