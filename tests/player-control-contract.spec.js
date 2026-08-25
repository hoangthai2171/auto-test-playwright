// Contract spec for the VOD player control layer. The player marks its states
// by geometry rather than by class - the detail panel slides to x=-1280 and the
// control bar keeps a stale `focused` class while hidden - so the readers and
// the seek loop run against a real DOM that reproduces those quirks. No live
// app is needed.
const {test, expect} = require("playwright/test");
const playerControl = require("./lib/player-control");

const PLAYER_PAGE = `
  <style>
    body {margin: 0; background: #000;}
    #movie_leftmenu_wr {position: absolute; top: 0; width: 1280px; height: 720px;}
    #media_player_new {position: absolute; top: 0; left: 0; width: 1280px; height: 720px;}
    #new-player-timeshift-bar {position: absolute; top: 302px; left: 33px; width: 1280px; height: 318px;}
    #new_player_controlbar {position: absolute; top: 607px; left: 61px; width: 1152px; height: 113px;}
    #player-button-play {position: absolute; top: -20px; left: 0; width: 40px; height: 40px; display: inline-block;}
    #player-bar-timeshift {position: absolute; top: 0; left: 56px; width: 1097px; height: 5px;}
    #player_bar_active {display: inline-block; width: 8px; height: 5px;}
    .hidden {display: none;}
  </style>
  <video id="player-video" style="width: 1280px; height: 720px;"></video>
  <div id="movie_leftmenu_wr" class="container" style="left: 0;">
    <span id="detail_button_watch" class="focused">Xem tập 1</span>
    <span id="detail_button_restart">Xem từ đầu</span>
  </div>
  <div id="media_player_new" class="new-player hidden">
    <div id="new-player-timeshift-bar" class="timeshift-thumb">
      <div class="thumb"><img alt="">00:00</div>
      <div class="thumb"><img alt="">00:10</div>
      <div class="thumb"><img alt="">00:20</div>
      <div class="thumb"><img alt="">00:30</div>
      <div class="thumb"><img alt="">00:40</div>
    </div>
    <div id="new_player_controlbar" class="controls-bar show">
      <span id="player-button-play" class="player-button-play focused"></span>
      <div id="player-bar-timeshift" class="progress-timer-bar">
        <div id="player_bar_active"></div>
      </div>
      <span id="media_player_current">00:11</span>
      <span id="media_player_duration">2:25:22</span>
    </div>
  </div>
  <script>
    const video = document.getElementById("player-video");
    window.__player = {paused: false, currentTime: 11, pending: null};
    for (const [name, read] of [
      ["paused", () => window.__player.paused],
      ["currentTime", () => window.__player.currentTime],
      ["duration", () => 8734.36],
      ["readyState", () => 4],
      ["ended", () => false],
    ]) {
      Object.defineProperty(video, name, {get: read});
    }

    function formatSeconds(total) {
      const minutes = String(Math.floor(total / 60)).padStart(2, "0");
      const seconds = String(total % 60).padStart(2, "0");
      return minutes + ":" + seconds;
    }

    function showControlBar(shown) {
      document.getElementById("media_player_new").classList.toggle("hidden", !shown);
    }

    // Mirrors the app: Left/Right opens the seek bar, pauses playback and moves
    // the pending target by one 10s step; OK commits it and resumes playback.
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        showControlBar(true);
        document.getElementById("player_bar_active").classList.add("active");
        window.__player.paused = true;
        const base = window.__player.pending ?? Math.round(window.__player.currentTime);
        window.__player.pending = Math.max(0, base + (event.key === "ArrowRight" ? 10 : -10));
        document.getElementById("media_player_current").textContent = formatSeconds(window.__player.pending);
        // The app redraws the thumbnail strip centred on the pending target.
        Array.from(document.querySelectorAll("#new-player-timeshift-bar .thumb")).forEach((thumb, index) => {
          const offset = (index - 2) * 10;
          thumb.textContent = "";
          thumb.appendChild(document.createElement("img"));
          thumb.appendChild(document.createTextNode(formatSeconds(Math.max(0, window.__player.pending + offset))));
        });
        return;
      }

      if (event.key === "Enter") {
        // A pending seek is committed and playback resumes; otherwise OK
        // toggles playback, and pausing is what opens the control bar.
        if (window.__player.pending !== null) {
          window.__player.currentTime = window.__player.pending;
          window.__player.pending = null;
          window.__player.paused = false;
          document.getElementById("player_bar_active").classList.remove("active");
          showControlBar(false);
          return;
        }

        window.__player.paused = !window.__player.paused;
        document.getElementById("player_bar_active").classList.remove("active");
        showControlBar(window.__player.paused);
      }
    });
  </script>
`;

