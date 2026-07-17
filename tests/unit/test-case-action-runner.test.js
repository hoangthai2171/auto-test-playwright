const test = require("node:test");
const assert = require("node:assert/strict");

const { createActionRunner } = require("../lib/test-case-action-runner");

test("runs each declared action through its handler in order", async () => {
  const events = [];
  const runTestCase = createActionRunner({
    handlers: {
      open_service: async (action) => {
        events.push(`handler:${action.action}:${action.service}`);
      },
      play_all_items_in_first_row: async (action) => {
        events.push(`handler:${action.action}:${action.itemLimit}`);
      },
    },
    stepRunner: async (title, step) => {
      events.push(`step:${title}`);
      return step();
    },
  });

  await runTestCase({
    id: "12066",
    name: "Vào phim truyện",
    actions: [
      { action: "open_service", service: "Phim truyện" },
      { action: "play_all_items_in_first_row", itemLimit: 2 },
    ],
  });

  assert.deepEqual(events, [
    "step:open_service",
    "handler:open_service:Phim truyện",
    "step:play_all_items_in_first_row",
    "handler:play_all_items_in_first_row:2",
  ]);
});

