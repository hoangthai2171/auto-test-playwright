const { compileTestCase } = require("./test-case-compiler");
const { expect } = require("playwright/test");
const workflows = require("./workflows");
const { normalizeVietnameseText } = require("./text-utils");
const { PLAYER_PLAYBACK_WAIT_SECONDS } = require("./playback");
const { captureCurrentAppScreenshot } = require("./artifacts");

const PLAYER_RETURN_DELAY_MS = 2000;

function attachJson(testInfo, name, value) {
  if (!testInfo || typeof testInfo.attach !== "function") return Promise.resolve();

  return testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

function actionName(action) {
  return action.action;
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyExpectedResult(expectedResult) {
  const normalized = normalizeVietnameseText(expectedResult)
    .replace(/[.!?…。！？]+$/u, "")
    .trim();

  if (
    /^(?:play|phat)(?:\s+(?:noi dung|kenh|phim))?\s+(?:binh thuong|thanh cong)$/u.test(
      normalized
    )
  ) {
    return "player";
  }

  if (/^vao man hinh dich vu\s+.+\s+thanh cong$/u.test(normalized)) {
    return "service";
  }

  return "";
}

function visibleScreenTextPredicate(page, expected) {
  return page.evaluate((needle) => {
    const normalizeChar = (value) => value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
    const viewportWidth = window.innerWidth || 1920;
    const viewportHeight = window.innerHeight || 1080;
    const isVisibleChain = (element) => {
      for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      }
      return true;
    };

    const textNodes = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeValue && isVisibleChain(node.parentElement)) nodes.push(node);
      }
      return nodes;
    };

    const normalizeWithMap = (nodes) => {
      const chars = [];
      for (const node of nodes) {
        for (let index = 0; index < node.nodeValue.length; index += 1) {
          const normalized = normalizeChar(node.nodeValue[index]);
          if (!normalized) continue;
          chars.push({value: /\s/u.test(normalized) ? " " : normalized, node, index});
        }
      }

      const compact = [];
      for (const char of chars) {
        if (char.value === " " && compact.at(-1)?.value === " ") {
          compact.at(-1).end = char.index + 1;
          continue;
        }
        compact.push({...char, end: char.index + 1});
      }
      while (compact[0]?.value === " ") compact.shift();
      while (compact.at(-1)?.value === " ") compact.pop();
      return compact;
    };

    const elements = [document.body, ...document.querySelectorAll("body *")];
    for (const element of elements) {
      if (!isVisibleChain(element)) continue;
      const mapped = normalizeWithMap(textNodes(element));
      const text = mapped.map((item) => item.value).join("");
      const startIndex = text.indexOf(needle);
      if (startIndex < 0) continue;
      const start = mapped[startIndex];
      const end = mapped[startIndex + needle.length - 1];
      if (!start || !end) continue;
      const range = document.createRange();
      range.setStart(start.node, start.index);
      range.setEnd(end.node, end.end);
      if (Array.from(range.getClientRects()).some((rect) =>
        rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight
      )) return true;
    }
    return false;
  }, expected).catch(() => false);
}

async function assertVisibleScreenText(page, text, {timeoutMs = 30000, pollIntervalMs = 100} = {}) {
  const expected = normalizeVietnameseText(text);
  await expect
    .poll(() => visibleScreenTextPredicate(page, expected), {timeout: timeoutMs, intervals: [pollIntervalMs]})
    .toBe(true);
}

