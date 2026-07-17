const path = require("node:path");
const {test} = require("./fixtures/mytv-session-fixture");
const {loadLocalTestCases, findTestCaseById} = require("./lib/test-case-source");
const {runTestCase} = require("./lib/test-case-action-runner");

test("run server-driven MyTV test case", async ({page, options}, testInfo) => {
  const fixturePath = process.env.TEST_CASE_PATH || path.resolve(__dirname, "../testcased.json");
  const cases = await loadLocalTestCases(fixturePath);
  const testCase = findTestCaseById(cases, process.env.TEST_CASE_ID);
  await runTestCase(page, testInfo, testCase, {source: "local", APP_URL: options.APP_URL});
});
