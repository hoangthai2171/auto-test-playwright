const WAIT_TIMEOUT_CODE = "WAIT_TIMEOUT";

const WAIT_DEFAULTS = Object.freeze({
  focus: Object.freeze({name: "focus", timeout: 30000, polling: 100}),
  content: Object.freeze({name: "content", timeout: 30000, polling: 250}),
  player: Object.freeze({name: "player", timeout: 30000, polling: 250}),
});

const MAX_DIAGNOSTIC_DEPTH = 4;
const MAX_DIAGNOSTIC_KEYS = 32;
const MAX_DIAGNOSTIC_ITEMS = 20;
const MAX_DIAGNOSTIC_STRING = 500;

class WaitTimeoutError extends Error {
  constructor(diagnostic) {
    super(`${diagnostic.waitName} wait timed out after ${diagnostic.timeout}ms: ${diagnostic.reason}`);
    this.name = "WaitTimeoutError";
    this.code = WAIT_TIMEOUT_CODE;
    this.waitName = diagnostic.waitName;
    this.timeout = diagnostic.timeout;
    this.elapsed = diagnostic.elapsed;
    this.lastObservation = diagnostic.lastObservation;
    this.url = diagnostic.url;
    this.hash = diagnostic.hash;
    this.focusedState = diagnostic.focusedState;
    this.reason = diagnostic.reason;
    this.diagnostic = diagnostic;
  }
}

function safeArtifactName(value) {
  return String(value || "wait")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "wait";
}

function boundDiagnostic(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DIAGNOSTIC_DEPTH) return "[truncated]";
  if (typeof value === "string") return value.slice(0, MAX_DIAGNOSTIC_STRING);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "object") return String(value).slice(0, MAX_DIAGNOSTIC_STRING);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_DIAGNOSTIC_ITEMS).map((item) => boundDiagnostic(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_DIAGNOSTIC_KEYS)
      .map(([key, item]) => [key.slice(0, 100), boundDiagnostic(item, depth + 1)])
  );
}

async function readPageUrl(page) {
  try {
    return typeof page?.url === "function" ? String(page.url()) : "";
  } catch (_) {
    return "";
  }
}

function getHash(url) {
  try {
    return new URL(url).hash || "";
  } catch (_) {
    const hashIndex = String(url || "").indexOf("#");
    return hashIndex >= 0 ? String(url).slice(hashIndex) : "";
  }
}

async function defaultFocusedState(page) {
  if (typeof page?.evaluate !== "function") return null;
  return page.evaluate(() => {
    const element = document.querySelector(".focused");
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const visible = Boolean(
      rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
    );
    return {
      id: element.id || "",
      text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
      label: element.getAttribute("title") || element.getAttribute("aria-label") || "",
      visible,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  });
}

async function defaultContentState(page) {
  if (typeof page?.evaluate !== "function") return {visible: false, visibleCount: 0};
  return page.evaluate(() => {
    const selectors = [
      ".content-row",
      '[content_name]',
      '[content_id]',
      '[content-id]',
      '[data-content-id]',
    ];
    const elements = Array.from(document.querySelectorAll(selectors.join(",")));
    const visibleItems = elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    });
    return {
      visible: visibleItems.length > 0,
      visibleCount: visibleItems.length,
      rowCount: document.querySelectorAll(".content-row").length,
    };
  });
}

async function defaultPopupState(page) {
  if (typeof page?.evaluate !== "function") return null;
  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('[role="dialog"], .popup, .modal, [class*="popup"], [id*="popup"]')
    );
    const visible = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    if (!visible) return null;
    return {text: (visible.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300)};
  });
}

async function defaultPlayerState(page) {
  if (typeof page?.evaluate !== "function") return {hasVideo: false, isProbablyPlaying: false};
  return page.evaluate(() => {
    const video = Array.from(document.querySelectorAll("video")).find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || document.querySelector("video");
    if (!video) return {hasVideo: false, isProbablyPlaying: false};
    return {
      hasVideo: true,
      isProbablyPlaying: !video.paused && !video.ended && video.readyState >= 3,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      readyState: video.readyState,
    };
  });
}

async function invokeObserver(observer, page) {
  return typeof observer === "function" ? observer(page) : null;
}

async function invokePredicate(predicate, page, observation) {
  return typeof predicate === "function" ? predicate({page, observation}) : Boolean(observation);
}

