const { test, expect } = require("playwright/test");
const sharedPlayback = require("./playback");
const {acceptUserConsentPopupIfVisible} = require("./login-popups");

const DEFAULT_OPTIONS = {
  APP_URL: "https://html5stage.mytv.vn/",
  USERNAME: "ts1",
  PASSWORD: "111222",
  CHANNEL_NAME: "VTV1 HD",
  CHANNEL_PLAY_MODE: "by_name",
  CHANNEL_CATE_NAME: "",
  CHANNEL_CATE_LIMIT: "0",
  MOVIE_PLAY_MODE: "first",
  MOVIE_NAME: "",
  MOVIE_CATE_NAME: "",
  MOVIE_CATE_LIMIT: "0",
  SEARCH_KEYWORD: "",
};

const CLOSE_POPUP_TEXT = /^(Đóng|Huỷ|Hủy|Quay về|Quay về trang chủ)$/i;

function getTestOptions() {
  const options = {
    APP_URL: process.env.APP_URL || DEFAULT_OPTIONS.APP_URL,
    USERNAME: process.env.USERNAME || DEFAULT_OPTIONS.USERNAME,
    PASSWORD: process.env.PASSWORD || DEFAULT_OPTIONS.PASSWORD,
    CHANNEL_NAME: process.env.CHANNEL_NAME || DEFAULT_OPTIONS.CHANNEL_NAME,
    CHANNEL_PLAY_MODE: process.env.CHANNEL_PLAY_MODE || DEFAULT_OPTIONS.CHANNEL_PLAY_MODE,
    CHANNEL_CATE_NAME: process.env.CHANNEL_CATE_NAME || DEFAULT_OPTIONS.CHANNEL_CATE_NAME,
    CHANNEL_CATE_LIMIT: process.env.CHANNEL_CATE_LIMIT || DEFAULT_OPTIONS.CHANNEL_CATE_LIMIT,
    MOVIE_PLAY_MODE: process.env.MOVIE_PLAY_MODE || DEFAULT_OPTIONS.MOVIE_PLAY_MODE,
    MOVIE_NAME: process.env.MOVIE_NAME || DEFAULT_OPTIONS.MOVIE_NAME,
    MOVIE_CATE_NAME: process.env.MOVIE_CATE_NAME || DEFAULT_OPTIONS.MOVIE_CATE_NAME,
    MOVIE_CATE_LIMIT: process.env.MOVIE_CATE_LIMIT || DEFAULT_OPTIONS.MOVIE_CATE_LIMIT,
    SEARCH_KEYWORD: process.env.SEARCH_KEYWORD || DEFAULT_OPTIONS.SEARCH_KEYWORD,
  };

  return {
    ...options,
    MOVIE_NAME_PATTERN: options.MOVIE_NAME ? containsTextPattern(options.MOVIE_NAME) : null,
    SEARCH_KEYWORD_PATTERN: options.SEARCH_KEYWORD
      ? containsTextPattern(options.SEARCH_KEYWORD)
      : null,
  };
}

async function openAppAndEnterLoginPage(page, options) {
  await gotoApp(page, options.APP_URL);
  await waitForAppReady(page);

  const isLoginTabsVisible = await page
    .locator("#login-tabs")
    .isVisible()
    .catch(() => false);

  if (!isLoginTabsVisible && (getSubpage(page.url()) === "welcomePage" || (await isWelcomeScreen(page)))) {
    await expectFocusedText(page, /đăng nhập|trải nghiệm/i);
    await expectFocusedElementToLookOrange(page).catch(() => {});

    if (!(await getFocusedState(page)).text.match(/^Đăng nhập$/i)) {
      await remoteFocusByText(page, /^Đăng nhập$/);
    }

    await remotePress(page, "Enter", 2000);
  }

  if (
    !(await page
      .locator("#login-tabs")
      .isVisible()
      .catch(() => false)) &&
    (await hasVisibleText(page, /^Đăng nhập$/))
  ) {
    await remoteFocusByText(page, /^Đăng nhập$/);
    await remotePress(page, "Enter", 2000);
  }

  await expect(page.locator("#login-tabs")).toBeVisible();
}

async function loginWithAccount(page, options) {
  await remoteFocusById(page, "remote-login-method");
  await remotePress(page, "Enter", 1500);
  await acceptUserConsentPopupIfVisible(page, undefined, {remoteFocusById, remotePress});

  await expect(page.locator("#new_ui_login_input_label")).toContainText(
    "Nhập số điện thoại / Tài khoản MyTV"
  );
  await enterWithVirtualKeyboard(page, options.USERNAME);

  await remoteFocusById(page, "new_ui_login_btn_ok");
  await remotePress(page, "Enter", 2000);

  await expect(page.locator("#new_ui_login_input_label")).toContainText("Nhập mật khẩu");
  await enterWithVirtualKeyboard(page, options.PASSWORD);

  await remoteFocusById(page, "new_ui_login_btn_ok");
  await remotePress(page, "Enter", 5000);

  await expect(page.locator("body")).not.toContainText("Nhập mật khẩu", {
    timeout: 30000,
  });
}

async function chooseFirstProfileAndEnterHome(page) {
  await waitForProfileSelection(page);
  await remoteFocusById(page, "item_0");
  await remotePress(page, "Enter", 10000);

  await expect.poll(() => getSubpage(page.url()), { timeout: 30000 }).toBe("homeNewUI");
}

async function closeHomePopupsAndVerifyHome(page) {
  await closeHomePopups(page);
  await expectFocusedText(page, /^Xem ngay$/i);
}

async function openTelevisionFromLeftMenu(page) {
  await openLeftMenuFromHome(page);
  await focusLeftMenuItem(page, /^Truyền hình$/i);
  await remotePress(page, "Enter", 3000);
}

async function openMovieFromLeftMenu(page) {
  await openLeftMenuFromHome(page);
  await focusLeftMenuItem(page, /^Phim truyện$/i);
  await remotePress(page, "Enter", 3000);
}

async function openSettingFromLeftMenu(page) {
  await openLeftMenuFromHome(page);
  await focusLeftMenuItem(page, /^Cài đặt$/i);
  await remotePress(page, "Enter", 3000);
  await expect(page.locator("body")).toContainText(/Thông tin tài khoản/i, { timeout: 10000 });
}

async function openSearchFromLeftMenu(page) {
  await openLeftMenuFromHome(page);
  await focusSearchMenuItem(page);
  await remotePress(page, "Enter", 2000);
  await expect(page.locator("body")).toContainText(/Tìm kiếm/i, { timeout: 10000 });
}

async function openServiceFromLeftMenuOrAllServices(page, serviceName) {
  await openLeftMenuFromHome(page);

  const leftMenuItemId = await findLeftMenuItemIdByFuzzyText(page, serviceName).catch(() => "");
  if (leftMenuItemId) {
    await remoteFocusById(page, leftMenuItemId, 100);
    await remotePress(page, "Enter", 3000);
    return;
  }

  const allServicesId = await findLeftMenuItemIdByFuzzyText(page, "Tất cả dịch vụ").catch(() => "");
  expect(allServicesId, "Left menu should contain Tat ca dich vu fallback").toBeTruthy();

  await remoteFocusById(page, allServicesId, 100);
  await remotePress(page, "Enter", 2500);

  const serviceId = await findServiceIdInAllServices(page, serviceName);
  await remoteFocusById(page, serviceId, 120);
  await remotePress(page, "Enter", 3000);
}

async function openChannel(page, options) {
  await expect
    .poll(() => getSubpage(page.url()), { timeout: 30000 })
    .toMatch(/^(channel|tv|television|listChannel|liveTV|homeLiveTV)$/i);

  const channelId = await findChannelIdByName(page, options.CHANNEL_NAME);
  await remoteFocusById(page, channelId, 120);
  await remotePress(page, "Enter", 6000);
}

