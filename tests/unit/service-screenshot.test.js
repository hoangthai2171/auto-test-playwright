const test = require("node:test");
const assert = require("node:assert/strict");

const {waitForServiceScreenImages} = require("../lib/service-screenshot");

test("waits two seconds before capturing a successful service screen", async () => {
  const waits = [];
  const page = {
    waitForTimeout: async (milliseconds) => waits.push(milliseconds),
  };
  const result = {
    steps: [{
      action: "press_ok",
      result: {type: "service", route: "specialModule", rowCount: 1},
    }],
  };

  const waited = await waitForServiceScreenImages(page, result);

  assert.equal(waited, true);
  assert.deepEqual(waits, [2000]);
});

test("waits two seconds before capturing a successful view-more screen", async () => {
  const waits = [];
  const page = {
    waitForTimeout: async (milliseconds) => waits.push(milliseconds),
  };
  const result = {
    steps: [{
      action: "press_ok",
      result: {type: "view_more", route: "category/123", rowCount: 3},
    }],
  };

  const waited = await waitForServiceScreenImages(page, result);

  assert.equal(waited, true);
  assert.deepEqual(waits, [2000]);
});

test("does not delay a non-service completion screenshot", async () => {
  const waits = [];
  const page = {
    waitForTimeout: async (milliseconds) => waits.push(milliseconds),
  };

  const waited = await waitForServiceScreenImages(page, {steps: []});

  assert.equal(waited, false);
  assert.deepEqual(waits, []);
});