// A <video> without a source stays paused at 0, which the readers correctly
// treat as a player that is still loading. Real playback is stubbed instead.
async function stubPlayingVideo(page, {currentTime = 11} = {}) {
  await page.evaluate((startTime) => {
    const video = document.querySelector("video");
    window.__player = {paused: false, currentTime: startTime, pending: null};
    for (const [name, read] of [
      ["paused", () => window.__player.paused],
      ["currentTime", () => window.__player.currentTime],
      ["duration", () => 8734.36],
      ["readyState", () => 4],
      ["ended", () => false],
    ]) {
      Object.defineProperty(video, name, {get: read});
    }
  }, currentTime);
}

async function leaveDetail(page) {
  await page.evaluate(() => {
    document.getElementById("movie_leftmenu_wr").style.left = "-1280px";
  });
}

test("reads the detail state while the panel is on screen", async ({page}) => {
  await page.setContent(PLAYER_PAGE);

  const state = await playerControl.observePlayerControlState(page);

  expect(state.state).toBe("detail");
  expect(state.detailOnScreen).toBe(true);
  expect(state.controlBarVisible).toBe(false);
  expect(state.focus.scope).toBe("detail");
  expect(state.focus.id).toBe("detail_button_watch");
  expect(state.video.hasVideo).toBe(true);
});

test("reads the bare player state even though the hidden play button keeps its focus class", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);

  const state = await playerControl.observePlayerControlState(page);

  expect(state.state).toBe("player");
  expect(state.detailOnScreen).toBe(false);
  expect(state.controlBarVisible).toBe(false);
  expect(state.timeshiftVisible).toBe(false);
  expect(state.focus.scope).toBe("none");
});

test("reads the control-bar state with the play/pause button focused", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);
  await page.evaluate(() => document.getElementById("media_player_new").classList.remove("hidden"));

  const state = await playerControl.observePlayerControlState(page);

  expect(state.state).toBe("control_bar");
  expect(state.focus.scope).toBe("play_pause");
  expect(state.timeshiftVisible).toBe(true);
  expect(state.position.currentSeconds).toBe(11);
  expect(state.position.remainingSeconds).toBe(8722);
});

test("reads the pending seek target from the middle thumbnail of the strip", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);
  await page.evaluate(() => document.getElementById("media_player_new").classList.remove("hidden"));

  const state = await playerControl.observePlayerControlState(page);

  expect(state.position.timeshiftLabels).toEqual(["00:00", "00:10", "00:20", "00:30", "00:40"]);
  expect(state.position.targetSeconds).toBe(20);
});

test("reads the seek-bar focus from the active progress marker", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);
  await page.evaluate(() => {
    document.getElementById("media_player_new").classList.remove("hidden");
    document.getElementById("player-button-play").classList.remove("focused");
    document.getElementById("player_bar_active").classList.add("active");
  });

  const state = await playerControl.observePlayerControlState(page);

  expect(state.focus.scope).toBe("timeshift");
  expect(state.focus.id).toBe("player_bar_active");
});

test("does not report a player for a page without a full-screen video", async ({page}) => {
  await page.setContent(`<video style="width: 240px; height: 135px;"></video><div id="home">Trang chủ</div>`);

  const state = await playerControl.observePlayerControlState(page);

  expect(state.state).toBe("closed");
  expect(state.video.hasVideo).toBe(false);
});

test("seeks the requested number of steps and commits the target with OK", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);

  const seek = await playerControl.seekPlayer(page, {direction: "forward", steps: 5, pressDelayMs: 50});

  expect(seek.type).toBe("player_seek");
  expect(seek.steps).toBe(5);
  expect(seek.fromSeconds).toBe(11);
  expect(seek.toSeconds).toBe(61);
  expect(seek.deltaSeconds).toBe(50);
  expect(seek.seekBarOpened).toBe(true);
  expect(seek.pending).toBe(true);

  const commit = await playerControl.pressPlayerOk(page, {pressDelayMs: 50});

  expect(commit.playing).toBe(true);
  expect(commit.positionSeconds).toBe(61);
  expect(await playerControl.observePlayerControlState(page).then((state) => state.state)).toBe("player");
});

test("OK on a playing player pauses it and shows the control bar", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);

  const result = await playerControl.pressPlayerOk(page, {pressDelayMs: 50});

  expect(result.expected).toBe("paused");
  expect(result.paused).toBe(true);
  expect(result.playing).toBe(false);
  expect(result.controlBarVisible).toBe(true);

  // OK again resumes playback from the same position.
  const resumed = await playerControl.pressPlayerOk(page, {pressDelayMs: 50});
  expect(resumed.expected).toBe("playing");
  expect(resumed.playing).toBe(true);
});

test("seeks, commits with OK, then pauses with the next OK", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);

  const seek = await playerControl.seekPlayer(page, {direction: "forward", steps: 5, pressDelayMs: 50});
  const commit = await playerControl.pressPlayerOk(page, {pressDelayMs: 50});
  const paused = await playerControl.pressPlayerOk(page, {pressDelayMs: 50});

  expect(seek.toSeconds).toBe(61);
  expect(commit.playing).toBe(true);
  expect(paused.paused).toBe(true);
  expect(paused.positionSeconds).toBe(61);
});

