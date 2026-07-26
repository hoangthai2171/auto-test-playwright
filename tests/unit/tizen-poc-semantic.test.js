const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseSemanticRequest,
  selectBestSearchResult,
  assessPlayback,
  leavePlayerAfterAssessment,
  runSemanticSearchPlayback,
  waitForProfileOrHome,
} = require("../../scripts/real-tv-appium/tizen-poc-semantic");

test("Samsung semantic POC requires a complete dedicated-account request", () => {
  assert.equal(parseSemanticRequest({}), null);
  assert.throws(
    () => parseSemanticRequest({ "search-name": "VTV1" }),
    /search-name.*content-type/i
  );
  assert.throws(
    () => parseSemanticRequest({ "search-name": "VTV1", "content-type": "channel" }),
    /login-from-env.*verify-logout/i
  );
  assert.throws(
    () => parseSemanticRequest({
      "search-name": "VTV1",
      "content-type": "channel",
      "login-from-env": true,
      "verify-logout": true,
    }),
    /skip-screenshot-gate/i
  );
  assert.deepEqual(
    parseSemanticRequest({
      "search-name": "VTV1",
      "content-type": "channel",
      "login-from-env": true,
      "verify-logout": true,
      "skip-screenshot-gate": true,
    }),
    { name: "VTV1", type: "channel" }
  );
});

test("Samsung semantic POC prefers the matching visible result", () => {
  const result = selectBestSearchResult(
    [
      { id: "searchRow_0_1", visible: true, type: "movie", label: "Tin tức" },
      { id: "searchRow_0_0", visible: true, type: "channel", label: "VTV1 HD" },
      { id: "searchRow_1_0", visible: false, type: "channel", label: "VTV1" },
    ],
    { name: "VTV1", type: "channel" }
  );

  assert.equal(result.id, "searchRow_0_0");
});

test("Samsung semantic POC accepts advancing visible video without a popup", () => {
  const assessment = assessPlayback(
    { hasVideo: true, currentTime: 12, paused: false, ended: false, readyState: 4, width: 1920, height: 1080 },
    { hasVideo: true, currentTime: 18.5, paused: false, ended: false, readyState: 4, width: 1920, height: 1080 },
    ""
  );

  assert.equal(assessment.passed, true);
  assert.equal(assessment.timeAdvanced, true);
});

test("Samsung semantic POC activates its selected result before DOM-only playback assessment", async () => {
  const operations = [];
  const result = await runSemanticSearchPlayback({
    request: { name: "VTV1", type: "channel" },
    searchSettleMs: 0,
    playbackStartMs: 0,
    playbackWaitMs: 0,
    driver: {
      async enterHome() { operations.push("home"); },
      async openSearch() { operations.push("search"); },
      async enterSearch(value) { operations.push(["query", value]); },
      async wait(ms) { operations.push(["wait", ms]); },
      async readSearchCandidates() {
        return [{ id: "searchRow_0_0", visible: true, type: "channel", label: "VTV1 HD" }];
      },
      async focusResult(id) { operations.push(["focus", id]); },
      async activateFocusedResult() { operations.push("activate"); },
      async readPlayerState() {
        return { hasVideo: true, currentTime: 1, paused: false, ended: false, readyState: 4, width: 1920, height: 1080 };
      },
      async readPopupText() { return ""; },
    },
  });

  assert.equal(result.searchResult.id, "searchRow_0_0");
  assert.equal(result.player.passed, true);
  assert.deepEqual(operations.slice(0, 6), [
    "home",
    "search",
    ["query", "VTV1"],
    ["wait", 0],
    ["focus", "searchRow_0_0"],
    "activate",
  ]);
});

test("Samsung semantic POC exposes a real-remote player exit after its assessment", async () => {
  const operations = [];
  const result = await runSemanticSearchPlayback({
    request: {name: "VTV1", type: "channel"},
    searchSettleMs: 0,
    playbackStartMs: 0,
    playbackWaitMs: 0,
    driver: {
      async enterHome() {},
      async openSearch() {},
      async enterSearch() {},
      async wait() {},
      async readSearchCandidates() {
        return [{id: "searchRow_0_0", visible: true, type: "channel", label: "VTV1 HD"}];
      },
      async focusResult() {},
      async activateFocusedResult() {},
      async exitPlayer() { operations.push("back"); },
      async readPlayerState() {
        return {hasVideo: true, currentTime: 1, paused: false, ended: false, readyState: 4, width: 1920, height: 1080};
      },
      async readPopupText() { return ""; },
    },
  });

  await result.exitPlayer();
  assert.deepEqual(operations, ["back"]);
});

test("Samsung semantic POC waits for player-session unload after the real Back key", async () => {
  const operations = [];
  await leavePlayerAfterAssessment({
    semantic: {async exitPlayer() { operations.push("back"); }},
    wait: async (timeoutMs) => operations.push(["wait", timeoutMs]),
  });

  assert.deepEqual(operations, ["back", ["wait", 2_000]]);
});

test("Samsung semantic POC waits for asynchronous profile selection before home navigation", async () => {
  const states = ["", "profile"];
  const waits = [];

  const result = await waitForProfileOrHome({
    readState: async () => states.shift() || "",
    wait: async (timeoutMs) => waits.push(timeoutMs),
    timeoutMs: 1_000,
    pollMs: 0,
  });

  assert.equal(result, "profile");
  assert.deepEqual(waits, [0]);
});
