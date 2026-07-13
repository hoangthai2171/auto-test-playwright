const {test, expect} = require("playwright/test");
const {
  WAIT_DEFAULTS,
  WaitTimeoutError,
  waitForFocusState,
  waitForContentVisible,
  waitForPlayerReady,
} = require("./lib/waits");

function createFakePage(states, focusedState = {id: "player", visible: true}) {
  let index = 0;
  const page = {
    url: () => "https://synthetic.test/player#episode-1",
    waitForTimeout: async () => {},
    screenshot: async () => Buffer.from("synthetic-png"),
    getFocusedState: async () => focusedState,
  };

  return {
    page,
    getVisiblePopup: async () => states[Math.min(index, states.length - 1)].popup,
    getPlayerState: async () => {
      const state = states[Math.min(index, states.length - 1)].playerState;
      index += 1;
      return state;
    },
  };
}

test("waitForFocusState resolves after a visible focused marker appears", async ({page}) => {
  await page.setContent(`
    <style>.focused { width: 120px; height: 60px; }</style>
    <div id="focus-target"></div>
    <script>
      setTimeout(() => document.querySelector('#focus-target').className = 'focused', 30);
    </script>
  `);

  const result = await waitForFocusState(page, {timeout: 500, polling: 10});

  expect(result.ok).toBe(true);
  expect(result.observation.id).toBe("focus-target");
  expect(result.observation.visible).toBe(true);
});

test("waitForContentVisible resolves for a visible synthetic content row", async ({page}) => {
  await page.setContent(`
    <div class="content-row" style="width: 600px; height: 180px;">Phim mới</div>
  `);

  const result = await waitForContentVisible(page, {timeout: 200, polling: 10});

  expect(result.ok).toBe(true);
  expect(result.observation.visibleCount).toBe(1);
});

test("waitForPlayerReady waits for a transient popup to clear before succeeding", async () => {
  const {page, getVisiblePopup, getPlayerState} = createFakePage([
    {popup: {text: "Đang tải"}, playerState: {hasVideo: true, isProbablyPlaying: false}},
    {popup: null, playerState: {hasVideo: true, isProbablyPlaying: false}},
    {popup: null, playerState: {hasVideo: true, isProbablyPlaying: true}},
  ]);

  const result = await waitForPlayerReady(page, {
    timeout: 100,
    polling: 1,
    getVisiblePopup,
    getPlayerState,
  });

  expect(result.ok).toBe(true);
  expect(result.observation.popup).toBeNull();
  expect(result.observation.playerState.isProbablyPlaying).toBe(true);
});

test("waitForPlayerReady can return a bounded failed result for batch callers", async () => {
  const {page, getVisiblePopup, getPlayerState} = createFakePage([
    {popup: null, playerState: {hasVideo: false, isProbablyPlaying: false}},
  ]);

  const result = await waitForPlayerReady(page, {
    timeout: 25,
    polling: 5,
    nonThrowing: true,
    getVisiblePopup,
    getPlayerState,
  });

  expect(result.ok).toBe(false);
  expect(result.timedOut).toBe(true);
  expect(result.waitName).toBe("player");
  expect(result.timeout).toBe(25);
  expect(result.elapsed).toBeGreaterThanOrEqual(25);
  expect(result.lastObservation.playerState.hasVideo).toBe(false);
});

test("player timeout captures the default focused state in its diagnostic", async ({page}) => {
  await page.setContent(`
    <div class="focused" id="player-focus" style="width: 100px; height: 40px;">Player</div>
  `);

  const result = await waitForPlayerReady(page, {
    timeout: 20,
    polling: 5,
    nonThrowing: true,
    getVisiblePopup: async () => null,
    getPlayerState: async () => ({hasVideo: false, isProbablyPlaying: false}),
  });

  expect(result.focusedState.id).toBe("player-focus");
  expect(result.focusedState.visible).toBe(true);
});

test("wait options override polling and timeout without changing named defaults", async () => {
  let observations = 0;
  const result = await waitForFocusState({}, {
    timeout: 100,
    polling: 1,
    getFocusedState: async () => ({visible: ++observations >= 3, id: "override-focus"}),
  });

  expect(result.ok).toBe(true);
  expect(result.timeout).toBe(100);
  expect(result.polling).toBe(1);
  expect(WAIT_DEFAULTS.focus.timeout).toBe(30000);
  expect(WAIT_DEFAULTS.focus.polling).toBe(100);
});

test("focus timeout exposes bounded diagnostics and both attachment names", async ({page}) => {
  const synthetic = createFakePage([
    {popup: null, playerState: {hasVideo: false, isProbablyPlaying: false}},
  ]);
  const attachments = [];
  const testInfo = {
    attach: async (name, payload) => attachments.push({name, payload}),
  };

  let thrown;
  try {
    await waitForFocusState(synthetic.page, {
      timeout: 20,
      polling: 5,
      testInfo,
      getFocusedState: async () => ({id: "missing", visible: false, state: "idle"}),
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(WaitTimeoutError);
  expect(thrown.code).toBe("WAIT_TIMEOUT");
  expect(thrown.diagnostic.waitName).toBe("focus");
  expect(thrown.diagnostic.timeout).toBe(20);
  expect(thrown.diagnostic.elapsed).toBeGreaterThanOrEqual(20);
  expect(thrown.diagnostic.lastObservation).toEqual({id: "missing", visible: false, state: "idle"});
  expect(thrown.diagnostic.url).toContain("synthetic");
  expect(thrown.diagnostic.hash).toBe("#episode-1");
  expect(thrown.diagnostic.focusedState).toEqual({id: "missing", visible: false, state: "idle"});
  expect(attachments.map((item) => item.name)).toEqual(["focus-timeout.json", "focus-timeout.png"]);
  expect(attachments[0].payload.contentType).toBe("application/json");
  expect(attachments[1].payload.contentType).toBe("image/png");
});
