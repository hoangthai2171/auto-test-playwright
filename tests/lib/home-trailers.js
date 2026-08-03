const navigation = require("./navigation");
const playback = require("./playback");
const workflows = require("./workflows");
const artifacts = require("./artifacts");
const {createBatchBudget} = require("./batch-budget");

const HOME_TRAILER_NEXT_SELECTOR = "#promo-video-next";
const HOME_TRAILER_NEXT_ID = "promo-video-next";
const HOME_TRAILER_TITLE_SELECTOR = "#promo-video-title #trailer-name";
const HOME_TRAILER_TITLE_ROOT_SELECTOR = "#promo-video-title";
const HOME_TRAILER_FALLBACK_TITLE_SELECTOR = "#trailer-name";
const HOME_TRAILER_PLAY_TEXT = /^\s*Xem ngay\s*$/iu;
const DEFAULT_STATE_CHANGE_TIMEOUT_MS = 30000;
const DEFAULT_STATE_CHANGE_POLLING_MS = 250;
const DEFAULT_BACK_DELAY_MS = playback.DEFAULT_CLOSE_BACK_DELAY_MS;
const DEFAULT_HOME_READY_RETRIES = 1;
const DEFAULT_HOME_BOUNDARY_TIMEOUT_MS = 10000;
const DEFAULT_HOME_BOUNDARY_POLLING_MS = 250;
const DEFAULT_HOME_TRAILER_RUNTIME_BUDGET_MS = 10 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").replace(/\s+/gu, " ").trim();
}

function errorMessage(error) {
  return error?.message || String(error);
}

function createTrailerError(message, details, cause) {
  const error = new Error(message);
  error.details = details;
  if (cause) error.cause = cause;
  return error;
}

