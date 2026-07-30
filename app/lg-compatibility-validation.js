"use strict";

const path = require("node:path");

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validCase(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function requiredDependency(value, name, method) {
  if (!value || typeof value[method] !== "function") {
    throw new Error(`An injected ${name} with ${method}() is required.`);
  }
}

function createLgCompatibilityValidation({
  attempts,
  temporaryTarget,
  adapter,
  downloadArtifact,
  verifyArchive,
  extractChromeDriver,
  verifyChromeDriver,
  runCase,
  createTempDir,
  removeTempDir,
  platform = process.platform,
} = {}) {
  requiredDependency(attempts, "compatibility attempt service", "takeForValidation");
  requiredDependency(attempts, "compatibility attempt service", "discard");
  requiredDependency(temporaryTarget, "temporary LG target service", "acquire");
  requiredDependency(adapter, "read-only LG device adapter", "deviceInfo");
  for (const [name, dependency] of Object.entries({downloadArtifact, verifyArchive, extractChromeDriver, verifyChromeDriver, runCase, createTempDir, removeTempDir})) {
    if (typeof dependency !== "function") throw new Error(`An injected ${name} function is required.`);
  }
  if (!new Set(["darwin", "win32"]).has(platform)) throw new Error("LG compatibility validation supports only macOS and Windows.");

  return Object.freeze({
    async validate({attemptId, confirmed, testCase} = {}) {
      if (confirmed !== true) return {ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED"};
      if (!validCase(testCase)) return {ok: false, status: "LG_COMPATIBILITY_CASE_REQUIRED"};

      const id = text(attemptId);
      let root = "";
      let lease;
      try {
        const taken = await attempts.takeForValidation({attemptId: id});
        if (!taken?.ok || !taken.attempt) return {ok: false, status: "ATTEMPT_NOT_FOUND"};
        const attempt = taken.attempt;
        root = await createTempDir();
        if (!text(root)) return {ok: false, status: "TEMPORARY_DRIVER_UNAVAILABLE"};

        const archivePath = await downloadArtifact({artifact: attempt.artifact, destination: root});
        if (await verifyArchive({archivePath, artifact: attempt.artifact}) !== true) {
          return {ok: false, status: "TEMPORARY_DRIVER_UNAVAILABLE"};
        }
        const chromedriverRoot = path.join(root, "chromedriver");
        await extractChromeDriver({archivePath, destination: chromedriverRoot});
        if (await verifyChromeDriver({chromedriverRoot, version: attempt.artifact?.version}) !== true) {
          return {ok: false, status: "TEMPORARY_DRIVER_UNAVAILABLE"};
        }

        lease = await temporaryTarget.acquire({host: attempt.host, passphrase: attempt.passphrase});
        if (!lease?.ok || !text(lease.targetName) || typeof lease.release !== "function") {
          return {ok: false, status: "CONNECTION_UNAVAILABLE"};
        }
        const info = await adapter.deviceInfo({deviceName: lease.targetName});
        if (text(info?.model) !== attempt.model || text(info?.firmware) !== attempt.firmware) {
          return {ok: false, status: "DEVICE_IDENTITY_MISMATCH"};
        }
        await runCase({
          testCase,
          model: attempt.model,
          firmware: attempt.firmware,
          connection: Object.freeze({
            deviceName: lease.targetName,
            deviceHost: attempt.host,
            chromedriverPath: path.join(chromedriverRoot, platform === "win32" ? "chromedriver.exe" : "chromedriver"),
            remoteOnly: false,
            rcMode: "rc",
          }),
        });
        return {ok: true, status: "VALIDATION_PASSED"};
      } catch {
        return {ok: false, status: "VALIDATION_FAILED"};
      } finally {
        if (lease?.release) {
          try {
            await lease.release();
          } catch {
            // A failed cleanup cannot disclose or retain the transient runtime values.
          }
        }
        if (root) {
          try {
            await removeTempDir(root);
          } catch {
            // A failed cleanup cannot disclose or retain the transient runtime values.
          }
        }
        try {
          await attempts.discard({attemptId: id});
        } catch {
          // The in-memory attempt service treats discard as idempotent.
        }
      }
    },
  });
}

module.exports = {createLgCompatibilityValidation};
