const { test } = require("./fixtures/mytv-session-fixture");
const {
  runStep,
  openMovieFromLeftMenu,
  openMovieContent,
  playAllItemsInFirstRow,
  assertMoviePlayback,
  attachCurrentAppScreenshot,
} = require("./lib/mytv-helpers");

test("play-movie-mytv", async ({ page, options }, testInfo) => {
  await runStep(page, testInfo, "Open left menu and choose Phim truyen", async () => {
    await openMovieFromLeftMenu(page, testInfo);
  });

  if (options.MOVIE_PLAY_MODE === "by_cate") {
    const cateName = options.MOVIE_CATE_NAME || "";
    const itemLimit = Number(options.MOVIE_CATE_LIMIT || 0);
    if (!cateName.trim()) {
      throw new Error("MOVIE_CATE_NAME is required when MOVIE_PLAY_MODE=by_cate.");
    }

    await runStep(page, testInfo, `Play ${itemLimit > 0 ? itemLimit : "all"} movies in cate ${cateName}`, async () => {
      await playAllItemsInFirstRow(page, testInfo, {
        rowName: cateName,
        itemLimit,
        waitSeconds: 6,
        backPresses: 2,
      });
      await attachCurrentAppScreenshot(page, testInfo, `${cateName || "movie cate"} final screen`);
    });
    return;
  }

  const targetMovie = options.MOVIE_NAME || "first movie content";
  await runStep(page, testInfo, `Open ${targetMovie} and verify playback`, async () => {
    await openMovieContent(page, options, testInfo);
    await assertMoviePlayback(page, testInfo, options);
    await attachCurrentAppScreenshot(page, testInfo, `${targetMovie} final screen`);
  });
});
