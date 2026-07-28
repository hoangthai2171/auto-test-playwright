"use strict";

class TargetActionError extends Error {
  constructor(code, message, {caseId, actionIndex, action} = {}) {
    super(message);
    this.name = "TargetActionError";
    this.code = code;
    this.caseId = caseId;
    this.actionIndex = actionIndex;
    this.action = action;
  }
}

function objectOrEmpty(value, name) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object when supplied.`);
  }
  return value;
}

function createTargetActionContext({session, testInfo, helpers, capabilities} = {}) {
  if (!session || typeof session !== "object") throw new TypeError("session is required.");
  return Object.freeze({
    session,
    testInfo,
    helpers,
    capabilities: Object.freeze({...objectOrEmpty(capabilities, "capabilities")}),
  });
}

function requireActionCapabilities(context, action, {caseId, actionIndex, required = []} = {}) {
  if (!context || typeof context !== "object") throw new TypeError("target action context is required.");
  if (!action || typeof action.action !== "string" || !action.action) throw new TypeError("a named action is required.");
  if (!Array.isArray(required) || required.some((capability) => typeof capability !== "string" || !capability)) {
    throw new TypeError("required capabilities must be named strings.");
  }
  const missing = required.filter((capability) => context.capabilities?.[capability] !== true);
  if (!missing.length) return;
  throw new TargetActionError(
    "ACTION_CAPABILITY_UNSUPPORTED",
    `Case ${String(caseId)} action ${String(actionIndex)} (${action.action}) requires unavailable capabilities: ${missing.join(", ")}.`,
    {caseId: String(caseId), actionIndex, action: action.action},
  );
}

module.exports = {TargetActionError, createTargetActionContext, requireActionCapabilities};
