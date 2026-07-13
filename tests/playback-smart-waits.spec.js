const {test, expect} = require("playwright/test");
const playback = require("./lib/playback");
const {WAIT_DEFAULTS, waitForPlayerReady} = require("./lib/waits");

function createPlaybackStub(states) {
  let index = 0;
  const waits = [];
  const page = {
    url: () => "https://synthetic.test/player#playback",
    waitForTimeout: async (milliseconds) => waits.push(milliseconds),
    screenshot: async () => Buffer.from("synthetic-png"),
  };

  return {
    page,
    waits,
    getVisiblePopup: async () => states[Math.min(index, states.length - 1)].popup,
    getPlayerState: async () => {
      const state = states[Math.min(index, states.length - 1)].playerState;
      index += 1;
      return state;
    },
  };
}

test("player readiness tolerates a transient popup before healthy playback", async () => {
  const stub = createPlaybackStub([
    {popup: {text: "Đang tải"}, playerState: {hasVideo: true, isProbablyPlaying: false}},
    {popup: null, playerState: {hasVideo: true, isProbablyPlaying: false}},
    {popup: null, playerState: {hasVideo: true, isProbablyPlaying: true}},
  ]);

  const result = await playback.waitForPlayerReady(stub.page, {
    timeout: 50,
    polling: 1,
    getVisiblePopup: stub.getVisiblePopup,
    getPlayerState: stub.getPlayerState,
  });

  expect(result.ok).toBe(true);
  expect(result.observation.popup).toBeNull();
  expect(result.observation.playerState.isProbablyPlaying).toBe(true);
});

test("persistent popup produces a failed non-throwing inspection with final popup text", async () => {
  const stub = createPlaybackStub([
    {popup: {text: "Không thể phát nội dung"}, playerState: {hasVideo: false, isProbablyPlaying: false}},
  ]);

  const result = await playback.inspectPlaybackAfterWait(stub.page, 0, {
    timeout: 10,
    polling: 1,
    getVisiblePopup: stub.getVisiblePopup,
    getPlayerState: stub.getPlayerState,
  });

  expect(result.ok).toBe(false);
  expect(result.popup.text).toBe("Không thể phát nội dung");
  expect(result.waitResult.timedOut).toBe(true);
});

test("missing video times out with bounded player diagnostics", async () => {
  const stub = createPlaybackStub([
    {popup: null, playerState: {hasVideo: false, isProbablyPlaying: false, reason: "No video element found"}},
  ]);

  const result = await playback.inspectPlaybackAfterWait(stub.page, 0, {
    timeout: 10,
    polling: 1,
    getVisiblePopup: stub.getVisiblePopup,
    getPlayerState: stub.getPlayerState,
  });

  expect(result.ok).toBe(false);
  expect(result.popup).toBeNull();
  expect(result.playerState.reason).toBe("No video element found");
  expect(result.waitResult.lastObservation.playerState.hasVideo).toBe(false);
});

test("paused and not-enough-data players remain failed until the bounded timeout", async () => {
  for (const playerState of [
    {hasVideo: true, isProbablyPlaying: false, reason: "Video element is paused"},
    {hasVideo: true, isProbablyPlaying: false, reason: "Video does not have enough data: readyState=2"},
  ]) {
    const stub = createPlaybackStub([{popup: null, playerState}]);
    const result = await playback.inspectPlaybackAfterWait(stub.page, 0, {
      timeout: 10,
      polling: 1,
      getVisiblePopup: stub.getVisiblePopup,
      getPlayerState: stub.getPlayerState,
    });

    expect(result.ok).toBe(false);
    expect(result.playerState.reason).toBe(playerState.reason);
    expect(result.waitResult.timedOut).toBe(true);
  }
});

test("inspection preserves the full intentional viewing duration before readiness polling", async () => {
  const stub = createPlaybackStub([
    {popup: null, playerState: {hasVideo: true, isProbablyPlaying: true}},
  ]);

  const result = await playback.inspectPlaybackAfterWait(stub.page, 3.25, {
    timeout: 10,
    polling: 1,
    getVisiblePopup: stub.getVisiblePopup,
    getPlayerState: stub.getPlayerState,
  });

  expect(result.ok).toBe(true);
  expect(stub.waits).toEqual([3250]);
});

test("batch inspection returns failure instead of throwing on readiness timeout", async () => {
  const stub = createPlaybackStub([
    {popup: null, playerState: {hasVideo: true, isProbablyPlaying: false, reason: "Video is paused"}},
  ]);

  await expect(playback.inspectPlaybackAfterWait(stub.page, 0, {
    timeout: 10,
    polling: 1,
    getVisiblePopup: stub.getVisiblePopup,
    getPlayerState: stub.getPlayerState,
  })).resolves.toMatchObject({
    ok: false,
    playerState: {reason: "Video is paused"},
    waitResult: {timedOut: true, waitName: "player"},
  });
});

test("playback timeout artifacts retain stable names and structured state", async () => {
  const stub = createPlaybackStub([
    {popup: null, playerState: {hasVideo: false, isProbablyPlaying: false, reason: "No video element found"}},
  ]);
  const attachments = [];
  const testInfo = {
    attach: async (name, payload) => attachments.push({name, payload}),
  };

  await expect(playback.assertPlayback(stub.page, testInfo, {
    label: "Synthetic playback",
    artifactPrefix: "Test Movie",
    timeout: 10,
    polling: 1,
    getVisiblePopup: stub.getVisiblePopup,
    getPlayerState: stub.getPlayerState,
  })).rejects.toThrow(/Player video element should exist/);

  const names = attachments.map(({name}) => name);
  expect(names).toContain("test-movie-playback-timeout.json");
  expect(names).toContain("test-movie-playback-timeout.png");
  expect(names).toContain("test-movie-player-state.json");
  expect(names).toContain("test-movie-playback-failure.txt");
  const timeoutPayload = attachments.find(({name}) => name === "test-movie-playback-timeout.json").payload;
  const timeoutBody = JSON.parse(timeoutPayload.body);
  expect(timeoutBody.playerState.reason).toBe("No video element found");
  expect(timeoutBody.wait.waitName).toBe("player");
  expect(timeoutBody.wait.lastObservation.playerState.hasVideo).toBe(false);
});

test("shared player defaults remain configurable and backward-compatible", () => {
  expect(WAIT_DEFAULTS.player).toEqual({name: "player", timeout: 30000, polling: 250});
  expect(typeof waitForPlayerReady).toBe("function");
  expect(typeof playback.getPlayerState).toBe("function");
  expect(typeof playback.inspectPlaybackAfterWait).toBe("function");
});
