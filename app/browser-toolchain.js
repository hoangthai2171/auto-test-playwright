"use strict";

function unavailableError() {
  const error = new Error("Managed Playwright Chromium is unavailable.");
  error.code = "BROWSER_UNAVAILABLE";
  return error;
}

function createBrowserToolchain({fs, resolveExecutablePath, version = "1.61.1"} = {}) {
  if (!fs || typeof fs.stat !== "function") throw new Error("A filesystem stat function is required.");
  if (typeof resolveExecutablePath !== "function") throw new Error("A Playwright executable resolver is required.");

  function component(status) {
    return {
      id: "playwright-chromium",
      label: "Playwright Chromium",
      version,
      status,
    };
  }

  async function resolve() {
    const executablePath = resolveExecutablePath();
    if (typeof executablePath !== "string" || !executablePath) throw unavailableError();
    let entry;
    try {
      entry = await fs.stat(executablePath);
    } catch {
      throw unavailableError();
    }
    if (!entry?.isFile?.()) throw unavailableError();
    return executablePath;
  }

  return {
    async status() {
      try {
        await resolve();
        return {ok: true, state: "ready", component: component("ready")};
      } catch {
        return {ok: true, state: "missing", component: component("missing")};
      }
    },
    resolve,
  };
}

module.exports = {createBrowserToolchain};
