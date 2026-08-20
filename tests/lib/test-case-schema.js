const ALLOWED_ACTIONS = new Set([
  "login",
  "open_home",
  "focus_row",
  "focus_row_first_item",
  "focus_text",
  "press_ok",
  "open_service",
  "open_search",
  "search_content",
  "play_content",
  "play_search_result",
  "play_row",
  "play_all_contents",
  "play_home_trailers",
  "assert_screen",
  "press_back",
  "wait_for_ready",
]);

const READY_NAMES = new Set(["app", "home", "content", "player"]);
const PLAY_CONTENT_TYPES = new Set(["channel", "movie", "content"]);
const ACTION_KEYS = {
  login: ["action", "username", "password"],
  open_home: ["action"],
  focus_row: ["action", "rowName", "itemIndex"],
  focus_row_first_item: ["action"],
  focus_text: ["action", "text"],
  press_ok: ["action"],
  open_service: ["action", "service"],
  open_search: ["action"],
  search_content: ["action", "name", "type"],
  play_content: ["action", "name", "type"],
  play_search_result: ["action", "type"],
  play_row: ["action", "rowIndex", "rowName", "count"],
  play_all_contents: ["action", "count", "rowCount"],
  play_home_trailers: ["action"],
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

  if (action.action === "focus_text" && !isNonEmptyString(action.text)) {
    throw new Error(`${path}.text must be a non-empty string`);
  }

  if (action.action === "focus_row" && !isNonEmptyString(action.rowName)) {
    throw new Error(`${path}.rowName must be a non-empty string`);
  }

  if (
    action.action === "focus_row" &&
    hasOwn(action, "itemIndex") &&
    (!Number.isInteger(action.itemIndex) || action.itemIndex < 1)
  ) {
    throw new Error(`${path}.itemIndex must be a positive 1-based integer when provided`);
  }

  if (action.action === "search_content") {
    if (!isNonEmptyString(action.name)) {
      throw new Error(`${path}.name must be a non-empty string`);
    }
    if (!PLAY_CONTENT_TYPES.has(action.type)) {
      throw new Error(`${path}.type must be one of channel, movie, or content`);
    }
  }

  if (action.action === "play_content") {
    if (!isNonEmptyString(action.name)) {
      throw new Error(`${path}.name must be a non-empty string`);
    }
    if (!PLAY_CONTENT_TYPES.has(action.type)) {
      throw new Error(`${path}.type must be one of channel, movie, or content`);
    }
  }

  if (
    action.action === "play_search_result" &&
    hasOwn(action, "type") &&
    !PLAY_CONTENT_TYPES.has(action.type)
  ) {
    throw new Error(`${path}.type must be one of channel, movie, or content`);
  }

  if (action.action === "play_row") {
    const hasRowIndex = hasOwn(action, "rowIndex");
    const hasRowName = hasOwn(action, "rowName");

    if (hasRowIndex === hasRowName) {
      throw new Error(`${path} must define exactly one of rowIndex or rowName`);
    }

    if (
      hasRowIndex &&
      (!Number.isInteger(action.rowIndex) || action.rowIndex < 1)
    ) {
      throw new Error(`${path}.rowIndex must be a positive 1-based integer`);
    }

    if (hasRowName && !isNonEmptyString(action.rowName)) {
      throw new Error(`${path}.rowName must be a non-empty string`);
    }

    if (
      hasOwn(action, "count") &&
      (!Number.isInteger(action.count) || action.count < 1)
    ) {
      throw new Error(`${path}.count must be a positive integer when provided`);
    }
  }

  if (action.action === "play_all_contents") {
    const hasCount = hasOwn(action, "count");
    const hasRowCount = hasOwn(action, "rowCount");

    if (hasCount && hasRowCount) {
      throw new Error(`${path} must define at most one of count or rowCount`);
    }

    if (hasCount && (!Number.isInteger(action.count) || action.count < 1)) {
      throw new Error(`${path}.count must be a positive integer when provided`);
    }

    if (hasRowCount && (!Number.isInteger(action.rowCount) || action.rowCount < 1)) {
      throw new Error(`${path}.rowCount must be a positive integer when provided`);
    }
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

  if (normalized.actions === null) {
    normalized.actions = [];
  } else if (Array.isArray(normalized.actions)) {
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
  const hasActionList = Array.isArray(testCase.actions);
  const hasNullActions = hasActions && testCase.actions === null;
  const hasDescription = hasOwn(testCase, "qaDescription");

  if (hasActions && !hasActionList && !hasNullActions) {
    throw new Error(`${path}.actions must be an array`);
  }

  if ((!hasActionList || testCase.actions.length === 0) && !hasDescription) {
    throw new Error(`${path} ${testCase.id} requires actions or qaDescription`);
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
  if (hasNullActions) {
    normalized.actions = [];
  } else if (hasActionList) {
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
