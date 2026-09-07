const navigation = require("./navigation");
const selectorValidation = require("./selector-validation");
const playback = require("./playback");

// An album poster (`.item_album`, `keyword="album"`, `album_id=...`) does not
// open a player.  It opens `#albumDetail`, whose left column holds the album's
// own buttons ("Xem toàn bộ", "Xem ở chế độ lặp lại", "Lưu vào danh sách") and
// whose right column lists the album's contents as `album_card_<row>_<col>`
// cards carrying `action="play_album_content"`.  Nothing is playing while that
// screen is up, so a play action has to pick one of those cards and activate it
// before any player check can mean anything.
const ALBUM_DETAIL_ROUTE = playback.ALBUM_DETAIL_ROUTE;
const ALBUM_SELECTORS = Object.freeze({
  root: "#album_detail",
  leftSide: "#album_detail_leftside",
  rightSide: "#album_detail_rightside",
  button: ".album_detail_button",
  card: ".album_detail_elements",
  cardTitle: ".card_title",
  lockIcon: ".item_lock_icon",
});
// The card id encodes the album's data position, not the DOM order.
const ALBUM_CARD_ID_PATTERN = "^album_card_(\\d+)_(\\d+)$";
const ALBUM_CARD_ACTION = "play_album_content";
// The right-hand list is virtualized: roughly a dozen cards live in the DOM at
// a time and the rest are built while focus walks toward them.  The album's
// real size therefore comes from its own "Tổng số phim, VOD : N" counter and
// traversal steps with the remote instead of collecting every card up front.
const ALBUM_TOTAL_PATTERN = "tổng\\s*số\\s*(?:phim|vod)(?:\\s*,\\s*vod)?\\s*:\\s*(\\d+)";
// Focus lands on the left button column when the screen opens, so entering the
// list is one Right press; the extra presses only cover a dropped key.
const ENTER_LIST_MAX_PRESSES = 3;
const ENTER_LIST_DELAY_MS = 1200;
const STEP_DELAY_MS = 900;
// A vertical step can be dropped while the list is building the next batch of
// cards, so a step that did not move is retried before the list is called
// exhausted.
const STEP_MAX_ATTEMPTS = 3;
// Walking the whole list is bounded so a card that never reports the expected
// row cannot spin forever.
const MAX_STEPS = 400;
const ACTIVATION_DELAY_MS = 4000;
// The route flips to #albumDetail before the screen has built its counter and
// its first cards, so the album is waited for rather than read once.
const READY_TIMEOUT_MS = 15000;
const READY_POLL_MS = 250;
const PLAYER_OPEN_TIMEOUT_MS = 30000;
const PLAYER_OPEN_POLL_MS = 250;

const dependencies = {
  remotePress: navigation.remotePress,
  getFocusedState: selectorValidation.getFocusedState,
  activateVerifiedTarget: selectorValidation.activateVerifiedTarget,
  getPlayerState: playback.getPlayerState,
};

function configureAlbumDetail(next = {}) {
  Object.assign(dependencies, next);
  return module.exports;
}

function remotePress(...args) {
  return dependencies.remotePress(...args);
}