test("seeks backward from the committed position", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);
  await page.evaluate(() => {
    window.__player.currentTime = 120;
    document.getElementById("media_player_current").textContent = "02:00";
  });

  const seek = await playerControl.seekPlayer(page, {direction: "backward", steps: 2, pressDelayMs: 50});

  expect(seek.direction).toBe("backward");
  expect(seek.fromSeconds).toBe(120);
  expect(seek.toSeconds).toBe(100);
  expect(seek.deltaSeconds).toBe(-20);
});

test("enters the player from the detail menu before seeking", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await page.evaluate(() => {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      document.getElementById("movie_leftmenu_wr").style.left = "-1280px";
    }, true);
  });

  const seek = await playerControl.seekPlayer(page, {direction: "forward", steps: 1, pressDelayMs: 50});

  expect(seek.steps).toBe(1);
  expect(seek.deltaSeconds).toBe(10);
});

test("retries a swallowed opening press and opens the seek bar", async ({page}) => {
  await page.setContent(PLAYER_PAGE);
  await leaveDetail(page);
  // The app drops the first key while the player finishes its transition.
  await page.evaluate(() => {
    window.__swallow = 1;
    document.addEventListener("keydown", (event) => {
      if (window.__swallow > 0 && event.key === "ArrowRight") {
        window.__swallow -= 1;
        event.stopImmediatePropagation();
      }
    }, true);
  });

  const seek = await playerControl.seekPlayer(page, {direction: "forward", steps: 2, pressDelayMs: 50, openTimeoutMs: 800});

  expect(seek.seekBarOpened).toBe(true);
  expect(seek.toSeconds).toBe(31);
});

test("fails closed when the seek bar never opens", async ({page}) => {
  await page.setContent(`
    <video id="player-video" style="width: 1280px; height: 720px;"></video>
    <div id="media_player_new" style="display: none;"></div>
  `);
  await stubPlayingVideo(page);

  await expect(playerControl.seekPlayer(page, {direction: "forward", steps: 3, pressDelayMs: 50, openTimeoutMs: 800}))
    .rejects.toThrow(/did not open its seek bar/u);
});

test("waits for the player to open and fails closed when it never does", async ({page}) => {
  await page.setContent(`<div id="home">Trang chủ</div>`);

  await expect(playerControl.seekPlayer(page, {direction: "forward", steps: 1, openTimeoutMs: 1000}))
    .rejects.toThrow(/An open VOD player was not reached/u);
  await expect(playerControl.pressPlayerOk(page, {}))
    .rejects.toThrow(/VOD player is not open/u);
});

test("waits for a player that opens after the action starts", async ({page}) => {
  await page.setContent(`<div id="home">Trang chủ</div>`);
  const opened = page.evaluate(() => new Promise((resolve) => {
    setTimeout(() => {
      document.body.innerHTML = `<video id="player-video" style="width: 1280px; height: 720px;"></video>`;
      const video = document.querySelector("video");
      Object.defineProperty(video, "paused", {get: () => false});
      Object.defineProperty(video, "currentTime", {get: () => 3});
      Object.defineProperty(video, "readyState", {get: () => 4});
      resolve(true);
    }, 1200);
  }));

  const state = await playerControl.preparePlayerForRemoteControl(page, {openTimeoutMs: 8000, stateSettleMs: 100});

  await opened;
  expect(state.state).toBe("player");
  expect(state.video.paused).toBe(false);
});

test("waits for a still-loading player before pressing any key", async ({page}) => {
  // Right after OK the app shows a full-screen video that is still paused at 0;
  // keys delivered in that gap are lost.
  await page.setContent(`<video id="player-video" style="width: 1280px; height: 720px;"></video>`);
  await page.evaluate(() => {
    window.__loading = {paused: true, currentTime: 0};
    const video = document.querySelector("video");
    Object.defineProperty(video, "paused", {get: () => window.__loading.paused});
    Object.defineProperty(video, "currentTime", {get: () => window.__loading.currentTime});
    Object.defineProperty(video, "readyState", {get: () => 4});
    setTimeout(() => {
      window.__loading = {paused: false, currentTime: 8};
    }, 1200);
  });

  const state = await playerControl.preparePlayerForRemoteControl(page, {openTimeoutMs: 8000, stateSettleMs: 100});

  expect(state.video.paused).toBe(false);
  expect(state.video.currentTime).toBe(8);
});

test("rejects unsupported seek arguments before touching the player", async ({page}) => {
  await page.setContent(PLAYER_PAGE);

  await expect(playerControl.seekPlayer(page, {direction: "up", steps: 1})).rejects.toThrow(/seek direction/u);
  await expect(playerControl.seekPlayer(page, {direction: "forward", steps: 0})).rejects.toThrow(/between 1 and 60/u);
});
