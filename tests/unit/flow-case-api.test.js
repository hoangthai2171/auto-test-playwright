const test = require("node:test");
const assert = require("node:assert/strict");

let api;
let loadError;

try {
  api = require("../../app/flow-case-api");
} catch (error) {
  loadError = error;
}

test("API module is available to unit tests", () => {
  assert.equal(loadError, undefined, loadError?.message);
});

test("normalizes API domain and positive timeout values", () => {
  assert.equal(api.normalizeApiDomain("  http://api.test/// "), "http://api.test");
  assert.equal(api.normalizeTimeoutMs(5), 5000);
  assert.equal(api.normalizeTimeoutMs("invalid"), 30000);
  assert.equal(api.normalizeTimeoutMs(0), 30000);
});

test("builds the flow-case folders URL", () => {
  assert.equal(
    api.buildFlowCaseFoldersUrl({apiDomain: "http://api.test/", projectId: "1"}),
    "http://api.test/api/v1/projects/1/flow-case-folders"
  );
});

test("builds a campaign-scoped flow-case folders URL", () => {
  assert.equal(
    api.buildFlowCaseFoldersUrl({apiDomain: "http://api.test/", projectId: "1", campaignId: "12"}),
    "http://api.test/api/v1/projects/1/flow-case-folders?campaignId=12"
  );
  assert.throws(
    () => api.buildFlowCaseFoldersUrl({projectId: "1", campaignId: "campaign-12"}),
    /campaignId must be a positive integer/
  );
});

test("builds encoded folder-case URL and uses the configured environment", () => {
  assert.equal(
    api.buildFlowCasesUrl({
      apiDomain: "http://api.test/",
      projectId: "1",
      folderName: "/Root/Play kênh",
      environment: "UI",
    }),
    "http://api.test/api/v1/projects/1/flow-cases/by-folder?folderName=%2FRoot%2FPlay+k%C3%AAnh&environment=UI"
  );
});

test("builds the flow-case result submission URL", () => {
  assert.equal(
    api.buildFlowCaseResultsUrl({apiDomain: "http://api.test/", projectId: "1"}),
    "http://api.test/api/v1/projects/1/flow-cases/by-folder"
  );
});

test("builds the running-campaign URL", () => {
  assert.equal(
    api.buildRunningFlowCaseCampaignsUrl({apiDomain: "http://api.test/", projectId: "1"}),
    "http://api.test/api/v1/projects/1/test-campaigns/running"
  );
});

test("builds a testcaseId lookup without also sending folderName", () => {
  assert.equal(
    api.buildFlowCasesUrl({
      apiDomain: "http://api.test/",
      projectId: "1",
      testcaseId: "1842",
      environment: "UI",
    }),
    "http://api.test/api/v1/projects/1/flow-cases/by-folder?testcaseId=1842&environment=UI"
  );
  assert.throws(
    () => api.buildFlowCasesUrl({projectId: "1", folderName: "/Root", testcaseId: "1842", environment: "UI"}),
    /exactly one of folderName, testcaseId, or campaignId/
  );
});

test("builds a campaign testcase lookup without also sending folderName", () => {
  assert.equal(
    api.buildFlowCasesUrl({
      apiDomain: "http://api.test/",
      projectId: "1",
      campaignId: "12",
      environment: "UI",
    }),
    "http://api.test/api/v1/projects/1/flow-cases/by-folder?campaignId=12&environment=UI"
  );
  assert.throws(
    () => api.buildFlowCasesUrl({projectId: "1", folderName: "/Root", campaignId: "12", environment: "UI"}),
    /exactly one of folderName, testcaseId, or campaignId/
  );
  assert.throws(
    () => api.buildFlowCasesUrl({projectId: "1", campaignId: "0", environment: "UI"}),
    /campaignId must be a positive integer/
  );
});

test("fetches the compatibility catalog through the X-FlowTest-Service-Token header", async () => {
  const calls = [];
  const result = await api.fetchDeviceCompatibilityCatalog({
    apiDomain: "https://api.example.test",
    authorization: "Bearer private",
    timeoutMs: 500,
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {ok: true, status: 200, json: async () => ({profiles: []})};
    },
  });

  assert.equal(api.buildDeviceCompatibilityUrl({apiDomain: "https://api.example.test/"}), "https://api.example.test/api/v1/device-compatibility");
  assert.equal(calls[0].url, "https://api.example.test/api/v1/device-compatibility");
  assert.equal(calls[0].options.headers["X-FlowTest-Service-Token"], "Bearer private");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(result.catalog, {profiles: []});
});

test("flattens nested folders while retaining each folder identity", () => {
  assert.deepEqual(api.flattenFlowCaseFolders([
    {id: "1", name: "Root", fullPath: "/Root", children: [
      {id: "2", name: "Child", fullPath: "/Root/Child", children: []},
    ]},
  ]), [
    {id: "1", name: "Root", fullPath: "/Root"},
    {id: "2", name: "Child", fullPath: "/Root/Child"},
  ]);
});

test("loads data-envelope folder responses", async () => {
  const result = await api.fetchFlowCaseFolders({
    apiDomain: "http://api.test",
    projectId: "1",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({data: [
        {id: "1", name: "Root", fullPath: "/Root", children: []},
      ]}),
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    folders: [{id: "1", name: "Root", fullPath: "/Root"}],
    request: {
      method: "GET",
      url: "http://api.test/api/v1/projects/1/flow-case-folders",
      headers: {Accept: "application/json"},
      timeoutMs: 30000,
    },
    response: {
      status: 200,
      statusText: "",
      body: {data: [{id: "1", name: "Root", fullPath: "/Root", children: []}]},
    },
  });
});

