const test = require("node:test");
const assert = require("node:assert/strict");

const playerControl = require("../lib/player-control");

const PLAY_PAUSE_RECT = {x: 61, y: 587, width: 40, height: 40};

function episodeState(episode, overrides = {}) {
  return createState({
    focus: {scope: "episode", id: `moviePartitions_${episode - 1}_0`},
    video: {paused: true},
    episodes: {panelOpen: true, focusedEpisode: episode, focusedLabel: `44 phút Tập ${episode}`, playingEpisode: 2},
    ...overrides,
  });
}

function createState(overrides = {}) {
  const focus = {scope: "none", id: "", className: "", text: "", rect: {x: 0, y: 0, width: 0, height: 0}, ...(overrides.focus || {})};
  const video = {hasVideo: true, currentTime: 11, duration: 8734, paused: false, ended: false, readyState: 4, ...(overrides.video || {})};
  const position = {currentLabel: "00:11", currentSeconds: 11, remainingLabel: "2:25:22", remainingSeconds: 8722, timeshiftLabels: [], ...(overrides.position || {})};
  if (position.targetSeconds === undefined) position.targetSeconds = position.currentSeconds;

  const episodes = {panelOpen: false, focusedEpisode: null, focusedLabel: "", playingEpisode: null, ...(overrides.episodes || {})};

  return {
    episodes,
    state: "player",
    route: "moviePlayerNew",
    detailOnScreen: false,
    controlBarVisible: false,
    timeshiftVisible: false,
    playPauseRect: PLAY_PAUSE_RECT,
    detailText: "",
    timeshiftText: "",
    ...overrides,
    focus,
    video,
    position,
  };
}

// The helpers read the player through a single page.evaluate, so a queue of
// observations plus a press log is enough to drive them.
function createPage(states) {
  const queue = [...states];
  const presses = [];
  return {
    presses,
    waitForTimeout: async () => {},
    evaluate: async () => (queue.length > 1 ? queue.shift() : queue[0]),
    remotePress: async (_page, key) => {
      presses.push(key);
    },
  };
}

function pressRecorder(page) {
  return async (_page, key) => {
    page.presses.push(key);
  };
}

test("normalizes seek direction and step count", () => {
  assert.equal(playerControl.normalizeSeekDirection(undefined), "forward");
  assert.equal(playerControl.normalizeSeekDirection("Backward"), "backward");
  assert.throws(() => playerControl.normalizeSeekDirection("up"), /Unsupported player seek direction/u);

  assert.equal(playerControl.normalizeSeekSteps(undefined), 1);
  assert.equal(playerControl.normalizeSeekSteps(5), 5);
  assert.throws(() => playerControl.normalizeSeekSteps(0), /between 1 and 60/u);
  assert.throws(() => playerControl.normalizeSeekSteps(61), /between 1 and 60/u);
  assert.throws(() => playerControl.normalizeSeekSteps(2.5), /between 1 and 60/u);
});

test("presses the seek key once per requested step", async () => {
  // The opening press already moves one step; the strip keeps moving with the
  // remaining presses.
  const afterFirstStep = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active", rect: {x: 117, y: 607, width: 8, height: 5}},
    video: {paused: true},
    position: {currentLabel: "00:11", currentSeconds: 11, targetSeconds: 21},
  });
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active", rect: {x: 117, y: 607, width: 8, height: 5}},
    video: {paused: true},
    position: {currentLabel: "01:01", currentSeconds: 61, targetSeconds: 61},
  });
  const page = createPage([createState(), afterFirstStep, seeking]);

  const result = await playerControl.seekPlayer(page, {
    direction: "forward",
    steps: 5,
    remotePress: pressRecorder(page),
  });

  assert.deepEqual(page.presses, ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]);
  assert.equal(result.type, "player_seek");
  assert.equal(result.steps, 5);
  assert.equal(result.fromSeconds, 11);
  assert.equal(result.toSeconds, 61);
  assert.equal(result.deltaSeconds, 50);
  assert.equal(result.firstStepSeconds, 21);
  assert.equal(result.pending, true);
});

