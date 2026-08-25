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
  currentTime: "#media_player_current",
  remainingTime: "#media_player_duration",
  promoVideo: "#promo-video-next",
});

const PLAYER_STATES = Object.freeze(["closed", "detail", "control_bar", "player"]);
const FOCUS_SCOPES = Object.freeze(["none", "detail", "play_pause", "timeshift", "control_button", "other"]);
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

function normalizeSeekDirection(value) {
  const direction = String(value ?? DEFAULT_SEEK_DIRECTION).trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SEEK_DIRECTIONS, direction)) {
    throw new Error(`Unsupported player seek direction: ${value}`);
  }
  return direction;
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

    const focusedElement = [
      `${selectors.timeshiftActive}.active`,
      `${selectors.timeshiftBar} .active`,
      `${selectors.playerRoot} .focused`,
      `${selectors.detail} .focused`,
      `${selectors.detail} .active`,
      ".focused",
      "[is_focus='1']",
    ].flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .find(isOnScreen) || null;

    // closest() answers by ancestry instead of by node identity, so duplicate
    // player instances cannot misfile the focus.
    let focusScope = "none";
    if (focusedElement) {
      if (focusedElement.closest(`${selectors.timeshiftBar}, ${selectors.timeshiftProgress}, ${selectors.timeshiftActive}`)) {
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
        }
        : {hasVideo: false, currentTime: 0, duration: null, paused: true, ended: false, readyState: 0},
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

async function preparePlayerForRemoteControl(page, options = {}) {
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

  return focusPlayPauseButton(page, {...options, state});
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

  const predicate = expected === "playing"
    ? isPlayingState
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
  preparePlayerForRemoteControl,
  seekPlayer,
  togglePlayerPlayback,
  pressPlayerOk,
  expectedOutcomeAfterOk,
  normalizeSeekDirection,
  normalizeSeekSteps,
  __internal: {describeState, isPlayingState, isRemoteReadyPlayer, isSeekReadyFocus, seekBaselineSeconds, seekTargetSeconds},
};
