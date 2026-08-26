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

function normalizeOptionalPositiveInteger(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  if (!/^[1-9]\d*$/u.test(normalized)) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return normalized;
}

function buildFlowCaseFoldersUrl({apiDomain, projectId, campaignId}) {
  const url = new URL(`${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/flow-case-folders`);
  const normalizedCampaignId = normalizeOptionalPositiveInteger(campaignId, "campaignId");
  if (normalizedCampaignId) url.searchParams.set("campaignId", normalizedCampaignId);
  return url.toString();
}

function buildFlowCasesUrl({apiDomain, projectId, folderName, testcaseId, campaignId, environment, platform, status}) {
  const url = new URL(`${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/flow-cases/by-folder`);
  const normalizedFolderName = String(folderName ?? "").trim();
  const normalizedTestcaseId = String(testcaseId ?? "").trim();
  const normalizedCampaignId = normalizeOptionalPositiveInteger(campaignId, "campaignId");
  const sources = [
    ["folderName", normalizedFolderName],
    ["testcaseId", normalizedTestcaseId],
    ["campaignId", normalizedCampaignId],
  ].filter(([, value]) => value);
  if (sources.length !== 1) {
    throw new Error("Flow-case API requests require exactly one of folderName, testcaseId, or campaignId.");
  }
  const [sourceKey, sourceValue] = sources[0];
  url.searchParams.set(sourceKey, sourceValue);
  url.searchParams.set("environment", String(environment ?? "").trim());
  if (String(platform ?? "").trim()) url.searchParams.set("platform", String(platform).trim());
  if (String(status ?? "").trim()) url.searchParams.set("status", String(status).trim());
  return url.toString();
}

function buildFlowCaseResultsUrl({apiDomain, projectId}) {
  return `${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/flow-cases/by-folder`;
}

function buildRunningFlowCaseCampaignsUrl({apiDomain, projectId}) {
  return `${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/test-campaigns/running`;
}

function buildCampaignTestCasesUrl({apiDomain, projectId, campaignId}) {
  const normalizedCampaignId = normalizeOptionalPositiveInteger(campaignId, "campaignId");
  if (!normalizedCampaignId) throw new Error("campaignId must be a positive integer.");
  return `${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/test-campaigns/${encodePathPart(normalizedCampaignId)}/testcases`;
}

function buildFlowCaseResultUrl({apiDomain, projectId, caseId}) {
  const normalizedCaseId = String(caseId ?? "").trim();
  if (!normalizedCaseId) throw new Error("caseId is required.");
  return `${normalizeApiDomain(apiDomain)}/api/v1/projects/${encodePathPart(projectId)}/flow-cases/${encodePathPart(normalizedCaseId)}`;
}

function buildDeviceCompatibilityUrl({apiDomain}) {
  return `${normalizeApiDomain(apiDomain)}/api/v1/device-compatibility`;
}

