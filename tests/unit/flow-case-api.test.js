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
  });
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
  });
});
