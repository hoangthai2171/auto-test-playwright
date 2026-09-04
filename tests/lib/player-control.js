const navigation = require("./navigation");

// The VOD player exposes three screen states and each one answers the remote
// differently (see README "Player control"):
//   detail      -> #movie_leftmenu_wr is on screen, playback runs behind it
//   control_bar -> #new_player_controlbar is shown, focus is inside the bar
//   player      -> only the video is on screen and nothing is focused
// The app keeps the detail container mounted and slides it out to x=-1280, and
// it keeps `focused` on #player-button-play while the bar is hidden, so every
// state check below is geometry based instead of class based.
const PLAYER_SELECTORS = Object.freeze({
  detail: "#movie_leftmenu_wr",
  playerRoot: "#media_player_new",
  controlBar: "#new_player_controlbar",
  playPauseButton: "#player-button-play",
  timeshiftBar: "#new-player-timeshift-bar",
  timeshiftProgress: "#player-bar-timeshift",
  timeshiftActive: "#player_bar_active",
  relatedItem: "[id^='relativeContentPopup']",
  episodeItem: "[id^='moviePartitions'].movie-partition-poster",
  episodeRow: "[id^='moviePartitions'].movie-partition-row",
  episodeButton: "#player-button-partition",
  titleBar: "#hide-when-timeshift",
  currentTime: "#media_player_current",
  remainingTime: "#media_player_duration",
  promoVideo: "#promo-video-next",
});

const PLAYER_STATES = Object.freeze(["closed", "detail", "control_bar", "player"]);
const FOCUS_SCOPES = Object.freeze(["none", "detail", "play_pause", "timeshift", "related", "episode", "control_button", "other"]);
const SEEK_DIRECTIONS = Object.freeze({forward: "ArrowRight", backward: "ArrowLeft"});
const DEFAULT_SEEK_DIRECTION = "forward";
const DEFAULT_SEEK_STEPS = 1;
const MAX_SEEK_STEPS = 60;
const SEEK_PRESS_DELAY_MS = 700;
const SEEK_OPEN_TIMEOUT_MS = 8000;
const SEEK_TARGET_TIMEOUT_MS = 8000;
const SEEK_TARGET_TOLERANCE_SECONDS = 1;
const PLAYER_OPEN_TIMEOUT_MS = 30000;
const PLAYER_STATE_SETTLE_MS = 1500;
const DETAIL_SETTLE_TIMEOUT_MS = 12000;
const ENTER_PLAYER_DELAY_MS = 1500;
const ENTER_PLAYER_TIMEOUT_MS = 30000;
const ENTER_PLAYER_SETTLE_MS = 2000;
const SEEK_OPEN_ATTEMPTS = 3;
const OK_PRESS_DELAY_MS = 1500;
const PLAYBACK_RESUME_TIMEOUT_MS = 20000;
const STATE_POLL_INTERVAL_MS = 250;
const STATE_TIMEOUT_MS = 15000;
const MAX_FOCUS_ALIGN_PRESSES = 4;
const MAX_RELATED_OPEN_PRESSES = 4;
const MAX_RELATED_MOVE_PRESSES = 40;
const RELATED_PRESS_DELAY_MS = 700;
const RELATED_STEP_TIMEOUT_MS = 2500;
const MAX_RELATED_ITEM_INDEX = 60;
const MAX_EPISODE_NUMBER = 2000;
const MAX_EPISODE_STEPS = 400;
const MAX_CONTROL_BUTTON_STEPS = 8;
const EPISODE_PRESS_DELAY_MS = 600;
const EPISODE_PANEL_TIMEOUT_MS = 10000;

function normalizeSeekDirection(value) {
  const direction = String(value ?? DEFAULT_SEEK_DIRECTION).trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SEEK_DIRECTIONS, direction)) {
    throw new Error(`Unsupported player seek direction: ${value}`);
  }
  return direction;
}

function normalizeRelatedItemIndex(value) {
  if (value === undefined || value === null || value === "") return 1;
  const itemIndex = Number(value);
  if (!Number.isSafeInteger(itemIndex) || itemIndex < 1 || itemIndex > MAX_RELATED_ITEM_INDEX) {
    throw new Error(`Related item index must be an integer between 1 and ${MAX_RELATED_ITEM_INDEX}: ${value}`);
  }
  return itemIndex;
}

function normalizeEpisodeNumber(value) {
  const episode = Number(value);
  if (!Number.isSafeInteger(episode) || episode < 1 || episode > MAX_EPISODE_NUMBER) {
    throw new Error(`Episode must be an integer between 1 and ${MAX_EPISODE_NUMBER}: ${value}`);
  }
  return episode;
}

