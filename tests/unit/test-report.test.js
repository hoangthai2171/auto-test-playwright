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
    rowPlaybackItems: [],
    homeTrailerItems: [],
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

test("reports every play_row item with content ID, result, and screenshot", () => {
  const entry = buildTestReportEntry({
    testCaseId: "case-row",
    testCaseName: "Play row",
    exitCode: 1,
    caseResult: {
      testCaseId: "case-row",
      name: "Play row",
      status: "failed",
      steps: [{
        action: "play_row",
        status: "failed",
        details: {
          results: [
            {
              index: 1,
              id: "homePage2_0_0",
              contentId: "162566",
              name: "Liễu Chu Ký",
              poster: "https://example.test/first.jpg",
              status: "playable",
              result: "pass",
              screenshotDataUrl: "data:image/png;base64,first",
            },
            {
              index: 2,
              id: "homePage2_0_1",
              contentId: "162567",
              name: "Failed poster",
              poster: "https://example.test/second.jpg",
              status: "failed",
              result: "fail",
              screenshotDataUrl: "data:image/png;base64,second",
              errorPopup: "Thiết bị không hỗ trợ",
            },
          ],
        },
      }],
    },
  });

  assert.deepEqual(entry.rowPlaybackItems, [
    {
      index: 1,
      id: "homePage2_0_0",
      contentId: "162566",
      name: "Liễu Chu Ký",
      poster: "https://example.test/first.jpg",
      status: "playable",
      result: "pass",
      screenshot: "data:image/png;base64,first",
      screenshotName: "",
      error: "",
    },
    {
      index: 2,
      id: "homePage2_0_1",
      contentId: "162567",
      name: "Failed poster",
      poster: "https://example.test/second.jpg",
      status: "failed",
      result: "fail",
      screenshot: "data:image/png;base64,second",
      screenshotName: "",
      error: "Thiết bị không hỗ trợ",
    },
  ]);

  const html = renderUserReport(upsertTestReport(createEmptyReport(), entry));
  assert.match(html, /Row Playback Results/);
  assert.match(html, /Liễu Chu Ký/);
  assert.match(html, /162566/);
  assert.match(html, />pass</);
  assert.match(html, /data:image\/png;base64,first/);
  assert.match(html, /Failed poster/);
  assert.match(html, /162567/);
  assert.match(html, />fail</);
  assert.match(html, /Thiết bị không hỗ trợ/);
  assert.match(html, /data:image\/png;base64,second/);
});

test("keeps every Home trailer name, status, and player screenshot on success", () => {
  const entry = buildTestReportEntry({
    testCaseId: "home-trailers-passed",
    testCaseName: "Play Home trailers",
    exitCode: 0,
    caseResult: {
      testCaseId: "home-trailers-passed",
      name: "Play Home trailers",
      status: "passed",
      steps: [{
        action: "play_home_trailers",
        result: {
          results: [
            {
              index: 1,
      name: "Trailer A",
      status: "playable",
      activationType: "player",
      screenshotDataUrl: "data:image/png;base64,trailer-a",
            },
            {
              index: 2,
              name: "Trailer B",
              status: "album_opened",
              activationType: "album_detail",
              screenshotDataUrl: "data:image/png;base64,trailer-b",
            },
          ],
        },
      }],
    },
  });

  assert.deepEqual(entry.homeTrailerItems, [
    {
      index: 1,
      name: "Trailer A",
      status: "playable",
      activationType: "player",
      screenshot: "data:image/png;base64,trailer-a",
      screenshotName: "",
      error: "",
    },
    {
      index: 2,
      name: "Trailer B",
      status: "album_opened",
      activationType: "album_detail",
      screenshot: "data:image/png;base64,trailer-b",
      screenshotName: "",
      error: "",
    },
  ]);
  const html = renderUserReport(upsertTestReport(createEmptyReport(), entry));
  assert.match(html, /Home Trailer Results/);
  assert.match(html, /Trailer A/);
  assert.match(html, /Trailer B/);
  assert.match(html, /data:image\/png;base64,trailer-a/);
  assert.match(html, /data:image\/png;base64,trailer-b/);
  assert.match(html, /album_detail/);
  assert.match(html, /Player\/Album Check Screenshot/);
});

test("keeps all accumulated Home trailer evidence when the action fails", () => {
  const entry = buildTestReportEntry({
    testCaseId: "home-trailers-failed",
    testCaseName: "Play Home trailers",
    exitCode: 1,
    caseResult: {
      testCaseId: "home-trailers-failed",
      name: "Play Home trailers",
      status: "failed",
      steps: [{
        action: "play_home_trailers",
        status: "failed",
        details: {
          results: [
            {
              index: 1,
              name: "Trailer A",
              status: "playable",
              activationType: "player",
              screenshotDataUrl: "data:image/png;base64,failed-case-a",
            },
            {
              index: 2,
              name: "Trailer B",
              status: "failed",
              activationType: "player",
              screenshotDataUrl: "data:image/png;base64,failed-case-b",
              errorPopup: "Video did not start",
            },
          ],
        },
      }],
    },
  });

  const html = renderUserReport(upsertTestReport(createEmptyReport(), entry));
  assert.equal(entry.homeTrailerItems.length, 2);
  assert.match(html, /Trailer A/);
  assert.match(html, /Trailer B/);
  assert.match(html, /data:image\/png;base64,failed-case-a/);
  assert.match(html, /data:image\/png;base64,failed-case-b/);
  assert.match(html, /Video did not start/);
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

test("preserves numbered row failure summaries as separate lines", () => {
  const report = upsertTestReport(createEmptyReport(), {
    id: "case-2287",
    name: "Playback",
    status: "failed",
    failedItems: [],
    error: "2 row content item(s) failed to play:\n1. 158218 - Ăn Chạy Yêu\n2. 155230 - Yêu Em",
  });
  const html = renderUserReport(report);

  assert.match(html, /error-summary/);
  assert.match(html, /1\. 158218 - Ăn Chạy Yêu\n2\. 155230 - Yêu Em/);
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
