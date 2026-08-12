const test = require("node:test");
const assert = require("node:assert/strict");

const {
  intersectCampaignCasesById,
  submitCampaignResultsOrdered,
} = require("../../app/campaign-flow-case-workflow");

test("intersects folder cases by authoritative campaign copy ID and preserves campaign order", () => {
  const campaignCases = [
    {id: "copy-3", name: "Third", sourceFlowCaseId: "source-1"},
    {id: "copy-1", name: "First", sourceFlowCaseId: "source-3"},
    {id: "copy-2", name: "Second", sourceFlowCaseId: "source-2"},
  ];
  const folderCases = [
    {id: "copy-2", name: "Folder copy 2"},
    {id: "copy-3", name: "Folder copy 3"},
    {id: "unrelated", name: "Unrelated"},
  ];

  assert.deepEqual(intersectCampaignCasesById(campaignCases, folderCases), [campaignCases[0], campaignCases[2]]);
});

test("does not substitute sourceFlowCaseId during campaign/folder intersection", () => {
  assert.deepEqual(
    intersectCampaignCasesById(
      [{id: "copy-1", sourceFlowCaseId: "source-1", name: "Copy"}],
      [{id: "source-1", name: "Original"}],
    ),
    [],
  );
});

test("returns an empty intersection when either source has no cases", () => {
  assert.deepEqual(intersectCampaignCasesById([], [{id: "copy-1"}]), []);
  assert.deepEqual(intersectCampaignCasesById([{id: "copy-1"}], []), []);
});

test("rejects duplicate IDs that would make folder filtering ambiguous", () => {
  assert.throws(
    () => intersectCampaignCasesById([{id: "copy-1"}, {id: "copy-1"}], [{id: "copy-1"}]),
    /campaignCases contains duplicate testcase id copy-1/,
  );
  assert.throws(
    () => intersectCampaignCasesById([{id: "copy-1"}], [{id: "copy-1"}, {id: "copy-1"}]),
    /folderCases contains duplicate testcase id copy-1/,
  );
});

test("submits campaign results in order and reports all successful IDs", async () => {
  const calls = [];
  const result = await submitCampaignResultsOrdered({
    testcases: [{id: "copy-2"}, {id: "copy-1"}],
    submitOne: async (testCase) => {
      calls.push(testCase.id);
      return {ok: true};
    },
  });

  assert.deepEqual(calls, ["copy-2", "copy-1"]);
  assert.deepEqual(result, {
    ok: true,
    submittedTestcaseIds: ["copy-2", "copy-1"],
    failedTestcaseIds: [],
    unknownTestcaseIds: [],
    retryTestcaseIds: [],
    failures: [],
  });
});

test("continues after a failed result and keeps confirmed successes out of retry", async () => {
  const calls = [];
  const result = await submitCampaignResultsOrdered({
    testcases: [{id: "copy-1"}, {id: "copy-2"}, {id: "copy-3"}],
    submitOne: async (testCase) => {
      calls.push(testCase.id);
      if (testCase.id === "copy-2") return {ok: false, message: "HTTP 503"};
      return {ok: true};
    },
  });

  assert.deepEqual(calls, ["copy-1", "copy-2", "copy-3"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.submittedTestcaseIds, ["copy-1", "copy-3"]);
  assert.deepEqual(result.failedTestcaseIds, ["copy-2"]);
  assert.deepEqual(result.unknownTestcaseIds, []);
  assert.deepEqual(result.retryTestcaseIds, ["copy-2"]);
  assert.deepEqual(result.failures, [{id: "copy-2", message: "HTTP 503", timeout: false, unknown: false}]);
});

test("classifies timeout failures as unknown retry candidates without stopping later submissions", async () => {
  const result = await submitCampaignResultsOrdered({
    testcases: [{id: "copy-1"}, {id: "copy-2"}],
    submitOne: async (testCase) => {
      if (testCase.id === "copy-1") return {ok: false, message: "timed out", timeout: true};
      return {ok: true};
    },
  });

  assert.deepEqual(result.submittedTestcaseIds, ["copy-2"]);
  assert.deepEqual(result.failedTestcaseIds, []);
  assert.deepEqual(result.unknownTestcaseIds, ["copy-1"]);
  assert.deepEqual(result.retryTestcaseIds, ["copy-1"]);
  assert.deepEqual(result.failures, [{id: "copy-1", message: "timed out", timeout: true, unknown: true}]);
});

test("treats an incomplete submitter response as a failed result", async () => {
  const result = await submitCampaignResultsOrdered({
    testcases: [{id: "copy-1"}],
    submitOne: async () => undefined,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.submittedTestcaseIds, []);
  assert.deepEqual(result.retryTestcaseIds, ["copy-1"]);
});

test("rejects an empty campaign result list or missing submitter", async () => {
  await assert.rejects(
    () => submitCampaignResultsOrdered({testcases: []}),
    /requires at least one testcase/,
  );
  await assert.rejects(
    () => submitCampaignResultsOrdered({testcases: [{id: "copy-1"}]}),
    /submitter is required/,
  );
});