test("seeks backward with the left key", async () => {
  const afterFirstStep = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {currentTime: 120, paused: true},
    position: {currentLabel: "02:00", currentSeconds: 120, targetSeconds: 110},
  });
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {currentTime: 120, paused: true},
    position: {currentLabel: "01:40", currentSeconds: 100, targetSeconds: 100},
  });
  const page = createPage([
    createState({video: {currentTime: 120}, position: {currentLabel: "02:00", currentSeconds: 120}}),
    afterFirstStep,
    seeking,
  ]);

  const result = await playerControl.seekPlayer(page, {
    direction: "backward",
    steps: 2,
    remotePress: pressRecorder(page),
  });

  assert.deepEqual(page.presses, ["ArrowLeft", "ArrowLeft"]);
  assert.equal(result.deltaSeconds, -20);
});

test("accepts a backward seek that is already at the start of the content", async () => {
  const atStart = createState({
    video: {currentTime: 0.4, paused: true},
    position: {currentLabel: "00:00", currentSeconds: 0},
    controlBarVisible: true,
    timeshiftVisible: true,
    state: "control_bar",
  });
  const page = createPage([atStart]);

  const result = await playerControl.seekPlayer(page, {
    direction: "backward",
    steps: 1,
    remotePress: pressRecorder(page),
  });

  assert.equal(result.atStartBoundary, true);
  assert.equal(result.deltaSeconds, 0);
});

test("walks focus back to play/pause before seeking from the control-bar button row", async () => {
  const onButtonRow = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: false,
    // The button row sits above the play/pause button.
    focus: {scope: "control_button", id: "player-button-timeshift", rect: {x: 648, y: 300, width: 40, height: 65}},
  });
  const onPlayPause = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
  });
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true},
    position: {currentLabel: "00:21", currentSeconds: 21},
  });
  const page = createPage([onButtonRow, onPlayPause, seeking]);

  const result = await playerControl.seekPlayer(page, {steps: 1, remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["ArrowDown", "ArrowRight"]);
  assert.equal(result.deltaSeconds, 10);
});

test("walks focus up from the related-content row before seeking", async () => {
  const onRelatedRow = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "other", id: "player_related_0", rect: {x: 61, y: 700, width: 245, height: 138}},
  });
  const onPlayPause = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
  });
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true},
    position: {currentLabel: "00:21", currentSeconds: 21},
  });
  const page = createPage([onRelatedRow, onPlayPause, seeking]);

  await playerControl.seekPlayer(page, {steps: 1, remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["ArrowUp", "ArrowRight"]);
});

test("enters the player from the detail menu before pressing a seek key", async () => {
  const detail = createState({
    state: "detail",
    detailOnScreen: true,
    focus: {scope: "detail", id: "movie_button_watch", text: "Xem tập 1"},
  });
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true},
    position: {currentLabel: "00:21", currentSeconds: 21},
  });
  // The detail panel is observed twice: once by the action and once by the
  // settle wait that lets its background playback start.
  const page = createPage([detail, detail, createState(), seeking]);

  await playerControl.seekPlayer(page, {steps: 1, remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["Enter", "ArrowRight"]);
});

test("retries the opening seek press and fails closed when the seek bar never opens", async () => {
  const page = createPage([createState()]);

  await assert.rejects(
    playerControl.seekPlayer(page, {steps: 3, remotePress: pressRecorder(page), openTimeoutMs: 0}),
    /did not open its seek bar after 3 ArrowRight press\(es\)/u
  );
  // Only the retried opening press is delivered; the remaining steps are not
  // pressed blindly against a player that is not seeking.
  assert.deepEqual(page.presses, ["ArrowRight", "ArrowRight", "ArrowRight"]);
});

test("fails closed when the seek target does not move", async () => {
  const stuck = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true},
  });
  const page = createPage([stuck]);

  await assert.rejects(
    playerControl.seekPlayer(page, {steps: 2, remotePress: pressRecorder(page), targetTimeoutMs: 0}),
    /Player seek target after 2 forward step\(s\)/u
  );
});

