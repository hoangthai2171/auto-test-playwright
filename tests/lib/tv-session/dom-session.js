"use strict";

const {normalizeVietnameseText} = require("../text-utils");
const {TvSessionError} = require("./tv-session");

function requireMethod(value, method) {
  if (!value || typeof value[method] !== "function") {
    throw new TypeError(`TvSession ${method}() is required.`);
  }
}

function requireCapability(capabilities, name) {
  if (capabilities?.[name] === true) return;
  throw new TvSessionError(
    name === "visualCapture" ? "VISUAL_CAPTURE_UNAVAILABLE" : "DOM_INSPECTION_UNAVAILABLE",
    `${name} is unavailable for this TV session.`,
  );
}

function normalizedIncludes(state, text) {
  const expected = normalizeVietnameseText(String(text || ""));
  if (!expected) throw new TypeError("Visible text is required.");
  const observed = normalizeVietnameseText([state?.bodyText, state?.focused, state?.active].filter(Boolean).join("\n"));
  return observed.includes(expected);
}

function createDomSession({tvSession, capabilities = {}} = {}) {
  requireMethod(tvSession, "pressKey");
  requireMethod(tvSession, "getDomState");
  requireMethod(tvSession, "waitForDomState");

  return Object.freeze({
    capabilities: Object.freeze({...capabilities}),
    async press(key) {
      return tvSession.pressKey(key);
    },
    async read() {
      requireCapability(capabilities, "domInspection");
      return tvSession.getDomState();
    },
    async hasVisibleText(text) {
      return normalizedIncludes(await this.read(), text);
    },
    async waitForVisibleText(text, options) {
      requireCapability(capabilities, "domInspection");
      const result = await tvSession.waitForDomState((state) => normalizedIncludes(state, text), options);
      return Boolean(result);
    },
    async capture() {
      requireCapability(capabilities, "visualCapture");
      requireMethod(tvSession, "screenshot");
      return tvSession.screenshot();
    },
  });
}

module.exports = {createDomSession, normalizedIncludes};