async function observeHomeTrailerState(page) {
  return page.evaluate((selectors) => {
    const compactText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const next = document.querySelector(selectors.next);
    const titleRoot = document.querySelector(selectors.titleRoot);
    const nestedTitle = titleRoot?.querySelector("#trailer-name") || null;
    const fallbackTitle = document.querySelector(selectors.fallbackTitle);
    const titleNode = nestedTitle || fallbackTitle || titleRoot;
    const visibleTitleContainer = titleRoot && isVisible(titleRoot);
    const visibleFallbackTitle = !titleRoot && fallbackTitle && isVisible(fallbackTitle);
    const name = (visibleTitleContainer || visibleFallbackTitle) ? textOf(titleNode) : "";
    const nextVisible = Boolean(next && isVisible(next));
    const nextDisabled = Boolean(
      next && (
        next.hasAttribute("disabled") ||
        next.getAttribute("aria-disabled") === "true" ||
        /(?:^|\s)disabled(?:\s|$)/iu.test(next.className || "")
      )
    );
    const identityParts = [titleRoot, titleNode, next]
      .filter(Boolean)
      .flatMap((element) => identityValues(element));
    const mediaNodes = titleRoot
      ? Array.from(titleRoot.querySelectorAll("img,video,source"))
      : [];
    identityParts.push(...mediaNodes.flatMap((element) => identityValues(element)));

    return {
      available: Boolean(name),
      name,
      signature: [name, ...identityParts].filter(Boolean).join("|") || name,
      titleSelector: nestedTitle
        ? selectors.title
        : fallbackTitle
          ? selectors.fallbackTitle
          : titleRoot
            ? selectors.titleRoot
            : "",
      next: {
        exists: Boolean(next),
        visible: nextVisible,
        disabled: nextDisabled,
        available: nextVisible && !nextDisabled,
      },
    };

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return Boolean(
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0
      );
    }

    function textOf(element) {
      return compactText(
        element.textContent ||
        element.getAttribute("title") ||
        element.getAttribute("aria-label") ||
        ""
      );
    }

    function identityValues(element) {
      const values = [];
      for (const attribute of [
        "data-id",
        "data-trailer-id",
        "data-promo-id",
        "data-video-id",
        "data-content-id",
        "data-key",
        "href",
        "src",
        "poster",
        "data-src",
      ]) {
        const value = element.getAttribute?.(attribute);
        if (value) values.push(`${attribute}:${compactText(value)}`);
      }
      const currentSource = element.currentSrc || "";
      if (currentSource) values.push(`currentSrc:${compactText(currentSource)}`);
      const backgroundImage = getComputedStyle(element).backgroundImage || "";
      const backgroundMatch = backgroundImage.match(/url\(["']?(.+?)["']?\)/iu);
      if (backgroundMatch?.[1]) values.push(`background:${compactText(backgroundMatch[1])}`);
      return values;
    }
  }, {
    next: HOME_TRAILER_NEXT_SELECTOR,
    title: HOME_TRAILER_TITLE_SELECTOR,
    titleRoot: HOME_TRAILER_TITLE_ROOT_SELECTOR,
    fallbackTitle: HOME_TRAILER_FALLBACK_TITLE_SELECTOR,
  });
}

async function observeAlbumDetailState(page) {
  const [content, destination] = await Promise.all([
    workflows.__internal.observeVisibleContentRows(page),
    page.evaluate((nextSelector) => {
      const compactText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
      const next = document.querySelector(nextSelector);
      const rect = next?.getBoundingClientRect?.();
      const style = next ? getComputedStyle(next) : null;
      const promoVisible = Boolean(
        next &&
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        style?.display !== "none" &&
        style?.visibility !== "hidden" &&
        Number(style?.opacity) !== 0
      );
      const isVisible = (element) => {
        if (!element) return false;
        const imageRect = element.getBoundingClientRect?.();
        const imageStyle = getComputedStyle(element);
        return Boolean(
          imageRect &&
          imageRect.width > 0 &&
          imageRect.height > 0 &&
          imageRect.bottom > 0 &&
          imageRect.right > 0 &&
          imageStyle.display !== "none" &&
          imageStyle.visibility !== "hidden" &&
          Number(imageStyle.opacity) !== 0
        );
      };
      const bodyText = compactText(document.body?.innerText || "");
      const albumCountMatch = bodyText.match(
        /tổng\s*số\s*(?:phim|vod)(?:\s*,\s*vod)?\s*:\s*(\d+)/iu
      );
      const visibleImageCount = Array.from(document.querySelectorAll("img")).filter(isVisible).length;
      return {
        routeValue: location.hash.replace(/^#/, "").split("?")[0],
        promoVisible,
        albumCount: albumCountMatch ? Number(albumCountMatch[1]) : 0,
        visibleImageCount,
      };
    }, HOME_TRAILER_NEXT_SELECTOR),
  ]);

  const routeIsAlbumDetail = destination?.routeValue === "albumDetail";
  const hasAlbumContentList = routeIsAlbumDetail &&
    Number(destination?.albumCount || 0) > 0 &&
    Number(destination?.visibleImageCount || 0) > 0;
  const contentRowsVisible = content?.visible === true && Number(content?.visibleCount || 0) > 0;
  const ok = !destination?.promoVisible && (contentRowsVisible || hasAlbumContentList);
  const visibleCount = Math.max(
    Number(content?.visibleCount || 0),
    hasAlbumContentList ? Number(destination?.visibleImageCount || 0) : 0
  );
  const rowCount = Math.max(
    Number(content?.rowCount || 0),
    hasAlbumContentList ? 1 : 0
  );
  return {
    ok,
    kind: ok ? "album_detail" : "not_album_detail",
    routeValue: String(destination?.routeValue || ""),
    promoVisible: destination?.promoVisible === true,
    albumCount: Number(destination?.albumCount || 0),
    visibleImageCount: Number(destination?.visibleImageCount || 0),
    visibleCount,
    rowCount,
  };
}

async function observeHomeExitConfirmation(page) {
  return playback.observeExitConfirmation(page);
}

async function waitForTrailerStateChange(page, previousState, options = {}, observe = observeHomeTrailerState) {
  const rawTimeoutMs = Number(options.stateChangeTimeoutMs ?? DEFAULT_STATE_CHANGE_TIMEOUT_MS);
  const rawPollingMs = Number(options.stateChangePollingMs ?? DEFAULT_STATE_CHANGE_POLLING_MS);
  const timeoutMs = Number.isFinite(rawTimeoutMs) ? Math.max(0, rawTimeoutMs) : DEFAULT_STATE_CHANGE_TIMEOUT_MS;
  const pollingMs = Number.isFinite(rawPollingMs) ? Math.max(0, rawPollingMs) : DEFAULT_STATE_CHANGE_POLLING_MS;
  const startedAt = Date.now();
  let lastState = null;

  while (true) {
    lastState = await observe(page);
    if (lastState?.next?.available !== true) {
      return {kind: "exhausted", state: lastState};
    }
    if (!lastState?.available || !lastState.signature) {
      throw new Error("Home trailer state became unidentifiable while waiting for the next trailer.");
    }
    if (lastState.signature !== previousState.signature) {
      return {kind: "changed", state: lastState};
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw new Error(
        `Home trailer did not advance after returning Home within ${timeoutMs}ms: ${JSON.stringify(lastState)}`
      );
    }
    if (typeof page.waitForTimeout === "function") {
      await page.waitForTimeout(Math.min(pollingMs, timeoutMs - elapsed));
    } else {
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollingMs, timeoutMs - elapsed)));
    }
  }
}