async function waitForDelay(page, delay) {
  if (delay <= 0) return;
  if (typeof page?.waitForTimeout === "function") {
    await page.waitForTimeout(delay);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function attachTimeoutDiagnostics(page, testInfo, diagnostic) {
  if (!testInfo || typeof testInfo.attach !== "function") return;
  const artifactName = safeArtifactName(diagnostic.waitName);
  await testInfo.attach(`${artifactName}-timeout.json`, {
    body: JSON.stringify(diagnostic, null, 2),
    contentType: "application/json",
  });

  if (typeof page?.screenshot !== "function") return;
  try {
    await testInfo.attach(`${artifactName}-timeout.png`, {
      body: await page.screenshot({fullPage: false}),
      contentType: "image/png",
    });
  } catch (_) {
    // A timeout diagnostic must remain useful even if the page closes before capture.
  }
}

async function createTimeoutDiagnostic(page, options, lastObservation, startedAt, reason) {
  const url = await readPageUrl(page);
  let focusedState = lastObservation?.focused || null;
  if (!focusedState && typeof options.getFocusedState === "function") {
    focusedState = await invokeObserver(options.getFocusedState, page).catch(() => null);
  }
  if (!focusedState && options.waitName === "focus") focusedState = lastObservation;

  return {
    waitName: options.waitName,
    timeout: options.timeout,
    polling: options.polling,
    elapsed: Math.max(0, Date.now() - startedAt),
    lastObservation: boundDiagnostic(lastObservation),
    url: url.slice(0, MAX_DIAGNOSTIC_STRING),
    hash: getHash(url).slice(0, MAX_DIAGNOSTIC_STRING),
    focusedState: boundDiagnostic(focusedState),
    reason: String(reason || "condition was not ready").slice(0, MAX_DIAGNOSTIC_STRING),
  };
}

async function pollWait(page, {
  waitName,
  timeout,
  polling,
  observe,
  isReady,
  getFocusedState,
  testInfo,
  throwOnTimeout = true,
  reason = "condition was not ready",
}) {
  const startedAt = Date.now();
  let lastObservation = null;

  while (true) {
    lastObservation = await observe();
    if (await invokePredicate(isReady, page, lastObservation)) {
      return {
        ok: true,
        waitName,
        timeout,
        polling,
        elapsed: Math.max(0, Date.now() - startedAt),
        observation: boundDiagnostic(lastObservation),
      };
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeout) break;
    await waitForDelay(page, Math.min(polling, timeout - elapsed));
  }

  const diagnostic = await createTimeoutDiagnostic(
    page,
    {waitName, timeout, polling, getFocusedState},
    lastObservation,
    startedAt,
    reason
  );
  await attachTimeoutDiagnostics(page, testInfo, diagnostic);

  if (throwOnTimeout) throw new WaitTimeoutError(diagnostic);
  return {ok: false, timedOut: true, ...diagnostic};
}

function getWaitOptions(type, options) {
  const defaults = WAIT_DEFAULTS[type];
  return {
    waitName: options.name || defaults.name,
    timeout: Math.max(0, Number(options.timeout ?? defaults.timeout)),
    polling: Math.max(0, Number(options.polling ?? defaults.polling)),
  };
}

async function waitForFocusState(page, options = {}) {
  const waitOptions = getWaitOptions("focus", options);
  const getFocusedState = options.getFocusedState || defaultFocusedState;
  return pollWait(page, {
    ...waitOptions,
    getFocusedState,
    testInfo: options.testInfo,
    throwOnTimeout: options.throwOnTimeout !== false,
    reason: options.reason || "visible focused state was not observed",
    observe: () => invokeObserver(getFocusedState, page),
    isReady: options.isReady || (({observation}) => Boolean(observation?.visible ?? observation)),
  });
}

async function waitForContentVisible(page, options = {}) {
  const waitOptions = getWaitOptions("content", options);
  const getContentState = options.getContentState || defaultContentState;
  return pollWait(page, {
    ...waitOptions,
    getFocusedState: options.getFocusedState,
    testInfo: options.testInfo,
    throwOnTimeout: options.throwOnTimeout !== false,
    reason: options.reason || "visible content was not observed",
    observe: () => invokeObserver(getContentState, page),
    isReady: options.isReady || (({observation}) => Boolean(observation?.visible ?? observation)),
  });
}

async function waitForPlayerReady(page, options = {}) {
  const waitOptions = getWaitOptions("player", options);
  const getVisiblePopup = options.getVisiblePopup || defaultPopupState;
  const getPlayerState = options.getPlayerState || defaultPlayerState;

  return pollWait(page, {
    ...waitOptions,
    getFocusedState: options.getFocusedState,
    testInfo: options.testInfo,
    throwOnTimeout: options.throwOnTimeout !== false && options.nonThrowing !== true,
    reason: options.reason || "popup remained visible or player state was not healthy",
    observe: async () => {
      const [popup, playerState] = await Promise.all([
        invokeObserver(getVisiblePopup, page),
        invokeObserver(getPlayerState, page),
      ]);
      return {popup: popup || null, playerState: playerState || null};
    },
    isReady:
      options.isReady ||
      (({observation}) => {
        const playerState = observation?.playerState;
        return (
          !observation?.popup &&
          playerState?.hasVideo === true &&
          playerState?.isProbablyPlaying === true
        );
      }),
  });
}

module.exports = {
  WAIT_DEFAULTS,
  WAIT_TIMEOUT_CODE,
  WaitTimeoutError,
  waitForFocusState,
  waitForContentVisible,
  waitForPlayerReady,
};
