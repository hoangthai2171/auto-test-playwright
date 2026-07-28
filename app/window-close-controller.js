"use strict";

function required(value, name) {
  if (typeof value !== "function") throw new TypeError(`Window close controller ${name}() is required.`);
  return value;
}

function createWindowCloseController({guard, confirm, closeWindow} = {}) {
  if (!guard || typeof guard.requestClose !== "function" || typeof guard.resolve !== "function") {
    throw new TypeError("Window close controller requires a run close guard.");
  }
  const confirmClose = required(confirm, "confirm");
  const finishClose = required(closeWindow, "closeWindow");
  let resolving = false;

  async function requestClose() {
    if (resolving) return false;
    resolving = true;
    try {
      const request = await guard.requestClose();
      if (request.allow) {
        finishClose();
        return true;
      }
      const action = await confirmClose(request.reason);
      const resolution = await guard.resolve(action || "keep_open");
      if (!resolution.allow) return false;
      finishClose();
      return true;
    } finally {
      resolving = false;
    }
  }

  return Object.freeze({requestClose});
}

function createManagedWindowCloseController({window, guard, confirm, onError = () => {}} = {}) {
  if (!window || typeof window.on !== "function" || typeof window.close !== "function") {
    throw new TypeError("Managed window close controller requires an Electron window.");
  }
  let approved = false;
  const controller = createWindowCloseController({
    guard,
    confirm,
    closeWindow() {
      approved = true;
      window.close();
    },
  });
  window.on("close", (event) => {
    if (approved) return;
    event.preventDefault();
    void controller.requestClose().catch(onError);
  });
  return controller;
}

module.exports = {createWindowCloseController, createManagedWindowCloseController};
