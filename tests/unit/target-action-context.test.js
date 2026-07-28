const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TargetActionError,
  createTargetActionContext,
  requireActionCapabilities,
} = require("../lib/target-action-context");

test("creates an immutable target action context without runtime connection data", () => {
  const session = {pressKey() {}};
  const context = createTargetActionContext({
    session,
    testInfo: {title: "fake"},
    helpers: {trusted: true},
    capabilities: {domInspection: true, visualCapture: false},
  });

  assert.equal(context.session, session);
  assert.deepEqual(context.capabilities, {domInspection: true, visualCapture: false});
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.capabilities), true);
  assert.equal(Object.hasOwn(context, "host"), false);
});

test("rejects an unsupported action before execution with case and action context", () => {
  const context = createTargetActionContext({
    session: {},
    capabilities: {domInspection: true},
  });

  assert.throws(
    () => requireActionCapabilities(context, {action: "play_content"}, {caseId: "case-7", actionIndex: 3, required: ["playerInspection"]}),
    (error) => error instanceof TargetActionError
      && error.code === "ACTION_CAPABILITY_UNSUPPORTED"
      && error.caseId === "case-7"
      && error.actionIndex === 3
      && /case-7.*3.*play_content/i.test(error.message),
  );
});
