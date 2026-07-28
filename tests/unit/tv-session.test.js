const test = require("node:test");
const assert = require("node:assert/strict");

const {TV_CAPABILITIES, normalizeRemoteKey, TvSessionError} = require("../lib/tv-session/tv-session");
const {normalizeDomState} = require("../lib/tv-session/dom-state");

test("normalizes supported TV remote keys and rejects unsupported keys", () => {
  assert.equal(normalizeRemoteKey("Enter"), "ok");
  assert.equal(normalizeRemoteKey("ArrowRight"), "right");
  assert.throws(() => normalizeRemoteKey("Space"), /Unsupported TV remote key/);
  assert.equal(TV_CAPABILITIES.DOM_INSPECTION, "domInspection");
  assert.equal(TV_CAPABILITIES.VISUAL_CAPTURE, "visualCapture");
});

test("attaches platform and model context to TV session errors", () => {
  const error = new TvSessionError(
    "VISUAL_CAPTURE_UNAVAILABLE",
    "No genuine screenshot route.",
    {platform: "lg", model: "OLED"}
  );

  assert.equal(error.code, "VISUAL_CAPTURE_UNAVAILABLE");
  assert.equal(error.platform, "lg");
  assert.equal(error.model, "OLED");
  assert.match(error.message, /lg.*OLED/i);
});

test("normalizes, redacts, and bounds DOM state", () => {
  const state = normalizeDomState(
    {
      bodyText: `password=secret token: bearer-token ${"b".repeat(12_500)}`,
      focused: "secret",
      active: undefined,
      screenUrl: "http://example/",
      authorization: "Basic secret",
      cookie: "session=secret",
      pairingKey: "secret",
      metadata: "x".repeat(2_001),
    },
    {secrets: ["secret", "bearer-token"]}
  );

  assert.doesNotMatch(JSON.stringify(state), /secret|bearer-token/i);
  assert.equal(state.active, "");
  assert.equal(state.screenUrl, "http://example/");
  assert.equal(state.bodyText.length, 12_000);
  assert.equal(state.metadata.length, 2_000);
  assert.equal(state.authorization, "••••••");
  assert.equal(state.cookie, "••••••");
  assert.equal(state.pairingKey, "••••••");
});
