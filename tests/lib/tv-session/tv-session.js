const TV_CAPABILITIES = Object.freeze({
  DOM_INSPECTION: "domInspection",
  VISUAL_CAPTURE: "visualCapture",
});

const REMOTE_KEYS = Object.freeze({
  Enter: "ok",
  Backspace: "back",
  Escape: "back",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
});

function normalizeRemoteKey(key) {
  if (!REMOTE_KEYS[key]) throw new Error(`Unsupported TV remote key: ${key}`);
  return REMOTE_KEYS[key];
}

class TvSessionError extends Error {
  constructor(code, message, {platform, model} = {}) {
    super(`${platform || "tv"}${model ? ` ${model}` : ""}: ${message}`);
    this.name = "TvSessionError";
    this.code = code;
    this.platform = platform;
    this.model = model;
  }
}

module.exports = {TV_CAPABILITIES, TvSessionError, normalizeRemoteKey};
