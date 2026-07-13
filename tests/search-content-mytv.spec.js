const { test } = require("./fixtures/mytv-session-fixture");
const {
  runStep,
  openSearchFromLeftMenu,
  searchAndOpenBestContent,
  assertSearchContentPlayback,
  attachCurrentAppScreenshot,
} = require("./lib/mytv-helpers");

test("search-content-mytv", async ({ page, options }, testInfo) => {
  await runStep(page, testInfo, "Open left menu and choose Tim kiem", async () => {
    await openSearchFromLeftMenu(page, testInfo);
  });

  await runStep(page, testInfo, `Search ${options.SEARCH_KEYWORD} and play best result`, async () => {
    const hasResult = await searchAndOpenBestContent(page, options, testInfo);
    if (!hasResult) return;

    await assertSearchContentPlayback(page, testInfo, options);
    await attachCurrentAppScreenshot(page, testInfo, `${options.SEARCH_KEYWORD} search final screen`);
  });
});
