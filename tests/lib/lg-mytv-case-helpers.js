"use strict";

function createLgMyTvCaseHelpers({tvSession} = {}) {
  if (!tvSession || typeof tvSession.createMyTvAutomation !== "function") {
    throw new TypeError("An approved LG TV session with trusted MyTV automation is required.");
  }
  const semantic = tvSession.createMyTvAutomation();
  return Object.freeze({
    semantic,
    waitForReady: (_session, name) => semantic.waitForReady(name),
  });
}

module.exports = {createLgMyTvCaseHelpers};
