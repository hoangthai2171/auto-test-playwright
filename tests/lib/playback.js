const {expect}=require("playwright/test");
const navigation = require("./navigation");
const {waitForPlayerReady}=require("./waits");
const {DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS}=require("../../app/test-configuration");

const CLOSE_POPUP_TEXT=/^(Đóng|Huỷ|Hủy|Quay về|Quay về trang chủ)$/i;
const PLAYER_PLAYBACK_WAIT_SECONDS=DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS;
const EXIT_DIALOG_IDS=["dialog_confirm_v2","dialog_alert_v2","dialog_alert_full","dialog_confirm_full"];
const DEFAULT_CLOSE_BACK_DELAY_MS=2500;
const DEFAULT_CLOSE_BOUNDARY_TIMEOUT_MS=10000;
const DEFAULT_CLOSE_BOUNDARY_POLLING_MS=250;
const DEFAULT_MAX_CLOSE_BACK_PRESSES=2;
const MAX_CLOSE_BACK_PRESSES=6;
function safeArtifactName(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"artifact";}
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

async function attachPlaybackTimeout(page, testInfo, artifactPrefix, label, readiness, popup, playerState) {
  if (!testInfo?.attach) return;

  await testInfo.attach(`${safeArtifactName(artifactPrefix)}-playback-timeout.json`, {
    body: JSON.stringify({
      label,
      popup,
      playerState,
      wait: readiness?.diagnostic || readiness,
    }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach(`${safeArtifactName(artifactPrefix)}-playback-timeout.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function assertPlayback(page, testInfo, { label, artifactPrefix, ...waitOptions }) {
  const popupObserver = waitOptions.getVisiblePopup || getVisiblePopup;
  const playerObserver = waitOptions.getPlayerState || getPlayerState;
  let readiness;
  try {
    readiness = await waitForPlayerReady(page, {
      ...waitOptions,
      testInfo,
      getVisiblePopup: popupObserver,
      getPlayerState: playerObserver,
    });
  } catch (error) {
    const observation = error?.diagnostic?.lastObservation || {};
    const popup = observation.popup || await popupObserver(page).catch(() => null);
    const playerState = observation.playerState || await playerObserver(page).catch((playerError) => ({
      hasVideo: false,
      isProbablyPlaying: false,
      reason: playerError?.message || String(playerError),
    }));

    await attachPlaybackTimeout(page, testInfo, artifactPrefix, label, error, popup, playerState);
    await testInfo.attach(`${safeArtifactName(artifactPrefix)}-player-state.json`, {
      body: JSON.stringify({label, ...playerState}, null, 2),
      contentType: "application/json",
    });

    if (popup) {
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

    readiness = {ok: false, diagnostic: error?.diagnostic, error: error?.message || String(error)};
    await attachPlayerFailureArtifacts(page, testInfo, artifactPrefix, label, playerState);
    expect(playerState.hasVideo, "Player video element should exist").toBe(true);
    expect(
      playerState.isProbablyPlaying,
      `Player should be playing normally: ${JSON.stringify(playerState)}`
    ).toBe(true);
    return readiness;
  }

  const playerState = readiness.observation.playerState;
  await testInfo.attach(`${safeArtifactName(artifactPrefix)}-player-state.json`, {
    body: JSON.stringify({ label, ...playerState }, null, 2),
    contentType: "application/json",
  });

  if (!playerState.hasVideo || !playerState.isProbablyPlaying) {
    await attachPlayerFailureArtifacts(page, testInfo, artifactPrefix, label, playerState);
  }

  expect(playerState.hasVideo, "Player video element should exist").toBe(true);
  expect(
    playerState.isProbablyPlaying,
    `Player should be playing normally: ${JSON.stringify(playerState)}`
  ).toBe(true);
}

async function attachPlayerFailureArtifacts(page, testInfo, artifactPrefix, label, playerState) {
  if (!testInfo?.attach) return;
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

async function inspectPlaybackAfterWait(page, waitSeconds, options = {}) {
  const viewingDurationMs = Math.max(0, Number(waitSeconds || 0) * 1000);
  await page.waitForTimeout(viewingDurationMs);

  const readiness = await waitForPlayerReady(page, {
    ...options,
    nonThrowing: true,
    getVisiblePopup: options.getVisiblePopup || getVisiblePopup,
    getPlayerState: options.getPlayerState || getPlayerState,
  });
  const observation = readiness.observation || readiness.lastObservation || {};
  const playerState = observation.playerState || {
    hasVideo: false,
    isProbablyPlaying: false,
    reason: readiness.reason || "Player readiness timed out",
  };

  return {
    ok: readiness.ok === true,
    popup: observation.popup || null,
    playerState,
    waitResult: readiness,
  };
}

async function observeExitConfirmation(page) {
  return page.evaluate((dialogIds = [
    "dialog_confirm_v2",
    "dialog_alert_v2",
    "dialog_alert_full",
    "dialog_confirm_full",
  ]) => {
    const roots = dialogIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const visibleDialogs = roots
      .filter((root) => isVisible(root) || Array.from(root.querySelectorAll?.("*") || []).some(isVisible))
      .map((root) => ({
        id: root.id,
        text: elementText(root),
        exitConfirmation: isExitConfirmation(elementText(root)),
      }));
    const exitDialog = visibleDialogs.find((dialog) => dialog.exitConfirmation);

    return {
      visible: Boolean(exitDialog),
      kind: exitDialog ? "exit_confirmation" : "none",
      dialogId: exitDialog?.id || "",
      text: exitDialog?.text || "",
      unexpectedVisible: visibleDialogs.length > 0 && !exitDialog,
      visibleDialogs,
    };

    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect?.();
      const style = getComputedStyle(element);
      return Boolean(
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0
      );
    }

    function elementText(element) {
      if (!element) return "";
      return [
        element.textContent || "",
        element.getAttribute?.("aria-label") || "",
        element.getAttribute?.("title") || "",
        element.getAttribute?.("data-message") || "",
      ].join(" ").replace(/\s+/gu, " ").trim();
    }

    function isExitConfirmation(text) {
      const normalized = String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/gu, "")
        .replace(/đ/gu, "d")
        .replace(/Đ/gu, "D")
        .replace(/\s+/gu, " ")
        .trim()
        .toLowerCase();
      return /\b(?:thoat|exit|quit)\b|\bdong (?:ung )?dung\b|\broi khoi (?:ung )?dung\b|\bclose (?:the )?app\b/iu.test(normalized);
    }
  }, EXIT_DIALOG_IDS);
}

async function observePlayerOrDetailState(page) {
  return page.evaluate(() => {
    const routeValue = location.hash.replace(/^#/, "").split("?")[0];
    const promoNext = document.querySelector("#promo-video-next");
    const promoVisible = isVisible(promoNext);
    const routeLooksLikePlayerOrDetail = /player|playback|albumdetail|contentdetail|moviedetail|voddetail|detail(?:page|screen)?/iu.test(routeValue);
    const playerMarker = Array.from(document.querySelectorAll("[id],[class]"))
      .filter(isVisible)
      .find((element) => {
        const marker = `${element.id || ""} ${typeof element.className === "string" ? element.className : ""}`;
        return /player|playback|video-player|player-container|video-container/iu.test(marker) &&
          !/promo|trailer/iu.test(marker);
      });
    const visiblePlayerVideo = Array.from(document.querySelectorAll("video"))
      .filter(isVisible)
      .some((video) => {
        const rect = video.getBoundingClientRect();
        return !promoVisible &&
          rect.width >= (window.innerWidth || 1) * 0.75 &&
          rect.height >= (window.innerHeight || 1) * 0.5;
      });

    return {
      routeValue,
      routeLooksLikePlayerOrDetail,
      playerMarker: playerMarker ? `${playerMarker.id || ""} ${playerMarker.className || ""}`.trim() : "",
      visiblePlayerVideo,
      open: routeLooksLikePlayerOrDetail || Boolean(playerMarker) || visiblePlayerVideo,
    };

    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect?.();
      const style = getComputedStyle(element);
      return Boolean(
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0
      );
    }
  });
}

function isClosedObservation(observation) {
  if (observation === true) return true;
  if (!observation || typeof observation !== "object") return false;
  return observation.closed === true || observation.ok === true || observation.open === false;
}

function normalizeCloseInteger(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(numeric)));
}

function normalizeCloseDuration(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

async function waitForCloseBoundary(page, observeBoundary, timeoutMs, pollingMs) {
  const startedAt = Date.now();
  let boundary = await observeBoundary();

  while (!boundary.closed && !boundary.popup) {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) return boundary;
    const delay = Math.min(pollingMs, Math.max(0, timeoutMs - elapsed));
    if (typeof page.waitForTimeout === "function") {
      await page.waitForTimeout(delay);
    } else {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    boundary = await observeBoundary();
  }

  return boundary;
}

async function closePlayerOrDetail(page, options = {}) {
  const pressBack = options.remotePress || navigation.remotePress;
  const dismissUnexpectedPopup = options.dismissUnexpectedPopup;
  const observeClosed = options.isClosed || (async (candidatePage) => {
    const observation = await observePlayerOrDetailState(candidatePage);
    return observation.open !== true;
  });
  const observePopup = options.observePopup || observeExitConfirmation;
  const maxBackPresses = normalizeCloseInteger(
    options.maxBackPresses ?? DEFAULT_MAX_CLOSE_BACK_PRESSES,
    DEFAULT_MAX_CLOSE_BACK_PRESSES,
    1,
    MAX_CLOSE_BACK_PRESSES
  );
  const backDelayMs = normalizeCloseDuration(options.backDelayMs, DEFAULT_CLOSE_BACK_DELAY_MS);
  const boundaryTimeoutMs = normalizeCloseDuration(options.boundaryTimeoutMs, DEFAULT_CLOSE_BOUNDARY_TIMEOUT_MS);
  const boundaryPollingMs = normalizeCloseDuration(options.boundaryPollingMs, DEFAULT_CLOSE_BOUNDARY_POLLING_MS);
  let closeBackPresses = 0;
  let dismissedExitConfirmation = 0;
  let lastBoundary = null;

  async function observeBoundary() {
    const popup = await observePopup(page);
    if (popup?.unexpectedVisible === true) {
      if (typeof dismissUnexpectedPopup === "function" &&
        await dismissUnexpectedPopup(page, popup) === true) {
        const afterDismiss = await observePopup(page);
        if (afterDismiss?.unexpectedVisible === true || afterDismiss?.visible === true) {
          return {closed: false, popup: afterDismiss, observation: null};
        }
        const observation = await observeClosed(page);
        return {closed: isClosedObservation(observation), popup: null, observation};
      }
      const error = new Error(
        `Unexpected modal blocked player/detail close: ${JSON.stringify(popup.visibleDialogs || popup)}`
      );
      error.code = "PLAYER_CLOSE_UNSAFE_POPUP";
      error.details = {popup, boundary: lastBoundary};
      throw error;
    }
    if (popup?.visible === true) {
      return {closed: false, popup, observation: null};
    }

    const observation = await observeClosed(page);
    return {closed: isClosedObservation(observation), popup: null, observation};
  }

  async function dismissExitConfirmation() {
    await pressBack(page, "Backspace", backDelayMs);
    dismissedExitConfirmation += 1;
    const afterDismiss = await waitForCloseBoundary(
      page,
      observeBoundary,
      boundaryTimeoutMs,
      boundaryPollingMs
    );
    if (afterDismiss.popup) {
      const error = new Error("Exit confirmation remained visible after the Back dismissal.");
      error.code = "PLAYER_CLOSE_POPUP_NOT_DISMISSED";
      error.details = {popup: afterDismiss.popup, boundary: afterDismiss};
      throw error;
    }
    return afterDismiss;
  }

  let boundary = await observeBoundary();
  lastBoundary = boundary;
  if (boundary.popup) {
    boundary = await dismissExitConfirmation();
    lastBoundary = boundary;
  }
  if (boundary.closed) {
    return {closed: true, backPresses: closeBackPresses, dismissedExitConfirmation, boundary};
  }

  while (closeBackPresses < maxBackPresses) {
    await pressBack(page, "Backspace", backDelayMs);
    closeBackPresses += 1;
    boundary = await waitForCloseBoundary(
      page,
      observeBoundary,
      boundaryTimeoutMs,
      boundaryPollingMs
    );
    lastBoundary = boundary;

    if (boundary.popup) {
      boundary = await dismissExitConfirmation();
      lastBoundary = boundary;
    }
    if (boundary.closed) {
      return {closed: true, backPresses: closeBackPresses, dismissedExitConfirmation, boundary};
    }
  }

  const error = new Error(
    `Could not close the player/detail screen after ${closeBackPresses} Back press(es): ${JSON.stringify(lastBoundary)}`
  );
  error.code = "PLAYER_CLOSE_FAILED";
  error.details = {
    backPresses: closeBackPresses,
    dismissedExitConfirmation,
    boundary: lastBoundary,
  };
  throw error;
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

    // A match only counts when it lives inside a real dialog container. Page
    // content is not a popup: a film synopsis such as "Một gia đình không thể
    // rời đi" matches the error wording, and without this gate a healthy player
    // showing that content was reported as a playback failure. Every popup the
    // app renders carries popup/dialog/alert in its id or class, so requiring
    // that container keeps real dialogs detected while page text is ignored.
    const closeButton = visibleElements.find(
      (element) => closePattern.test(elementText(element)) && findPopupRoot(element)
    );
    const errorElement = visibleElements.find(
      (element) => errorPattern.test(elementText(element)) && findPopupRoot(element)
    );

    if (!closeButton && !errorElement) return null;

    const root =
      [closeButton, errorElement]
        .filter(Boolean)
        .map((element) => findPopupRoot(element))
        .filter(Boolean)
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

    // The outermost ancestor-or-self that the app marks as a dialog, or null when
    // the element is ordinary page content. Outermost matters for diagnostics: a
    // dialog's own button can carry the marker too (#btn_alert_v2_ok), and
    // stopping there would report the button label instead of the message.
    function findPopupRoot(element) {
      let root = null;
      for (let current = element; current && current !== document.body; current = current.parentElement) {
        if (looksLikePopupRoot(current)) root = current;
      }

      return root;
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
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll("video"));
    const video = videos.find((item) => {
      const rect = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      const source = item.currentSrc || item.src || item.querySelector("source")?.src || "";
      const hasMediaState = Boolean(source) || item.readyState > 0 || item.videoWidth > 0 || item.videoHeight > 0;
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        hasMediaState
      );
    });

    if (!video) {
      return {
        hasVideo: false,
        isProbablyPlaying: false,
        videoCount: videos.length,
        reason: videos.length ? "No active video element found" : "No video element found",
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
      videoCount: videos.length,
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


module.exports={assertPlayback,assertChannelPlayback,assertMoviePlayback,assertSearchContentPlayback,getVisiblePopup,getPlayerState,inspectPlaybackAfterWait,observeExitConfirmation,observePlayerOrDetailState,closePlayerOrDetail,waitForPlayerReady,safeArtifactName,PLAYER_PLAYBACK_WAIT_SECONDS,DEFAULT_CLOSE_BACK_DELAY_MS,DEFAULT_CLOSE_BOUNDARY_TIMEOUT_MS,DEFAULT_CLOSE_BOUNDARY_POLLING_MS,DEFAULT_MAX_CLOSE_BACK_PRESSES,MAX_CLOSE_BACK_PRESSES};
