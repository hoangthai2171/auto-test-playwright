const test = require("node:test");
const assert = require("node:assert/strict");

const {
  attachPlaybackBatchReport,
  attachSearchNoResultArtifacts,
  captureCurrentAppScreenshot,
} = require("../lib/artifacts");

test("captures a completion screenshot as both an attachment and report-ready data URL", async () => {
  const attachments = [];
  const page = {
    screenshot: async (options) => {
      assert.deepEqual(options, {fullPage: false});
      return Buffer.from("png");
    },
  };
  const testInfo = {
    attach: async (name, value) => attachments.push({name, value}),
  };

  const screenshot = await captureCurrentAppScreenshot(page, testInfo, "test-passed");

  assert.equal(screenshot, "data:image/png;base64,cG5n");
  assert.deepEqual(attachments, [{
    name: "test-passed.png",
    value: {
      body: Buffer.from("png"),
      contentType: "image/png",
    },
  }]);
});

test("generic playback reports include player screenshots for every item status", async () => {
  const attachments = [];
  const testInfo = {
    attach: async (name, value) => attachments.push({name, value}),
  };
  const results = [
    {
      index: 1,
      name: "Trailer A",
      status: "playable",
      screenshot: "home-trailer-1-player-check.png",
      screenshotDataUrl: "data:image/png;base64,playable",
    },
    {
      index: 2,
      name: "Album trailer",
      status: "album_opened",
      activationType: "album_detail",
      screenshot: "home-trailer-2-album-detail-check.png",
      screenshotDataUrl: "data:image/png;base64,album",
    },
    {
      index: 3,
      name: "Trailer B",
      status: "failed",
      screenshot: "home-trailer-2-player-check.png",
      screenshotDataUrl: "data:image/png;base64,failed",
      errorPopup: "Video did not start",
    },
  ];

  await attachPlaybackBatchReport(testInfo, results, {
    prefix: "home-trailer-playback",
    heading: "Home trailer player-check results",
    includeScreenshot: true,
  });

  const html = attachments.find(({name}) => name.endsWith(".html"))?.value.body || "";
  assert.match(html, /Home trailer player-check results/);
  assert.match(html, /data:image\/png;base64,playable/);
  assert.match(html, /data:image\/png;base64,album/);
  assert.match(html, /data:image\/png;base64,failed/);
  assert.match(html, /Ảnh kiểm tra player/);
  assert.match(html, /class="ok">album_opened/);
});

test("search failure artifacts normalize Vietnamese keywords without a runtime ReferenceError", async () => {
  const attachments = [];
  const page = {
    url: () => "https://example.test/search",
    screenshot: async () => Buffer.from("png"),
  };
  const testInfo = {
    attach: async (name, value) => attachments.push({name, value}),
  };

  await attachSearchNoResultArtifacts(page, testInfo, "Căn phòng tử thần");

  const jsonAttachment = attachments.find(({name}) => name.endsWith(".json"));
  assert.ok(jsonAttachment);
  const report = JSON.parse(jsonAttachment.value.body);
  assert.equal(report.normalizedKeyword, "can phong tu than");
});
