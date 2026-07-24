const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createEmptyReport,
  buildTestReportEntry,
  upsertTestReport,
  renderUserReport,
} = require("../../app/test-report");

test("builds a compact passed test entry", () => {
  const entry = buildTestReportEntry({
    testCaseId: "case-1",
    testCaseName: "Home",
    exitCode: 0,
    caseResult: {
      testCaseId: "case-1",
      name: "Home",
      status: "passed",
      expectedResult: "Home is visible",
      completionScreenshotDataUrl: "data:image/png;base64,passed",
      steps: [],
    },
  });

  assert.deepEqual(entry, {
    id: "case-1",
    name: "Home",
    status: "passed",
    expectedResult: "Home is visible",
    completionScreenshot: "data:image/png;base64,passed",
    failedItems: [],
    error: "",
  });
});

test("extracts failed row items with poster and screenshot", () => {
  const entry = buildTestReportEntry({
    testCaseId: "case-2",
    testCaseName: "Playback",
    exitCode: 1,
    caseResult: {
      testCaseId: "case-2",
      name: "Playback",
      status: "failed",
      steps: [{
        result: {
          results: [{
            name: "Căn phòng tử thần",
            status: "failed",
            poster: "https://example.test/poster.jpg",
            screenshotDataUrl: "data:image/png;base64,abc",
          }],
        },
      }],
    },
  });

  assert.equal(entry.status, "failed");
  assert.deepEqual(entry.failedItems, [{
    name: "Căn phòng tử thần",
    poster: "https://example.test/poster.jpg",
    screenshot: "data:image/png;base64,abc",
  }]);
});

test("uses a failed step message when no failed item is available", () => {
  const entry = buildTestReportEntry({
    testCaseId: "case-3",
    testCaseName: "Open service",
    exitCode: 1,
    caseResult: {
      testCaseId: "case-3",
      name: "Open service",
      status: "failed",
      steps: [{
        action: "open_service",
        status: "failed",
        message: "Không thể tìm thấy dịch vụ kênh",
      }],
    },
  });

  assert.equal(entry.error, "Không thể tìm thấy dịch vụ kênh");
});

test("keeps a player-check screenshot on a failed expected result", () => {
  const entry = buildTestReportEntry({
    testCaseId: "player-failure",
    testCaseName: "Playback",
    exitCode: 1,
    caseResult: {
      testCaseId: "player-failure",
      name: "Playback",
      status: "failed",
      completionScreenshotDataUrl: "data:image/png;base64,player",
      steps: [{action: "expected_result", status: "failed", message: "Player did not start"}],
    },
  });
  const html = renderUserReport(upsertTestReport(createEmptyReport(), entry));

  assert.equal(entry.completionScreenshot, "data:image/png;base64,player");
  assert.match(html, /Player Check Screenshot/);
  assert.match(html, /data:image\/png;base64,player/);
});

test("shows the parser failure reason in the user report", () => {
  const entry = buildTestReportEntry({
    testCaseId: "case-unknown-step",
    testCaseName: "Unknown step",
    exitCode: 1,
    caseResult: {
      testCaseId: "case-unknown-step",
      name: "Unknown step",
      status: "failed",
      steps: [{
        action: "compile",
        status: "failed",
        message: "Không thể parse được bước: B3. Làm thao tác lạ",
      }],
    },
  });

  assert.equal(entry.error, "Không thể parse được bước: B3. Làm thao tác lạ");
});

test("renders a Details button and expandable failed-item table", () => {
  const report = upsertTestReport(createEmptyReport(), {
    id: "case-2",
    name: "Playback",
    status: "failed",
    failedItems: [{
      name: "Failed movie",
      poster: "https://example.test/poster.jpg",
      screenshot: "data:image/png;base64,abc",
    }],
    error: "",
  });
  const html = renderUserReport(report);

  assert.match(html, /Test ID/);
  assert.match(html, /Playback/);
  assert.match(html, />failed</);
  assert.match(html, />Details</);
  assert.match(html, /Failed Item Name/);
  assert.match(html, /Failed movie/);
  assert.match(html, /poster\.jpg/);
  assert.match(html, /data:image\/png/);
});

test("renders a passed test's expected result and completion screenshot in expandable details", () => {
  const report = upsertTestReport(createEmptyReport(), {
    id: "case-1",
    name: "Home",
    status: "passed",
    expectedResult: "Home is visible",
    completionScreenshot: "data:image/png;base64,passed",
    failedItems: [],
    error: "",
  });

  const html = renderUserReport(report);

  assert.match(html, /test-details-0/);
  assert.match(html, />Details</);
  assert.match(html, /Expected Result/);
  assert.match(html, /Home is visible/);
  assert.match(html, /Completion Screenshot/);
  assert.match(html, /completion-screenshot/);
  assert.match(html, /data:image\/png;base64,passed/);
  assert.match(html, /Screenshot after Home passed/);
  assert.doesNotMatch(html, /Passed Screenshot/);
});