async function openFirstMovieContent(page) {
  await page.waitForFunction(
    () => {
      const focused = document.querySelector(".focused");
      if (!focused) return false;

      const rect = focused.getBoundingClientRect();
      const style = getComputedStyle(focused);
      return (
        rect.x >= 100 &&
        rect.y >= 500 &&
        rect.width >= 120 &&
        rect.height >= 90 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    },
    null,
    { timeout: 15000 }
  );
  await remotePress(page, "Enter", 6000);
}

async function playAllItemsInFirstRow(page, testInfo, options = {}) {
  const waitSeconds = Number(options.waitSeconds || 6);
  const rowName = options.rowName || "";
  const rowIndex = Number.isInteger(options.rowIndex) ? options.rowIndex : undefined;
  const rowPosition = options.rowPosition || "";
  const itemLimit = Number(options.itemLimit);
  const maxItems = Number.isFinite(itemLimit) && itemLimit > 0 ? itemLimit : Number(options.maxItems || 60);
  await page.waitForTimeout(2500);

  const targetRow = await focusRequestedContentRow(page, {
    rowName,
    rowIndex,
    rowPosition,
  });
  const items = targetRow.items;
  expect(items.length, "First row should contain playable items").toBeGreaterThan(0);

  const firstRowY = (await getFocusedContentMetadata(page)).rect?.y || targetRow.rowY || items[0].rect.y;

  const results = [];
  const seenItems = new Set();
  for (let index = 0; index < maxItems; index++) {
    await expectFocusedContent(page);
    const focusedItem = await getFocusedContentMetadata(page);
    const item = focusedItem.id ? focusedItem : items[index] || focusedItem;
    const signature = contentItemSignature(item);

    if (seenItems.has(signature)) {
      break;
    }

    seenItems.add(signature);
    const label = item.title || `Item ${index + 1}`;

    await test.step(`Play first-row item ${index + 1}: ${label}`, async () => {
      const result = {
        index: index + 1,
        id: item.id,
        title: label,
        poster: item.poster,
        status: "unknown",
        errorPopup: "",
        screenshot: "",
        screenshotDataUrl: "",
      };

      try {
        await expectFocusedContent(page);
        await testInfo.attach(`${safeArtifactName(`first-row-${index + 1}-focused-item`)}.json`, {
          body: JSON.stringify(item, null, 2),
          contentType: "application/json",
        });
        await openFocusedContentForPlayback(page);

        const playback = await inspectPlaybackAfterWait(page, waitSeconds);
        result.status = playback.ok ? "playable" : "failed";
        result.errorPopup = playback.popup?.text || playback.playerState?.reason || "";
        result.playerState = playback.playerState;

        if (!playback.ok) {
          const screenshotName = `${safeArtifactName(`first-row-${index + 1}-${label}`)}.png`;
          const screenshot = await page.screenshot({ fullPage: false });
          await testInfo.attach(screenshotName, {
            body: screenshot,
            contentType: "image/png",
          });
          result.screenshot = screenshotName;
          result.screenshotDataUrl = imageDataUrl(screenshot);
        }
      } catch (error) {
        result.status = "failed";
        result.errorPopup = error?.message || String(error);
          const screenshotName = `${safeArtifactName(`first-row-${index + 1}-${label}-error`)}.png`;
        const screenshot = await page.screenshot({ fullPage: false });
        await testInfo.attach(screenshotName, {
          body: screenshot,
          contentType: "image/png",
        });
        result.screenshot = screenshotName;
        result.screenshotDataUrl = imageDataUrl(screenshot);
      } finally {
        results.push(result);
        await returnToFirstRowContent(page, {
          item,
          rowY: firstRowY,
        });
      }
    });

    const movedToNext = await moveToNextFirstRowContent(page, {
      previousSignature: signature,
      rowY: firstRowY,
    });

    if (!movedToNext) {
      break;
    }
  }

  await attachFirstRowPlaybackReport(testInfo, results);

  const playableCount = results.filter((item) => item.status === "playable").length;
  expect(playableCount, "At least one first-row content item should play successfully").toBeGreaterThan(0);
}

async function openMovieContent(page, options, testInfo) {
  if (options.MOVIE_PLAY_MODE === "by_name" && options.MOVIE_NAME) {
    await openMovieContentByName(page, options, testInfo);
    return;
  }

  await openFirstMovieContent(page);
}

async function openMovieContentByName(page, options, testInfo) {
  await page.waitForTimeout(3000);

  let movieId;
  try {
    movieId = await findMovieContentIdByName(page, options.MOVIE_NAME, options.MOVIE_NAME_PATTERN);
  } catch (error) {
    if (testInfo) {
      await attachMovieSearchFailureArtifacts(page, testInfo, options.MOVIE_NAME, error);
    }

    const searchError = new Error(
      `Không tìm thấy phim "${options.MOVIE_NAME}" trên trang Phim truyện. ` +
        "Xem attachment movie-search-*-not-found.json/png trong report để biết các phim đang hiển thị và trạng thái màn hình."
    );
    searchError.stack = `${searchError.stack}\n\nOriginal error:\n${error?.stack || error}`;
    throw searchError;
  }

  await remoteFocusById(page, movieId, 160);
  await remotePress(page, "Enter", 6000);
}

async function searchAndOpenBestContent(page, options, testInfo) {
  const keyword = options.SEARCH_KEYWORD?.trim();
  expect(keyword, "SEARCH_KEYWORD is required for search-content-mytv").toBeTruthy();

  const keyboardKeyword = searchKeyboardInput(keyword);
  await enterWithVirtualKeyboard(page, keyboardKeyword);
  await submitSearchFromVirtualKeyboard(page);
  await page.waitForTimeout(5000);

  const result = await findBestSearchResult(page, keyword);
  if (!result) {
    await attachSearchNoResultArtifacts(page, testInfo, keyword);
    return false;
  }

  await testInfo.attach(`${safeArtifactName(`search-${keyword}-selected-result`)}.json`, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });

  await focusStableSearchResult(page, result);
  await remotePress(page, "Enter", 6000);
  return true;
}

async function focusStableSearchResult(page, result) {
  await focusSearchResult(page, result);
  await page.waitForTimeout(2000);

  if (await isFocusedOnSearchResult(page, result.id)) return;

  await focusSearchResult(page, result);
  await page.waitForTimeout(500);
  expect(await isFocusedOnSearchResult(page, result.id), `Search result "${result.id}" should be focused before Enter`).toBe(
    true
  );
}

async function isFocusedOnSearchResult(page, id) {
  return page.evaluate((targetId) => {
    const target = document.getElementById(targetId);
    const focused = document.querySelector(".focused");
    if (!target || !focused) return false;
    return target === focused || target.contains(focused) || focused.contains(target);
  }, id);
}

async function focusSearchResult(page, result) {
  if (!/^searchRow_\d+_\d+$/.test(result.id)) {
    await remoteFocusById(page, result.id, 180);
    return;
  }

  if (await focusSearchRowItemByPosition(page, result.id)) return;

  let focusError;
  try {
    await remoteFocusById(page, result.id, 120);
    return;
  } catch (error) {
    focusError = error;
  }

  if (await focusSearchRowItemByPosition(page, result.id)) return;
  throw focusError;
}

async function focusSearchRowItemByPosition(page, targetId, maxMoves = 80) {
  const target = parseSearchRowId(targetId);
  if (!target) return false;

  for (let attempt = 0; attempt < maxMoves; attempt++) {
    const state = await getFocusedState(page);
    if (state.id === targetId) return true;

    const current = parseSearchRowId(state.id);
    if (!current) return false;

    if (current.row !== target.row) {
      await remotePress(page, current.row > target.row ? "ArrowUp" : "ArrowDown", 220);
      continue;
    }

    if (current.col !== target.col) {
      await remotePress(page, current.col > target.col ? "ArrowLeft" : "ArrowRight", 220);
      continue;
    }

    return false;
  }

  return (await getFocusedState(page)).id === targetId;
}

function parseSearchRowId(id) {
  const match = /^searchRow_(\d+)_(\d+)$/.exec(id || "");
  if (!match) return null;
  return {
    row: Number(match[1]),
    col: Number(match[2]),
  };
}

async function submitSearchFromVirtualKeyboard(page) {
  const searchButtonId = await page
    .evaluate(() => {
      const button = document.querySelector("#keyboard_btn_wr #callSearch, #callSearch");
      if (!button?.id) return "";

      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0;

      return visible ? button.id : "";
    })
    .catch(() => "");

  if (!searchButtonId) return;

  await remoteFocusById(page, searchButtonId, 80);
  await remotePress(page, "Enter", 2500);
  await page.waitForTimeout(2000);
}

async function assertChannelPlayback(page, testInfo, options) {
  await assertPlayback(page, testInfo, {
    label: `Channel "${options.CHANNEL_NAME}"`,
    artifactPrefix: options.CHANNEL_NAME,
  });
}

async function assertMoviePlayback(page, testInfo, options = {}) {
  const label = options.MOVIE_NAME ? `Movie "${options.MOVIE_NAME}"` : "First movie content";

  await assertPlayback(page, testInfo, {
    label,
    artifactPrefix: options.MOVIE_NAME || "first-movie-content",
  });
}

async function assertSearchContentPlayback(page, testInfo, options) {
  await assertPlayback(page, testInfo, {
    label: `Search result for "${options.SEARCH_KEYWORD}"`,
    artifactPrefix: `search-${options.SEARCH_KEYWORD}`,
  });
}

