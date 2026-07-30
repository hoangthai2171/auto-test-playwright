"use strict";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createLgCompatibilityAttemptService({temporaryTarget, adapter, compatibilityCatalog, platform = process.platform, createId, scheduleExpiry = (callback) => setTimeout(callback, 5 * 60 * 1000), cancelExpiry = clearTimeout} = {}) {
  if (!temporaryTarget || typeof temporaryTarget.acquire !== "function") throw new Error("A temporary LG target service is required.");
  if (!adapter || typeof adapter.deviceInfo !== "function") throw new Error("A read-only LG device adapter is required.");
  if (!compatibilityCatalog || typeof compatibilityCatalog.select !== "function") throw new Error("An LG compatibility catalog is required.");
  if (typeof createId !== "function") throw new Error("A compatibility attempt identifier factory is required.");
  if (typeof scheduleExpiry !== "function" || typeof cancelExpiry !== "function") throw new Error("Compatibility attempt expiry handlers are required.");

  const attempts = new Map();

  function remove(id) {
    const attempt = attempts.get(id);
    if (!attempt) return false;
    attempts.delete(id);
    cancelExpiry(attempt.expiry);
    return true;
  }

  return Object.freeze({
    async inspect({confirmed, label, host, passphrase} = {}) {
      if (confirmed !== true) return {ok: false, status: "INSPECTION_CONFIRMATION_REQUIRED"};
      const safeLabel = text(label);
      const safeHost = text(host);
      const safePassphrase = text(passphrase);
      if (!safeLabel || !safeHost || !safePassphrase) return {ok: false, status: "INSPECTION_INPUT_INVALID"};

      const lease = await temporaryTarget.acquire({host: safeHost, passphrase: safePassphrase});
      if (!lease?.ok || !text(lease.targetName) || typeof lease.release !== "function") {
        return {ok: false, status: "CONNECTION_UNAVAILABLE"};
      }
      try {
        const info = await adapter.deviceInfo({deviceName: lease.targetName});
        const model = text(info?.model);
        const firmware = text(info?.firmware);
        if (!model || !firmware) return {ok: false, status: "INSPECTION_FAILED"};
        const selected = await compatibilityCatalog.select({model, firmware, platform});
        if (selected?.status !== "verified" || !selected.artifact) {
          return {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED", model, firmware};
        }

        const attemptId = text(createId());
        if (!attemptId || attempts.has(attemptId)) return {ok: false, status: "INSPECTION_FAILED"};
        const attempt = {label: safeLabel, host: safeHost, passphrase: safePassphrase, model, firmware, artifact: structuredClone(selected.artifact)};
        attempt.expiry = scheduleExpiry(() => { remove(attemptId); });
        attempts.set(attemptId, attempt);
        return {ok: true, status: "COMPATIBILITY_VERIFIED", attemptId, model, firmware};
      } catch {
        return {ok: false, status: "INSPECTION_FAILED"};
      } finally {
        await lease.release();
      }
    },

    async takeForValidation({attemptId} = {}) {
      const id = text(attemptId);
      const attempt = attempts.get(id);
      if (!attempt) return {ok: false, status: "ATTEMPT_NOT_FOUND"};
      remove(id);
      return {ok: true, attempt: Object.freeze({
        label: attempt.label,
        host: attempt.host,
        passphrase: attempt.passphrase,
        model: attempt.model,
        firmware: attempt.firmware,
        artifact: structuredClone(attempt.artifact),
      })};
    },

    async discard({attemptId} = {}) {
      remove(text(attemptId));
      return {ok: true};
    },
  });
}

module.exports = {createLgCompatibilityAttemptService};