function routeOf(page) {
  return page.evaluate(() => location.hash.replace(/^#/, "").split("?")[0]);
}

function isAlbumDetailRoute(routeValue) {
  return String(routeValue || "").trim() === ALBUM_DETAIL_ROUTE;
}

// Album detail is a way-station between a player and the screen the poster was
// activated from, never a valid return boundary.  `playback` owns the route
// classification, so its check is re-exported rather than reimplemented here.
const isAlbumDetailScreen = playback.isAlbumDetailScreen;

async function observeAlbumDetailScreen(page) {
  const observation = await page.evaluate(({selectors, cardIdPattern, cardAction, totalPattern}) => {
    const cardIdRegExp = new RegExp(cardIdPattern, "u");
    const routeValue = location.hash.replace(/^#/, "").split("?")[0];
    const cards = Array.from(document.querySelectorAll(selectors.card))
      .map(describeCard)
      .filter((card) => card !== null)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    const totalMatch = compactText(document.body?.innerText || "")
      .match(new RegExp(totalPattern, "iu"));

    return {
      routeValue,
      rootVisible: isVisible(document.querySelector(selectors.root)),
      albumTitle: albumTitle(),
      declaredTotal: totalMatch ? Number(totalMatch[1]) : 0,
      cards,
      focused: describeFocus(),
    };

    // The album's name is the first text line of the left column, above the
    // "Tổng số phim, VOD : N" counter and the button stack. The app ships no
    // dedicated id or class for it.
    function albumTitle() {
      const lines = String(document.querySelector(selectors.leftSide)?.innerText || "")
        .split(/\n+/u)
        .map((line) => compactText(line))
        .filter(Boolean);
      return lines[0] || "";
    }

    function describeCard(element) {
      const match = cardIdRegExp.exec(element.id || "");
      if (!match) return null;

      const rect = element.getBoundingClientRect();
      return {
        id: element.id,
        row: Number(match[1]),
        col: Number(match[2]),
        title: compactText(element.querySelector(selectors.cardTitle)?.innerText || ""),
        contentId: String(element.getAttribute("content-id") || "").trim(),
        typeId: String(element.getAttribute("type-id") || "").trim(),
        action: String(element.getAttribute("action") || "").trim(),
        locked: isVisible(element.querySelector(selectors.lockIcon)),
        visible: isVisible(element),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    }

    function describeFocus() {
      const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
      if (!focused) return {kind: "none", id: "", row: null, col: null, title: ""};

      const card = focused.matches(selectors.card) ? focused : focused.closest(selectors.card);
      if (card) {
        const described = describeCard(card);
        if (described) return {kind: "card", ...described};
      }

      const button = focused.matches(selectors.button) ? focused : focused.closest(selectors.button);
      return {
        kind: button ? "button" : "other",
        id: focused.id || "",
        row: null,
        col: null,
        title: compactText(focused.innerText || ""),
      };
    }

    function compactText(value) {
      return String(value || "").replace(/\s+/gu, " ").trim();
    }

    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }
  }, {
    selectors: ALBUM_SELECTORS,
    cardIdPattern: ALBUM_CARD_ID_PATTERN,
    cardAction: ALBUM_CARD_ACTION,
    totalPattern: ALBUM_TOTAL_PATTERN,
  });

  const playableCards = observation.cards.filter(
    (card) => !card.action || card.action === ALBUM_CARD_ACTION
  );
  // The declared counter is the album's real size; the DOM window only holds
  // the cards built so far, so it is a floor rather than the total.
  const contentCount = Math.max(
    Number(observation.declaredTotal || 0),
    playableCards.reduce((highest, card) => Math.max(highest, card.row + 1), 0)
  );

  return {
    ...observation,
    isAlbumDetail: isAlbumDetailRoute(observation.routeValue),
    cards: playableCards,
    contentCount,
  };
}

// A random pick over the album's real size, not over the virtualized DOM
// window, so the tail of a long album is reachable.  Cards known to be locked
// are avoided when they happen to be built already; a locked card that only
// shows up after focus reaches it is stepped over by
// `focusPlayableAlbumContent`.
function pickAlbumContentRow(observation, {random = Math.random, exclude = []} = {}) {
  const count = Number(observation?.contentCount || 0);
  if (!(count > 0)) return null;

  const excluded = new Set(exclude.map(Number));
  for (const card of observation?.cards || []) {
    if (card.locked) excluded.add(card.row);
  }

  const candidates = [];
  for (let row = 0; row < count; row += 1) {
    if (!excluded.has(row)) candidates.push(row);
  }
  if (!candidates.length) return null;

  const index = Math.floor(random() * candidates.length);
  return candidates[Math.min(Math.max(index, 0), candidates.length - 1)];
}

async function enterAlbumContentList(page) {
  let observation = await observeAlbumDetailScreen(page);
  for (let attempt = 0; attempt < ENTER_LIST_MAX_PRESSES && observation.focused.kind !== "card"; attempt += 1) {
    await remotePress(page, "ArrowRight", ENTER_LIST_DELAY_MS);
    observation = await observeAlbumDetailScreen(page);
  }

  if (observation.focused.kind !== "card") {
    const error = new Error(
      "Không focus được danh sách nội dung của album " +
      `(focus hiện tại: ${JSON.stringify(observation.focused)})`
    );
    error.code = "ALBUM_LIST_UNREACHABLE";
    error.details = observation;
    throw error;
  }

  return observation;
}

async function focusAlbumContentRow(page, targetRow) {
  let observation = await enterAlbumContentList(page);

  for (let step = 0; step < MAX_STEPS && observation.focused.row !== targetRow; step += 1) {
    const key = observation.focused.row < targetRow ? "ArrowDown" : "ArrowUp";
    const previousRow = observation.focused.row;
    let moved = false;

    for (let attempt = 0; attempt < STEP_MAX_ATTEMPTS && !moved; attempt += 1) {
      await remotePress(page, key, STEP_DELAY_MS);
      observation = await observeAlbumDetailScreen(page);
      moved = observation.focused.kind === "card" && observation.focused.row !== previousRow;
    }

    if (!moved) {
      const error = new Error(
        `Không di chuyển được tới nội dung thứ ${targetRow + 1} trong album ` +
        `(dừng ở nội dung thứ ${Number(previousRow) + 1})`
      );
      error.code = "ALBUM_CONTENT_UNREACHABLE";
      error.details = {targetRow, observation};
      throw error;
    }
  }

  if (observation.focused.row !== targetRow) {
    const error = new Error(
      `Không focus được nội dung thứ ${targetRow + 1} trong album sau ${MAX_STEPS} bước`
    );
    error.code = "ALBUM_CONTENT_UNREACHABLE";
    error.details = {targetRow, observation};
    throw error;
  }

  return observation;
}

// A locked card cannot play, so focus steps forward to the next playable one
// rather than reporting a playback failure the album is expected to produce.
async function focusPlayableAlbumContent(page, targetRow) {
  const attemptedRows = [];
  let observation = await focusAlbumContentRow(page, targetRow);
  let row = targetRow;

  while (observation.focused.locked === true) {
    attemptedRows.push(row);
    const next = pickAlbumContentRow(observation, {exclude: attemptedRows, random: () => 0});
    if (next === null) {
      const error = new Error("Album không có nội dung nào có thể phát (tất cả đều bị khoá)");
      error.code = "ALBUM_CONTENT_LOCKED";
      error.details = {attemptedRows, observation};
      throw error;
    }

    row = next;
    observation = await focusAlbumContentRow(page, row);
  }

  return observation;
}

async function waitForAlbumContentPlayer(page, {timeoutMs = PLAYER_OPEN_TIMEOUT_MS} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastRoute = "";
  let lastPlayerState = null;

  for (;;) {
    lastRoute = await routeOf(page).catch(() => lastRoute);
    if (!isAlbumDetailRoute(lastRoute)) {
      lastPlayerState = await dependencies.getPlayerState(page).catch(() => null);
      if (lastPlayerState?.hasVideo === true) {
        return {routeValue: lastRoute, playerState: lastPlayerState};
      }
    }

    if (Date.now() >= deadline) {
      const error = new Error(
        "Nội dung trong album không mở được player sau " +
        `${Math.round(timeoutMs / 1000)}s (route: "${lastRoute}"; ` +
        `lỗi: ${lastPlayerState?.reason || "không có video"})`
      );
      error.code = "ALBUM_PLAYER_NOT_OPEN";
      error.details = {routeValue: lastRoute, playerState: lastPlayerState};
      throw error;
    }

    await page.waitForTimeout(PLAYER_OPEN_POLL_MS);
  }
}

// The screen's own content counter and first cards arrive after the route flips,
// so an album that is still building is waited for; only a screen that never
// reports a content is treated as empty.
async function waitForAlbumDetailReady(page, {timeoutMs = READY_TIMEOUT_MS} = {}) {
  const deadline = Date.now() + timeoutMs;
  let observed = await observeAlbumDetailScreen(page);

  while (observed.isAlbumDetail && !(observed.contentCount > 0) && Date.now() < deadline) {
    await page.waitForTimeout(READY_POLL_MS);
    observed = await observeAlbumDetailScreen(page);
  }

  if (!observed.isAlbumDetail) {
    const error = new Error(
      `Không phải trang chi tiết album (route hiện tại: "${observed.routeValue}")`
    );
    error.code = "NOT_ALBUM_DETAIL";
    error.details = observed;
    throw error;
  }
  if (!(observed.contentCount > 0)) {
    const error = new Error("Album không có nội dung nào để phát");
    error.code = "ALBUM_EMPTY";
    error.details = observed;
    throw error;
  }

  return observed;
}

// Opens one of the album's contents so the caller's ordinary player check has a
// player to look at.  `contentIndex` forces a specific card (0-based, in the
// album's own order); by default a random one is chosen.
async function playRandomAlbumContent(page, testInfo, options = {}) {
  const opened = await waitForAlbumDetailReady(page, {
    timeoutMs: Number(options.readyTimeoutMs) > 0
      ? Number(options.readyTimeoutMs)
      : READY_TIMEOUT_MS,
  });

  const requestedRow = Number.isInteger(options.contentIndex)
    ? options.contentIndex
    : pickAlbumContentRow(opened, {random: options.random});
  if (requestedRow === null || !(requestedRow >= 0) || requestedRow >= opened.contentCount) {
    const error = new Error(
      `Chỉ số nội dung album không hợp lệ: ${options.contentIndex} ` +
      `(album có ${opened.contentCount} nội dung)`
    );
    error.code = "ALBUM_CONTENT_INDEX_INVALID";
    error.details = opened;
    throw error;
  }

  const focused = await focusPlayableAlbumContent(page, requestedRow);
  const card = focused.focused;

  if (testInfo?.attach) {
    await testInfo.attach("album-detail-selection.json", {
      body: JSON.stringify({
        albumRoute: opened.routeValue,
        albumTitle: opened.albumTitle,
        contentCount: opened.contentCount,
        requestedIndex: requestedRow,
        selected: card,
      }, null, 2),
      contentType: "application/json",
    });
  }

  await dependencies.activateVerifiedTarget(page, {
    testInfo,
    name: `album-content-${card.id}`,
    contractName: "contentItem",
    expectedId: card.id,
    expectedLabel: card.title,
    delay: ACTIVATION_DELAY_MS,
  });

  const player = await waitForAlbumContentPlayer(page, {
    timeoutMs: Number(options.playerTimeoutMs) > 0
      ? Number(options.playerTimeoutMs)
      : PLAYER_OPEN_TIMEOUT_MS,
  });

  return {
    type: "album_content",
    albumRoute: opened.routeValue,
    albumTitle: opened.albumTitle,
    contentCount: opened.contentCount,
    requestedIndex: requestedRow,
    contentIndex: card.row,
    cardId: card.id,
    contentId: card.contentId,
    name: card.title,
    playerRoute: player.routeValue,
  };
}

module.exports = {
  ALBUM_DETAIL_ROUTE,
  ALBUM_SELECTORS,
  ALBUM_CARD_ID_PATTERN,
  ALBUM_CARD_ACTION,
  configureAlbumDetail,
  isAlbumDetailRoute,
  isAlbumDetailScreen,
  observeAlbumDetailScreen,
  pickAlbumContentRow,
  focusAlbumContentRow,
  focusPlayableAlbumContent,
  waitForAlbumDetailReady,
  waitForAlbumContentPlayer,
  playRandomAlbumContent,
};
