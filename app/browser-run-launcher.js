"use strict";

function createBrowserRunLauncher({browserToolchain, managedRoot} = {}) {
  if (!browserToolchain || typeof browserToolchain.resolve !== "function") {
    throw new Error("A browser toolchain is required.");
  }
  if (typeof managedRoot !== "string" || !managedRoot) {
    throw new Error("A managed browser root is required.");
  }

  return {
    async prepare() {
      try {
        await browserToolchain.resolve();
        return {ok: true, browsersPath: managedRoot};
      } catch {
        return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
      }
    },
  };
}

module.exports = {createBrowserRunLauncher};
