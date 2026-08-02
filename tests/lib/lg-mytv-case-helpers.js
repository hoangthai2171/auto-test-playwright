"use strict";

function createLgMyTvCaseHelpers({tvSession, playerCheckTimeoutSeconds} = {}) {
  if (!tvSession || typeof tvSession.createMyTvAutomation !== "function") {
    throw new TypeError("An approved LG TV session with trusted MyTV automation is required.");
  }
  const semantic = tvSession.createMyTvAutomation({playerCheckTimeoutSeconds});
  return Object.freeze({
    semantic,
    waitForReady: (_session, name) => semantic.waitForReady(name),
  });
}

module.exports = {createLgMyTvCaseHelpers};
