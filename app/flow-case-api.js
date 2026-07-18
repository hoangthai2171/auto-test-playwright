const DEFAULT_API_DOMAIN = "http://172.16.240.254:30100";
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_SECONDS * 1000;

function normalizeApiDomain(value) {
  const domain = String(value ?? DEFAULT_API_DOMAIN).trim().replace(/\/+$/, "");
  return domain || DEFAULT_API_DOMAIN;
}

function normalizeTimeoutMs(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.round(seconds * 1000);
}

function encodePathPart(value) {
  return encodeURIComponent(String(value ?? "").trim());
}

function buildFlowCaseFoldersUrl({apiDomain, projectId}) {
  return `${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/flow-case-folders`;
}

function buildFlowCasesUrl({apiDomain, projectId, folderName, environment}) {
  const url = new URL(`${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/flow-cases/by-folder`);
  url.searchParams.set("folderName", String(folderName ?? "").trim());
  url.searchParams.set("environment", String(environment ?? "").trim());
  return url.toString();
}

function flattenFlowCaseFolders(nodes, result = []) {
  if (!Array.isArray(nodes)) return result;
  nodes.forEach((node) => {
    if (!node || typeof node !== "object") return;
    result.push({
      id: node.id,
      name: String(node.name ?? ""),
      fullPath: String(node.fullPath ?? ""),
    });
    flattenFlowCaseFolders(node.children, result);
  });
  return result;
}

function extractList(payload, keys) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("API response did not contain a list.");
  }

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data && typeof payload.data === "object") {
    return extractList(payload.data, keys);
  }

  throw new Error("API response did not contain a list.");
}

function responseMessage(response, body) {
  const detail = body && typeof body === "object"
    ? body.message || body.error
    : "";
  return detail || response.statusText || "Unknown error";
}

async function requestJson(url, {fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS} = {}) {
  const controller = new AbortController();
  const duration = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, duration);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {Accept: "application/json"},
      signal: controller.signal,
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        message: `API request failed with HTTP ${response.status}: ${responseMessage(response, body)}`,
        timeout: false,
      };
    }

    return {ok: true, body};
  } catch (error) {
    if (timedOut) {
      return {ok: false, message: `API request timed out after ${duration} ms.`, timeout: true};
    }
    return {ok: false, message: `API request failed: ${error.message}`, timeout: false};
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFlowCaseFolders({apiDomain, projectId, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(buildFlowCaseFoldersUrl({apiDomain, projectId}), {timeoutMs, fetchImpl});
  if (!result.ok) return result;

  try {
    return {ok: true, folders: flattenFlowCaseFolders(extractList(result.body, ["folders", "data"]))};
  } catch (error) {
    return {ok: false, message: error.message, timeout: false};
  }
}

async function fetchFlowCases({apiDomain, projectId, folderName, environment, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(
    buildFlowCasesUrl({apiDomain, projectId, folderName, environment}),
    {timeoutMs, fetchImpl}
  );
  if (!result.ok) return result;

  try {
    return {ok: true, cases: extractList(result.body, ["cases", "data"])};
  } catch (error) {
    return {ok: false, message: error.message, timeout: false};
  }
}

module.exports = {
  DEFAULT_API_DOMAIN,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_TIMEOUT_MS,
  normalizeApiDomain,
  normalizeTimeoutMs,
  buildFlowCaseFoldersUrl,
  buildFlowCasesUrl,
  flattenFlowCaseFolders,
  fetchFlowCaseFolders,
  fetchFlowCases,
};
