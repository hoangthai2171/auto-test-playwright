const { test } = require("./fixtures/mytv-session-fixture");
const {
  runStep,
  openSettingFromLeftMenu,
  attachCurrentAppScreenshot,
} = require("./lib/mytv-helpers");

test("open-setting-mytv", async ({ page }, testInfo) => {
  await runStep(page, testInfo, "Open left menu and choose Cai dat", async () => {
    await openSettingFromLeftMenu(page, testInfo);
    await attachCurrentAppScreenshot(page, testInfo, "setting screen");
  });
});
