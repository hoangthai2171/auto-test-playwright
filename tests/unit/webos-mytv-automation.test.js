"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createWebOsMyTvAutomation} = require("../lib/tv-session/webos-mytv-automation");

function createAutomation({playerStates = []} = {}) {
  let focusedId = "";
  let playerIndex = 0;
  const remoteKeys = [];
  const automation = createWebOsMyTvAutomation({
    async execute(script) {
      if (script.includes("MYTV_TRUSTED_RECT")) {
        const id = /document\.getElementById\(("[^"]+")\)/.exec(script)?.[1];
        focusedId = id ? JSON.parse(id) : "";
        return {x: 0, y: 0, width: 120, height: 80};
      }
      if (script.includes("MYTV_TRUSTED_FOCUS")) return {id: focusedId, text: "", rect: {x: 0, y: 0, width: 120, height: 80}};
      if (script.includes("MYTV_TRUSTED_SEARCH_CANDIDATES")) return [{id: "result-1", label: "Mẫu phim", type: "movie"}];
      if (script.includes("MYTV_TRUSTED_PLAYER")) return playerStates[Math.min(playerIndex++, playerStates.length - 1)];
      if (script.includes("document.body")) return "Search";
      return "";
    },
    async pressKey(key) { remoteKeys.push(key); },
    async wait() {},
  });
  return {automation, remoteKeys};
}

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
