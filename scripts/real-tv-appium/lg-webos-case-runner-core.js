"use strict";

const CONTENT_TYPES = new Set(["channel", "movie", "content"]);

function required(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function createLgProductGateCase({username, password, searchName, contentType} = {}) {
  const safeUsername = required(username, "Runtime LG test username");
  const safePassword = required(password, "Runtime LG test password");
  const safeSearchName = required(searchName, "LG search name");
  if (!CONTENT_TYPES.has(contentType)) throw new Error("LG content type must be channel, movie, or content.");
  return {
    id: "lg-product-gate",
    name: "LG product gate",
    actions: [
      {action: "login", username: safeUsername, password: safePassword},
      {action: "open_search"},
      {action: "search_content", name: safeSearchName, type: contentType},
      {action: "play_search_result", type: contentType},
    ],
  };
}

function withoutLgProductGateCredentials(environment = {}) {
  const sanitized = {...environment};
  delete sanitized.MYTV_LG_TEST_USERNAME;
  delete sanitized.MYTV_LG_TEST_PASSWORD;
  return sanitized;
}

function parseLgCaseRunnerArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--skip-screenshot-gate") throw new Error("LG product gate does not support --skip-screenshot-gate.");
    if (["--secure-websocket", "--allow-self-signed-tls"].includes(item)) { args[item.slice(2)] = true; continue; }
    if (item === "--help" || item === "-h") { args.help = true; continue; }
    if (!item.startsWith("--")) throw new Error(`Unknown argument ${item}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}.`);
    args[item.slice(2)] = value;
    index += 1;
  }
  if (!args.help && args["content-type"] && !CONTENT_TYPES.has(args["content-type"])) {
    throw new Error("--content-type must be channel, movie, or content.");
  }
  return args;
}

module.exports = {createLgProductGateCase, parseLgCaseRunnerArgs, withoutLgProductGateCredentials};