function buildAppUpdateManifestUrl({apiDomain}) {
  return `${normalizeApiDomain(apiDomain)}/api/v1/app-updates/latest`;
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

async function requestJson(url, {
  method = "GET",
  body,
  authorization,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const duration = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
  const hasBody = body !== undefined;
  const authorizationValue = String(authorization ?? "").trim();
  const request = {
    method: String(method).toUpperCase(),
    url,
    headers: {
      Accept: "application/json",
      ...(hasBody ? {"Content-Type": "application/json"} : {}),
      ...(authorizationValue ? {"X-FlowTest-Service-Token": authorizationValue} : {}),
    },
    timeoutMs: duration,
    ...(hasBody ? {body} : {}),
  };
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, duration);

  try {
    const response = await fetchImpl(url, {
      method: request.method,
      headers: request.headers,
      ...(hasBody ? {body: JSON.stringify(body)} : {}),
      signal: controller.signal,
    });
    let responseBody;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    const responseDetails = {
      status: response.status,
      statusText: response.statusText || "",
      body: responseBody,
    };

    if (!response.ok) {
      return {
        ok: false,
        message: `API request failed with HTTP ${response.status}: ${responseMessage(response, responseBody)}`,
        timeout: false,
        request,
        response: responseDetails,
      };
    }

    return {ok: true, body: responseBody, request, response: responseDetails};
  } catch (error) {
    if (timedOut) {
      return {
        ok: false,
        message: `API request timed out after ${duration} ms.`,
        timeout: true,
        request,
        response: null,
      };
    }
    return {
      ok: false,
      message: `API request failed: ${error.message}`,
      timeout: false,
      request,
      response: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFlowCaseFolders({apiDomain, projectId, campaignId, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(buildFlowCaseFoldersUrl({apiDomain, projectId, campaignId}), {authorization, timeoutMs, fetchImpl});
  if (!result.ok) return result;

  try {
    return {
      ok: true,
      folders: flattenFlowCaseFolders(extractList(result.body, ["folders", "data"])),
      request: result.request,
      response: result.response,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      timeout: false,
      request: result.request,
      response: result.response,
    };
  }
}

async function fetchFlowCases({apiDomain, projectId, folderName, testcaseId, campaignId, environment, platform, status, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(
    buildFlowCasesUrl({apiDomain, projectId, folderName, testcaseId, campaignId, environment, platform, status}),
    {authorization, timeoutMs, fetchImpl}
  );
  if (!result.ok) return result;

  try {
    return {
      ok: true,
      cases: extractList(result.body, ["cases", "data"]),
      request: result.request,
      response: result.response,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      timeout: false,
      request: result.request,
      response: result.response,
    };
  }
}

async function fetchRunningFlowCaseCampaigns({apiDomain, projectId, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(
    buildRunningFlowCaseCampaignsUrl({apiDomain, projectId}),
    {authorization, timeoutMs, fetchImpl}
  );
  if (!result.ok) return result;

  try {
    return {
      ok: true,
      campaigns: extractList(result.body, ["data", "campaigns"]),
      request: result.request,
      response: result.response,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      timeout: false,
      request: result.request,
      response: result.response,
    };
  }
}

async function fetchCampaignTestCases({apiDomain, projectId, campaignId, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(
    buildCampaignTestCasesUrl({apiDomain, projectId, campaignId}),
    {authorization, timeoutMs, fetchImpl}
  );
  if (!result.ok) return result;

  try {
    return {
      ok: true,
      cases: extractList(result.body, ["testcases", "cases", "data"]),
      request: result.request,
      response: result.response,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      timeout: false,
      request: result.request,
      response: result.response,
    };
  }
}

async function submitFlowCaseResults({apiDomain, projectId, folderPath, testcases, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(
    buildFlowCaseResultsUrl({apiDomain, projectId}),
    {
      method: "PATCH",
      body: {folderPath, testcases},
      authorization,
      timeoutMs,
      fetchImpl,
    }
  );
  if (!result.ok) return result;

  return {
    ok: true,
    request: result.request,
    response: result.response,
  };
}

async function submitFlowCaseResult({apiDomain, projectId, caseId, campaignId, status = "tested", testResult, authorization, timeoutMs, fetchImpl} = {}) {
  const normalizedCampaignId = String(campaignId ?? "").trim();
  const result = await requestJson(
    buildFlowCaseResultUrl({apiDomain, projectId, caseId}),
    {
      method: "PATCH",
      body: {
        ...(normalizedCampaignId ? {campaignId: normalizedCampaignId} : {}),
        status,
        testResult,
      },
      authorization,
      timeoutMs,
      fetchImpl,
    }
  );
  if (!result.ok) return result;

  return {
    ok: true,
    request: result.request,
    response: result.response,
  };
}

async function fetchDeviceCompatibilityCatalog({apiDomain, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(buildDeviceCompatibilityUrl({apiDomain}), {authorization, timeoutMs, fetchImpl});
  if (!result.ok) return result;
  return {ok: true, catalog: result.body, request: result.request, response: result.response};
}

async function fetchAppUpdateManifest({apiDomain, authorization, timeoutMs, fetchImpl} = {}) {
  const result = await requestJson(buildAppUpdateManifestUrl({apiDomain}), {authorization, timeoutMs, fetchImpl});
  if (!result.ok) return result;
  return {ok: true, manifest: result.body, request: result.request, response: result.response};
}

module.exports = {
  DEFAULT_API_DOMAIN,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_TIMEOUT_MS,
  normalizeApiDomain,
  normalizeTimeoutMs,
  buildFlowCaseFoldersUrl,
  buildFlowCasesUrl,
  buildFlowCaseResultsUrl,
  buildRunningFlowCaseCampaignsUrl,
  buildCampaignTestCasesUrl,
  buildFlowCaseResultUrl,
  buildDeviceCompatibilityUrl,
  buildAppUpdateManifestUrl,
  flattenFlowCaseFolders,
  fetchFlowCaseFolders,
  fetchFlowCases,
  fetchRunningFlowCaseCampaigns,
  fetchCampaignTestCases,
  fetchDeviceCompatibilityCatalog,
  fetchAppUpdateManifest,
  submitFlowCaseResults,
  submitFlowCaseResult,
};