async function assertPlayback(page, testInfo, { label, artifactPrefix }) {
  await page.waitForTimeout(6000);

  const popup = await getVisiblePopup(page);
  if (popup) {
    const playerState = await getPlayerState(page).catch((error) => ({
      hasVideo: false,
      isProbablyPlaying: false,
      reason: error?.message || String(error),
    }));

    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-error-popup.txt`, {
      body: `${label}\n\n${popup.text}`,
      contentType: "text/plain",
    });
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-error-popup.png`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-error-player-state.json`, {
      body: JSON.stringify({ label, popup, ...playerState }, null, 2),
      contentType: "application/json",
    });

    throw new Error(`${label} playback failed with popup: ${popup.text}`);
  }

  const playerState = await getPlayerState(page);
  await testInfo.attach(`${safeArtifactName(artifactPrefix)}-player-state.json`, {
    body: JSON.stringify({ label, ...playerState }, null, 2),
    contentType: "application/json",
  });

  if (!playerState.hasVideo || !playerState.isProbablyPlaying) {
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-playback-failure.png`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-playback-failure.txt`, {
      body: [
        `${label} playback did not look healthy.`,
        "",
        `hasVideo: ${playerState.hasVideo}`,
        `isProbablyPlaying: ${playerState.isProbablyPlaying}`,
        `reason: ${playerState.reason || ""}`,
        "",
        JSON.stringify(playerState, null, 2),
      ].join("\n"),
      contentType: "text/plain",
    });
  }

  expect(playerState.hasVideo, "Player video element should exist").toBe(true);
  expect(
    playerState.isProbablyPlaying,
    `Player should be playing normally: ${JSON.stringify(playerState)}`
  ).toBe(true);
}

async function runStep(page, testInfo, title, action) {
  await test.step(title, async () => {
    try {
      await action();
    } catch (error) {
      await attachFailureArtifacts(page, testInfo, title, error);
      throw error;
    }
  });
}

async function attachCurrentAppScreenshot(page, testInfo, name) {
  await testInfo.attach(`${safeArtifactName(name)}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function attachMovieSearchFailureArtifacts(page, testInfo, movieName, error) {
  const artifactPrefix = safeArtifactName(`movie-search-${movieName}`);
  const candidates = await collectMovieSearchCandidates(page);

  await testInfo.attach(`${artifactPrefix}-not-found.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  await testInfo.attach(`${artifactPrefix}-not-found.json`, {
    body: JSON.stringify(
      {
        searchedMovieName: movieName,
        normalizedSearchedMovieName: normalizeVietnameseText(movieName),
        url: page.url(),
        focused: await getFocusedState(page).catch(() => null),
        error: {
          message: error?.message || String(error),
          stack: error?.stack || "",
        },
        visibleCandidates: candidates,
      },
      null,
      2
    ),
    contentType: "application/json",
  });
}

async function attachSearchNoResultArtifacts(page, testInfo, keyword) {
  const artifactPrefix = safeArtifactName(`search-${keyword}-no-result`);
  const candidates = await collectSearchResultCandidates(page, keyword);

  await testInfo.attach(`${artifactPrefix}.txt`, {
    body: `Không tìm thấy kết quả phù hợp cho từ khoá: ${keyword}`,
    contentType: "text/plain",
  });

  await testInfo.attach(`${artifactPrefix}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  await testInfo.attach(`${artifactPrefix}.json`, {
    body: JSON.stringify(
      {
        keyword,
        normalizedKeyword: normalizeVietnameseText(keyword),
        url: page.url(),
        focused: await getFocusedState(page).catch(() => null),
        visibleMatchedCandidates: candidates,
      },
      null,
      2
    ),
    contentType: "application/json",
  });
}

async function attachFailureArtifacts(page, testInfo, title, error) {
  const safeTitle = safeArtifactName(title);

  await testInfo.attach(`${safeTitle}-failure.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  await testInfo.attach(`${safeTitle}-failure-context.json`, {
    body: JSON.stringify(
      {
        step: title,
        url: page.url(),
        focused: await getFocusedState(page).catch(() => null),
        error: {
          message: error?.message || String(error),
          stack: error?.stack || "",
        },
      },
      null,
      2
    ),
    contentType: "application/json",
  });
}

async function waitForAppReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const text = document.body?.innerText || "";
    return /Đăng nhập|Trải nghiệm|Nhập số điện thoại|Nhập mật khẩu/.test(text);
  });
}

async function gotoApp(page, appUrl) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(appUrl, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await page.waitForTimeout(5000);
    }
  }

  throw lastError;
}

function getSubpage(url) {
  return new URL(url).hash.replace(/^#/, "").split("?")[0];
}

function containsTextPattern(value) {
  return new RegExp(escapeRegExp(value), "i");
}

function normalizeVietnameseText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeArtifactName(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "artifact"
  );
}

async function remotePress(page, key, delay = 250) {
  await page.keyboard.press(key);
  await page.waitForTimeout(delay);
}

async function hasVisibleText(page, text) {
  return page
    .getByText(text)
    .first()
    .isVisible()
    .catch(() => false);
}

async function isWelcomeScreen(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    return text.includes("Đăng nhập") && text.includes("Trải nghiệm");
  });
}

async function waitForProfileSelection(page) {
  await page.waitForFunction(
    () =>
      location.hash.includes("chooseProfile") ||
      document.body?.innerText?.includes("Những ai đang xem?"),
    null,
    { timeout: 30000 }
  );
  await expect(page.locator("#item_0")).toBeVisible();
}

async function closeHomePopups(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.waitForTimeout(1500);

    if (await closeAdvertisePopupIfVisible(page)) {
      continue;
    }

    const focused = await getFocusedState(page);
    if (/^Xem ngay$/i.test(focused.text) || /^Xem ngay$/i.test(focused.label)) {
      return;
    }

    if (CLOSE_POPUP_TEXT.test(focused.text) || CLOSE_POPUP_TEXT.test(focused.label)) {
      await remotePress(page, "Enter", 2500);
      continue;
    }

    if (await hasVisibleText(page, CLOSE_POPUP_TEXT)) {
      await remoteFocusByText(page, CLOSE_POPUP_TEXT, 80);
      await remotePress(page, "Enter", 2500);
      continue;
    }

    break;
  }
}

async function closeAdvertisePopupIfVisible(page) {
  const closeButton = page
    .locator('#advertise-popup:visible #advertise-popup-container .advertise-btn[type-button="0"]')
    .first();

  if (!(await closeButton.isVisible().catch(() => false))) {
    return false;
  }

  await closeButton.evaluate((element) => element.click());
  await page.locator("#advertise-popup").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return true;
}

async function openLeftMenuFromHome(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await remotePress(page, "ArrowLeft", 1000);
    if (await isLeftMenuOpen(page)) return;

    await remotePress(page, "Backspace", 2500);
    if (await isLeftMenuOpen(page)) return;

    await remotePress(page, "Escape", 1500);
    if (await isLeftMenuOpen(page)) return;
  }

  await expect(page.getByText(/^Truyền hình$/i).first()).toBeVisible({ timeout: 10000 });
}

async function focusLeftMenuItem(page, text) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10000 });
  const menuItemId = await findLeftMenuItemIdByText(page, text);
  await remoteFocusById(page, menuItemId, 80);
}

async function focusSearchMenuItem(page) {
  const searchMenuItemId = await findLeftMenuItemIdByText(page, /^Tìm kiếm$/i).catch(() => "");
  await remoteFocusById(page, searchMenuItemId || "menu_item_search", 80);
}

async function findLeftMenuItemIdByText(page, text) {
  const itemId = await page.waitForFunction(
    (source) => {
      const pattern = new RegExp(source, "i");
      const textElement = Array.from(document.querySelectorAll('[id^="menu_text_"]')).find(
        (element) => pattern.test((element.textContent || "").replace(/\s+/g, " ").trim())
      );

      if (!textElement) return "";
      return textElement.id.replace(/^menu_text_/, "menu_item_");
    },
    text.source,
    { timeout: 10000 }
  );

  const id = await itemId.jsonValue();
  expect(id, `Left menu item ${text} should have id`).toBeTruthy();
  return id;
}

async function findLeftMenuItemIdByFuzzyText(page, text) {
  const itemId = await page.waitForFunction(
    (targetText) => {
      const normalizedTarget = normalizeText(targetText);
      const targetTokens = tokenize(normalizedTarget);
      const candidates = Array.from(document.querySelectorAll('[id^="menu_text_"]'))
        .map((element) => {
          const label = (element.textContent || "").replace(/\s+/g, " ").trim();
          return {
            id: element.id.replace(/^menu_text_/, "menu_item_"),
            label,
            score: scoreMatch(normalizeText(label)),
          };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      return candidates[0]?.id || "";

      function scoreMatch(normalizedLabel) {
        if (normalizedLabel === normalizedTarget) return 100;
        if (normalizedLabel.includes(normalizedTarget)) return 90;

        const labelTokens = tokenize(normalizedLabel);
        if (!targetTokens.length || !labelTokens.length) return 0;
        const matchedTokens = targetTokens.filter((token) =>
          labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token))
        );
        const coverage = matchedTokens.length / targetTokens.length;
        return coverage === 1 ? 80 + Math.min(targetTokens.length, 10) : 0;
      }

      function normalizeText(value) {
        return value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function tokenize(value) {
        return value
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .map((token) => token.trim())
          .filter((token) => token.length >= 2);
      }
    },
    text,
    { timeout: 5000 }
  );

  const id = await itemId.jsonValue();
  expect(id, `Left menu item similar to "${text}" should have id`).toBeTruthy();
  return id;
}

async function findServiceIdInAllServices(page, serviceName) {
  await page.waitForTimeout(800);

  for (let attempt = 0; attempt < 18; attempt++) {
    const serviceId =
      (await findVisibleServiceIdByTitleAttribute(page, serviceName).catch(() => "")) ||
      (await findVisibleElementIdByFuzzyLabel(page, serviceName, {
        minWidth: 60,
        minHeight: 30,
        maxWidth: 460,
        maxHeight: 280,
        excludeIdPrefixes: ["menu_"],
        timeout: 1200,
      }).catch(() => ""));

    if (serviceId) {
      return serviceId;
    }

    await remotePress(page, attempt % 5 === 4 ? "ArrowRight" : "ArrowDown", 500);
  }

  const visibleServices = await collectVisibleAllServiceLabels(page);
  throw new Error(
    `Không tìm thấy dịch vụ "${serviceName}" trong Tất cả dịch vụ. Các mục đang thấy: ${visibleServices.join(", ")}`
  );
}

async function findVisibleServiceIdByTitleAttribute(page, serviceName) {
  const serviceId = await page.waitForFunction(
    (targetServiceName) => {
      const normalizedTarget = normalizeText(targetServiceName);
      const targetTokens = tokenize(normalizedTarget);
      const rowElements = Array.from(document.querySelectorAll('[id^="dropdown_service_items_row"]'));
      const serviceElements = rowElements.flatMap((row) =>
        Array.from(row.querySelectorAll("[service_title]")).map((element) => ({
          row,
          element,
        }))
      );

      const candidates = serviceElements
        .map(({ row, element }) => {
          const rect = element.getBoundingClientRect();
          const rowId = row.id || "";
          const style = getComputedStyle(element);
          const label = (element.getAttribute("service_title") || "").replace(/\s+/g, " ").trim();
          const normalizedLabel = normalizeText(label);

          return {
            id: element.id || "",
            rowId,
            label,
            normalizedLabel,
            rect,
            score: scoreMatch(normalizedLabel),
            visible:
              rect.width >= 40 &&
              rect.height >= 30 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0,
          };
        })
        .filter((item) => item.id && item.visible && item.label && item.score > 0)
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          const rowDiff = getRowIndex(a.rowId) - getRowIndex(b.rowId);
          if (rowDiff !== 0) return rowDiff;
          return a.rect.x - b.rect.x;
        });

      return candidates[0]?.id || "";

      function scoreMatch(normalizedLabel) {
        if (!normalizedTarget) return 0;
        if (normalizedLabel === normalizedTarget) return 100;
        if (normalizedLabel.includes(normalizedTarget) || normalizedTarget.includes(normalizedLabel)) return 90;

        const labelTokens = tokenize(normalizedLabel);
        if (!targetTokens.length || !labelTokens.length) return 0;
        const matchedTokens = targetTokens.filter((token) =>
          labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token) || token.includes(labelToken))
        );
        const coverage = matchedTokens.length / targetTokens.length;
        return coverage === 1 ? 80 + Math.min(targetTokens.length, 10) : 0;
      }

      function getRowIndex(rowId) {
        const match = rowId.match(/dropdown_service_items_row(\d+)/);
        return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
      }

      function normalizeText(value) {
        return value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/["'“”‘’]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function tokenize(value) {
        return value
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .map((token) => token.trim())
          .filter((token) => token.length >= 2);
      }
    },
    serviceName,
    { timeout: 1200 }
  );

  const id = await serviceId.jsonValue();
  expect(id, `Service with service_title similar to "${serviceName}" should have id`).toBeTruthy();
  return id;
}

async function collectVisibleAllServiceLabels(page) {
  return page.evaluate(() => {
    const titleLabels = Array.from(
      document.querySelectorAll('[id^="dropdown_service_items_row"] [service_title]')
    )
      .map((element) => (element.getAttribute("service_title") || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const fallbackLabels = Array.from(document.querySelectorAll("[id]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const label = [
          element.textContent || "",
          element.getAttribute("title") || "",
          element.getAttribute("title_text") || "",
          element.getAttribute("service_title") || "",
          element.getAttribute("service_name") || "",
          element.getAttribute("menu_name") || "",
          element.getAttribute("alt") || "",
        ]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        return {
          label,
          rect,
          visible:
            label &&
            rect.width >= 60 &&
            rect.height >= 30 &&
            rect.width <= 460 &&
            rect.height <= 280 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !element.id.startsWith("menu_"),
        };
      })
      .filter((item) => item.visible)
      .map((item) => item.label)
      .filter((label, index, labels) => labels.indexOf(label) === index)
      .slice(0, 30);

    return [...titleLabels, ...fallbackLabels]
      .filter((label, index, labels) => labels.indexOf(label) === index)
      .slice(0, 30);
  });
}

async function isLeftMenuOpen(page) {
  return page
    .locator("#menu_text_dynamic_menu_1")
    .filter({ hasText: /^Truyền hình$/i })
    .isVisible()
    .catch(() => false);
}

async function findFirstPlayableContentId(page) {
  const contentId = await page.waitForFunction(
    () => {
      const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân)$/i;
      const candidates = Array.from(document.querySelectorAll("[id]"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();

          return (
            rect.width >= 120 &&
            rect.height >= 90 &&
            rect.x >= 180 &&
            rect.y >= 80 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !element.id.startsWith("menu_item_") &&
            !menuText.test(text)
          );
        })
        .sort((a, b) => {
          const aFirstItem = /(^specialModuleID_0_0$|_0_0$)/.test(a.id);
          const bFirstItem = /(^specialModuleID_0_0$|_0_0$)/.test(b.id);
          if (aFirstItem !== bFirstItem) return aFirstItem ? -1 : 1;

          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          if (Math.abs(aRect.y - bRect.y) > 40) return aRect.y - bRect.y;
          return aRect.x - bRect.x;
        });

      return candidates[0]?.id || "";
    },
    null,
    { timeout: 20000 }
  );

  const id = await contentId.jsonValue();
  expect(id, "First playable movie content should have id").toBeTruthy();
  return id;
}

async function findVisibleElementIdByFuzzyLabel(page, text, filters = {}) {
  const elementId = await page.waitForFunction(
    ({ targetText, minWidth, minHeight, maxWidth, maxHeight, excludeIdPrefixes }) => {
      const normalizedTarget = normalizeText(targetText);
      const targetTokens = tokenize(normalizedTarget);
      const candidates = Array.from(document.querySelectorAll("[id]"))
        .map((element) => {
          const style = getComputedStyle(element);
          const label = [
            element.textContent || "",
            element.getAttribute("title") || "",
            element.getAttribute("title_text") || "",
            element.getAttribute("service_name") || "",
            element.getAttribute("menu_name") || "",
            element.getAttribute("alt") || "",
          ]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          const normalizedLabel = normalizeText(label);
          const target = findNavigationTarget(element);
          const rect = target ? target.getBoundingClientRect() : element.getBoundingClientRect();

          return {
            id: target?.id || element.id,
            label,
            rect,
            score: scoreMatch(normalizedLabel),
            visible:
            Boolean(target) &&
            rect.width >= minWidth &&
            rect.height >= minHeight &&
            rect.width <= maxWidth &&
            rect.height <= maxHeight &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
              !excludeIdPrefixes.some((prefix) => element.id.startsWith(prefix)),
          };
        })
        .filter((item) => item.visible && item.label && item.score > 0)
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          const aArea = a.rect.width * a.rect.height;
          const bArea = b.rect.width * b.rect.height;
          return aArea - bArea;
        });

      return candidates[0]?.id || "";

      function findNavigationTarget(element) {
        let current = element;
        let candidate = null;
        while (current && current !== document.body) {
          const rect = current.getBoundingClientRect();
          const style = getComputedStyle(current);
          const id = current.id || "";
          const visible =
            id &&
            rect.width >= minWidth &&
            rect.height >= minHeight &&
            rect.width <= maxWidth &&
            rect.height <= maxHeight &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !excludeIdPrefixes.some((prefix) => id.startsWith(prefix));

          if (visible) {
            candidate = current;
          }
          current = current.parentElement;
        }

        return candidate;
      }

      function scoreMatch(normalizedLabel) {
        if (normalizedLabel === normalizedTarget) return 100;
        if (normalizedLabel.includes(normalizedTarget)) return 90;

        const labelTokens = tokenize(normalizedLabel);
        if (!targetTokens.length || !labelTokens.length) return 0;
        const matchedTokens = targetTokens.filter((token) =>
          labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token))
        );
        const coverage = matchedTokens.length / targetTokens.length;
        return coverage === 1 ? 80 + Math.min(targetTokens.length, 10) : 0;
      }

      function normalizeText(value) {
        return value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/["'“”‘’]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function tokenize(value) {
        return value
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .map((token) => token.trim())
          .filter((token) => token.length >= 2);
      }
    },
    {
      targetText: text,
      minWidth: filters.minWidth || 1,
      minHeight: filters.minHeight || 1,
      maxWidth: filters.maxWidth || Number.MAX_SAFE_INTEGER,
      maxHeight: filters.maxHeight || Number.MAX_SAFE_INTEGER,
      excludeIdPrefixes: filters.excludeIdPrefixes || [],
    },
    { timeout: filters.timeout || 15000 }
  );

  const id = await elementId.jsonValue();
  expect(id, `Visible element similar to "${text}" should have id`).toBeTruthy();
  return id;
}

async function findChannelIdByName(page, channelName) {
  const channelId = await page.waitForFunction(
    (name) => {
      const normalizedName = normalizeText(name);
      const searchTokens = tokenize(normalizedName);
      const candidates = Array.from(document.querySelectorAll("[channel_name]"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const label = (element.getAttribute("channel_name") || "").replace(/\s+/g, " ").trim();
          const normalizedLabel = normalizeText(label);

          return {
            element,
            label,
            normalizedLabel,
            score: scoreMatch(normalizedLabel),
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0,
          };
        })
        .filter((item) => item.visible && item.label && item.score > 0)
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return a.normalizedLabel.length - b.normalizedLabel.length;
        });

      return candidates[0]?.element.id || "";

      function scoreMatch(normalizedLabel) {
        if (!normalizedName) return 0;
        if (normalizedLabel === normalizedName) return 100;
        if (normalizedLabel.includes(normalizedName)) return 90;

        const labelTokens = tokenize(normalizedLabel);
        if (!searchTokens.length || !labelTokens.length) return 0;

        const matchedTokens = searchTokens.filter((token) =>
          labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token))
        );
        const coverage = matchedTokens.length / searchTokens.length;
        if (coverage === 1) return 80 + Math.min(searchTokens.length, 10);
        if (searchTokens.length >= 2 && coverage >= 0.75) return Math.round(60 + coverage * 10);
        return 0;
      }

      function normalizeText(value) {
        return value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function tokenize(value) {
        return value
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .map((token) => token.trim())
          .filter((token) => token.length >= 2);
      }
    },
    channelName,
    { timeout: 20000 }
  );

  const id = await channelId.jsonValue();
  expect(id, `Channel with channel_name similar to "${channelName}" should have id`).toBeTruthy();
  return id;
}

async function findMovieContentIdByName(page, movieName, movieNamePattern) {
  const movieId = await page.waitForFunction(
    ({ name, source }) => {
      const pattern = new RegExp(source, "i");
      const normalizedName = normalizeText(name);
      const searchTokens = tokenize(normalizedName);

      const candidates = Array.from(document.querySelectorAll("[id]"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const label = [
            element.textContent || "",
            element.getAttribute("title") || "",
            element.getAttribute("title_text") || "",
            element.getAttribute("movie_name") || "",
            element.getAttribute("vod_name") || "",
            element.getAttribute("content_name") || "",
            element.getAttribute("channel_name") || "",
            element.getAttribute("alt") || "",
          ]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          return {
            element,
            rect,
            label,
            normalizedLabel: normalizeText(label),
            score: scoreMatch(label, normalizeText(label)),
            visible:
              rect.width >= 120 &&
              rect.height >= 80 &&
              rect.x >= 80 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0 &&
              !element.id.startsWith("menu_"),
          };
        })
        .filter((item) => {
          if (!item.visible || !item.label) return false;
          return item.score > 0;
        })
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;

          const aExact = a.normalizedLabel === normalizedName;
          const bExact = b.normalizedLabel === normalizedName;
          if (aExact !== bExact) return aExact ? -1 : 1;

          const aArea = a.rect.width * a.rect.height;
          const bArea = b.rect.width * b.rect.height;
          if (Math.abs(aArea - bArea) > 1000) return aArea - bArea;

          if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
          return a.rect.x - b.rect.x;
        });

      return candidates[0]?.element.id || "";

      function scoreMatch(label, normalizedLabel) {
        if (pattern.test(label)) return 100;
        if (normalizedLabel === normalizedName) return 95;
        if (normalizedLabel.includes(normalizedName)) return 90;

        const labelTokens = tokenize(normalizedLabel);
        if (!searchTokens.length || !labelTokens.length) return 0;

        const matchedTokens = searchTokens.filter((token) =>
          labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token))
        );
        const coverage = matchedTokens.length / searchTokens.length;
        if (coverage === 1) return 80 + Math.min(searchTokens.length, 10);
        if (searchTokens.length >= 3 && coverage >= 0.75) return Math.round(60 + coverage * 10);

        return 0;
      }

      function normalizeText(value) {
        return value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function tokenize(value) {
        return value
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .map((token) => token.trim())
          .filter((token) => token.length >= 2);
      }
    },
    { name: movieName, source: movieNamePattern.source },
    { timeout: 20000 }
  );

  const id = await movieId.jsonValue();
  expect(id, `Movie content matching "${movieName}" should have id`).toBeTruthy();
  return id;
}

async function findBestSearchResult(page, keyword) {
  await page.waitForFunction(
    () => {
      const bodyText = document.body?.innerText || "";
      if (/không tìm thấy|không có kết quả|không có nội dung/i.test(bodyText)) return true;

      return Array.from(document.querySelectorAll("[id]")).some((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width >= 120 &&
          rect.height >= 80 &&
          rect.x >= 80 &&
          rect.y >= 80 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          !element.id.startsWith("key-") &&
          !element.id.startsWith("menu_")
        );
      });
    },
    null,
    { timeout: 20000 }
  );

  const results = await collectSearchResultCandidates(page, keyword);
  const normalizedKeyword = normalizeVietnameseText(keyword);
  return (
    results.find((item) => item.id === "searchRow_0_0" && item.normalizedLabel === normalizedKeyword) ||
    results.find((item) => item.row === 0 && item.normalizedLabel === normalizedKeyword) ||
    results.find((item) => item.normalizedLabel === normalizedKeyword) ||
    results.find((item) => item.row === 0 && item.score >= 90) ||
    results[0] ||
    null
  );
}

async function collectSearchResultCandidates(page, keyword) {
  return page.evaluate((searchKeyword) => {
    const normalizedKeyword = normalizeText(searchKeyword);
    const searchTokens = tokenize(normalizedKeyword);

    return Array.from(document.querySelectorAll("[id]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const labelParts = {
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
          title: element.getAttribute("title") || "",
          titleText: element.getAttribute("title_text") || "",
          movieName: element.getAttribute("movie_name") || "",
          vodName: element.getAttribute("vod_name") || "",
          contentName: element.getAttribute("content_name") || "",
          channelName: element.getAttribute("channel_name") || "",
          alt: element.getAttribute("alt") || "",
        };
        const label = Object.values(labelParts).join(" ").replace(/\s+/g, " ").trim();
        const normalizedLabel = normalizeText(label);

        return {
          id: element.id,
          ...parseSearchRowId(element.id),
          label,
          labelParts,
          normalizedLabel,
          score: scoreMatch(label, normalizedLabel),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          visible:
            rect.width >= 120 &&
            rect.height >= 80 &&
            rect.x >= 80 &&
            rect.y >= 80 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !element.id.startsWith("key-") &&
            !element.id.startsWith("menu_") &&
            !element.id.includes("keyboard"),
        };
      })
      .filter((item) => item.visible && item.label && item.score > 0 && item.isSearchRow)
      .sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        if (a.score !== b.score) return b.score - a.score;
        const aArea = a.rect.width * a.rect.height;
        const bArea = b.rect.width * b.rect.height;
        if (Math.abs(aArea - bArea) > 1000) return aArea - bArea;
        if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
        return a.rect.x - b.rect.x;
      })
      .slice(0, 40);

    function parseSearchRowId(id) {
      const match = /^searchRow_(\d+)_(\d+)$/.exec(id || "");
      return {
        isSearchRow: Boolean(match),
        row: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
        col: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
      };
    }

    function scoreMatch(label, normalizedLabel) {
      if (!normalizedKeyword) return 0;
      if (normalizedLabel === normalizedKeyword) return 100;
      if (normalizedLabel.includes(normalizedKeyword)) return 90;

      const labelTokens = tokenize(normalizedLabel);
      if (!searchTokens.length || !labelTokens.length) return 0;

      const matchedTokens = searchTokens.filter((token) =>
        labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token))
      );
      const coverage = matchedTokens.length / searchTokens.length;
      if (coverage === 1) return 80 + Math.min(searchTokens.length, 10);
      if (searchTokens.length >= 3 && coverage >= 0.75) return Math.round(60 + coverage * 10);
      return 0;
    }

    function normalizeText(value) {
      return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function tokenize(value) {
      return value
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
    }
  }, keyword);
}

async function collectMovieSearchCandidates(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("[id]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const labelParts = {
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
          title: element.getAttribute("title") || "",
          titleText: element.getAttribute("title_text") || "",
          movieName: element.getAttribute("movie_name") || "",
          vodName: element.getAttribute("vod_name") || "",
          contentName: element.getAttribute("content_name") || "",
          alt: element.getAttribute("alt") || "",
        };
        const label = Object.values(labelParts).join(" ").replace(/\s+/g, " ").trim();

        return {
          id: element.id,
          label,
          labelParts,
          normalizedLabel: normalizeText(label),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          visible:
            rect.width >= 120 &&
            rect.height >= 80 &&
            rect.x >= 80 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !element.id.startsWith("menu_"),
        };
      })
      .filter((item) => item.visible && item.label)
      .sort((a, b) => {
        if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
        return a.rect.x - b.rect.x;
      })
      .slice(0, 80);

    function normalizeText(value) {
      return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }
  });
}

async function collectFirstRowPlayableItems(page) {
  const rows = await collectVisibleContentRows(page);
  return rows[0]?.items || [];
}

async function focusRequestedContentRow(page, rowSelector = {}) {
  const selector =
    typeof rowSelector === "string"
      ? { rowName: rowSelector }
      : {
          rowName: rowSelector.rowName || "",
          rowIndex: Number.isInteger(rowSelector.rowIndex) ? rowSelector.rowIndex : undefined,
          rowPosition: rowSelector.rowPosition || "",
        };

  const { rowName, rowIndex, rowPosition } = selector;
  if (!rowName) {
    const row = await findContentRowByPosition(page, { rowIndex, rowPosition });
    const items = row.items;
    await focusFirstRowStart(page, items[0]);
    return {
      title: row.title || "",
      rowY: row.rowY || items[0]?.rect.y || 0,
      items,
    };
  }

  const targetPattern = normalizeVietnameseText(rowName);
  for (let attempt = 0; attempt < 18; attempt++) {
    const rows = await collectVisibleContentRows(page);
    const matchedRow = findBestContentRowMatch(rows, targetPattern);
    if (matchedRow) {
      await focusFirstRowStart(page, matchedRow.items[0]);
      await expect.poll(() => isFocusedOnRowItems(page, matchedRow.items), { timeout: 6000 }).toBe(true);
      return matchedRow;
    }

    await remotePress(page, "ArrowDown", 700);
  }

  const visibleRows = await collectVisibleContentRows(page);
  throw new Error(
    `Không tìm thấy hàng/cate "${rowName}". Các hàng đang thấy: ${visibleRows
      .map((row) => row.title || `y=${row.rowY}`)
      .join(", ")}`
  );
}

async function findContentRowByPosition(page, { rowIndex, rowPosition } = {}) {
  if (rowPosition === "last") {
    return findLastContentRow(page);
  }

  const index = Number.isInteger(rowIndex) ? rowIndex : 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const rows = await collectVisibleContentRows(page);
    const cateRows = rows.filter((row) => row.title);
    const selectableRows = cateRows.length ? cateRows : rows;
    if (selectableRows[index]) return selectableRows[index];
    await remotePress(page, "ArrowDown", 700);
  }

  const visibleRows = await collectVisibleContentRows(page);
  throw new Error(
    `Không tìm thấy hàng thứ ${index + 1}. Các hàng đang thấy: ${visibleRows
      .map((row) => row.title || `y=${row.rowY}`)
      .join(", ")}`
  );
}

async function findLastContentRow(page) {
  let lastRows = [];
  let lastSignature = "";
  let stableCount = 0;

  for (let attempt = 0; attempt < 18; attempt++) {
    const rows = await collectVisibleContentRows(page);
    const cateRows = rows.filter((row) => row.title);
    const selectableRows = cateRows.length ? cateRows : rows;
    if (selectableRows.length) {
      lastRows = selectableRows;
    }

    const signature = selectableRows.map((row) => `${row.title}:${row.rowY}`).join("|");
    if (signature && signature === lastSignature) {
      stableCount += 1;
      if (stableCount >= 2) break;
    } else {
      stableCount = 0;
      lastSignature = signature;
    }

    await remotePress(page, "ArrowDown", 700);
  }

  const row = lastRows[lastRows.length - 1];
  if (row) return row;

  throw new Error("Không tìm thấy hàng cuối cùng vì không có hàng nội dung nào đang hiển thị.");
}

function findBestContentRowMatch(rows, targetPattern) {
  return rows
    .map((row) => ({
      row,
      score: scoreNormalizedTextMatch(row.normalizedTitle || normalizeVietnameseText(row.title || ""), targetPattern),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.rowY - b.row.rowY)[0]?.row;
}

function scoreNormalizedTextMatch(label, target) {
  if (!label || !target) return 0;
  if (label === target) return 100;
  if (label.includes(target) || target.includes(label)) return 90;

  const labelTokens = label.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  const targetTokens = target.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  if (!labelTokens.length || !targetTokens.length) return 0;

  const matchedTokens = targetTokens.filter((token) =>
    labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token) || token.includes(labelToken))
  );
  const coverage = matchedTokens.length / targetTokens.length;
  if (coverage === 1) return 80;
  if (targetTokens.length >= 2 && coverage >= 0.6) return Math.round(50 + coverage * 20);
  return 0;
}

async function collectVisibleContentRows(page) {
  return page.evaluate(() => {
    const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân|Tất cả dịch vụ)$/i;
    const candidates = Array.from(document.querySelectorAll("[id]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const title = contentLabel(element);
        const img = element.querySelector("img");
        const backgroundImage = getComputedStyle(element).backgroundImage || "";

        return {
          id: element.id,
          title,
          poster: img?.currentSrc || img?.src || extractCssUrl(backgroundImage),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          visible:
            rect.width >= 100 &&
            rect.height >= 80 &&
            rect.width <= 520 &&
            rect.height <= 420 &&
            rect.x >= 100 &&
            rect.y >= 100 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !element.id.startsWith("menu_") &&
            !element.id.startsWith("key-") &&
            !menuText.test(title),
        };
      })
      .filter((item) => item.visible && item.title)
      .sort((a, b) => {
        if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
        return a.rect.x - b.rect.x;
      });

    const rowBuckets = [];
    for (const item of candidates) {
      let row = rowBuckets.find((bucket) => Math.abs(bucket.rowY - item.rect.y) <= 40);
      if (!row) {
        row = {
          rowY: item.rect.y,
          title: "",
          normalizedTitle: "",
          items: [],
        };
        rowBuckets.push(row);
      }
      row.items.push(item);
    }

    const headings = collectVisibleHeadings();
    return rowBuckets
      .map((row) => {
        row.items = dedupeByPosition(row.items).slice(0, 30);
        const heading = headings
          .filter((item) => item.rect.y < row.rowY && row.rowY - item.rect.y <= 150)
          .sort((a, b) => row.rowY - b.rect.y - (row.rowY - a.rect.y))[0];
        row.title = heading?.text || "";
        row.normalizedTitle = normalizeText(row.title);
        return row;
      })
      .filter((row) => row.items.length > 0)
      .sort((a, b) => a.rowY - b.rowY);

    function collectVisibleHeadings() {
      return Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          return {
            text,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            visible:
              text &&
              text.length <= 80 &&
              rect.width > 30 &&
              rect.height > 12 &&
              rect.height <= 70 &&
              rect.x >= 80 &&
              rect.y >= 40 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0 &&
              !element.id.startsWith("menu_") &&
              !element.id.startsWith("key-"),
          };
        })
        .filter((item) => item.visible)
        .sort((a, b) => a.rect.y - b.rect.y);
    }

    function contentLabel(element) {
      return [
        element.getAttribute("title") || "",
        element.getAttribute("title_text") || "",
        element.getAttribute("movie_name") || "",
        element.getAttribute("vod_name") || "",
        element.getAttribute("content_name") || "",
        element.getAttribute("channel_name") || "",
        element.textContent || "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function extractCssUrl(value) {
      const match = value.match(/url\(["']?(.+?)["']?\)/);
      return match?.[1] || "";
    }

    function dedupeByPosition(items) {
      const output = [];
      for (const item of items) {
        const duplicate = output.find(
          (existing) =>
            Math.abs(existing.rect.x - item.rect.x) <= 24 &&
            Math.abs(existing.rect.y - item.rect.y) <= 24
        );

        if (!duplicate) {
          output.push(item);
        }
      }

      return output.sort((a, b) => a.rect.x - b.rect.x);
    }

    function normalizeText(value) {
      return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }
  });
}

async function focusFirstRowStart(page, firstItem) {
  if (!firstItem?.id) {
    await expectFocusedContent(page);
    return;
  }

  const hasTargetFocus = await isFocusedOnContentItem(page, firstItem);
  if (!hasTargetFocus) {
    await remoteFocusById(page, firstItem.id, 80).catch(() => {});
  }

  await expectFocusedContent(page);
  await expect.poll(() => isFocusedOnContentItem(page, firstItem), { timeout: 6000 }).toBe(true);
}

async function expectFocusedContent(page) {
  await expect.poll(() => isFocusedContentItem(page), { timeout: 10000 }).toBe(true);
}

async function isFocusedContentItem(page) {
  return page.evaluate(() => {
    const focused = document.querySelector(".focused");
    if (!focused) return false;

    const rect = focused.getBoundingClientRect();
    const style = getComputedStyle(focused);
    const label = contentLabel(focused);
    const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân|Tất cả dịch vụ)$/i;

    return (
      rect.width >= 100 &&
      rect.height >= 80 &&
      rect.x >= 100 &&
      rect.y >= 100 &&
      rect.width <= 620 &&
      rect.height <= 460 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      !focused.id.startsWith("menu_") &&
      !focused.id.startsWith("key-") &&
      label &&
      !menuText.test(label)
    );

    function contentLabel(element) {
      return [
        element.getAttribute("title") || "",
        element.getAttribute("title_text") || "",
        element.getAttribute("movie_name") || "",
        element.getAttribute("vod_name") || "",
        element.getAttribute("content_name") || "",
        element.getAttribute("channel_name") || "",
        element.textContent || "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
  });
}

async function isFocusedOnContentItem(page, item) {
  if (!item?.id) return false;

  return page.evaluate((targetId) => {
    const focused = document.querySelector(".focused");
    if (!focused) return false;
    const target = document.getElementById(targetId);
    return focusWithinTarget(focused, target);

    function focusWithinTarget(focusedElement, targetElement) {
      if (!focusedElement || !targetElement) return false;
      if (
        focusedElement === targetElement ||
        focusedElement.contains(targetElement) ||
        targetElement.contains(focusedElement)
      ) {
        return true;
      }

      const focusedRect = focusedElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const intersects =
        focusedRect.left < targetRect.right &&
        focusedRect.right > targetRect.left &&
        focusedRect.top < targetRect.bottom &&
        focusedRect.bottom > targetRect.top;

      if (!intersects) return false;

      const overlapWidth =
        Math.min(focusedRect.right, targetRect.right) - Math.max(focusedRect.left, targetRect.left);
      const overlapHeight =
        Math.min(focusedRect.bottom, targetRect.bottom) - Math.max(focusedRect.top, targetRect.top);
      return overlapWidth >= 12 && overlapHeight >= 12;
    }
  }, item.id);
}

async function isFocusedOnRowItems(page, items) {
  const targetIds = (items || []).map((item) => item?.id).filter(Boolean);
  if (!targetIds.length) return false;

  return page.evaluate((ids) => {
    const focused = document.querySelector(".focused");
    if (!focused) return false;

    return ids.some((id) => {
      const target = document.getElementById(id);
      return focusWithinTarget(focused, target);
    });

    function focusWithinTarget(focusedElement, targetElement) {
      if (!focusedElement || !targetElement) return false;
      if (
        focusedElement === targetElement ||
        focusedElement.contains(targetElement) ||
        targetElement.contains(focusedElement)
      ) {
        return true;
      }

      const focusedRect = focusedElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const intersects =
        focusedRect.left < targetRect.right &&
        focusedRect.right > targetRect.left &&
        focusedRect.top < targetRect.bottom &&
        focusedRect.bottom > targetRect.top;

      if (!intersects) return false;

      const overlapWidth =
        Math.min(focusedRect.right, targetRect.right) - Math.max(focusedRect.left, targetRect.left);
      const overlapHeight =
        Math.min(focusedRect.bottom, targetRect.bottom) - Math.max(focusedRect.top, targetRect.top);
      return overlapWidth >= 12 && overlapHeight >= 12;
    }
  }, targetIds);
}

async function getFocusedContentMetadata(page) {
  return page.evaluate(() => {
    const focused = document.querySelector(".focused");
    if (!focused) {
      return {
        id: "",
        title: "",
        poster: "",
        rect: null,
      };
    }

    const rect = focused.getBoundingClientRect();
    const img = focused.querySelector("img");
    const backgroundImage = getComputedStyle(focused).backgroundImage || "";
    const title = [
      focused.getAttribute("title") || "",
      focused.getAttribute("title_text") || "",
      focused.getAttribute("movie_name") || "",
      focused.getAttribute("vod_name") || "",
      focused.getAttribute("content_name") || "",
      focused.getAttribute("channel_name") || "",
      focused.textContent || "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id: focused.id || "",
      title,
      poster: img?.currentSrc || img?.src || extractCssUrl(backgroundImage),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };

    function extractCssUrl(value) {
      const match = value.match(/url\(["']?(.+?)["']?\)/);
      return match?.[1] || "";
    }
  });
}

async function openFocusedContentForPlayback(page) {
  await remotePress(page, "Enter", 3500);

  const hasVideo = await getPlayerState(page)
    .then((state) => state.hasVideo)
    .catch(() => false);
  if (hasVideo) return;

  const focused = await getFocusedState(page).catch(() => ({ text: "", label: "" }));
  const xemNgay = /^Xem ngay$/i;
  if (xemNgay.test(focused.text) || xemNgay.test(focused.label) || (await hasVisibleText(page, xemNgay))) {
    await remoteFocusByText(page, xemNgay, 60).catch(() => {});
    await remotePress(page, "Enter", 6000);
  }
}

async function inspectPlaybackAfterWait(page, waitSeconds) {
  await page.waitForTimeout(waitSeconds * 1000);

  const popup = await getVisiblePopup(page);
  const playerState = await getPlayerState(page).catch((error) => ({
    hasVideo: false,
    isProbablyPlaying: false,
    reason: error?.message || String(error),
  }));

  return {
    ok: !popup && playerState.hasVideo && playerState.isProbablyPlaying,
    popup,
    playerState,
  };
}

async function returnFromPlayerOrDetail(page) {
  return sharedPlayback.closePlayerOrDetail(page, {
    remotePress,
    maxBackPresses: 2,
    backDelayMs: 2500,
  });
}

async function returnToFirstRowContent(page, { item, rowY }) {
  await sharedPlayback.closePlayerOrDetail(page, {
    remotePress,
    isClosed: async (candidatePage) => (
      (await isFocusedContentItem(candidatePage)) &&
      (await isFocusedNearRow(candidatePage, rowY))
    ),
    maxBackPresses: 2,
    backDelayMs: 1800,
  });

  if (item?.id) {
    await remoteFocusById(page, item.id, 20).catch(() => {});
  }

  await expectFocusedContent(page);
}

async function moveToNextFirstRowContent(page, { previousSignature, rowY }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await remotePress(page, "ArrowRight", 800);

    if (!(await isFocusedContentItem(page)) || !(await isFocusedNearRow(page, rowY))) {
      return false;
    }

    const focusedItem = await getFocusedContentMetadata(page);
    if (contentItemSignature(focusedItem) !== previousSignature) {
      return true;
    }
  }

  return false;
}

async function isFocusedNearRow(page, rowY) {
  return page.evaluate((targetY) => {
    const focused = document.querySelector(".focused");
    if (!focused) return false;

    const rect = focused.getBoundingClientRect();
    return Math.abs(Math.round(rect.y) - targetY) <= 80;
  }, rowY);
}

function contentItemSignature(item) {
  return [item?.id || "", item?.title || "", item?.poster || ""].join("|").trim();
}

async function attachFirstRowPlaybackReport(testInfo, results) {
  await testInfo.attach("first-row-playback-results.json", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  await testInfo.attach("first-row-playback-results.html", {
    body: renderPlaybackResultsHtml(results),
    contentType: "text/html",
  });
}

function renderPlaybackResultsHtml(results) {
  const rows = results
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(String(item.index))}</td>
          <td>${item.poster ? `<img class="poster" src="${escapeHtml(item.poster)}" alt="" />` : ""}</td>
          <td>${escapeHtml(item.title)}</td>
          <td class="${item.status === "playable" ? "ok" : "failed"}">${escapeHtml(item.status)}</td>
          <td>${renderPlaybackErrorCell(item)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { background: #f3f5f8; text-align: left; }
    .poster { width: 96px; max-height: 140px; object-fit: cover; }
    .error-cell { display: grid; gap: 8px; }
    .error-text { white-space: pre-wrap; word-break: break-word; }
    .error-screenshot { width: 320px; max-width: 100%; max-height: 220px; object-fit: contain; border: 1px solid #ddd; background: #111; }
    .error-screenshot-caption { color: #667085; font-size: 12px; }
    .ok { color: #087f3f; font-weight: 700; }
    .failed { color: #c62828; font-weight: 700; }
  </style>
</head>
<body>
  <h1>First-row playback results</h1>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Poster</th>
        <th>Tên nội dung</th>
        <th>Trạng thái</th>
        <th>Lỗi</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function renderPlaybackErrorCell(item) {
  const errorText = item.errorPopup || "";
  const screenshot = item.screenshotDataUrl || "";
  const screenshotName = item.screenshot || "";

  if (!errorText && !screenshot && !screenshotName) return "";

  return `
    <div class="error-cell">
      ${errorText ? `<div class="error-text">${escapeHtml(errorText)}</div>` : ""}
      ${
        screenshot
          ? `<img class="error-screenshot" src="${escapeHtml(screenshot)}" alt="${escapeHtml(`Screenshot lỗi ${item.title}`)}" />`
          : ""
      }
      ${screenshotName ? `<div class="error-screenshot-caption">${escapeHtml(screenshotName)}</div>` : ""}
    </div>`;
}

function imageDataUrl(buffer) {
  return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getVisiblePopup(page) {
  return page.evaluate((closePatternSource) => {
    const closePattern = new RegExp(closePatternSource, "i");
    const errorPattern = /lỗi|error|không thể|không phát|thất bại|xin lỗi|vui lòng thử lại/i;
    const elements = Array.from(document.querySelectorAll("body *"));

    const visibleElements = elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0
      );
    });

    const closeButton = visibleElements.find((element) => closePattern.test(elementText(element)));
    const errorElement = visibleElements.find((element) => errorPattern.test(elementText(element)));

    if (!closeButton && !errorElement) return null;

    const root =
      [closeButton, errorElement]
        .filter(Boolean)
        .map((element) => closestPopupRoot(element))
        .sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          return bRect.width * bRect.height - aRect.width * aRect.height;
        })[0] ||
      closeButton ||
      errorElement;

    const text = elementText(root) || elementText(errorElement) || elementText(closeButton);

    return {
      text,
      closeText: closeButton ? elementText(closeButton) : "",
    };

    function closestPopupRoot(element) {
      let current = element;
      while (current?.parentElement && current.parentElement !== document.body) {
        if (looksLikePopupRoot(current)) {
          return current;
        }

        const rect = current.getBoundingClientRect();
        const parentRect = current.parentElement.getBoundingClientRect();
        if (
          parentRect.width >= rect.width &&
          parentRect.height >= rect.height &&
          parentRect.width <= window.innerWidth &&
          parentRect.height <= window.innerHeight
        ) {
          current = current.parentElement;
          continue;
        }

        break;
      }

      return current;
    }

    function looksLikePopupRoot(element) {
      const marker = `${element.id || ""} ${element.className || ""} ${element.getAttribute("role") || ""}`;
      return /popup|modal|dialog|toast|alert|message|notify|notification|error/i.test(marker);
    }

    function elementText(element) {
      if (!element) return "";

      const attributeNames = [
        "aria-label",
        "title",
        "button-title",
        "data-title",
        "data-message",
        "message",
        "error-message",
        "description",
        "alt",
      ];
      const nodes = [element, ...Array.from(element.querySelectorAll?.("*") || [])];
      const parts = [];

      for (const node of nodes) {
        parts.push((node.textContent || "").replace(/\s+/g, " ").trim());

        for (const name of attributeNames) {
          const value = node.getAttribute?.(name);
          if (value) parts.push(value.replace(/\s+/g, " ").trim());
        }
      }

      return parts
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(" ")
        .trim();
    }
  }, CLOSE_POPUP_TEXT.source);
}

async function getPlayerState(page) {
  return page.evaluate(async () => {
    const videos = Array.from(document.querySelectorAll("video"));
    const video =
      videos.find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) || videos[0];

    if (!video) {
      return {
        hasVideo: false,
        isProbablyPlaying: false,
        reason: "No video element found",
      };
    }

    const before = {
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
      networkState: video.networkState,
      width: video.videoWidth,
      height: video.videoHeight,
      src: video.currentSrc || video.src || "",
    };

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const after = {
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
      networkState: video.networkState,
      width: video.videoWidth,
      height: video.videoHeight,
      src: video.currentSrc || video.src || "",
    };

    const timeAdvanced = after.currentTime > before.currentTime + 0.25;
    const hasFrames = after.width > 0 && after.height > 0;
    const hasEnoughData = after.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const isProbablyPlaying = !after.paused && !after.ended && hasEnoughData && (timeAdvanced || hasFrames);

    return {
      hasVideo: true,
      before,
      after,
      timeAdvanced,
      hasFrames,
      hasEnoughData,
      isProbablyPlaying,
      reason: isProbablyPlaying
        ? ""
        : playbackReason({ before, after, timeAdvanced, hasFrames, hasEnoughData }),
    };

    function playbackReason({ before, after, timeAdvanced, hasFrames, hasEnoughData }) {
      if (after.ended) return "Video ended";
      if (after.paused) return "Video element is paused";
      if (!hasEnoughData) return `Video does not have enough data: readyState=${after.readyState}`;
      if (!hasFrames) return `Video has no rendered frames: videoWidth=${after.width}, videoHeight=${after.height}`;
      if (!timeAdvanced) {
        return `Video time did not advance: before=${before.currentTime}, after=${after.currentTime}`;
      }
      return "Video playback state is not healthy";
    }
  });
}

async function expectFocusedText(page, text) {
  await expect.poll(() => getFocusedState(page).then((state) => state.text)).toMatch(text);
}

async function expectFocusedElementToLookOrange(page) {
  const orangeScore = await page.evaluate(() => {
    const focused = document.querySelector(".focused");
    if (!focused) return 0;
    const style = getComputedStyle(focused);
    const colors = [style.backgroundColor, style.borderColor, style.boxShadow, style.color].join(" ");
    const matches = [...colors.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)];
    return matches.some(([, r, g, b]) => {
      const red = Number(r);
      const green = Number(g);
      const blue = Number(b);
      return red >= 200 && green >= 80 && green <= 180 && blue <= 80;
    })
      ? 1
      : 0;
  });

  expect(orangeScore).toBe(1);
}

async function enterWithVirtualKeyboard(page, value) {
  for (const char of value) {
    await remoteFocusByVirtualKey(page, char);
    await remotePress(page, "Enter", 250);
  }
}

async function remoteFocusByVirtualKey(page, char) {
  for (const keyId of virtualKeyIds(char)) {
    const hasKeyId = await page
      .evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        // Must be actually rendered and within viewport to be a real keyboard key.
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || 1080) &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0
        );
      }, keyId)
      .catch(() => false);

    if (hasKeyId) {
      await remoteFocusById(page, keyId);
      return;
    }
  }

  await remoteFocusByKeyText(page, char);
}

function virtualKeyIds(char) {
  const keyMap = {
    ".": "key-dot-v2",
    " ": ["space", "key-space-v2"],
    "-": "key-dash-v2",
    _: "key-underline-v2",
    "!": "key-exclamation-v2",
    "@": "key-atsign-v2",
    "#": "key-hash-v2",
    $: "key-dollar-v2",
    "%": "key-percent-v2",
    "^": "key-caret-v2",
    "&": "key-and-v2",
    "*": "key-asterisk-v2",
  };

  const keyIds = keyMap[char] ?? `key-${char.toLowerCase()}-v2`;
  return Array.isArray(keyIds) ? keyIds : [keyIds];
}

function searchKeyboardInput(value) {
  return normalizeVietnameseText(value);
}

function cssEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function remoteFocusByText(page, text, maxMoves = 40) {
  await remoteFocus(page, {
    maxMoves,
    isTarget: (state) => text.test(state.text) || text.test(state.label),
    getTargetRect: async () =>
      page.evaluate((source) => {
        const pattern = new RegExp(source, "i");
        const candidates = Array.from(document.querySelectorAll("body *"));
        const target = candidates
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const text = (element.textContent || "").replace(/\s+/g, " ").trim();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              pattern.test(text)
            );
          })
          .sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            return aRect.width * aRect.height - bRect.width * bRect.height;
          })[0];
        return target ? rectOf(target) : null;

        function rectOf(element) {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }
      }, text.source),
  });
}

async function remoteFocusByKeyText(page, char, maxMoves = 50) {
  await remoteFocus(page, {
    maxMoves,
    isTarget: (state) => state.text.toLowerCase() === char.toLowerCase(),
    getTargetRect: async () =>
      page.evaluate((targetChar) => {
        const normalizedTarget = targetChar.toLowerCase();
        const candidates = Array.from(document.querySelectorAll("body *"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const text = (element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            const hasChildText = Array.from(element.children || []).some((child) =>
              (child.textContent || "").trim()
            );

            return (
              text === normalizedTarget &&
              !hasChildText &&
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            const aArea = aRect.width * aRect.height;
            const bArea = bRect.width * bRect.height;
            return aArea - bArea;
          });

        const target = candidates[0];
        if (!target) return null;

        const rect = target.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }, char),
  });
}

async function remoteFocusById(page, id, maxMoves = 50, options = {}) {
  await remoteFocus(page, {
    maxMoves,
    preferredDirection: options.preferredDirection,
    isTarget: (state) => {
      if (state.id === id) return true;
      // When the target is a container element (e.g. id="space" wrapping the
      // spacebar + Xoá + Tìm kiếm row), the `.focused` class lands on a CHILD
      // rather than the container itself.  Accept focus if the focused element
      // is contained within the target element.
      return page.evaluate(
        ({ focusedId, targetId }) => {
          const target = document.getElementById(targetId);
          if (!target) return false;
          const focusedEl = focusedId
            ? document.getElementById(focusedId)
            : document.querySelector(".focused");
          if (!focusedEl) return false;
          // Accept focus when:
          //   1. focused element is a descendant of the target (e.g. focus on img child of #space)
          //   2. target element is a descendant of the focused element (e.g. focus on #space container
          //      while target is the #key-space-v2 img child inside it)
          return target.contains(focusedEl) || focusedEl.contains(target);
        },
        { focusedId: state.id, targetId: id }
      );
    },
    getTargetRect: async () =>
      page.evaluate((targetId) => {
        const element = document.getElementById(targetId);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }, id),
  });
}

async function remoteFocus(page, { isTarget, getTargetRect, maxMoves, preferredDirection }) {
  const targetRect = await getTargetRect();
  expect(targetRect).toBeTruthy();

  for (let attempt = 0; attempt < maxMoves; attempt++) {
    const state = await getFocusedState(page);
    if (await Promise.resolve(isTarget(state))) return;

    const key = preferredDirection || chooseDirection(state.rect, targetRect);
    const before = state.id || state.text;
    await remotePress(page, key, 160);
    const after = await getFocusedState(page);

    if ((after.id || after.text) === before) {
      await remotePress(page, fallbackDirection(key), 160);
    }
  }

  // One final check: the last press may have landed on the target but the loop
  // ended before the next iteration could detect it.
  const finalState = await getFocusedState(page);
  if (await Promise.resolve(isTarget(finalState))) return;

  throw new Error(
    `Could not focus target with remote keys. Current focus: ${JSON.stringify(finalState)}`
  );
}

function chooseDirection(fromRect, toRect) {
  const from = center(fromRect);
  const to = center(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const isAbove = toRect.y + toRect.height <= fromRect.y;
  const isBelow = toRect.y >= fromRect.y + fromRect.height;
  const isLeft = toRect.x + toRect.width <= fromRect.x;
  const isRight = toRect.x >= fromRect.x + fromRect.width;
  const horizontalOverlap = rangesOverlap(fromRect.x, fromRect.x + fromRect.width, toRect.x, toRect.x + toRect.width);
  const verticalOverlap = rangesOverlap(fromRect.y, fromRect.y + fromRect.height, toRect.y, toRect.y + toRect.height);

  if ((isAbove || isBelow) && horizontalOverlap) {
    return isBelow ? "ArrowDown" : "ArrowUp";
  }

  if ((isLeft || isRight) && verticalOverlap) {
    return isRight ? "ArrowRight" : "ArrowLeft";
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "ArrowRight" : "ArrowLeft";
  }

  return dy > 0 ? "ArrowDown" : "ArrowUp";
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function fallbackDirection(key) {
  return {
    ArrowRight: "ArrowDown",
    ArrowDown: "ArrowRight",
    ArrowLeft: "ArrowUp",
    ArrowUp: "ArrowLeft",
  }[key];
}

function center(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

async function getFocusedState(page) {
  return page.evaluate(() => {
    const focused = Array.from(document.querySelectorAll(".focused")).find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });

    if (!focused) {
      return {
        id: "",
        text: "",
        label: "",
        rect: { x: 0, y: 0, width: 0, height: 0 },
      };
    }

    const rect = focused.getBoundingClientRect();
    const text = (focused.textContent || "").replace(/\s+/g, " ").trim();
    const parentText = (focused.parentElement?.textContent || "").replace(/\s+/g, " ").trim();
    const siblingText = Array.from(focused.parentElement?.children || [])
      .map((element) => (element.textContent || "").replace(/\s+/g, " ").trim())
      .join(" ")
      .trim();

    return {
      id: focused.id || "",
      text,
      label: [text, parentText, siblingText].filter(Boolean).join(" "),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    };
  });
}

module.exports = {
  getTestOptions,
  runStep,
  openAppAndEnterLoginPage,
  loginWithAccount,
  chooseFirstProfileAndEnterHome,
  closeHomePopupsAndVerifyHome,
  openSearchFromLeftMenu,
  openTelevisionFromLeftMenu,
  openMovieFromLeftMenu,
  openSettingFromLeftMenu,
  openServiceFromLeftMenuOrAllServices,
  openChannel,
  searchAndOpenBestContent,
  openMovieContent,
  openFirstMovieContent,
  playAllItemsInFirstRow,
  assertChannelPlayback,
  assertMoviePlayback,
  assertSearchContentPlayback,
  attachCurrentAppScreenshot,
  __internal: {
    focusFirstRowStart,
    findServiceIdInAllServices,
    closeAdvertisePopupIfVisible,
    getVisiblePopup,
    chooseDirection,
  },
};