function createHomeTrailersApi(overrides = {}) {
  const dependencies = {
    waitForHomeReady: workflows.__internal.waitForHomeReady,
    observeHomeReadyState: workflows.__internal.observeHomeReadyState,
    isValidFocusedState: workflows.__internal.isValidFocusedState,
    observeHomeExitConfirmation,
    observeHomeTrailerState,
    observeAlbumDetailState,
    waitForTrailerStateChange,
    closePlayerOrDetail: playback.closePlayerOrDetail,
    remoteFocusByText: navigation.remoteFocusByText,
    remoteFocusById: navigation.remoteFocusById,
    remotePress: navigation.remotePress,
    inspectPlaybackAfterWait: playback.inspectPlaybackAfterWait,
    captureCurrentAppScreenshot: artifacts.captureCurrentAppScreenshot,
    attachPlaybackBatchReport: artifacts.attachPlaybackBatchReport,
    createBatchBudget,
    safeArtifactName: artifacts.safeArtifactName,
    ...overrides,
  };

  async function attachJson(testInfo, name, value) {
    if (!testInfo || typeof testInfo.attach !== "function") return;
    await testInfo.attach(name, {
      body: JSON.stringify(value, null, 2),
      contentType: "application/json",
    });
  }

  async function waitForHomeReadyWithRetry(page, testInfo, options = {}) {
    const rawRetries = Number(options.homeReadyRetries ?? DEFAULT_HOME_READY_RETRIES);
    const retries = Number.isFinite(rawRetries) ? Math.max(0, Math.floor(rawRetries)) : DEFAULT_HOME_READY_RETRIES;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await dependencies.waitForHomeReady(page, testInfo);
      } catch (error) {
        lastError = error;
        if (attempt >= retries) throw error;
        if (typeof page.waitForTimeout === "function") {
          await page.waitForTimeout(500);
        }
      }
    }

    throw lastError || new Error("Home readiness could not be confirmed.");
  }

  function isHomeReadyObservation(observation) {
    return Boolean(
      observation?.route &&
      observation?.menu &&
      observation?.content &&
      dependencies.isValidFocusedState(observation?.focused)
    );
  }

  async function observeHomeBoundary(page) {
    const [home, popup, trailer] = await Promise.all([
      dependencies.observeHomeReadyState(page),
      dependencies.observeHomeExitConfirmation(page),
      dependencies.observeHomeTrailerState(page),
    ]);

    if (popup?.visible === true) {
      return {kind: "exit-confirmation", home, popup, trailer};
    }
    if (popup?.unexpectedVisible === true) {
      const error = new Error(
        `Unexpected modal blocked the Home-trailer return: ${JSON.stringify(popup.visibleDialogs || popup)}`
      );
      error.code = "HOME_RETURN_UNSAFE_POPUP";
      error.details = {home, popup, trailer};
      throw error;
    }
    if (
      isHomeReadyObservation(home) &&
      trailer?.available === true &&
      trailer?.next?.exists === true &&
      trailer?.next?.visible === true
    ) {
      return {kind: "home", home, popup, trailer};
    }
    return {kind: "transitioning", home, popup, trailer};
  }

  async function waitForHomeBoundary(page, options = {}) {
    const rawTimeoutMs = Number(options.homeBoundaryTimeoutMs ?? DEFAULT_HOME_BOUNDARY_TIMEOUT_MS);
    const rawPollingMs = Number(options.homeBoundaryPollingMs ?? DEFAULT_HOME_BOUNDARY_POLLING_MS);
    const timeoutMs = Number.isFinite(rawTimeoutMs)
      ? Math.max(0, rawTimeoutMs)
      : DEFAULT_HOME_BOUNDARY_TIMEOUT_MS;
    const pollingMs = Number.isFinite(rawPollingMs)
      ? Math.max(0, rawPollingMs)
      : DEFAULT_HOME_BOUNDARY_POLLING_MS;
    const startedAt = Date.now();
    let lastBoundary = null;

    while (true) {
      lastBoundary = await observeHomeBoundary(page);
      if (lastBoundary.kind !== "transitioning") return lastBoundary;

      const elapsed = Date.now() - startedAt;
      if (elapsed >= timeoutMs) {
        const error = new Error(
          `Home boundary was not ready within ${timeoutMs}ms: ${JSON.stringify(lastBoundary)}`
        );
        error.code = "HOME_RETURN_NOT_READY";
        error.details = lastBoundary;
        throw error;
      }
      const delay = Math.min(pollingMs, timeoutMs - elapsed);
      if (typeof page.waitForTimeout === "function") {
        await page.waitForTimeout(delay);
      } else {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async function returnHomeAfterTrailer(page, testInfo, options = {}) {
    return dependencies.closePlayerOrDetail(page, {
      remotePress: dependencies.remotePress,
      observePopup: dependencies.observeHomeExitConfirmation,
      isClosed: async (candidatePage) => {
        const boundary = await observeHomeBoundary(candidatePage);
        return boundary.kind === "home";
      },
      maxBackPresses: options.maxHomeBackPresses ?? 2,
      backDelayMs: options.backDelayMs ?? DEFAULT_BACK_DELAY_MS,
      boundaryTimeoutMs: options.homeBoundaryTimeoutMs ?? DEFAULT_HOME_BOUNDARY_TIMEOUT_MS,
      boundaryPollingMs: options.homeBoundaryPollingMs ?? DEFAULT_HOME_BOUNDARY_POLLING_MS,
    });
  }

  async function advanceToNextTrailer(page, previousState, options = {}) {
    try {
      return await dependencies.waitForTrailerStateChange(
        page,
        previousState,
        options,
        dependencies.observeHomeTrailerState
      );
    } catch (error) {
      if (!/did not advance after returning Home/i.test(errorMessage(error))) {
        throw error;
      }

      const currentState = await dependencies.observeHomeTrailerState(page);
      if (currentState?.next?.available !== true) {
        return {kind: "exhausted", state: currentState};
      }
      if (currentState?.signature && currentState.signature !== previousState.signature) {
        return {kind: "changed", state: currentState};
      }

      await dependencies.remoteFocusById(page, HOME_TRAILER_NEXT_ID, 60);
      await dependencies.remotePress(page, "Enter");
      return dependencies.waitForTrailerStateChange(
        page,
        previousState,
        options,
        dependencies.observeHomeTrailerState
      );
    }
  }

  async function captureTrailerCheckScreenshot(page, testInfo, index, name, activationType) {
    const suffix = activationType === "album_detail" ? "album-detail-check" : "player-check";
    const prefix = `home-trailer-${index}-${name}-${suffix}`;
    const screenshotDataUrl = await dependencies.captureCurrentAppScreenshot(
      page,
      testInfo,
      prefix
    );
    return {
      screenshot: `${dependencies.safeArtifactName(prefix)}.png`,
      screenshotDataUrl,
    };
  }

  async function playAllHomeTrailers(page, testInfo, options = {}) {
    const rawWaitSeconds = Number(options.waitSeconds ?? playback.PLAYER_PLAYBACK_WAIT_SECONDS);
    const waitSeconds = Number.isFinite(rawWaitSeconds)
      ? Math.max(0, rawWaitSeconds)
      : playback.PLAYER_PLAYBACK_WAIT_SECONDS;
    const budget = dependencies.createBatchBudget({
      itemLimit: 0,
      runtimeBudgetMs: options.runtimeBudgetMs ?? DEFAULT_HOME_TRAILER_RUNTIME_BUDGET_MS,
      now: options.now,
    });
    const results = [];
    const seenSignatures = new Set();
    let state = null;
    let attempted = 0;
    let stopReason = "";
    let budgetLimited = false;
    let terminalError = null;

    try {
      await waitForHomeReadyWithRetry(page, testInfo, options);
      state = await dependencies.observeHomeTrailerState(page);

      if (!state?.available || !state.name || !state.signature) {
        stopReason = "no-trailers";
        terminalError = new Error("No identifiable Home trailer is available.");
      }

      while (!terminalError && state?.available) {
        const signature = String(state.signature || state.name || "").trim();
        if (!signature) {
          stopReason = "unidentifiable-trailer";
          terminalError = new Error("Home trailer identity is empty.");
          break;
        }
        if (seenSignatures.has(signature)) {
          stopReason = "carousel-cycled";
          break;
        }

        const decision = budget.canStart({
          completed: results.length,
          attempted,
          estimatedDurationMs: Math.max(0, waitSeconds * 1000),
        });
        if (!decision.allowed) {
          stopReason = decision.reason;
          budgetLimited = true;
          break;
        }

        attempted += 1;
        seenSignatures.add(signature);
        const result = {
          index: attempted,
          id: signature,
          name: String(state.name).trim(),
          title: String(state.name).trim(),
          signature,
          status: "unknown",
          activationType: "",
          errorPopup: "",
          screenshot: "",
          screenshotDataUrl: "",
        };
        let enteredPlayer = false;
        let returnedHome = false;
        let attemptError = null;
        let transition = null;

        try {
          await dependencies.remoteFocusByText(page, HOME_TRAILER_PLAY_TEXT, 60);
          enteredPlayer = true;
          await dependencies.remotePress(page, "Enter");

          let playbackResult;
          try {
            playbackResult = await dependencies.inspectPlaybackAfterWait(
              page,
              waitSeconds,
              options.playbackOptions || {}
            );
          } catch (error) {
            playbackResult = {
              ok: false,
              popup: null,
              playerState: null,
              error,
            };
          }

          result.playerState = playbackResult?.playerState || null;
          result.errorPopup = normalizeText(
            playbackResult?.popup?.text ||
            playbackResult?.playerState?.reason ||
            playbackResult?.error?.message ||
            ""
          );
          let albumDetailState = null;
          if (playbackResult?.ok === true) {
            result.status = "playable";
            result.activationType = "player";
          } else {
            try {
              albumDetailState = await dependencies.observeAlbumDetailState(page);
            } catch (error) {
              result.albumDetailError = errorMessage(error);
            }
            result.albumDetailState = albumDetailState;
            if (albumDetailState?.ok === true) {
              result.status = "album_opened";
              result.activationType = "album_detail";
              result.errorPopup = "";
            } else {
              result.status = "failed";
            }
          }
          Object.assign(
            result,
            await captureTrailerCheckScreenshot(
              page,
              testInfo,
              attempted,
              result.name,
              result.activationType
            )
          );
        } catch (error) {
          result.status = "failed";
          result.errorPopup = errorMessage(error);
          try {
            Object.assign(
              result,
              await captureTrailerCheckScreenshot(
                page,
                testInfo,
                attempted,
                result.name,
                result.activationType
              )
            );
          } catch (screenshotError) {
            result.screenshotError = errorMessage(screenshotError);
            attemptError = screenshotError;
          }
          if (!attemptError && error?.code !== "PLAYBACK_CHECK_FAILED") {
            attemptError = error;
          }
        } finally {
          if (enteredPlayer) {
            try {
              await returnHomeAfterTrailer(page, testInfo, options);
              returnedHome = true;
            } catch (error) {
              attemptError ||= error;
              result.returnError = errorMessage(error);
            }
          }

          results.push(result);

          if (returnedHome && !attemptError) {
            try {
              transition = await advanceToNextTrailer(page, state, options);
            } catch (error) {
              attemptError = error;
            }
          }
        }

        if (attemptError) {
          stopReason = returnedHome ? "trailer-attempt-failed" : "home-return-failed";
          terminalError = attemptError;
          break;
        }
        if (!returnedHome) {
          stopReason = "home-return-failed";
          terminalError = new Error(`Could not return Home after trailer ${result.name}.`);
          break;
        }

        if (transition?.kind === "exhausted") {
          stopReason = "carousel-exhausted";
          state = null;
          break;
        }
        state = transition?.state || null;
        if (!state) {
          stopReason = "unidentifiable-trailer";
          terminalError = new Error("The next Home trailer state was not available.");
          break;
        }
      }
    } catch (error) {
      terminalError ||= error;
      stopReason ||= "home-trailer-error";
    }

    if (!stopReason) stopReason = terminalError ? "home-trailer-error" : "carousel-exhausted";
    const budgetReport = budget.report({
      completed: results.length,
      attempted,
      reason: stopReason,
      budgetLimited,
    });

    try {
      await attachJson(testInfo, "home-trailer-playback-budget.json", budgetReport);
      await dependencies.attachPlaybackBatchReport(testInfo, results, {
        prefix: "home-trailer-playback",
        heading: "Home trailer player/Album-detail check results",
        includeScreenshot: true,
        screenshotHeading: "Ảnh kiểm tra player/Album detail",
      });
    } catch (error) {
      terminalError ||= error;
      stopReason = "report-artifact-failed";
    }

    const failedCount = results.filter((item) => item.status === "failed").length;
    if (!terminalError && results.length === 0) {
      terminalError = new Error("No Home trailers were tested.");
      stopReason = "no-trailers";
    } else if (!terminalError && budgetLimited) {
      terminalError = new Error("Home trailer playback stopped before every trailer was tested.");
    } else if (!terminalError && failedCount > 0) {
      terminalError = new Error(`${failedCount} Home trailer(s) failed to open a player or Album detail screen.`);
    }

    if (terminalError) {
      throw createTrailerError(
        terminalError.message,
        {results, budget: budgetReport, stopReason},
        terminalError
      );
    }

    return {results, budget: budgetReport, stopReason};
  }

  return {
    observeHomeExitConfirmation: dependencies.observeHomeExitConfirmation,
    observeHomeTrailerState: dependencies.observeHomeTrailerState,
    observeAlbumDetailState: dependencies.observeAlbumDetailState,
    waitForTrailerStateChange: dependencies.waitForTrailerStateChange,
    playAllHomeTrailers,
  };
}

const defaultApi = createHomeTrailersApi();

module.exports = {
  HOME_TRAILER_NEXT_SELECTOR,
  HOME_TRAILER_NEXT_ID,
  HOME_TRAILER_TITLE_SELECTOR,
  HOME_TRAILER_PLAY_TEXT,
  DEFAULT_HOME_BOUNDARY_TIMEOUT_MS,
  DEFAULT_HOME_BOUNDARY_POLLING_MS,
  DEFAULT_HOME_TRAILER_RUNTIME_BUDGET_MS,
  observeHomeTrailerState,
  observeAlbumDetailState,
  observeHomeExitConfirmation,
  waitForTrailerStateChange,
  createHomeTrailersApi,
  playAllHomeTrailers: defaultApi.playAllHomeTrailers,
};
