"use strict";

const fs = require("node:fs");
const path = require("node:path");

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

function createLgProductGateManifest({model, appId} = {}) {
  return {
    platform: "lg-webos",
    status: "running",
    evidencePolicy: "local-only-redacted",
    device: {model: required(model, "LG model"), appId: required(appId, "LG app ID")},
  };
}

function summarizeStep(step, index) {
  return {
    index: Number.isInteger(step?.index) ? step.index : index,
    action: String(step?.action || ""),
    status: step?.status === "passed" ? "passed" : "failed",
    durationMs: Number.isFinite(step?.durationMs) && step.durationMs >= 0 ? step.durationMs : 0,
  };
}

function safeFailureCode(value) {
  const code = typeof value === "string" ? value.trim() : "";
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : "";
}

function finalizeLgProductGateManifest(manifest, {testCaseResult, forceFailed = false, failureCode} = {}) {
  const steps = Array.isArray(testCaseResult?.steps)
    ? testCaseResult.steps.map(summarizeStep)
    : [];
  const status = !forceFailed && testCaseResult?.status === "passed" ? "passed" : "failed";
  return {
    ...manifest,
    status,
    case: {status, steps},
    ...(safeFailureCode(failureCode) ? {failureCode: safeFailureCode(failureCode)} : {}),
  };
}

function createLgProductGateEvidenceWriter({rootDir, runId} = {}) {
  const safeRoot = required(rootDir, "LG evidence root");
  const safeRunId = required(runId, "LG evidence run ID").replace(/[^a-zA-Z0-9._-]/g, "_");
  const evidenceDir = path.resolve(safeRoot, `lg-product-gate-${safeRunId}`);
  fs.mkdirSync(evidenceDir, {recursive: true, mode: 0o700});
  fs.chmodSync(evidenceDir, 0o700);
  return {
    evidenceDir,
    write(manifest) {
      const destination = path.join(evidenceDir, "manifest.json");
      fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
      fs.chmodSync(destination, 0o600);
    },
  };
}

async function runLgProductGateWithEvidence({manifest, writer, run, getTestCaseResult = () => undefined, getFailureCode = (error) => error?.code} = {}) {
  if (!writer || typeof writer.write !== "function") throw new TypeError("An LG product-gate evidence writer is required.");
  if (typeof run !== "function") throw new TypeError("An LG product-gate run function is required.");
  if (typeof getTestCaseResult !== "function") throw new TypeError("An LG product-gate case-result accessor is required.");
  if (typeof getFailureCode !== "function") throw new TypeError("An LG product-gate failure-code accessor is required.");
  writer.write(manifest);
  try {
    const result = await run();
    writer.write(finalizeLgProductGateManifest(manifest, {testCaseResult: result?.caseResult || getTestCaseResult()}));
    return result;
  } catch (error) {
    writer.write(finalizeLgProductGateManifest(manifest, {
      testCaseResult: error?.testCaseResult || getTestCaseResult(),
      forceFailed: true,
      failureCode: getFailureCode(error),
    }));
    throw error;
  }
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

module.exports = {
  createLgProductGateCase,
  createLgProductGateEvidenceWriter,
  createLgProductGateManifest,
  finalizeLgProductGateManifest,
  parseLgCaseRunnerArgs,
  runLgProductGateWithEvidence,
  withoutLgProductGateCredentials,
};