test("forwards a campaign ID when loading the folder tree", async () => {
  let requestUrl;
  const result = await api.fetchFlowCaseFolders({
    apiDomain: "http://api.test",
    projectId: "1",
    campaignId: "12",
    fetchImpl: async (url) => {
      requestUrl = url;
      return {ok: true, status: 200, json: async () => ({data: []})};
    },
  });

  assert.equal(requestUrl, "http://api.test/api/v1/projects/1/flow-case-folders?campaignId=12");
  assert.deepEqual(result.folders, []);
});

test("sends the configured API authorization value as the X-FlowTest-Service-Token header", async () => {
  let receivedHeaders;
  const result = await api.fetchFlowCaseFolders({
    apiDomain: "http://api.test",
    projectId: "1",
    authorization: "  Bearer private-token  ",
    fetchImpl: async (_url, {headers}) => {
      receivedHeaders = headers;
      return {ok: true, status: 200, json: async () => ({data: []})};
    },
  });

  assert.equal(receivedHeaders["X-FlowTest-Service-Token"], "Bearer private-token");
  assert.equal(receivedHeaders.Authorization, undefined);
  assert.equal(result.request.headers["X-FlowTest-Service-Token"], "Bearer private-token");
  assert.equal(result.request.headers.Authorization, undefined);
});

test("loads running campaigns from the data envelope with the configured X-FlowTest-Service-Token header", async () => {
  let request;
  const result = await api.fetchRunningFlowCaseCampaigns({
    apiDomain: "https://api.example.test",
    projectId: "1",
    authorization: "Bearer private-token",
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {
        ok: true,
        status: 200,
        json: async () => ({data: [{campaign: {id: "12", name: "Regression tháng 8"}, run: {status: "running"}}]}),
      };
    },
  });

  assert.equal(request.url, "https://api.example.test/api/v1/projects/1/test-campaigns/running");
  assert.equal(request.options.headers["X-FlowTest-Service-Token"], "Bearer private-token");
  assert.equal(request.options.headers.Authorization, undefined);
  assert.deepEqual(result.campaigns, [{campaign: {id: "12", name: "Regression tháng 8"}, run: {status: "running"}}]);
});

test("loads campaign-scoped cases through the campaignId query", async () => {
  let requestUrl;
  const result = await api.fetchFlowCases({
    apiDomain: "http://api.test",
    projectId: "1",
    campaignId: "12",
    environment: "UI",
    fetchImpl: async (url) => {
      requestUrl = url;
      return {ok: true, status: 200, json: async () => ({data: [{id: "1842", name: "Campaign copy", actions: []}]})};
    },
  });

  assert.equal(requestUrl, "http://api.test/api/v1/projects/1/flow-cases/by-folder?campaignId=12&environment=UI");
  assert.deepEqual(result.cases, [{id: "1842", name: "Campaign copy", actions: []}]);
});

test("reports an HTTP error without treating it as a timeout", async () => {
  const result = await api.fetchFlowCases({
    apiDomain: "http://api.test",
    projectId: "1",
    folderName: "/Root",
    environment: "UI",
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({message: "offline"}),
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    message: "API request failed with HTTP 503: offline",
    timeout: false,
    request: {
      method: "GET",
      url: "http://api.test/api/v1/projects/1/flow-cases/by-folder?folderName=%2FRoot&environment=UI",
      headers: {Accept: "application/json"},
      timeoutMs: 30000,
    },
    response: {status: 503, statusText: "Service Unavailable", body: {message: "offline"}},
  });
});

test("reports an API timeout distinctly", async () => {
  const result = await api.fetchFlowCaseFolders({
    apiDomain: "http://api.test",
    projectId: "1",
    timeoutMs: 5,
    fetchImpl: (_url, {signal}) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), {name: "AbortError"})));
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    message: "API request timed out after 5 ms.",
    timeout: true,
    request: {
      method: "GET",
      url: "http://api.test/api/v1/projects/1/flow-case-folders",
      headers: {Accept: "application/json"},
      timeoutMs: 5,
    },
    response: null,
  });
});

test("submits tested results with the required PATCH payload", async () => {
  let request;
  const testcases = [{
    id: "12074",
    status: "tested",
    testResult: {status: "success", message: "Testcase chạy thành công.", passed: 1, failed: 0},
  }];
  const result = await api.submitFlowCaseResults({
    apiDomain: "http://api.test",
    projectId: "1",
    folderPath: "/Boundary",
    testcases,
    authorization: "service-token",
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {ok: true, status: 200, statusText: "OK", json: async () => ({data: []})};
    },
  });

  assert.equal(request.url, "http://api.test/api/v1/projects/1/flow-cases/by-folder");
  assert.equal(request.options.method, "PATCH");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.equal(request.options.headers["X-FlowTest-Service-Token"], "service-token");
  assert.equal(request.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(request.options.body), {folderPath: "/Boundary", testcases});
  assert.deepEqual(result.request.body, {folderPath: "/Boundary", testcases});
  assert.equal(result.response.status, 200);
});

test("preserves campaignId on each result item in the PATCH body", async () => {
  let request;
  const testcases = [{
    id: "1842",
    campaignId: "12",
    status: "tested",
    testResult: {status: "success", message: "Testcase chạy thành công.", passed: 1, failed: 0},
  }];
  await api.submitFlowCaseResults({
    apiDomain: "http://api.test",
    projectId: "1",
    folderPath: "/Thai-test",
    testcases,
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {ok: true, status: 200, json: async () => ({data: []})};
    },
  });

  assert.deepEqual(JSON.parse(request.options.body), {folderPath: "/Thai-test", testcases});
});
