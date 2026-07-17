const ALLOWED_ACTIONS = new Set([
  "login",
  "open_home",
  "open_service",
  "assert_screen",
  "press_back",
  "wait_for_ready",
]);

const READY_NAMES = new Set(["app", "home", "content", "player"]);
const ACTION_KEYS = {
  login: ["action", "username", "password"],
  open_home: ["action"],
  open_service: ["action", "service"],
  assert_screen: ["action", "text"],
  press_back: ["action", "count"],
  wait_for_ready: ["action", "name"],
};

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAction(action, path = "action") {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error(`${path} must be an object`);
  }

  if (!ALLOWED_ACTIONS.has(action.action)) {
    throw new Error(`${path}: unsupported action "${action.action}"`);
  }

  const unknownKeys = Object.keys(action).filter(
    (key) => !ACTION_KEYS[action.action].includes(key)
  );
  if (unknownKeys.length) {
    throw new Error(`${path}: unknown field "${unknownKeys[0]}"`);
  }

  if (action.action === "login") {
    if (!isNonEmptyString(action.username)) {
      throw new Error(`${path}.username must be a non-empty string`);
    }
    if (!isNonEmptyString(action.password)) {
      throw new Error(`${path}.password must be a non-empty string`);
    }
  }

  if (action.action === "open_service" && !isNonEmptyString(action.service)) {
    throw new Error(`${path}.service must be a non-empty string`);
  }

  if (action.action === "assert_screen" && !isNonEmptyString(action.text)) {
    throw new Error(`${path}.text must be a non-empty string`);
  }

  if (
    action.action === "press_back" &&
    hasOwn(action, "count") &&
    (!Number.isInteger(action.count) || action.count < 0)
  ) {
    throw new Error(`${path}.count must be a non-negative integer`);
  }

  if (
    action.action === "wait_for_ready" &&
    !READY_NAMES.has(action.name)
  ) {
    throw new Error(`${path}.name must be one of app, home, content, or player`);
  }

  return Object.fromEntries(
    ACTION_KEYS[action.action]
      .filter((key) => hasOwn(action, key))
      .map((key) => [key, action[key]])
  );
}

function normalizeTestCase(testCase) {
  const normalized = { ...testCase };

  if (typeof normalized.id === "number") {
    normalized.id = String(normalized.id);
  }

  if (Array.isArray(normalized.actions)) {
    normalized.actions = normalized.actions.map((action, actionIndex) =>
      validateAction(action, `actions[${actionIndex}]`)
    );
  }

  return normalized;
}

function validateTestCase(testCase, index = 0) {
  const path = `testCases[${index}]`;

  if (!testCase || typeof testCase !== "object" || Array.isArray(testCase)) {
    throw new Error(`${path} must be an object`);
  }

  if (
    !hasOwn(testCase, "id") ||
    testCase.id === null ||
    testCase.id === undefined ||
    (typeof testCase.id === "string" && testCase.id.trim() === "") ||
    (typeof testCase.id !== "string" && typeof testCase.id !== "number")
  ) {
    throw new Error(`${path}.id is required`);
  }

  if (!isNonEmptyString(testCase.name)) {
    throw new Error(`${path}.name must be a non-empty string`);
  }

  const hasActions = hasOwn(testCase, "actions");
  const hasDescription = hasOwn(testCase, "qaDescription");

  if ((!hasActions || testCase.actions.length === 0) && !hasDescription) {
    throw new Error(`${path} ${testCase.id} requires actions or qaDescription`);
  }

  if (hasActions && !Array.isArray(testCase.actions)) {
    throw new Error(`${path}.actions must be an array`);
  }

  if (
    hasDescription &&
    !isNonEmptyString(testCase.qaDescription)
  ) {
    throw new Error(`${path}.qaDescription must be a non-empty string`);
  }

  const normalized = { ...testCase };
  if (typeof normalized.id === "number") {
    normalized.id = String(normalized.id);
  }
  if (hasActions) {
    normalized.actions = testCase.actions.map((action, actionIndex) =>
      validateAction(action, `${path}.actions[${actionIndex}]`)
    );
  }

  return normalized;
}

function validateTestCaseList(value, sourceLabel = "test cases") {
  if (!Array.isArray(value)) {
    throw new Error(`${sourceLabel} must be an array`);
  }

  return value.map((testCase, index) => validateTestCase(testCase, index));
}

module.exports = {
  validateTestCaseList,
  validateTestCase,
  validateAction,
  normalizeTestCase,
};
