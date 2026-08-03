const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createHomeTrailersApi,
  observeHomeTrailerState,
  observeHomeExitConfirmation,
} = require("../lib/home-trailers");

function state(name, signature, nextAvailable = true) {
  return {
    available: true,
    name,
    signature,
    next: {
      exists: true,
      visible: true,
      disabled: !nextAvailable,
      available: nextAvailable,
    },
  };
}

function createFakeRun({
  playbackResults,
  transitions,
  initialState,
  albumDetailStates = [],
  transitionResponses = null,
  homeBoundaryBehaviors = [],
}) {
  const events = [];
  const attachments = [];
  const reports = [];
  let playbackIndex = 0;
  let transitionIndex = 0;
  let albumDetailIndex = 0;
  let homeReadyCount = 0;
  let trailerAttemptIndex = -1;
  let currentBackPresses = 0;

  function currentHomeBehavior() {
    return homeBoundaryBehaviors[trailerAttemptIndex] || {requiredBackPresses: 1};
  }

  function homeObservation() {
    const requiredBackPresses = Math.max(1, Number(currentHomeBehavior().requiredBackPresses || 1));
    const ready = currentBackPresses >= requiredBackPresses;
    return {
      route: ready,
      menu: ready,
      content: ready,
      focused: ready ? {rect: {width: 10, height: 10}, id: "home-focus"} : null,
    };
  }

  const testInfo = {
    attach: async (name, value) => attachments.push({name, value}),
  };
  const api = createHomeTrailersApi({
    waitForHomeReady: async () => {
      homeReadyCount += 1;
      events.push(["home-ready", homeReadyCount]);
    },
    observeHomeReadyState: async () => homeObservation(),
    observeHomeExitConfirmation: async () => {
      const behavior = currentHomeBehavior();
      const visible = behavior.exitAfterBack != null &&
        Number(behavior.exitAfterBack) === currentBackPresses;
      return {
        visible,
        kind: visible ? "exit_confirmation" : "none",
        dialogId: visible ? "dialog_confirm_v2" : "",
        text: visible ? "Bạn có muốn thoát khỏi ứng dụng?" : "",
        unexpectedVisible: false,
      };
    },
    observeHomeTrailerState: async () => initialState,
    observeAlbumDetailState: async () => albumDetailStates[albumDetailIndex++] || {ok: false},
    waitForTrailerStateChange: async (_page, previousState) => {
      events.push(["wait-next", previousState.signature]);
      const response = transitionResponses
        ? transitionResponses[transitionIndex++]
        : transitions[transitionIndex++];
      if (response instanceof Error) throw response;
      return response;
    },
    remoteFocusById: async (_page, id, maxMoves) => {
      events.push(["focus-id", id, maxMoves]);
    },
    remoteFocusByText: async (_page, pattern, maxMoves) => {
      trailerAttemptIndex += 1;
      currentBackPresses = 0;
      events.push(["focus", pattern.source, maxMoves]);
    },
    remotePress: async (_page, key) => {
      if (key === "Backspace") currentBackPresses += 1;
      events.push(["press", key]);
    },
    inspectPlaybackAfterWait: async (_page, waitSeconds) => {
      events.push(["inspect", waitSeconds]);
      return playbackResults[playbackIndex++];
    },
    captureCurrentAppScreenshot: async (_page, _testInfo, prefix) => {
      events.push(["screenshot", prefix]);
      return `data:image/png;base64,${prefix}`;
    },
    attachPlaybackBatchReport: async (_testInfo, results, options) => {
      reports.push({results, options});
    },
    safeArtifactName: (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact",
  });

  return {api, testInfo, events, attachments, reports, page: {waitForTimeout: async () => {}}};
}

test("reads a hidden trailer-name anchor from the visible promo title container", async () => {
  const nestedTitle = {
    textContent: "Trailer A",
    getBoundingClientRect: () => ({width: 0, height: 0, bottom: 0, right: 0}),
    getAttribute: () => null,
    hasAttribute: () => false,
    className: "",
    querySelectorAll: () => [],
  };
  const titleRoot = {
    textContent: "Trailer A",
    getBoundingClientRect: () => ({width: 320, height: 40, bottom: 40, right: 320}),
    getAttribute: () => null,
    hasAttribute: () => false,
    className: "movie-title",
    querySelector: (selector) => selector === "#trailer-name" ? nestedTitle : null,
    querySelectorAll: () => [],
  };
  const next = {
    textContent: "",
    getBoundingClientRect: () => ({width: 22, height: 22, bottom: 22, right: 22}),
    getAttribute: () => null,
    hasAttribute: () => false,
    className: "trailer-video-step next",
  };
  const previousDocument = global.document;
  const previousGetComputedStyle = global.getComputedStyle;
  global.document = {
    querySelector: (selector) => {
      if (selector === "#promo-video-next") return next;
      if (selector === "#promo-video-title") return titleRoot;
      if (selector === "#trailer-name") return nestedTitle;
      return null;
    },
  };
  global.getComputedStyle = (element) => ({
    display: element === nestedTitle ? "none" : "block",
    visibility: "visible",
    opacity: "1",
    backgroundImage: "none",
  });

  try {
    const state = await observeHomeTrailerState({
      evaluate: async (evaluateFn, selectors) => evaluateFn(selectors),
    });
    assert.equal(state.available, true);
    assert.equal(state.name, "Trailer A");
    assert.equal(state.titleSelector, "#promo-video-title #trailer-name");
    assert.equal(state.next.available, true);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    if (previousGetComputedStyle === undefined) delete global.getComputedStyle;
    else global.getComputedStyle = previousGetComputedStyle;
  }
});

test("recognizes the fixed exit-confirmation dialog roots", async () => {
  const dialog = {
    id: "dialog_confirm_v2",
    textContent: "Bạn có muốn thoát khỏi ứng dụng?",
    getBoundingClientRect: () => ({width: 400, height: 160, bottom: 160, right: 400}),
    getAttribute: () => null,
    querySelectorAll: () => [],
  };
  const previousDocument = global.document;
  const previousGetComputedStyle = global.getComputedStyle;
  global.document = {
    getElementById: (id) => id === dialog.id ? dialog : null,
  };
  global.getComputedStyle = () => ({display: "block", visibility: "visible", opacity: "1"});

  try {
    const popup = await observeHomeExitConfirmation({
      evaluate: async (evaluateFn) => evaluateFn(),
    });
    assert.equal(popup.visible, true);
    assert.equal(popup.kind, "exit_confirmation");
    assert.equal(popup.dialogId, "dialog_confirm_v2");
    assert.match(popup.text, /thoát/i);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    if (previousGetComputedStyle === undefined) delete global.getComputedStyle;
    else global.getComputedStyle = previousGetComputedStyle;
  }
});

test("plays distinct Home trailers with remote Enter/Back and stops at the carousel end", async () => {
  const trailerA = state("Trailer A", "A", true);
  const trailerB = state("Trailer B", "B", false);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [{ok: true, playerState: {hasVideo: true}}, {ok: true, playerState: {hasVideo: true}}],
    transitions: [
      {kind: "changed", state: trailerB},
      {kind: "exhausted", state: trailerB},
    ],
  });

  const result = await fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {waitSeconds: 1});

  assert.equal(result.stopReason, "carousel-exhausted");
  assert.deepEqual(result.results.map((item) => [item.name, item.status]), [
    ["Trailer A", "playable"],
    ["Trailer B", "playable"],
  ]);
  assert.ok(result.results.every((item) => item.screenshotDataUrl.startsWith("data:image/png;base64,")));
  assert.deepEqual(fake.events.filter(([type]) => type === "press").map(([, key]) => key), [
    "Enter",
    "Backspace",
    "Enter",
    "Backspace",
  ]);
  assert.equal(fake.reports.length, 1);
  assert.equal(fake.reports[0].results.length, 2);
});