test("waits for the player instead of failing while it is still opening", async () => {
  const page = createPage([
    createState({state: "closed", video: {hasVideo: false, paused: true}}),
    createState(),
  ]);

  const state = await playerControl.preparePlayerForRemoteControl(page, {remotePress: pressRecorder(page)});

  assert.equal(state.state, "player");
  assert.deepEqual(page.presses, []);
});

test("toggles playback and reports the new state", async () => {
  const playing = createState();
  const paused = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
    video: {paused: true, currentTime: 61},
  });
  const page = createPage([playing, paused]);

  const result = await playerControl.togglePlayerPlayback(page, {remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["Enter"]);
  assert.deepEqual(result, {
    type: "player_toggle_play",
    from: "playing",
    to: "paused",
    positionSeconds: 61,
    state: "control_bar",
  });
});

test("OK inside the player commits the pending seek and requires playback again", async () => {
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true, currentTime: 11},
    position: {currentLabel: "01:01", currentSeconds: 61},
  });
  const resumed = createState({video: {currentTime: 61}, position: {currentLabel: "01:01", currentSeconds: 61}});
  const page = createPage([seeking, resumed]);

  const result = await playerControl.pressPlayerOk(page, {remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["Enter"]);
  assert.equal(result.type, "player_press_ok");
  assert.equal(result.from.focus, "timeshift");
  assert.equal(result.playing, true);
  assert.equal(result.positionSeconds, 61);
});

test("OK inside the player fails closed when playback does not resume", async () => {
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true},
  });
  const page = createPage([seeking]);

  await assert.rejects(
    playerControl.pressPlayerOk(page, {remotePress: pressRecorder(page), timeoutMs: 0}),
    /Player playing after OK in the control_bar state/u
  );
});

function relatedState(column, overrides = {}) {
  return createState({
    focus: {scope: "related", id: `relativeContentPopup2_0_${column}`, rect: {x: 27 + column * 247, y: 523, width: 245, height: 138}},
    video: {paused: true},
    ...overrides,
  });
}

test("opens the related-content row and focuses its first poster", async () => {
  const controlBar = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
  });
  const page = createPage([createState(), controlBar, relatedState(0)]);

  const result = await playerControl.focusPlayerRelatedContent(page, {
    remotePress: pressRecorder(page),
    openTimeoutMs: 0,
  });

  // Down opens the control bar, Down again shows the related row.
  assert.deepEqual(page.presses, ["ArrowDown", "ArrowDown"]);
  assert.equal(result.type, "player_focus_related");
  assert.equal(result.itemIndex, 1);
  assert.equal(result.id, "relativeContentPopup2_0_0");
  assert.equal(result.rowId, "relativeContentPopup2_0");
  assert.equal(result.column, 0);
  assert.equal(result.playbackPaused, true);
});

test("walks right to the requested related-content item", async () => {
  const page = createPage([relatedState(0), relatedState(1), relatedState(2)]);

  const result = await playerControl.focusPlayerRelatedContent(page, {
    itemIndex: 3,
    remotePress: pressRecorder(page),
    openTimeoutMs: 0,
  });

  assert.deepEqual(page.presses, ["ArrowRight", "ArrowRight"]);
  assert.equal(result.id, "relativeContentPopup2_0_2");
  assert.equal(result.column, 2);
});

test("fails closed when the related-content row ends before the requested item", async () => {
  const page = createPage([relatedState(0), relatedState(1), relatedState(1)]);

  await assert.rejects(
    playerControl.focusPlayerRelatedContent(page, {itemIndex: 4, remotePress: pressRecorder(page), openTimeoutMs: 0}),
    /related-content row ended before item 4/u
  );
});

test("fails closed when the related-content row never opens", async () => {
  const page = createPage([createState()]);

  await assert.rejects(
    playerControl.focusPlayerRelatedContent(page, {remotePress: pressRecorder(page), openTimeoutMs: 0}),
    /did not open its related-content row/u
  );
});

