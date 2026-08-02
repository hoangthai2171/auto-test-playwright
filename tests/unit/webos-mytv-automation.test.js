"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createWebOsMyTvAutomation} = require("../lib/tv-session/webos-mytv-automation");

function createAutomation({playerStates = [], visibleAfter = {}, bodyText = "Search", searchCandidates = [{id: "result-1", label: "Mẫu phim", type: "movie"}], searchCandidatesAfter = 1, playerCheckTimeoutSeconds} = {}) {
  let focusedId = "";
  let playerIndex = 0;
  let searchCandidateReads = 0;
  const remoteKeys = [];
  const waits = [];
  const rectReads = new Map();
  const automation = createWebOsMyTvAutomation({
    async execute(script) {
      if (script.includes("MYTV_TRUSTED_RECT")) {
        const id = /document\.getElementById\(("[^"]+")\)/.exec(script)?.[1];
        focusedId = id ? JSON.parse(id) : "";
        const reads = (rectReads.get(focusedId) || 0) + 1;
        rectReads.set(focusedId, reads);
        if (reads < (visibleAfter[focusedId] || 1)) return null;
        return {x: 0, y: 0, width: 120, height: 80};
      }
      if (script.includes("MYTV_TRUSTED_FOCUS")) return {id: focusedId, text: "", rect: {x: 0, y: 0, width: 120, height: 80}};
        if (script.includes("MYTV_TRUSTED_SEARCH_CANDIDATES")) {
          searchCandidateReads += 1;
          return searchCandidateReads >= searchCandidatesAfter ? searchCandidates : [];
        }
      if (script.includes("MYTV_TRUSTED_PLAYER")) return playerStates[Math.min(playerIndex++, playerStates.length - 1)];
      if (script.includes("document.body")) return bodyText;
      return "";
    },
    async pressKey(key) { remoteKeys.push(key); },
    async wait(milliseconds) { waits.push(milliseconds); },
    playerCheckTimeoutSeconds,
  });
  return {automation, remoteKeys, waits};
}

test("LG MyTV login waits for the welcome control after a fresh app reset", async () => {
  const {automation, remoteKeys, waits} = createAutomation({
    visibleAfter: {"btn-welcome-0-1": 3},
    bodyText: "Đăng nhập Nhập số điện thoại",
  });

  await automation.focusLogin();

  assert.deepEqual(remoteKeys, ["Enter", "Enter"]);
  assert.deepEqual(waits, [250, 250]);
});

test("LG MyTV search waits for a delayed matching result", async () => {
  const {automation, waits} = createAutomation({searchCandidatesAfter: 3});

  const result = await automation.searchContent({name: "Mẫu phim", type: "movie"});

  assert.deepEqual(result, {name: "Mẫu phim", type: "movie"});
  assert.deepEqual(waits, [3_000, 250, 250]);
});

test("LG MyTV search accepts an untyped exact result for the requested content type", async () => {
  const {automation} = createAutomation({
    searchCandidates: [{id: "result-1", label: "VTV3 HD", type: ""}],
  });

  const result = await automation.searchContent({name: "VTV3 HD", type: "channel"});

  assert.deepEqual(result, {name: "VTV3 HD", type: ""});
});

test("LG MyTV player readiness does not accept a non-player screen", async () => {
  const {automation} = createAutomation({
    playerStates: [{hasVideo: false, currentTime: 0, paused: true, ended: false, readyState: 0, width: 0, height: 0}],
  });

  await assert.rejects(automation.waitForReady("player"), (error) => error.code === "DOM_STATE_TIMEOUT");
});

test("LG MyTV playback rejects a visible video whose time does not advance", async () => {
  const frozen = {hasVideo: true, currentTime: 12, paused: false, ended: false, readyState: 4, width: 1920, height: 1080};
  const {automation, remoteKeys} = createAutomation({playerStates: [frozen, frozen]});

  await automation.searchContent({name: "Mẫu phim", type: "movie"});
  await assert.rejects(automation.playSearchResult({type: "movie"}), (error) => error.code === "PLAYBACK_FAILED");
  assert.deepEqual(remoteKeys, ["Enter", "Enter"]);
});

test("LG MyTV playback uses the configured player-check timeout", async () => {
  const before = {hasVideo: true, currentTime: 12, paused: false, ended: false, readyState: 4, width: 1920, height: 1080};
  const after = {...before, currentTime: 13};
  const {automation, waits} = createAutomation({
    playerCheckTimeoutSeconds: 3,
    playerStates: [before, after],
  });

  await automation.searchContent({name: "Mẫu phim", type: "movie"});
  await automation.playSearchResult({type: "movie"});

  assert.deepEqual(waits, [3_000, 3_500, 3_000]);
});
