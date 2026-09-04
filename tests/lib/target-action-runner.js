"use strict";

const {compileTestCase} = require("./test-case-compiler");
const {requireActionCapabilities} = require("./target-action-context");
const {createTvMyTvActionHandlers} = require("./tv-mytv-actions");

const ACTION_CAPABILITIES = Object.freeze({
  wait_for_ready: ["domInspection"],
  press_ok: [],
  press_back: [],
  assert_screen: ["domInspection"],
  login: ["targetSemanticActions"],
  open_home: ["targetSemanticActions"],
  focus_row: ["targetSemanticActions"],
  focus_row_first_item: ["targetSemanticActions"],
  focus_text: ["targetSemanticActions"],
  open_service: ["targetSemanticActions"],
  open_search: ["targetSemanticActions"],
  search_content: ["targetSemanticActions"],
  play_content: ["targetSemanticActions", "playerInspection"],
  play_search_result: ["targetSemanticActions", "playerInspection"],
  play_row: ["targetSemanticActions", "playerInspection"],
  play_all_contents: ["browserListPlayback"],
  play_home_trailers: ["browserHomeTrailers"],
  player_seek: ["browserPlayerControl"],
  player_toggle_play: ["browserPlayerControl"],
  player_focus_related: ["browserPlayerControl"],
  player_open_episodes: ["browserPlayerControl"],
  player_focus_episode: ["browserPlayerControl"],
});

function validateTargetCaseCapabilities(testCase, capabilities = {}) {
  const compiledTestCase = compileTestCase(testCase);
  const context = {capabilities: Object.freeze({...capabilities})};
  compiledTestCase.actions.forEach((action, actionIndex) => {
    requireActionCapabilities(context, action, {
      caseId: String(compiledTestCase.id),
      actionIndex,
      required: ACTION_CAPABILITIES[action.action] || ["targetSemanticActions"],
    });
  });
  return compiledTestCase;
}

function createTargetActionHandlers(context) {
  return {
    wait_for_ready: ({action}) => {
      if (typeof context.helpers?.waitForReady !== "function") throw new Error("Target waitForReady helper is unavailable.");
      return context.helpers.waitForReady(context.session, action.name);
    },
    press_ok: () => context.session.press("Enter"),
    press_back: async ({action}) => {
      for (let index = 0; index < (action.count ?? 1); index += 1) await context.session.press("Backspace");
    },
    assert_screen: async ({action}) => {
      if (await context.session.hasVisibleText(action.text)) return;
      throw new Error(`Expected visible screen text was not found: ${action.text}`);
    },
    ...createTvMyTvActionHandlers({semantic: context.helpers?.semantic}),
  };
}

async function notifyStep(observer, event) {
  if (typeof observer !== "function") return;
  try {
    await observer(event);
  } catch {
    // Status observers are informational and cannot alter trusted execution.
  }
}

async function runTargetActions(context, testCase, {handlers = createTargetActionHandlers(context), source = "tv", onStep} = {}) {
  const compiledTestCase = compileTestCase(testCase);
  const result = {
    testCaseId: String(compiledTestCase.id),
    name: compiledTestCase.name,
    status: "passed",
    source,
    steps: [],
    expectedResult: compiledTestCase.expectedResult || "",
  };

  for (const [actionIndex, action] of compiledTestCase.actions.entries()) {
    requireActionCapabilities(context, action, {
      caseId: result.testCaseId,
      actionIndex,
      required: ACTION_CAPABILITIES[action.action] || ["targetSemanticActions"],
    });
    const handler = handlers[action.action];
    if (typeof handler !== "function") throw new Error(`Missing target handler for action \"${action.action}\".`);
    const step = {index: actionIndex, action: action.action, status: "passed", durationMs: 0, message: ""};
    const startedAt = Date.now();
    try {
      const handlerResult = await handler({context, action, actionIndex, testCase: compiledTestCase});
      if (handlerResult !== undefined) step.result = handlerResult;
      step.durationMs = Date.now() - startedAt;
      result.steps.push(step);
      await notifyStep(onStep, {status: "passed", actionIndex, action: action.action});
    } catch (error) {
      step.status = "failed";
      step.durationMs = Date.now() - startedAt;
      step.message = error?.message || String(error);
      if (error?.details !== undefined) step.details = error.details;
      result.status = "failed";
      result.steps.push(step);
      await notifyStep(onStep, {status: "failed", actionIndex, action: action.action});
      if (error && typeof error === "object") error.testCaseResult = result;
      throw error;
    }
  }
  return result;
}

module.exports = {ACTION_CAPABILITIES, createTargetActionHandlers, runTargetActions, validateTargetCaseCapabilities};