test("sends a second Back only when the first Back did not reach Home", async () => {
  const trailerA = state("Two-step trailer", "two-step", false);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [{ok: true}],
    transitions: [{kind: "exhausted", state: trailerA}],
    homeBoundaryBehaviors: [{requiredBackPresses: 2}],
  });

  const result = await fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {
    waitSeconds: 0,
    homeBoundaryTimeoutMs: 0,
  });

  assert.equal(result.results[0].status, "playable");
  assert.deepEqual(fake.events.filter(([type, key]) => type === "press" && key === "Backspace"), [
    ["press", "Backspace"],
    ["press", "Backspace"],
  ]);
});

test("dismisses an exit confirmation after Home without another close Back", async () => {
  const trailerA = state("Popup trailer", "popup", false);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [{ok: true}],
    transitions: [{kind: "exhausted", state: trailerA}],
    homeBoundaryBehaviors: [{requiredBackPresses: 1, exitAfterBack: 1}],
  });

  const result = await fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {waitSeconds: 0});

  assert.equal(result.results[0].status, "playable");
  assert.deepEqual(fake.events.filter(([type, key]) => type === "press" && key === "Backspace"), [
    ["press", "Backspace"],
    ["press", "Backspace"],
  ]);
  assert.equal(fake.events.filter(([type, key]) => type === "press" && key === "Backspace").length, 2);
});

