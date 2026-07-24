const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