function createActionRunner({ handlers = {}, stepRunner, afterAction, onActionError }) {
  if (typeof stepRunner !== "function") {
    throw new TypeError("stepRunner must be a function");
  }

  return async function runActionRunner(page, testInfo, testCase, options = {}) {
    const steps = [];
    const result = {
      testCaseId: String(testCase.id),
      name: testCase.name,
      status: "passed",
      source: options.source || "local",
      steps,
      expectedResult: testCase.expectedResult || "",
    };

    await attachJson(testInfo, "test-case.json", testCase);

    let compiledTestCase;
    try {
      compiledTestCase = compileTestCase(testCase);
    } catch (error) {
      const step = {
        index: 0,
        action: "compile",
        status: "failed",
        durationMs: 0,
        message: errorMessage(error),
      };
      result.status = "failed";
      steps.push(step);
      if (error && typeof error === "object") error.testCaseResult = result;
      await attachJson(testInfo, "test-case-result.json", result);
      throw error;
    }

    await attachJson(testInfo, "normalized-actions.json", compiledTestCase.actions);

    for (const action of compiledTestCase.actions) {
      if (typeof handlers[actionName(action)] !== "function") {
        throw new Error(`Missing handler for action "${actionName(action)}"`);
      }
    }

    for (const [index, action] of compiledTestCase.actions.entries()) {
      const label = actionName(action);
      const step = {
        index,
        action: label,
        status: "passed",
        durationMs: 0,
        message: "",
      };
      const startedAt = Date.now();

      try {
        const handlerResult = await stepRunner(page, testInfo, label, () =>
          handlers[label]({ page, testInfo, action, testCase: compiledTestCase, options })
        );
        if (typeof afterAction === "function") {
          await afterAction({
            page,
            testInfo,
            action,
            actionIndex: index,
            testCase: compiledTestCase,
            options,
          });
        }
        if (handlerResult !== undefined) step.result = handlerResult;
        step.durationMs = Date.now() - startedAt;
      } catch (error) {
        if (typeof onActionError === "function") {
          try {
            await onActionError({
              page,
              testInfo,
              action,
              actionIndex: index,
              testCase: compiledTestCase,
              options,
              error,
            });
          } catch (cleanupError) {
            if (error && typeof error === "object") error.playerCleanupError = errorMessage(cleanupError);
          }
        }
        step.status = "failed";
        step.durationMs = Date.now() - startedAt;
        step.message = errorMessage(error);
        if (error?.details !== undefined) step.details = error.details;
        result.status = "failed";
        steps.push(step);
        if (error && typeof error === "object") error.testCaseResult = result;

        try {
          await attachJson(testInfo, "test-case-result.json", result);
        } catch (_attachmentError) {
          // Preserve the action error if reporting is unavailable.
        }

        throw error;
      }

      steps.push(step);
    }

    if (typeof options.postRun === "function") {
      const startedAt = Date.now();
      try {
        const postRunResult = await options.postRun({
          page,
          testInfo,
          testCase: compiledTestCase,
          steps,
          options,
        });
        if (postRunResult !== undefined) {
          const { completionScreenshotDataUrl, ...stepResult } = postRunResult;
          if (completionScreenshotDataUrl) {
            result.completionScreenshotDataUrl = completionScreenshotDataUrl;
          }
          steps.push({
            index: steps.length,
            action: "expected_result",
            status: "passed",
            durationMs: Date.now() - startedAt,
            message: "",
            result: stepResult,
          });
        }
      } catch (error) {
        const step = {
          index: steps.length,
          action: "expected_result",
          status: "failed",
          durationMs: Date.now() - startedAt,
          message: errorMessage(error),
        };
        result.status = "failed";
        if (error?.playerCheckScreenshotDataUrl) {
          result.completionScreenshotDataUrl = error.playerCheckScreenshotDataUrl;
        }
        steps.push(step);
        if (error && typeof error === "object") error.testCaseResult = result;

        try {
          await attachJson(testInfo, "test-case-result.json", result);
        } catch (_attachmentError) {
          // Preserve the expected-result error if reporting is unavailable.
        }

        throw error;
      }
    }

    await attachJson(testInfo, "test-case-result.json", result);
    return result;
  };
}

async function verifyExpectedResult({page, testInfo, testCase, steps, helpers}) {
  const kind = classifyExpectedResult(testCase.expectedResult);
  if (!kind) return undefined;

  if (kind === "player") {
    let playerScreenshotDataUrl = "";
    try {
      await page.waitForTimeout(PLAYER_PLAYBACK_WAIT_SECONDS * 1000);
      await assertPlayerReadyAfterDefaultWait(helpers, page);
      playerScreenshotDataUrl = await capturePlayerCheckScreenshot(page, testInfo);
      await finishPlayerCheck(page, helpers);
      return {
        type: "player",
        verified: "Player is open and playing normally",
        ...(playerScreenshotDataUrl ? {completionScreenshotDataUrl: playerScreenshotDataUrl} : {}),
      };
    } catch (error) {
      playerScreenshotDataUrl ||= await capturePlayerCheckScreenshot(page, testInfo);
      if (playerScreenshotDataUrl && error && typeof error === "object") {
        error.playerCheckScreenshotDataUrl = playerScreenshotDataUrl;
      }
      try {
        await finishPlayerCheck(page, helpers);
      } catch (cleanupError) {
        if (error && typeof error === "object") error.playerCleanupError = errorMessage(cleanupError);
      }
      throw error;
    }
  }

  if (!hasSuccessfulServiceNavigation(testCase, steps)) {
    throw new Error(
      `Expected result requires a completed service navigation path: ${testCase.expectedResult}`
    );
  }

  return {
    type: "service",
    verified: "Service navigation action completed; destination label was not asserted",
  };
}

