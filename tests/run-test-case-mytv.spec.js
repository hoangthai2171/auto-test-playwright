const path = require("node:path");
const {test} = require("./fixtures/mytv-session-fixture");
const {loadLocalTestCases, loadCachedTestCases, findTestCaseById} = require("./lib/test-case-source");
const {runTestCase} = require("./lib/test-case-action-runner");

test("run server-driven MyTV test case", async ({page, options}, testInfo) => {
  const fixturePath = process.env.TEST_CASE_PATH || path.resolve(__dirname, "../testcased.json");
  const cases = process.env.TEST_CASE_FOLDER_ID
    ? await loadCachedTestCases(process.env.TEST_CASE_CACHE_PATH, process.env.TEST_CASE_FOLDER_ID)
    : await loadLocalTestCases(fixturePath);
  const testCase = findTestCaseById(cases, process.env.TEST_CASE_ID);
  const source = process.env.TEST_CASE_FOLDER_ID ? "api-cache" : "local";
  await runTestCase(page, testInfo, testCase, {source, APP_URL: options.APP_URL});
});
