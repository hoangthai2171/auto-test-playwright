const test = require("node:test");
const assert = require("node:assert/strict");

const contentRows = require("../lib/content-rows");

test("scans the Thể loại carousel until the requested service poster becomes visible", async () => {
  const rows = [
    {
      title: "Thể loại",
      items: [{id: "service-tv", title: "Truyền hình"}],
    },
    {
      title: "Thể loại",
      items: [{id: "service-sport", title: "Thể thao"}],
    },
  ];
  let position = 0;
  const calls = [];
  const page = {
    evaluate: async () => rows[position],
  };

  contentRows.configureContentRows({
    getFocusedState: async () => ({id: rows[position].items[0].id}),
    remotePress: async (_page, key) => {
      calls.push(["press", key]);
      assert.equal(key, "ArrowRight");
      position = 1;
    },
    remoteFocusById: async (_page, id, maxMoves) => calls.push(["focus", id, maxMoves]),
  });

  const focused = await contentRows.focusServiceCategoryItem(page, "Thể thao", {
    initialRow: rows[0],
  });

  assert.deepEqual(focused, rows[1].items[0]);
  assert.deepEqual(calls, [["press", "ArrowRight"]]);
});

test("does not mistake a wide Thể loại container for the requested service poster", async () => {
  const rows = [
    {
      title: "Thể loại",
      items: [{
        id: "homePage2_7_1",
        title: "World Cup 2026 Truyền hình World Cup 2026 Phim truyện Thiếu nhi Galaxy Play TV xem lại",
      }],
    },
    {
      title: "Thể loại",
      items: [{id: "service-tv-replay", title: "TV xem lại"}],
    },
  ];
  let position = 0;
  const calls = [];
  const page = {
    evaluate: async () => rows[position],
  };

  contentRows.configureContentRows({
    getFocusedState: async () => ({id: rows[position].items[0].id}),
    remotePress: async (_page, key) => {
      calls.push(["press", key]);
      position = 1;
    },
    remoteFocusById: async (_page, id) => calls.push(["focus", id]),
  });

  const focused = await contentRows.focusServiceCategoryItem(page, "TV xem lại", {
    initialRow: rows[0],
  });

  assert.deepEqual(focused, rows[1].items[0]);
  assert.deepEqual(calls, [["press", "ArrowRight"]]);
});

test("reaches a discovered Thể loại service with remote Right presses instead of geometric focus", async () => {
  const row = {
    title: "Thể loại",
    items: [
      {id: "service-tv", title: "Truyền hình"},
      {id: "service-replay", title: "TV xem lại"},
    ],
  };
  let focusedId = "service-tv";
  const calls = [];
  const page = {evaluate: async () => row};

  contentRows.configureContentRows({
    getFocusedState: async () => ({id: focusedId}),
    remotePress: async (_page, key) => {
      calls.push(["press", key]);
      focusedId = "service-replay";
    },
    remoteFocusById: async () => {
      throw new Error("geometric focus must not be used for a category poster");
    },
  });

  const focused = await contentRows.focusServiceCategoryItem(page, "TV xem lại", {
    initialRow: row,
  });

  assert.deepEqual(focused, row.items[1]);
  assert.deepEqual(calls, [["press", "ArrowRight"]]);
});

test("accepts a category poster when its focused child has the requested service text", async () => {
  const row = {
    title: "Thể loại",
    items: [
      {id: "service-tv", title: "Truyền hình"},
      {id: "service-replay", title: "TV xem lại"},
    ],
  };
  let focused = {id: "service-tv", text: "Truyền hình", label: "Truyền hình"};
  const calls = [];
  const page = {evaluate: async () => row};

  contentRows.configureContentRows({
    getFocusedState: async () => focused,
    remotePress: async (_page, key) => {
      calls.push(["press", key]);
      focused = {
        id: "service-replay-title",
        text: "TV xem lại",
        label: "TV xem lại",
      };
    },
  });

  const focusedService = await contentRows.focusServiceCategoryItem(page, "TV xem lại", {
    initialRow: row,
  });

  assert.deepEqual(focusedService, row.items[1]);
  assert.deepEqual(calls, [["press", "ArrowRight"]]);
});
