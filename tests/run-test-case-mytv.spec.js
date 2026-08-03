const path = require("node:path");
const fs = require("node:fs/promises");
const {test} = require("./fixtures/mytv-session-fixture");
const {loadLocalTestCases, loadCachedTestCases, findTestCaseById} = require("./lib/test-case-source");
const {runTestCase} = require("./lib/test-case-action-runner");
const {logoutApp} = require("./lib/app-cleanup");
const {captureCurrentAppScreenshot} = require("./lib/artifacts");
const {waitForServiceScreenImages} = require("./lib/service-screenshot");
const {normalizePlayerCheckTimeoutSeconds} = require("../app/test-configuration");

const HOME_TRAILER_CASE_TIMEOUT_MS = 10 * 60 * 1000;

async function writeCaseResult(resultPath, result) {
  if (!resultPath) return;

  await fs.mkdir(path.dirname(resultPath), {recursive: true});
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");
}

test("run server-driven MyTV test case", async ({page, options}, testInfo) => {
  const fixturePath = process.env.TEST_CASE_PATH || path.resolve(__dirname, "../testcased.json");
  const cases = process.env.TEST_CASE_FOLDER_ID
    ? await loadCachedTestCases(process.env.TEST_CASE_CACHE_PATH, process.env.TEST_CASE_FOLDER_ID)
    : await loadLocalTestCases(fixturePath);
  const testCase = findTestCaseById(cases, process.env.TEST_CASE_ID);
  const source = process.env.TEST_CASE_FOLDER_ID ? "api-cache" : "local";
  const resultPath = process.env.MYTV_CASE_RESULT_PATH;
  let result;
  let testError;

  if (isHomeTrailerCase(testCase)) {
    test.setTimeout(HOME_TRAILER_CASE_TIMEOUT_MS);
  }

  try {
    result = await runTestCase(page, testInfo, testCase, {
      source,
      APP_URL: options.APP_URL,
      playerCheckTimeoutSeconds: normalizePlayerCheckTimeoutSeconds(process.env.MYTV_PLAYER_CHECK_TIMEOUT_SECONDS),
    });
    await capturePassedTestScreenshot(page, testInfo, result);
  } catch (error) {
    testError = error;
    if (resultPath) {
      const caseResult = error?.testCaseResult || {
        testCaseId: String(testCase.id),
        name: testCase.name,
        status: "failed",
        steps: [],
        expectedResult: testCase.expectedResult || "",
      };
      await writeCaseResult(resultPath, caseResult);
    }
    throw error;
  } finally {
    try {
      await logoutApp(page);
    } catch (logoutError) {
      if (testError) {
        console.warn(`App logout cleanup failed after test failure: ${logoutError.message}`);
      } else {
        const failedResult = {
          ...(result || {}),
          testCaseId: String(testCase.id),
          name: testCase.name,
          status: "failed",
          source,
          steps: [
            ...(result?.steps || []),
            {
              index: result?.steps?.length || 0,
              action: "logout_cleanup",
              status: "failed",
              durationMs: 0,
              message: logoutError?.message || String(logoutError),
            },
          ],
          expectedResult: testCase.expectedResult || "",
        };
        await writeCaseResult(resultPath, failedResult);
        throw logoutError;
      }
    }

    if (result) await writeCaseResult(resultPath, result);
  }
});

function isHomeTrailerCase(testCase) {
  if (testCase?.actions?.some((action) => action?.action === "play_home_trailers")) {
    return true;
  }
  return /(?:chạy|phát|play)\s+(?:toàn bộ|tất cả|các)\s+(?:tra(?:iler|iller))\b[\s\S]*\b(?:trang chủ|home)\b/iu.test(
    String(testCase?.qaDescription || "")
  );
}

async function capturePassedTestScreenshot(page, testInfo, result) {
  const startedAt = Date.now();

  try {
    if (!result.completionScreenshotDataUrl) {
      await waitForServiceScreenImages(page, result);
      result.completionScreenshotDataUrl = await captureCurrentAppScreenshot(
        page,
        testInfo,
        "test-passed"
      );
    }
    result.steps.push({
      index: result.steps.length,
      action: "completion_screenshot",
      status: "passed",
      durationMs: Date.now() - startedAt,
      message: "",
    });
  } catch (error) {
    result.status = "failed";
    result.steps.push({
      index: result.steps.length,
      action: "completion_screenshot",
      status: "failed",
      durationMs: Date.now() - startedAt,
      message: error?.message || String(error),
    });
    if (error && typeof error === "object") error.testCaseResult = result;
    throw error;
  }
}
