"use strict";

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`An injected ${name} function is required.`);
}

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("An Appium loopback port from 1 to 65535 is required.");
  }
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`A non-empty ${name} is required.`);
  return value.trim();
}

function redactLogChunk(redact, chunk) {
  let redacted;
  try {
    redacted = String(redact(String(chunk ?? "")));
  } catch {
    redacted = "[REDACTED]";
  }
  return redacted
    .replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/gi, "[REDACTED_PNG]")
    .replace(/\biVBORw(?:0KGgo)?[A-Za-z0-9+/=]*/g, "[REDACTED_PNG]")
    .replace(/\b(?:png|screenshot|image)\s*[:=]\s*[A-Za-z0-9+/=]+/gi, "[REDACTED_PNG]")
    .replace(/["'](?:pairing[-_ ]?key|client[-_ ]?key)["']\s*:\s*["'][^"']*["']/gi, '"[REDACTED_SECRET]"')
    .replace(/\b(pairing[-_ ]?key|client[-_ ]?key|password|token|authorization|cookie)\s*[:=]\s*(?:["'][^"']*["']|[^\s,;]+)/gi, "$1=[REDACTED]")
    .replace(/\bkey\s+is\s+(['"])[^'"]*\1/gi, "key is '[REDACTED]'")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_HOST]");
}

function isHealthyStatus(response, payload) {
  return Boolean(response?.ok && payload?.value?.ready === true);
}

async function withRequestDeadline(work, {timeoutMs, wait}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let operation;
  try {
    operation = Promise.resolve(work(controller?.signal));
  } catch (error) {
    throw error;
  }
  const outcome = operation.then(
    (value) => ({type: "value", value}),
    (error) => ({type: "error", error}),
  );
  const timeout = Promise.resolve()
    .then(() => wait(timeoutMs))
    .then(() => ({type: "timeout"}));
  const result = await Promise.race([outcome, timeout]);
  if (result.type === "timeout") {
    controller?.abort();
    const error = new Error("Appium health request exceeded its deadline.");
    error.code = "APPIUM_HEALTH_REQUEST_TIMEOUT";
    throw error;
  }
  if (result.type === "error") throw result.error;
  return result.value;
}

function createAppiumServerManager({spawn, fetch, kill, redact, wait, platform = process.platform}) {
  requireFunction(spawn, "spawn");
  requireFunction(fetch, "fetch");
  requireFunction(kill, "kill");
  requireFunction(redact, "redact");
  requireFunction(wait, "wait");

  return {
    async start({port, appiumBin = "appium", appiumHome, timeoutMs = 10000, pollIntervalMs = 100, requestTimeoutMs = pollIntervalMs, allowSelfSignedTls = false, env = process.env} = {}) {
      assertPort(port);
      const command = assertNonEmptyString(appiumBin, "Appium binary");
      const isolatedAppiumHome = assertNonEmptyString(appiumHome, "APPIUM_HOME");
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("Appium health timeout must be a non-negative number.");
      if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) throw new Error("Appium poll interval must be a positive number.");
      if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) throw new Error("Appium health request timeout must be a positive number.");
      if (typeof allowSelfSignedTls !== "boolean") throw new Error("allowSelfSignedTls must be a boolean.");

      const baseUrl = `http://127.0.0.1:${port}`;
      const args = ["server", "--address", "127.0.0.1", "--port", String(port), "--use-drivers", "webos"];
      const childEnv = {...env, APPIUM_HOME: isolatedAppiumHome};
      delete childEnv.NODE_TLS_REJECT_UNAUTHORIZED;
      if (allowSelfSignedTls) childEnv.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      const child = spawn(command, args, {
        env: childEnv,
        detached: platform !== "win32",
        stdio: "pipe",
      });
      if (!child || !Number.isInteger(child.pid)) throw new Error("Appium spawn did not return an owned child process.");

      const logs = [];
      let combinedLog = "";
      let exited = child.exitCode !== null && child.exitCode !== undefined;
      let stopped = false;
      const retainLog = (chunk) => {
        combinedLog += String(chunk ?? "");
        logs.splice(0, logs.length, redactLogChunk(redact, combinedLog));
      };
      child.stdout?.on?.("data", retainLog);
      child.stderr?.on?.("data", retainLog);
      child.once?.("exit", () => { exited = true; });
      child.once?.("error", (error) => {
        exited = true;
        retainLog(error?.message ?? "Appium child process error.");
      });
      const diagnostics = {logs};

      const unhealthyError = (message) => {
        const error = new Error(message);
        error.code = "APPIUM_UNHEALTHY";
        error.diagnostics = diagnostics;
        return error;
      };

      const stop = async () => {
        if (stopped) return;
        stopped = true;
        if (exited || (child.exitCode !== null && child.exitCode !== undefined)) return;
        try {
          await Promise.resolve(kill(platform === "win32" ? child.pid : -child.pid, "SIGTERM"));
        } catch {
          return;
        }
        await wait(50);
        if (exited || (child.exitCode !== null && child.exitCode !== undefined)) return;
        try {
          await Promise.resolve(kill(platform === "win32" ? child.pid : -child.pid, "SIGKILL"));
        } catch {
          // The owned child may have exited between signals.
        }
      };

      const attempts = Math.max(1, Math.floor(timeoutMs / pollIntervalMs) + 1);
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (exited) break;
        try {
          const response = await withRequestDeadline(
            (signal) => fetch(`${baseUrl}/status`, {signal}),
            {timeoutMs: requestTimeoutMs, wait},
          );
          const payload = typeof response?.json === "function"
            ? await withRequestDeadline((signal) => response.json({signal}), {timeoutMs: requestTimeoutMs, wait})
            : null;
          if (exited) break;
          if (isHealthyStatus(response, payload)) return {baseUrl, stop, diagnostics};
        } catch (error) {
          if (error?.code === "APPIUM_HEALTH_REQUEST_TIMEOUT") {
            await stop();
            throw unhealthyError("Appium health request did not complete before its deadline.");
          }
          // A connection refusal is expected until the manager-owned child is healthy.
        }
        if (attempt < attempts - 1) await wait(pollIntervalMs);
      }

      await stop();
      throw unhealthyError(exited ? "Appium child exited before it became healthy." : "Appium server did not become healthy before timeout.");
    },
  };
}

module.exports = {createAppiumServerManager};