async function assertPlayerReadyAfterDefaultWait(helpers, page) {
  const [popup, playerState] = await Promise.all([
    helpers.__internal.getVisiblePopup(page),
    helpers.getPlayerState(page),
  ]);

  if (!popup && playerState?.hasVideo === true && playerState?.isProbablyPlaying === true) {
    return;
  }

  const popupText = typeof popup?.text === "string" ? popup.text.trim() : "";
  const playerReason = typeof playerState?.reason === "string" ? playerState.reason.trim() : "";
  const reason = popup
    ? `popup remained visible${popupText ? `: ${popupText}` : ""}`
    : `player state was not healthy${playerReason ? `: ${playerReason}` : ""}`;
  const error = new Error(
    `Player check failed after ${PLAYER_PLAYBACK_WAIT_SECONDS} seconds: ${reason}`
  );
  error.details = {popup: popup || null, playerState: playerState || null};
  throw error;
}

function isPlayerCheckingAction(action) {
  return (
    action?.action === "play_content" ||
    action?.action === "play_search_result" ||
    (action?.action === "wait_for_ready" && action.name === "player")
  );
}

function nextStepRequiresPlayer(testCase, actionIndex) {
  const actions = testCase.actions || [];
  const nextAction = actions[actionIndex + 1];
  if (nextAction?.action === "wait_for_ready" && nextAction.name === "player") return true;
  if (nextAction?.action === "press_back") return true;
  return !nextAction && classifyExpectedResult(testCase.expectedResult) === "player";
}

async function cleanupAfterPlayerAction({page, action, actionIndex, testCase, helpers}) {
  if (!isPlayerCheckingAction(action) || nextStepRequiresPlayer(testCase, actionIndex)) return;
  await returnFromPlayer(page, helpers);
  if (actionIndex === (testCase.actions || []).length - 1) {
    await page.waitForTimeout(PLAYER_RETURN_DELAY_MS);
  }
}

async function cleanupAfterFailedPlayerAction({page, action, helpers, error}) {
  const playerWasChecked =
    action?.action === "wait_for_ready" && action.name === "player" ||
    Boolean(error?.details?.playerState);
  if (!playerWasChecked) return;
  await finishPlayerCheck(page, helpers);
}

async function finishPlayerCheck(page, helpers) {
  await returnFromPlayer(page, helpers);
  await page.waitForTimeout(PLAYER_RETURN_DELAY_MS);
}

async function returnFromPlayer(page, helpers) {
  if (typeof helpers.remotePress === "function") {
    await helpers.remotePress(page, "Backspace");
    return;
  }
  await page.keyboard.press("Backspace");
}

async function capturePlayerCheckScreenshot(page, testInfo) {
  if (typeof page?.screenshot !== "function") return "";
  try {
    return await captureCurrentAppScreenshot(page, testInfo, "expected-player-check");
  } catch {
    return "";
  }
}

function hasSuccessfulServiceNavigation(testCase, steps) {
  const actions = testCase.actions || [];
  const stepPassed = (index) => steps[index]?.status === "passed";

  if (actions.some((action, index) => action.action === "open_service" && stepPassed(index))) {
    return true;
  }

  return actions.some((action, index) => {
    if (action.action !== "press_ok" || !stepPassed(index)) return false;

    const preceding = actions.slice(0, index);
    const rowFocusIndex = preceding.findIndex((candidate) =>
      candidate.action === "focus_row" &&
      normalizeVietnameseText(candidate.rowName || "") === "the loai"
    );
    const serviceFocusIndex = preceding.findIndex((candidate) => candidate.action === "focus_text");

    return rowFocusIndex >= 0 && serviceFocusIndex >= 0 &&
      stepPassed(rowFocusIndex) && stepPassed(serviceFocusIndex);
  });
}