function normalizeSeekSteps(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_SEEK_STEPS;
  const steps = Number(value);
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > MAX_SEEK_STEPS) {
    throw new Error(`Player seek steps must be an integer between 1 and ${MAX_SEEK_STEPS}: ${value}`);
  }
  return steps;
}

async function observePlayerControlState(page) {
  return page.evaluate((selectors) => {
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;

    function isOnScreen(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect?.();
      if (!rect) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      return rect.width > 0 && rect.height > 0 &&
        rect.right > 0 && rect.bottom > 0 &&
        rect.left < viewportWidth && rect.top < viewportHeight;
    }

    function describe(element) {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        id: element.id || "",
        className: typeof element.className === "string" ? element.className : "",
        text: (element.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 160),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    }

    function parseTimeLabel(text) {
      const match = String(text || "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/u);
      if (!match) return null;
      const [, first, second, third] = match;
      return third === undefined
        ? Number(first) * 60 + Number(second)
        : Number(first) * 3600 + Number(second) * 60 + Number(third);
    }

    // The app mounts more than one player instance (the detail-embedded one and
    // the standalone one) under the same ids, so every lookup must prefer the
    // instance that is actually on screen.
    function pick(selector) {
      const nodes = Array.from(document.querySelectorAll(selector));
      return nodes.find(isOnScreen) || nodes[0] || null;
    }

    const detail = pick(selectors.detail);
    const controlBar = pick(selectors.controlBar);
    const playPauseButton = pick(selectors.playPauseButton);
    const timeshiftBar = pick(selectors.timeshiftBar);
    const promoVisible = isOnScreen(pick(selectors.promoVideo));

    // Only a full-screen video is the VOD player. Home trailers and promo
    // videos also mount <video>, and treating those as a player would make
    // every Home step look like a playback step. Among the full-screen
    // instances the playing one is the current player.
    const fullScreenVideos = Array.from(document.querySelectorAll("video")).filter((candidate) => {
      if (promoVisible || !isOnScreen(candidate)) return false;
      const rect = candidate.getBoundingClientRect();
      return rect.width >= viewportWidth * 0.75 && rect.height >= viewportHeight * 0.5;
    });
    const videoElement = fullScreenVideos.find((candidate) => !candidate.paused && candidate.readyState >= 2) ||
      fullScreenVideos
        .slice()
        .sort((a, b) => (b.readyState - a.readyState) || (b.currentTime - a.currentTime))[0] ||
      null;

    const detailOnScreen = isOnScreen(detail);
    const controlBarVisible = isOnScreen(controlBar) || isOnScreen(playPauseButton);
    const timeshiftVisible = isOnScreen(timeshiftBar);

    // `.focused` is the app's real focus marker and must win. #player_bar_active
    // carries `active` whenever the control bar is shown - it is the progress
    // fill, not the focus - so it only counts when nothing else is focused,
    // which is exactly the seeking state.
    const focusedElement = [
      `${selectors.playerRoot} .focused`,
      `${selectors.detail} .focused`,
      `${selectors.relatedItem}.focused`,
      ".focused",
      `${selectors.detail} .active`,
      `${selectors.timeshiftActive}.active`,
      `${selectors.timeshiftBar} .active`,
      "[is_focus='1']",
    ].flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .find(isOnScreen) || null;

    // closest() answers by ancestry instead of by node identity, so duplicate
    // player instances cannot misfile the focus.
    let focusScope = "none";
    if (focusedElement) {
      if (focusedElement.closest(selectors.episodeItem)) {
        focusScope = "episode";
      } else if (focusedElement.closest(selectors.relatedItem)) {
        focusScope = "related";
      } else if (focusedElement.closest(`${selectors.timeshiftBar}, ${selectors.timeshiftProgress}, ${selectors.timeshiftActive}`)) {
        focusScope = "timeshift";
      } else if (focusedElement.closest(selectors.playPauseButton)) {
        focusScope = "play_pause";
      } else if (detailOnScreen && focusedElement.closest(selectors.detail)) {
        focusScope = "detail";
      } else if (focusedElement.closest(`${selectors.controlBar}, ${selectors.playerRoot}`)) {
        focusScope = "control_button";
      } else {
        focusScope = "other";
      }
    }

    const state = detailOnScreen
      ? "detail"
      : controlBarVisible
        ? "control_bar"
        : videoElement
          ? "player"
          : "closed";

    // The episode picker marks every poster with the episode it opens, so the
    // episode number never has to be counted from a position.
    const episodeElement = focusedElement?.closest(selectors.episodeItem) || null;
    const episodeNumber = episodeElement
      ? Number(episodeElement.getAttribute("partition") || episodeElement.getAttribute("keyword") || "") || null
      : null;
    const episodeRow = episodeElement?.id
      ? document.getElementById(episodeElement.id.replace(/_\d+$/u, ""))
      : null;
    const episodePanelOpen = Array.from(document.querySelectorAll(selectors.episodeItem)).some(isOnScreen);
    const titleText = (pick(selectors.titleBar)?.textContent || "").replace(/\s+/gu, " ").trim();
    const playingEpisode = Number(titleText.match(/t[aâăậ]p\s*(\d+)/iu)?.[1] || "") || null;

    const currentLabel = describe(pick(selectors.currentTime))?.text || "";
    const remainingLabel = describe(pick(selectors.remainingTime))?.text || "";

    // The seek bar draws a strip of thumbnail times and the middle one is the
    // pending seek target. It is the only position readout the app keeps in
    // sync while seeking, so it drives seek verification.
    // Each thumbnail holds its time as a direct text node next to the preview
    // image, so read own text instead of descendant text.
    const timeshiftLabels = timeshiftVisible
      ? Array.from(timeshiftBar.querySelectorAll("*"))
        .map((node) => Array.from(node.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent || "")
          .join(" ")
          .replace(/\s+/gu, " ")
          .trim())
        .filter((text) => /^\d{1,2}:\d{2}(?::\d{2})?$/u.test(text))
      : [];
    const targetSeconds = timeshiftLabels.length
      ? parseTimeLabel(timeshiftLabels[Math.floor(timeshiftLabels.length / 2)])
      : parseTimeLabel(currentLabel);

    return {
      state,
      route: location.hash.replace(/^#/u, "").split("?")[0],
      detailOnScreen,
      controlBarVisible,
      timeshiftVisible,
      focus: {
        scope: focusScope,
        ...(describe(focusedElement) || {id: "", className: "", text: "", rect: {x: 0, y: 0, width: 0, height: 0}}),
      },
      playPauseRect: describe(playPauseButton)?.rect || null,
      episodes: {
        panelOpen: episodePanelOpen,
        focusedEpisode: episodeNumber,
        focusedLabel: (episodeRow?.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 80),
        playingEpisode,
      },
      position: {
        currentLabel,
        currentSeconds: parseTimeLabel(currentLabel),
        remainingLabel,
        remainingSeconds: parseTimeLabel(remainingLabel),
        timeshiftLabels,
        targetSeconds,
      },
      video: videoElement
        ? {
          hasVideo: true,
          currentTime: Number(videoElement.currentTime.toFixed(2)),
          duration: Number.isFinite(videoElement.duration) ? Number(videoElement.duration.toFixed(2)) : null,
          paused: videoElement.paused,
          ended: videoElement.ended,
          readyState: videoElement.readyState,
          // Playing a related item swaps the content in place and leaves the
          // route untouched, so the media source is the only content identity.
          source: (videoElement.currentSrc || videoElement.src || "").slice(-64),
        }
        : {hasVideo: false, currentTime: 0, duration: null, paused: true, ended: false, readyState: 0, source: ""},
      detailText: detailOnScreen ? describe(detail)?.text || "" : "",
      timeshiftText: timeshiftVisible ? describe(timeshiftBar)?.text || "" : "",
    };
  }, PLAYER_SELECTORS);
}

async function waitForPlayerControlState(page, predicate, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? STATE_TIMEOUT_MS);
  const pollIntervalMs = Number(options.pollIntervalMs ?? STATE_POLL_INTERVAL_MS);
  const startedAt = Date.now();
  let state = await observePlayerControlState(page);

  while (!(await Promise.resolve(predicate(state)))) {
    if (Date.now() - startedAt >= timeoutMs) {
      const error = new Error(
        `${options.reason || "Player control state"} was not reached within ${timeoutMs}ms: ${describeState(state)}`
      );
      error.details = {playerControlState: state};
      throw error;
    }
    await page.waitForTimeout(pollIntervalMs);
    state = await observePlayerControlState(page);
  }

  return state;
}

function describeState(state) {
  return JSON.stringify({
    state: state?.state,
    focus: state?.focus?.scope,
    timeshiftVisible: state?.timeshiftVisible,
    position: state?.position?.currentLabel,
    target: state?.position?.targetSeconds,
    video: state?.video,
  });
}

// Left/Right acts on the seek bar from the play/pause button, from the seek bar
// itself, and from the bare player screen. The control bar always opens with
// play/pause focused, so a shown bar without a readable focus marker counts too.
function isSeekReadyFocus(state) {
  if (state.focus.scope === "play_pause" || state.focus.scope === "timeshift") return true;
  return state.focus.scope === "none" && (state.state === "player" || state.state === "control_bar");
}

// A player that is mounted is not yet a player that answers the remote: right
// after OK the app shows a full-screen video that is still paused at 0 and only
// then slides the detail panel in. Keys delivered in that gap are lost.
function isRemoteReadyPlayer(state) {
  if (state?.state === "detail") return true;
  if (!state || state.state === "closed") return false;
  return state.video.hasVideo === true && (state.video.paused === false || state.video.currentTime > 0);
}

function isPlayingState(state) {
  return state?.video?.hasVideo === true && state.video.paused === false && state.video.ended === false;
}

// The detail menu plays the content behind its panel; OK on the focused button
// ("Xem tập 1" / "Xem từ đầu") is what moves the app into the player itself.
async function enterPlayerFromDetail(page, options = {}) {
  const remotePress = options.remotePress || navigation.remotePress;
  let before = options.state || (await observePlayerControlState(page));
  if (before.state !== "detail") return before;

  // The detail panel renders before its background playback starts, and an OK
  // delivered during that gap is dropped. Give playback a chance to start;
  // content that never plays behind the panel still fails on the check below.
  before = await waitForPlayerControlState(
    page,
    (state) => state.state !== "detail" || state.video.paused === false,
    {timeoutMs: options.detailSettleTimeoutMs ?? DETAIL_SETTLE_TIMEOUT_MS}
  ).catch(() => before);
  if (before.state !== "detail") return before;

  await remotePress(page, "Enter", options.pressDelayMs ?? ENTER_PLAYER_DELAY_MS);

  try {
    const entered = await waitForPlayerControlState(
      page,
      (state) => state.detailOnScreen === false && state.video.hasVideo === true,
      {
        timeoutMs: options.timeoutMs ?? ENTER_PLAYER_TIMEOUT_MS,
        reason: "Player screen after OK on the detail menu",
      }
    );
    // The player keeps finishing its transition after the detail panel leaves
    // and drops remote keys until it settles.
    await page.waitForTimeout(options.settleMs ?? ENTER_PLAYER_SETTLE_MS);
    return entered;
  } catch (error) {
    error.message = `${error.message} (focused detail button: "${before.focus.text || before.focus.id || "unknown"}")`;
    throw error;
  }
}

// Left/Right only reaches the seek bar from the play/pause button or from the
// bare player screen. When focus sits on the control-bar button row or on the
// related-content row, walk back to play/pause first.
async function focusPlayPauseButton(page, options = {}) {
  const remotePress = options.remotePress || navigation.remotePress;
  let state = options.state || (await observePlayerControlState(page));

  if (state.state === "detail") {
    const error = new Error(`The detail menu owns the focus; enter the player first: ${describeState(state)}`);
    error.details = {playerControlState: state};
    throw error;
  }

  for (let attempt = 0; attempt < MAX_FOCUS_ALIGN_PRESSES; attempt += 1) {
    if (isSeekReadyFocus(state)) return state;

    // Up is the documented way back from the related-content row; the control
    // bar is hidden while that row is open, so its geometry says nothing.
    if (state.focus.scope === "related") {
      await remotePress(page, "ArrowUp", options.pressDelayMs ?? SEEK_PRESS_DELAY_MS);
      state = await observePlayerControlState(page);
      continue;
    }

    const playPauseY = state.playPauseRect?.y;
    if (typeof playPauseY !== "number") break;
    const key = state.focus.rect.y < playPauseY ? "ArrowDown" : "ArrowUp";
    await remotePress(page, key, options.pressDelayMs ?? SEEK_PRESS_DELAY_MS);
    state = await observePlayerControlState(page);
  }

  if (isSeekReadyFocus(state)) return state;

  const error = new Error(`Could not focus the player play/pause button: ${describeState(state)}`);
  error.details = {playerControlState: state};
  throw error;
}

// Readiness only: the player answers the remote and the detail menu no longer
// owns the screen. Callers that need a specific focus align it themselves.
async function ensureRemoteReadyPlayer(page, options = {}) {
  let state = options.state || (await observePlayerControlState(page));

  // The OK press that opened the content belongs to the previous step, so the
  // player screen is usually still on its way in when this action starts.
  if (!isRemoteReadyPlayer(state)) {
    state = await waitForPlayerControlState(page, isRemoteReadyPlayer, {
      timeoutMs: options.openTimeoutMs ?? PLAYER_OPEN_TIMEOUT_MS,
      reason: "An open VOD player",
    });
    // Playback can start a moment before the detail panel finishes sliding in;
    // let it land so the state that owns the focus is the one we act on.
    await page.waitForTimeout(options.stateSettleMs ?? PLAYER_STATE_SETTLE_MS);
    state = await observePlayerControlState(page);
  }

  if (state.state === "detail") {
    state = await enterPlayerFromDetail(page, {...options, state});
  }

  return state;
}

async function preparePlayerForRemoteControl(page, options = {}) {
  const state = await ensureRemoteReadyPlayer(page, options);
  return focusPlayPauseButton(page, {...options, state});
}

function relatedItemPosition(state) {
  // Items are ids of the shape relativeContentPopup<n>_<row>_<col>.
  const match = String(state?.focus?.id || "").match(/^(relativeContentPopup\d*)_(\d+)_(\d+)$/u);
  if (!match) return null;
  return {rowId: `${match[1]}_${match[2]}`, row: Number(match[2]), column: Number(match[3])};
}

// Down from the player opens the control bar, and Down again shows the related
// content row and moves focus into it. The app pauses playback while that row
// is open, and OK on a poster starts that content instead.
async function focusPlayerRelatedContent(page, options = {}) {
  const itemIndex = normalizeRelatedItemIndex(options.itemIndex);
  const remotePress = options.remotePress || navigation.remotePress;
  const pressDelayMs = Number(options.pressDelayMs ?? RELATED_PRESS_DELAY_MS);
  // Focus that already sits in the related row stays there; only readiness is
  // required here.
  let state = await ensureRemoteReadyPlayer(page, {...options, state: options.state});

  // Down opens the control bar first and only the next Down reaches the related
  // row. The bar auto-hides after a few idle seconds, so each press waits just
  // until something opened - never for the row itself - and the next Down lands
  // while the bar is still up.
  for (let attempt = 0; state.focus.scope !== "related" && attempt < MAX_RELATED_OPEN_PRESSES; attempt += 1) {
    await remotePress(page, "ArrowDown", pressDelayMs);
    state = await waitForPlayerControlState(
      page,
      (candidate) => candidate.focus.scope === "related" ||
        candidate.focus.scope === "play_pause" ||
        candidate.controlBarVisible === true,
      {
        timeoutMs: options.openTimeoutMs ?? RELATED_STEP_TIMEOUT_MS,
        pollIntervalMs: options.pollIntervalMs,
      }
    ).catch((error) => error?.details?.playerControlState || observePlayerControlState(page));
  }

  if (state.focus.scope !== "related") {
    const error = new Error(`The player did not open its related-content row: ${describeState(state)}`);
    error.details = {playerControlState: state};
    throw error;
  }

  let position = relatedItemPosition(state);
  if (!position) {
    const error = new Error(`Could not read the related-content position from "${state.focus.id}"`);
    error.details = {playerControlState: state};
    throw error;
  }

  const targetColumn = itemIndex - 1;
  for (let move = 0; position.column !== targetColumn && move < MAX_RELATED_MOVE_PRESSES; move += 1) {
    const key = position.column < targetColumn ? "ArrowRight" : "ArrowLeft";
    await remotePress(page, key, pressDelayMs);
    const moved = await observePlayerControlState(page);
    const movedPosition = relatedItemPosition(moved);
    if (!movedPosition || movedPosition.column === position.column) {
      const error = new Error(
        `The related-content row ended before item ${itemIndex}: ${describeState(moved)}`
      );
      error.details = {playerControlState: moved};
      throw error;
    }
    state = moved;
    position = movedPosition;
  }

  if (position.column !== targetColumn) {
    const error = new Error(`Could not focus related-content item ${itemIndex}: ${describeState(state)}`);
    error.details = {playerControlState: state};
    throw error;
  }

  return {
    type: "player_focus_related",
    itemIndex,
    id: state.focus.id,
    rowId: position.rowId,
    column: position.column,
    label: state.focus.text,
    playbackPaused: state.video.paused === true,
  };
}

// The control bar's top button row sits above play/pause; Up enters it and
// Left/Right walk it. The row differs per content (a movie has no episode
// button at all), so the walk is by id and fails closed when the row ends.
async function focusPlayerControlButton(page, options = {}) {
  const buttonId = String(options.buttonId || "").trim();
  const remotePress = options.remotePress || navigation.remotePress;
  const pressDelayMs = Number(options.pressDelayMs ?? EPISODE_PRESS_DELAY_MS);
  let state = await preparePlayerForRemoteControl(page, {...options, state: options.state});

  const settle = (predicate, timeoutMs) => waitForPlayerControlState(page, predicate, {
    timeoutMs: timeoutMs ?? options.openTimeoutMs ?? RELATED_STEP_TIMEOUT_MS,
  }).catch((error) => error?.details?.playerControlState || observePlayerControlState(page));

  // Down opens the control bar on the play/pause button; Up then enters the
  // button row above it.
  if (state.focus.scope !== "control_button" && state.focus.scope !== "play_pause") {
    await remotePress(page, "ArrowDown", pressDelayMs);
    state = await settle((candidate) =>
      candidate.focus.scope === "play_pause" || candidate.focus.scope === "control_button");
  }

  for (let attempt = 0; state.focus.scope !== "control_button" && attempt < MAX_FOCUS_ALIGN_PRESSES; attempt += 1) {
    await remotePress(page, "ArrowUp", pressDelayMs);
    state = await settle((candidate) => candidate.focus.scope === "control_button");
  }

  // Left/Right on the play/pause button starts a seek instead of moving along
  // the row, so the walk may only begin once the row owns the focus.
  if (state.focus.scope !== "control_button") {
    const error = new Error(
      `Could not reach the player control-bar button row for "${buttonId}": ${describeState(state)}`
    );
    error.details = {playerControlState: state};
    throw error;
  }

  for (const key of ["ArrowRight", "ArrowLeft"]) {
    for (let step = 0; step < MAX_CONTROL_BUTTON_STEPS; step += 1) {
      if (state.focus.id === buttonId) return state;
      await remotePress(page, key, pressDelayMs);
      const moved = await observePlayerControlState(page);
      if (moved.focus.id === state.focus.id) break;
      state = moved;
    }
  }

  if (state.focus.id === buttonId) return state;

  const error = new Error(
    `Could not focus the player control button "${buttonId}": ${describeState(state)}`
  );
  error.details = {playerControlState: state};
  throw error;
}

// "Chọn tập" opens a vertical list of episode posters. Each poster carries the
// episode it opens in its `partition` attribute, so the episode is read rather
// than counted, and opening the list pauses the content behind it.
async function openPlayerEpisodes(page, options = {}) {
  const remotePress = options.remotePress || navigation.remotePress;
  let state = options.state || (await observePlayerControlState(page));

  if (state.focus.scope !== "episode") {
    state = await focusPlayerControlButton(page, {
      ...options,
      state,
      buttonId: PLAYER_SELECTORS.episodeButton.replace(/^#/u, ""),
    });
    await remotePress(page, "Enter", options.pressDelayMs ?? EPISODE_PRESS_DELAY_MS);
    state = await waitForPlayerControlState(page, (candidate) => candidate.focus.scope === "episode", {
      timeoutMs: options.panelTimeoutMs ?? EPISODE_PANEL_TIMEOUT_MS,
      reason: "The player episode picker",
    });
  }

  return {
    type: "player_open_episodes",
    focusedEpisode: state.episodes.focusedEpisode,
    playingEpisode: state.episodes.playingEpisode,
    label: state.episodes.focusedLabel,
    playbackPaused: state.video.paused === true,
  };
}

async function focusPlayerEpisode(page, options = {}) {
  const episode = normalizeEpisodeNumber(options.episode);
  const remotePress = options.remotePress || navigation.remotePress;
  const pressDelayMs = Number(options.pressDelayMs ?? EPISODE_PRESS_DELAY_MS);
  let state = options.state || (await observePlayerControlState(page));

  if (state.focus.scope !== "episode") {
    await openPlayerEpisodes(page, {...options, state});
    state = await observePlayerControlState(page);
  }

  let current = state.episodes.focusedEpisode;
  if (!current) {
    const error = new Error(`Could not read the focused episode from "${state.focus.id}"`);
    error.details = {playerControlState: state};
    throw error;
  }

  for (let step = 0; current !== episode && step < MAX_EPISODE_STEPS; step += 1) {
    await remotePress(page, current < episode ? "ArrowDown" : "ArrowUp", pressDelayMs);
    const moved = await observePlayerControlState(page);
    const movedEpisode = moved.episodes.focusedEpisode;
    if (!movedEpisode || movedEpisode === current) {
      const error = new Error(
        `The episode list ended at episode ${current} before reaching episode ${episode}: ${describeState(moved)}`
      );
      error.details = {playerControlState: moved};
      throw error;
    }
    state = moved;
    current = movedEpisode;
  }

  if (current !== episode) {
    const error = new Error(`Could not focus episode ${episode}: ${describeState(state)}`);
    error.details = {playerControlState: state};
    throw error;
  }

  return {
    type: "player_focus_episode",
    episode,
    id: state.focus.id,
    label: state.episodes.focusedLabel,
    playingEpisode: state.episodes.playingEpisode,
    playbackPaused: state.video.paused === true,
  };
}

function seekBaselineSeconds(state) {
  // While playback runs the video element is authoritative; once the app pauses
  // for seeking, its own position readout is.
  if (state.video.hasVideo && state.video.paused === false) return state.video.currentTime;
  if (typeof state.position.currentSeconds === "number") return state.position.currentSeconds;
  return state.video.currentTime;
}

// The pending target while the seek bar is open. The app keeps the thumbnail
// strip in sync during a seek and only writes the elapsed label on commit, so
// the strip's middle thumbnail is the reliable target.
function seekTargetSeconds(state) {
  if (typeof state?.position?.targetSeconds === "number") return state.position.targetSeconds;
  if (typeof state?.position?.currentSeconds === "number") return state.position.currentSeconds;
  return state?.video?.currentTime ?? null;
}

async function openSeekBar(page, {key, remotePress, pressDelayMs, attempts, timeoutMs}) {
  let lastState = null;

  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    await remotePress(page, key, pressDelayMs);
    const opened = await waitForPlayerControlState(page, (state) => state.timeshiftVisible === true, {
      timeoutMs,
      reason: "Player seek bar after the seek press",
    }).catch((error) => {
      lastState = error?.details?.playerControlState || lastState;
      return null;
    });
    if (opened) return {state: opened, presses: attempt + 1};
  }

  const error = new Error(
    `The player did not open its seek bar after ${Math.max(1, attempts)} ${key} press(es): ${describeState(lastState)}`
  );
  error.details = {playerControlState: lastState};
  throw error;
}

async function seekPlayer(page, options = {}) {
  const direction = normalizeSeekDirection(options.direction);
  const steps = normalizeSeekSteps(options.steps);
  const remotePress = options.remotePress || navigation.remotePress;
  const pressDelayMs = Number(options.pressDelayMs ?? SEEK_PRESS_DELAY_MS);
  const key = SEEK_DIRECTIONS[direction];

  const before = await preparePlayerForRemoteControl(page, {...options, state: options.state});
  const fromSeconds = seekBaselineSeconds(before);

  // The seek bar always appears when the player accepts a seek key, so a press
  // that leaves it hidden was swallowed by a screen transition and moved
  // nothing. Retry it, then spend the remaining steps on the open bar.
  const opened = await openSeekBar(page, {
    key,
    remotePress,
    pressDelayMs,
    attempts: options.openAttempts ?? SEEK_OPEN_ATTEMPTS,
    timeoutMs: options.openTimeoutMs ?? SEEK_OPEN_TIMEOUT_MS,
  });
  const openTargetSeconds = seekTargetSeconds(opened.state);

  for (let step = 1; step < steps; step += 1) {
    await remotePress(page, key, pressDelayMs);
  }

  // The opening press already moved one step, so the remaining steps are what
  // can still be observed as movement. A backward seek that started at the very
  // beginning of the content has nowhere left to go.
  const atStartBoundary = direction === "backward" &&
    typeof openTargetSeconds === "number" &&
    openTargetSeconds <= SEEK_TARGET_TOLERANCE_SECONDS;
  const after = steps > 1 && !atStartBoundary
    ? await waitForPlayerControlState(
      page,
      (state) => {
        const target = seekTargetSeconds(state);
        if (typeof target !== "number" || typeof openTargetSeconds !== "number") return false;
        return direction === "forward"
          ? target > openTargetSeconds + SEEK_TARGET_TOLERANCE_SECONDS
          : target < openTargetSeconds - SEEK_TARGET_TOLERANCE_SECONDS;
      },
      {
        timeoutMs: options.targetTimeoutMs ?? SEEK_TARGET_TIMEOUT_MS,
        reason: `Player seek target after ${steps} ${direction} step(s) from ${Math.round(fromSeconds)}s`,
      }
    )
    : await observePlayerControlState(page);

  const toSeconds = seekTargetSeconds(after);

  return {
    type: "player_seek",
    direction,
    steps,
    fromSeconds: Math.round(fromSeconds),
    toSeconds: typeof toSeconds === "number" ? Math.round(toSeconds) : null,
    deltaSeconds: typeof toSeconds === "number" ? Math.round(toSeconds - fromSeconds) : null,
    firstStepSeconds: typeof openTargetSeconds === "number" ? Math.round(openTargetSeconds) : null,
    fromLabel: before.position.currentLabel,
    toLabel: after.position.currentLabel,
    timeshiftLabels: after.position.timeshiftLabels || [],
    atStartBoundary,
    seekBarOpened: after.timeshiftVisible === true,
    pending: after.video.paused === true,
    state: after.state,
  };
}

async function togglePlayerPlayback(page, options = {}) {
  const remotePress = options.remotePress || navigation.remotePress;
  const before = await preparePlayerForRemoteControl(page, {...options, state: options.state});
  const wasPaused = before.video.paused === true;

  await remotePress(page, "Enter", options.pressDelayMs ?? OK_PRESS_DELAY_MS);

  const after = await waitForPlayerControlState(
    page,
    (state) => state.video.hasVideo === true && state.video.paused !== wasPaused,
    {
      timeoutMs: options.timeoutMs ?? PLAYBACK_RESUME_TIMEOUT_MS,
      reason: `Player playback toggle from ${wasPaused ? "paused" : "playing"}`,
    }
  );

  return {
    type: "player_toggle_play",
    from: wasPaused ? "paused" : "playing",
    to: after.video.paused ? "paused" : "playing",
    positionSeconds: Math.round(after.video.currentTime),
    state: after.state,
  };
}

// What OK means depends on which state owns the screen, so its outcome is
// state-derived rather than assumed:
//   detail / pending seek -> the content plays (the seek is committed)
//   playing player        -> playback pauses and the control bar appears
//   play/pause button     -> playback toggles
// Focus on another control-bar button opens that control instead, and nothing
// about playback can be required of it.
function expectedOutcomeAfterOk(before) {
  if (before.focus.scope === "related" || before.focus.scope === "episode") return "playing";
  if (before.state === "detail") return "playing";
  if (before.focus.scope === "timeshift") return "playing";
  if (before.state === "player" || before.focus.scope === "play_pause") {
    return before.video.paused ? "playing" : "paused";
  }
  return "none";
}

async function pressPlayerOk(page, options = {}) {
  const remotePress = options.remotePress || navigation.remotePress;
  const before = options.state || (await observePlayerControlState(page));
  if (before.state === "closed") {
    const error = new Error(`The VOD player is not open: ${describeState(before)}`);
    error.details = {playerControlState: before};
    throw error;
  }

  const expected = options.expect || expectedOutcomeAfterOk(before);
  await remotePress(page, "Enter", options.pressDelayMs ?? OK_PRESS_DELAY_MS);

  // A related poster swaps the content, so playing the same media again would
  // mean the poster never opened.
  const requireNewMedia = options.requireNewMedia ??
    (before.focus.scope === "related" || before.focus.scope === "episode");
  // The player names the episode it is on, so an episode poster can be held to
  // the episode it promised - but only when the app shows one at all.
  const expectedEpisode = before.focus.scope === "episode" &&
    typeof before.episodes.playingEpisode === "number"
    ? before.episodes.focusedEpisode
    : null;
  const predicate = expected === "playing"
    ? (state) => isPlayingState(state) &&
      (!requireNewMedia || state.video.source !== before.video.source) &&
      (!expectedEpisode || state.episodes.playingEpisode === expectedEpisode)
    : expected === "paused"
      ? (state) => state.video.hasVideo === true && state.video.paused === true
      : null;
  const after = predicate
    ? await waitForPlayerControlState(page, predicate, {
      timeoutMs: options.timeoutMs ?? PLAYBACK_RESUME_TIMEOUT_MS,
      reason: `Player ${expected} after OK in the ${before.state} state`,
    })
    : await observePlayerControlState(page);

  return {
    type: "player_press_ok",
    expected,
    from: {state: before.state, focus: before.focus.scope, positionLabel: before.position.currentLabel},
    to: {state: after.state, focus: after.focus.scope, positionLabel: after.position.currentLabel},
    playing: isPlayingState(after),
    paused: after.video.paused === true,
    ...(requireNewMedia ? {contentChanged: after.video.source !== before.video.source} : {}),
    ...(before.focus.scope === "episode"
      ? {episode: after.episodes.playingEpisode, requestedEpisode: before.episodes.focusedEpisode}
      : {}),
    controlBarVisible: after.controlBarVisible === true,
    positionSeconds: Math.round(after.video.currentTime),
  };
}

module.exports = {
  PLAYER_SELECTORS,
  PLAYER_STATES,
  FOCUS_SCOPES,
  SEEK_DIRECTIONS,
  DEFAULT_SEEK_STEPS,
  MAX_SEEK_STEPS,
  observePlayerControlState,
  waitForPlayerControlState,
  enterPlayerFromDetail,
  focusPlayPauseButton,
  ensureRemoteReadyPlayer,
  preparePlayerForRemoteControl,
  seekPlayer,
  focusPlayerRelatedContent,
  normalizeRelatedItemIndex,
  focusPlayerControlButton,
  openPlayerEpisodes,
  focusPlayerEpisode,
  normalizeEpisodeNumber,
  togglePlayerPlayback,
  pressPlayerOk,
  expectedOutcomeAfterOk,
  normalizeSeekDirection,
  normalizeSeekSteps,
  __internal: {describeState, isPlayingState, isRemoteReadyPlayer, isSeekReadyFocus, seekBaselineSeconds, seekTargetSeconds, relatedItemPosition},
};
