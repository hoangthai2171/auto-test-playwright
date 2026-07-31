"use strict";

function waitForChild(child) {
  return new Promise((resolve) => {
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

function createBrowserToolchainInstaller({browserToolchain, managedRoot, nodePath, playwrightCliPath, spawn, environment = process.env} = {}) {
  if (!browserToolchain || typeof browserToolchain.status !== "function" || typeof browserToolchain.resolve !== "function") {
    throw new Error("A browser toolchain is required.");
  }
  if (typeof managedRoot !== "string" || !managedRoot || typeof nodePath !== "string" || !nodePath || typeof playwrightCliPath !== "string" || !playwrightCliPath || typeof spawn !== "function") {
    throw new Error("Managed browser installation dependencies are required.");
  }

  return {
    async install({confirmed, onProgress} = {}) {
      if (confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
      const emit = (event) => { try { onProgress?.(event); } catch {} };
      emit({code: "preparing"});
      const env = {...environment, PLAYWRIGHT_BROWSERS_PATH: managedRoot, ELECTRON_RUN_AS_NODE: "1"};
      delete env.PLAYWRIGHT_DOWNLOAD_HOST;
      emit({code: "downloading-chromium"});
      let installed;
      try {
        installed = await waitForChild(spawn(nodePath, [playwrightCliPath, "install", "chromium"], {env, shell: false, stdio: "ignore"}));
      } catch {
        installed = false;
      }
      if (!installed) {
        emit({code: "failed", status: "DOWNLOAD_FAILED"});
        return {ok: false, status: "DOWNLOAD_FAILED"};
      }
      emit({code: "verifying-chromium"});
      try {
        await browserToolchain.resolve();
      } catch {
        emit({code: "failed", status: "VERIFICATION_FAILED"});
        return {ok: false, status: "VERIFICATION_FAILED"};
      }
      const status = await browserToolchain.status();
      emit({code: "complete"});
      return status;
    },
  };
}

module.exports = {createBrowserToolchainInstaller};