async function resolveReadyWait(helpers, page, testInfo, name) {
  switch (name) {
    case "app":
      return workflows.__internal.waitForAppReady(page, testInfo);
    case "home":
      return workflows.__internal.waitForHomeReady(page, testInfo);
    case "content":
      return helpers.waitForContentVisible(page, {
        name: "action-content-ready",
        testInfo,
        getContentState: workflows.__internal.observeVisibleContentRows,
        getFocusedState: helpers.getFocusedState,
      });
    case "player":
      return helpers.waitForPlayerReady(page, {
        name: "action-player-ready",
        testInfo,
        getVisiblePopup: helpers.__internal.getVisiblePopup,
        getPlayerState: helpers.getPlayerState,
      });
    default:
      throw new Error(`Unsupported readiness target: ${name}`);
  }
}

function createDefaultActionHandlers({ helpers }) {
  return {
    login: async ({ page, testInfo, action, options }) => {
      const account = {
        ...options,
        USERNAME: action.username,
        PASSWORD: action.password,
      };
      await helpers.openAppAndEnterLoginPage(page, account, testInfo);
      await helpers.loginWithAccount(page, account, testInfo);
      await helpers.chooseFirstProfileAndEnterHome(page, testInfo);
      await helpers.closeHomePopupsAndVerifyHome(page, testInfo);
    },
    open_home: ({ page, testInfo }) =>
      workflows.__internal.waitForHomeReady(page, testInfo),
    focus_row: ({ page, action }) =>
      helpers.focusRequestedContentRow(page, {
        rowName: action.rowName,
        ...(action.itemIndex ? {itemIndex: action.itemIndex} : {}),
      }),
    focus_row_first_item: ({ page }) =>
      helpers.focusFirstItemInCurrentContentRow(page),
    focus_text: ({ page, action }) =>
      helpers.remoteFocusByText(
        page,
        new RegExp(`^\\s*${escapeRegExp(action.text.trim())}\\s*$`, "iu")
      ),
    press_ok: ({ page }) => helpers.remotePress(page, "Enter"),
    open_service: async ({ page, testInfo, action }) => {
      const serviceName = String(action.service || "").trim();
      try {
        return await helpers.openServiceFromLeftMenuOrAllServices(
          page,
          serviceName,
          testInfo
        );
      } catch (error) {
        const serviceError = new Error(`Không thể tìm thấy dịch vụ ${serviceName}`);
        serviceError.cause = error;
        throw serviceError;
      }
    },
    open_search: ({ page, testInfo }) =>
      helpers.openSearchFromLeftMenu(page, testInfo),
    search_content: ({ page, testInfo, action }) =>
      helpers.searchContentByName(
        page,
        {name: action.name, type: action.type},
        testInfo
      ),
    play_content: ({ page, testInfo, action }) =>
      helpers.playVisibleContentByName(page, testInfo, {
        name: action.name,
        type: action.type,
      }),
    play_search_result: ({ page, testInfo, action }) =>
      helpers.playFocusedSearchResult(page, testInfo, {type: action.type}),
    play_row: ({ page, testInfo, action }) =>
      helpers.playItemsInRow(page, testInfo, {
        rowIndex: action.rowIndex,
        rowName: action.rowName,
        count: action.count,
      }),
    press_back: async ({ page, action }) => {
      for (let index = 0; index < (action.count ?? 1); index += 1) {
        await page.keyboard.press("Backspace");
      }
    },
    assert_screen: async ({ page, action }) => {
      await assertVisibleScreenText(page, action.text);
    },
    wait_for_ready: ({ page, testInfo, action }) =>
      resolveReadyWait(helpers, page, testInfo, action.name),
  };
}

async function runTestCase(page, testInfo, testCase, options = {}) {
  const helpers = options.helpers || require("./mytv-helpers");
  const handlers = options.handlers || createDefaultActionHandlers({ helpers });
  const stepRunner = options.stepRunner || helpers.runStep;

  return createActionRunner({
    handlers,
    stepRunner,
    afterAction: (context) => cleanupAfterPlayerAction({...context, helpers}),
    onActionError: (context) => cleanupAfterFailedPlayerAction({...context, helpers}),
  })(
    page,
    testInfo,
    testCase,
    {
      ...options,
      postRun: ({page: runPage, testInfo: runTestInfo, testCase: compiledTestCase, steps}) =>
        verifyExpectedResult({
          page: runPage,
          testInfo: runTestInfo,
          testCase: compiledTestCase,
          steps,
          helpers,
        }),
    }
  );
}

module.exports = {
  createActionRunner,
  createDefaultActionHandlers,
  runTestCase,
  assertVisibleScreenText,
  classifyExpectedResult,
  hasSuccessfulServiceNavigation,
  verifyExpectedResult,
  isPlayerCheckingAction,
  nextStepRequiresPlayer,
};