test("rejects an unusable related item index before touching the player", async () => {
  const page = createPage([createState()]);

  await assert.rejects(
    playerControl.focusPlayerRelatedContent(page, {itemIndex: 0, remotePress: pressRecorder(page)}),
    /between 1 and 60/u
  );
  assert.deepEqual(page.presses, []);
});

test("returns from the related row to play/pause before seeking", async () => {
  const onPlayPause = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
  });
  const seeking = createState({
    state: "control_bar",
    controlBarVisible: true,
    timeshiftVisible: true,
    focus: {scope: "timeshift", id: "player_bar_active"},
    video: {paused: true},
    position: {currentLabel: "00:21", currentSeconds: 21},
  });
  const page = createPage([relatedState(0), onPlayPause, seeking]);

  await playerControl.seekPlayer(page, {steps: 1, remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["ArrowUp", "ArrowRight"]);
});

test("OK on a related poster must start a different content", async () => {
  const focusedRelated = relatedState(0, {video: {paused: true, source: "blob:old-content"}});
  const sameContent = createState({video: {source: "blob:old-content"}});
  const newContent = createState({video: {source: "blob:new-content", currentTime: 3}});

  const playing = createPage([focusedRelated, sameContent, newContent]);
  const result = await playerControl.pressPlayerOk(playing, {remotePress: pressRecorder(playing)});

  assert.equal(result.expected, "playing");
  assert.equal(result.contentChanged, true);
  assert.equal(result.playing, true);

  // The same media playing again means the poster never opened.
  const stuck = createPage([focusedRelated, sameContent]);
  await assert.rejects(
    playerControl.pressPlayerOk(stuck, {remotePress: pressRecorder(stuck), timeoutMs: 0}),
    /Player playing after OK in the player state/u
  );
});

test("derives the OK outcome from the state that owns the screen", () => {
  const {expectedOutcomeAfterOk} = playerControl;

  assert.equal(expectedOutcomeAfterOk(createState({state: "detail", detailOnScreen: true})), "playing");
  assert.equal(
    expectedOutcomeAfterOk(createState({state: "control_bar", focus: {scope: "timeshift"}, video: {paused: true}})),
    "playing"
  );
  // OK on a playing player pauses it and shows the control bar.
  assert.equal(expectedOutcomeAfterOk(createState()), "paused");
  assert.equal(expectedOutcomeAfterOk(createState({video: {paused: true}})), "playing");
  assert.equal(
    expectedOutcomeAfterOk(createState({state: "control_bar", focus: {scope: "play_pause"}})),
    "paused"
  );
  assert.equal(
    expectedOutcomeAfterOk(createState({focus: {scope: "related"}, video: {paused: true}})),
    "playing"
  );
  // Another control-bar button opens its own control; playback says nothing.
  assert.equal(
    expectedOutcomeAfterOk(createState({state: "control_bar", focus: {scope: "control_button"}})),
    "none"
  );
});

test("OK on a playing player pauses it and reports the control bar", async () => {
  const playing = createState();
  const paused = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
    video: {paused: true, currentTime: 110},
    position: {currentLabel: "01:50", currentSeconds: 110},
  });
  const page = createPage([playing, paused]);

  const result = await playerControl.pressPlayerOk(page, {remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["Enter"]);
  assert.equal(result.expected, "paused");
  assert.equal(result.paused, true);
  assert.equal(result.playing, false);
  assert.equal(result.controlBarVisible, true);
  assert.equal(result.positionSeconds, 110);
});

test("OK on a playing player fails closed when it keeps playing", async () => {
  const page = createPage([createState()]);

  await assert.rejects(
    playerControl.pressPlayerOk(page, {remotePress: pressRecorder(page), timeoutMs: 0}),
    /Player paused after OK in the player state/u
  );
});

test("refuses to press OK when no player is open", async () => {
  const page = createPage([createState({state: "closed", video: {hasVideo: false, paused: true}})]);

  await assert.rejects(
    playerControl.pressPlayerOk(page, {remotePress: pressRecorder(page)}),
    /VOD player is not open/u
  );
  assert.deepEqual(page.presses, []);
});

