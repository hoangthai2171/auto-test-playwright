const { test } = require("./fixtures/mytv-session-fixture");
const {
  runStep,
  openTelevisionFromLeftMenu,
  openChannel,
  playAllItemsInFirstRow,
  assertChannelPlayback,
  attachCurrentAppScreenshot,
} = require("./lib/mytv-helpers");

test("play-channel-mytv", async ({ page, options }, testInfo) => {
  await runStep(page, testInfo, "Open left menu and choose Truyen hinh", async () => {
    await openTelevisionFromLeftMenu(page, testInfo);
  });

  if (options.CHANNEL_PLAY_MODE === "by_cate") {
    const cateName = options.CHANNEL_CATE_NAME || "";
    const itemLimit = Number(options.CHANNEL_CATE_LIMIT || 0);
    if (!cateName.trim()) {
      throw new Error("CHANNEL_CATE_NAME is required when CHANNEL_PLAY_MODE=by_cate.");
    }

    await runStep(page, testInfo, `Play ${itemLimit > 0 ? itemLimit : "all"} channels in cate ${cateName}`, async () => {
      await playAllItemsInFirstRow(page, testInfo, {
        rowName: cateName,
        itemLimit,
        waitSeconds: 6,
        backPresses: 2,
      });
      await attachCurrentAppScreenshot(page, testInfo, `${cateName || "channel cate"} final screen`);
    });
    return;
  }

  await runStep(page, testInfo, `Open ${options.CHANNEL_NAME} and verify playback`, async () => {
    await openChannel(page, options, testInfo);
    await assertChannelPlayback(page, testInfo, options);
    await attachCurrentAppScreenshot(page, testInfo, `${options.CHANNEL_NAME} final screen`);
  });
});