test("stops on a repeated trailer identity after testing each distinct trailer", async () => {
  const trailerA = state("Trailer A", "A", true);
  const trailerB = state("Trailer B", "B", true);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [{ok: true}, {ok: true}],
    transitions: [
      {kind: "changed", state: trailerB},
      {kind: "changed", state: trailerA},
    ],
  });

  const result = await fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {waitSeconds: 0});

  assert.equal(result.stopReason, "carousel-cycled");
  assert.deepEqual(result.results.map((item) => item.name), ["Trailer A", "Trailer B"]);
});

test("uses the trusted next control when Home does not auto-advance", async () => {
  const trailerA = state("Trailer A", "A", true);
  const trailerB = state("Trailer B", "B", false);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [{ok: true}, {ok: true}],
    transitions: [],
    transitionResponses: [
      new Error("Home trailer did not advance after returning Home within 30000ms"),
      {kind: "changed", state: trailerB},
      {kind: "exhausted", state: trailerB},
    ],
  });

  const result = await fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {waitSeconds: 0});

  assert.equal(result.stopReason, "carousel-exhausted");
  assert.deepEqual(result.results.map((item) => item.name), ["Trailer A", "Trailer B"]);
  assert.deepEqual(fake.events.filter(([type]) => type === "focus-id"), [["focus-id", "promo-video-next", 60]]);
  assert.deepEqual(fake.events.filter(([type]) => type === "press").map(([, key]) => key), [
    "Enter",
    "Backspace",
    "Enter",
    "Enter",
    "Backspace",
  ]);
});

test("retains player-check screenshots and continues after a failed trailer", async () => {
  const trailerA = state("Trailer A", "A", true);
  const trailerB = state("Trailer B", "B", false);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [
      {ok: false, popup: {text: "Video did not start"}, playerState: {hasVideo: false, reason: "No video"}},
      {ok: true, playerState: {hasVideo: true}},
    ],
    transitions: [
      {kind: "changed", state: trailerB},
      {kind: "exhausted", state: trailerB},
    ],
  });

  await assert.rejects(
    () => fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {waitSeconds: 0}),
    (error) => {
      assert.equal(error.details.results.length, 2);
      assert.equal(error.details.results[0].name, "Trailer A");
      assert.equal(error.details.results[0].status, "failed");
      assert.match(error.details.results[0].screenshotDataUrl, /Trailer A/);
      assert.equal(error.details.results[1].status, "playable");
      return /failed to open a player or Album detail screen/i.test(error.message);
    }
  );
  assert.equal(fake.reports[0].results.length, 2);
});

test("treats a visible Album detail content list as a successful trailer activation", async () => {
  const trailerA = state("Album trailer", "album-a", false);
  const fake = createFakeRun({
    initialState: trailerA,
    playbackResults: [{ok: false, popup: {text: "No player"}, playerState: {hasVideo: false, reason: "No video"}}],
    albumDetailStates: [{
      ok: true,
      kind: "album_detail",
      routeValue: "albumDetail",
      promoVisible: false,
      visibleCount: 4,
      rowCount: 1,
    }],
    transitions: [{kind: "exhausted", state: trailerA}],
  });

  const result = await fake.api.playAllHomeTrailers(fake.page, fake.testInfo, {waitSeconds: 0});

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].status, "album_opened");
  assert.equal(result.results[0].activationType, "album_detail");
  assert.equal(result.results[0].errorPopup, "");
  assert.equal(result.results[0].albumDetailState.visibleCount, 4);
  assert.match(result.results[0].screenshot, /album-detail-check/);
  assert.match(result.results[0].screenshotDataUrl, /Album trailer/);
});

test("fails closed when Home has no identifiable trailer", async () => {
  const fake = createFakeRun({
    initialState: {available: false, name: "", signature: "", next: {available: false}},
    playbackResults: [],
    transitions: [],
  });

  await assert.rejects(
    () => fake.api.playAllHomeTrailers(fake.page, fake.testInfo),
    (error) => error.details.results.length === 0 && /No identifiable Home trailer/i.test(error.message)
  );
  assert.equal(fake.reports[0].results.length, 0);
});
