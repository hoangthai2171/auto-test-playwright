const {test,expect}=require("playwright/test");
const {normalizeVietnameseText,containsTextPattern}=require("./text-utils");
const navigation=require("./navigation");
const contentRows=require("./content-rows");
const playback=require("./playback");
const artifacts=require("./artifacts");

const {remotePress,remoteFocusById,remoteFocusByText,enterWithVirtualKeyboard,searchKeyboardInput,getFocusedState,expectFocusedText,expectFocusedElementToLookOrange}=navigation;
const {collectVisibleContentRows,focusRequestedContentRow,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback}=contentRows;
const {getPlayerState,inspectPlaybackAfterWait}=playback;
const {runStep,attachCurrentAppScreenshot,attachMovieSearchFailureArtifacts,attachSearchNoResultArtifacts,attachFailureArtifacts,attachFirstRowPlaybackReport,renderPlaybackResultsHtml,renderPlaybackErrorCell,imageDataUrl,safeArtifactName}=artifacts;


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
  AI_PLAN_PATH: "",
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
    AI_PLAN_PATH: process.env.AI_PLAN_PATH || DEFAULT_OPTIONS.AI_PLAN_PATH,
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
  const backPresses = Number(options.backPresses || 2);
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
        await testInfo.attach(`${safeArtifactName(`ai-first-row-${index + 1}-focused-item`)}.json`, {
          body: JSON.stringify(item, null, 2),
          contentType: "application/json",
        });
        await openFocusedContentForPlayback(page);

        const playback = await inspectPlaybackAfterWait(page, waitSeconds);
        result.status = playback.ok ? "playable" : "failed";
        result.errorPopup = playback.popup?.text || playback.playerState?.reason || "";
        result.playerState = playback.playerState;

        if (!playback.ok) {
          const screenshotName = `${safeArtifactName(`ai-first-row-${index + 1}-${label}`)}.png`;
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
        const screenshotName = `${safeArtifactName(`ai-first-row-${index + 1}-${label}-error`)}.png`;
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
          backPresses,
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

contentRows.configureContentRows({remotePress,remoteFocusById,remoteFocusByText,getFocusedState,getPlayerState,hasVisibleText,expectFocusedText});
artifacts.configureArtifacts({getFocusedState,collectMovieSearchCandidates,collectSearchResultCandidates});


module.exports={getTestOptions,runStep,openAppAndEnterLoginPage,loginWithAccount,chooseFirstProfileAndEnterHome,closeHomePopupsAndVerifyHome,openSearchFromLeftMenu,openTelevisionFromLeftMenu,openMovieFromLeftMenu,openSettingFromLeftMenu,openServiceFromLeftMenuOrAllServices,openChannel,searchAndOpenBestContent,openMovieContent,openFirstMovieContent,playAllItemsInFirstRow,assertChannelPlayback:playback.assertChannelPlayback,assertMoviePlayback:playback.assertMoviePlayback,assertSearchContentPlayback:playback.assertSearchContentPlayback,attachCurrentAppScreenshot,__internal:{focusFirstRowStart,findServiceIdInAllServices,closeAdvertisePopupIfVisible,getVisiblePopup:playback.getVisiblePopup,chooseDirection:navigation.__internal.chooseDirection}};