test("opens the episode picker from the control-bar button row", async () => {
  const controlBar = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "play_pause", id: "player-button-play", rect: PLAY_PAUSE_RECT},
  });
  const onForward = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "control_button", id: "player-button-forward", rect: {x: 897, y: 545, width: 40, height: 65}},
  });
  const onPartition = createState({
    state: "control_bar",
    controlBarVisible: true,
    focus: {scope: "control_button", id: "player-button-partition", rect: {x: 967, y: 545, width: 40, height: 65}},
  });
  const page = createPage([createState(), controlBar, onForward, onPartition, episodeState(2)]);

  const result = await playerControl.openPlayerEpisodes(page, {remotePress: pressRecorder(page)});

  // Down opens the bar, Up enters the button row, Right reaches "Chọn tập",
  // and OK opens the list.
  assert.deepEqual(page.presses, ["ArrowDown", "ArrowUp", "ArrowRight", "Enter"]);
  assert.equal(result.type, "player_open_episodes");
  assert.equal(result.focusedEpisode, 2);
  assert.equal(result.playingEpisode, 2);
  assert.equal(result.playbackPaused, true);
});

test("walks the episode list by the episode each poster names", async () => {
  const page = createPage([episodeState(2), episodeState(3), episodeState(4), episodeState(5)]);

  const result = await playerControl.focusPlayerEpisode(page, {episode: 5, remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["ArrowDown", "ArrowDown", "ArrowDown"]);
  assert.equal(result.episode, 5);
  assert.equal(result.id, "moviePartitions_4_0");
  assert.equal(result.label, "44 phút Tập 5");
});

test("walks up when the requested episode is behind the current one", async () => {
  const page = createPage([episodeState(5), episodeState(4)]);

  const result = await playerControl.focusPlayerEpisode(page, {episode: 4, remotePress: pressRecorder(page)});

  assert.deepEqual(page.presses, ["ArrowUp"]);
  assert.equal(result.episode, 4);
});

test("fails closed when the episode list ends before the requested episode", async () => {
  const page = createPage([episodeState(2), episodeState(3), episodeState(3)]);

  await assert.rejects(
    playerControl.focusPlayerEpisode(page, {episode: 9, remotePress: pressRecorder(page)}),
    /episode list ended at episode 3 before reaching episode 9/u
  );
});

test("rejects an unusable episode number before touching the player", async () => {
  const page = createPage([episodeState(2)]);

  await assert.rejects(
    playerControl.focusPlayerEpisode(page, {episode: 0, remotePress: pressRecorder(page)}),
    /Episode must be an integer between 1 and 2000/u
  );
  assert.deepEqual(page.presses, []);
});

test("OK on an episode poster must play the episode it named", async () => {
  const focused = episodeState(5, {video: {paused: true, source: "blob:episode-2"}});
  const wrongEpisode = createState({
    video: {source: "blob:episode-6"},
    episodes: {panelOpen: false, focusedEpisode: null, focusedLabel: "", playingEpisode: 6},
  });
  const rightEpisode = createState({
    video: {source: "blob:episode-5", currentTime: 4},
    episodes: {panelOpen: false, focusedEpisode: null, focusedLabel: "", playingEpisode: 5},
  });

  const page = createPage([focused, rightEpisode]);
  const result = await playerControl.pressPlayerOk(page, {remotePress: pressRecorder(page)});

  assert.equal(result.expected, "playing");
  assert.equal(result.episode, 5);
  assert.equal(result.requestedEpisode, 5);
  assert.equal(result.contentChanged, true);

  // Playing a different episode than the one that was focused is a failure.
  const mismatched = createPage([focused, wrongEpisode]);
  await assert.rejects(
    playerControl.pressPlayerOk(mismatched, {remotePress: pressRecorder(mismatched), timeoutMs: 0}),
    /Player playing after OK in the player state/u
  );
});
