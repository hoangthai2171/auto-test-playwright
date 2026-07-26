"use strict";

const navigation = require("../../tests/lib/navigation");
const { createRemotePage } = require("./tizen-poc-login");

const CONTENT_TYPES = new Set(["channel", "movie", "content"]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function searchRowPosition(id) {
  const match = /^searchRow_(\d+)_(\d+)$/.exec(String(id || ""));
  return {
    row: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
    column: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
  };
}

function scoreSearchCandidate(label, name) {
  const normalizedLabel = normalizeText(label);
  const normalizedName = normalizeText(name);
  if (!normalizedLabel || !normalizedName) return 0;
  if (normalizedLabel === normalizedName) return 100;
  if (normalizedLabel.includes(normalizedName)) return 90;

  const nameTokens = normalizedName.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  const labelTokens = normalizedLabel.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  if (!nameTokens.length || !labelTokens.length) return 0;

  const matched = nameTokens.filter((nameToken) =>
    labelTokens.some((labelToken) => labelToken === nameToken || labelToken.includes(nameToken))
  );
  if (matched.length !== nameTokens.length) return 0;
  return 80 + Math.min(nameTokens.length, 10);
}

function selectBestSearchResult(candidates, request) {
  const requestedType = request.type || "content";
  return (candidates || [])
    .filter((candidate) => candidate?.visible && candidate.id && candidate.label)
    .filter((candidate) => requestedType === "content" || !candidate.type || candidate.type === requestedType)
    .map((candidate) => ({
      ...candidate,
      score: scoreSearchCandidate(candidate.label, request.name),
      position: searchRowPosition(candidate.id),
    }))
    .filter((candidate) => candidate.score >= 70)
    .sort((left, right) =>
      right.score - left.score ||
      left.position.row - right.position.row ||
      left.position.column - right.position.column ||
      left.label.length - right.label.length
    )[0] || null;
}

function assessPlayback(before, after, popupText) {
  const timeAdvanced = Number(after?.currentTime || 0) > Number(before?.currentTime || 0) + 0.25;
  const hasFrames = Number(after?.width || 0) > 0 && Number(after?.height || 0) > 0;
  const hasEnoughData = Number(after?.readyState || 0) >= 2;
  const passed = !popupText &&
    after?.hasVideo === true &&
    !after.paused &&
    !after.ended &&
    hasEnoughData &&
    (timeAdvanced || hasFrames);

  return {
    passed,
    timeAdvanced,
    hasFrames,
    hasEnoughData,
    popupText: popupText || "",
    before,
    after,
  };
}

async function runSemanticSearchPlayback({
  execute,
  request,
  driver,
  searchSettleMs = 3_000,
  playbackStartMs = 3_500,
  playbackWaitMs = 6_000,
} = {}) {
  if (!request?.name || !request?.type) {
    throw new Error("A validated semantic search request is required.");
  }
  const activeDriver = driver || createSemanticDriver({execute});

  await activeDriver.enterHome();
  await activeDriver.openSearch();
  await activeDriver.enterSearch(request.name);
  await activeDriver.wait(searchSettleMs);

  const searchResult = selectBestSearchResult(await activeDriver.readSearchCandidates(), request);
  if (!searchResult) {
    throw new Error(`No visible ${request.type} search result matched "${request.name}".`);
  }

  await activeDriver.focusResult(searchResult.id);
  await activeDriver.activateFocusedResult();
  await activeDriver.wait(playbackStartMs);

  let before = await activeDriver.readPlayerState();
  if (!before.hasVideo && typeof activeDriver.activatePlayNow === "function") {
    const startedFromDetail = await activeDriver.activatePlayNow();
    if (startedFromDetail) {
      await activeDriver.wait(playbackStartMs);
      before = await activeDriver.readPlayerState();
    }
  }
  await activeDriver.wait(playbackWaitMs);
  const after = await activeDriver.readPlayerState();
  const player = assessPlayback(before, after, await activeDriver.readPopupText());
  if (!player.passed) {
    const error = new Error(`Playback DOM assessment failed for ${request.type} "${request.name}".`);
    error.details = {searchResult, player};
    throw error;
  }

  return {
    searchResult,
    player,
    async exitPlayer() {
      if (typeof activeDriver.exitPlayer !== "function") {
        throw new Error("Semantic POC driver cannot exit the player with a real remote key.");
      }
      await activeDriver.exitPlayer();
    },
  };
}

async function leavePlayerAfterAssessment({semantic, wait} = {}) {
  if (!semantic || typeof semantic.exitPlayer !== "function" || typeof wait !== "function") {
    throw new Error("Semantic player teardown requires exitPlayer and wait functions.");
  }
  await semantic.exitPlayer();
  await wait(2_000);
}

function isVisibleElementScript(id) {
  return `return (() => {
    const element = document.getElementById(${JSON.stringify(id)});
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
  })();`;
}

async function findSearchMenuItemId(execute) {
  return execute(`return (() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
    };
    const label = Array.from(document.querySelectorAll('[id^="menu_text_"]')).find((element) =>
      visible(element) && /^Tìm kiếm$/i.test((element.textContent || '').replace(/\\s+/g, ' ').trim())
    );
    if (label && label.id) return label.id.replace(/^menu_text_/, 'menu_item_');
    const fallback = document.getElementById('menu_item_search');
    return fallback && visible(fallback) ? fallback.id : '';
  })();`);
}

async function readSearchCandidates(execute) {
  return execute(`return (() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width >= 120 && rect.height >= 80 && rect.x >= 0 && rect.y >= 80 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
    };
    const root = Array.from(document.querySelectorAll('#clip_search_content #clip_item_row #clip_item_row_move_grid_ver_container'))
      .find((element) => visible(element) || Array.from(element.querySelectorAll('[id]')).some(visible));
    if (!root) return [];
    return Array.from(root.querySelectorAll('[id]'))
      .filter(visible)
      .filter((element) => !element.id.startsWith('key-') && !element.id.startsWith('menu_') && !element.id.includes('keyboard'))
      .map((element) => {
        const fields = [
          element.textContent || '',
          element.getAttribute('title') || '',
          element.getAttribute('title_text') || '',
          element.getAttribute('movie_name') || '',
          element.getAttribute('vod_name') || '',
          element.getAttribute('content_name') || '',
          element.getAttribute('channel_name') || '',
          element.getAttribute('alt') || '',
        ];
        const label = fields.join(' ').replace(/\\s+/g, ' ').trim();
        return {
          id: element.id,
          label,
          visible: Boolean(label),
          type: element.getAttribute('channel_name') ? 'channel' :
            (element.getAttribute('movie_name') || element.getAttribute('vod_name')) ? 'movie' : '',
        };
      });
  })();`);
}

async function isFocusedWithin(execute, id) {
  return execute(`return (() => {
    const target = document.getElementById(${JSON.stringify(id)});
    const focused = document.querySelector('.focused');
    return Boolean(target && focused && (target === focused || target.contains(focused) || focused.contains(target)));
  })();`);
}

async function readPlayerState(execute) {
  return execute(`return (() => {
    const video = Array.from(document.querySelectorAll('video')).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || document.querySelector('video');
    if (!video) return {hasVideo: false, currentTime: 0, paused: true, ended: false, readyState: 0, width: 0, height: 0};
    return {
      hasVideo: true,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      paused: Boolean(video.paused),
      ended: Boolean(video.ended),
      readyState: Number(video.readyState || 0),
      width: Number(video.videoWidth || 0),
      height: Number(video.videoHeight || 0),
    };
  })();`);
}

async function readVisiblePlaybackPopup(execute) {
  return execute(`return (() => {
    const errorPattern = /lỗi|error|không thể|không phát|thất bại|xin lỗi|vui lòng thử lại/i;
    const roots = Array.from(document.querySelectorAll('#dialog_confirm_v2, #dialog_alert_v2, #dialog_alert_full, #dialog_confirm_full, [role="dialog"], .popup, .modal'));
    const visibleError = roots.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const text = (element.textContent || '').replace(/\\s+/g, ' ').trim();
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && errorPattern.test(text);
    });
    return visibleError ? (visibleError.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500) : '';
  })();`);
}

async function readProfileOrHomeState(execute) {
  return execute(`return (() => {
    const profile = document.getElementById('item_0');
    if (profile) {
      const rect = profile.getBoundingClientRect();
      const style = getComputedStyle(profile);
      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0) {
        return 'profile';
      }
    }
    return /home/i.test(location.hash || '') ? 'home' : '';
  })();`);
}

async function waitForProfileOrHome({
  readState,
  wait,
  timeoutMs = 30_000,
  pollMs = 250,
  allowProfile = true,
} = {}) {
  if (typeof readState !== "function" || typeof wait !== "function") {
    throw new Error("Profile/Home readiness requires readState and wait functions.");
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const state = await readState();
    if (state === "home" || (allowProfile && state === "profile")) return state;
    await wait(pollMs);
  }
  throw new Error("Timed out waiting for MyTV profile selection or Home.");
}

function createSemanticDriver({execute}) {
  if (typeof execute !== "function") throw new Error("An Appium execute adapter is required for semantic POC actions.");
  const page = createRemotePage({
    execute,
    pressKey: (key) => execute("tizen: pressKey", [{key}]),
  });

  return {
    wait: (timeoutMs) => page.waitForTimeout(timeoutMs),
    async enterHome() {
      const readiness = {
        readState: () => readProfileOrHomeState(execute),
        wait: (timeoutMs) => page.waitForTimeout(timeoutMs),
      };
      const entryState = await waitForProfileOrHome(readiness);
      if (entryState === "profile") {
        await navigation.remoteFocusById(page, "item_0");
        await page.keyboard.press("Enter");
        await waitForProfileOrHome({...readiness, allowProfile: false});
      }
    },
    async openSearch() {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(1_000);
        const menuItemId = await findSearchMenuItemId(execute);
        if (!menuItemId) {
          await page.keyboard.press("Backspace");
          await page.waitForTimeout(1_500);
          continue;
        }
        await navigation.remoteFocusById(page, menuItemId, 80);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2_000);
        if (await execute(isVisibleElementScript("callSearch"))) return;
      }
      throw new Error("Unable to open the MyTV search screen with real remote keys.");
    },
    async enterSearch(name) {
      await navigation.enterWithVirtualKeyboard(page, navigation.searchKeyboardInput(name));
      await navigation.remoteFocusById(page, "callSearch", 80);
      await page.keyboard.press("Enter");
    },
    readSearchCandidates: () => readSearchCandidates(execute),
    async focusResult(id) {
      await navigation.remoteFocusById(page, id, 180);
      if (!(await isFocusedWithin(execute, id))) {
        throw new Error(`Search result ${id} did not receive remote focus.`);
      }
    },
    activateFocusedResult: () => page.keyboard.press("Enter"),
    exitPlayer: () => page.keyboard.press("Backspace"),
    async activatePlayNow() {
      const playNowVisible = await execute(`return (() => {
        const element = Array.from(document.querySelectorAll('body *')).find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = getComputedStyle(candidate);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && /^Xem ngay$/i.test((candidate.textContent || '').replace(/\\s+/g, ' ').trim());
        });
        return Boolean(element);
      })();`);
      if (!playNowVisible) return false;
      await navigation.remoteFocusByText(page, /^Xem ngay$/i, 60);
      await page.keyboard.press("Enter");
      return true;
    },
    readPlayerState: () => readPlayerState(execute),
    readPopupText: () => readVisiblePlaybackPopup(execute),
  };
}

function parseSemanticRequest(args) {
  const hasName = Object.prototype.hasOwnProperty.call(args, "search-name");
  const hasType = Object.prototype.hasOwnProperty.call(args, "content-type");

  if (!hasName && !hasType) return null;
  if (!hasName || !hasType) {
    throw new Error("--search-name and --content-type must be supplied together.");
  }

  const name = String(args["search-name"] || "").trim();
  const type = String(args["content-type"] || "").trim();
  if (!name) throw new Error("--search-name must not be empty.");
  if (!CONTENT_TYPES.has(type)) {
    throw new Error("--content-type must be channel, movie, or content.");
  }
  if (!args["login-from-env"] || !args["verify-logout"]) {
    throw new Error("Semantic POC requires --login-from-env and --verify-logout.");
  }
  if (!args["skip-screenshot-gate"]) {
    throw new Error("Semantic POC requires --skip-screenshot-gate because it records DOM-only evidence.");
  }

  return {name, type};
}

module.exports = {
  parseSemanticRequest,
  assessPlayback,
  createSemanticDriver,
  leavePlayerAfterAssessment,
  selectBestSearchResult,
  runSemanticSearchPlayback,
  waitForProfileOrHome,
};
