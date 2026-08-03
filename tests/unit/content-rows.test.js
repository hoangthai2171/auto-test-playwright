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

test("uses remote navigation to focus an indexed poster beyond the visible row window", async () => {
  const virtualRow = createVirtualizedRowPage({
    totalItems: 10,
    initialFocusedIndex: 3,
  });
  const {page, calls, state} = virtualRow;

  contentRows.configureContentRows({
    getFocusedState: async () => state(),
    remotePress: async (_page, key, _delay, options = {}) => {
      calls.push(["press", key]);
      if (key === "ArrowLeft") {
        virtualRow.focusedIndex = Math.max(0, virtualRow.focusedIndex - 1);
      } else if (key === "ArrowRight") {
        virtualRow.focusedIndex = Math.min(9, virtualRow.focusedIndex + 1);
      }
      options.snapshotCache?.invalidate();
    },
    remoteFocusById: async (_page, id) => {
      calls.push(["focus", id]);
      virtualRow.focusedIndex = Number(id.replace("item-", ""));
    },
  });

  const focusedRow = await contentRows.focusRequestedContentRow(page, {
    rowName: "Thịnh hành",
    itemIndex: 7,
  });

  assert.equal(virtualRow.focusedIndex, 6);
  assert.equal(focusedRow.title, "Thịnh hành");
  assert.deepEqual(
    calls.filter(([type, key]) => type === "press" && key === "ArrowRight"),
    Array.from({length: 6}, () => ["press", "ArrowRight"])
  );
});

test("reports the furthest reachable index when a row ends before the request", async () => {
  const virtualRow = createVirtualizedRowPage({
    totalItems: 3,
    initialFocusedIndex: 0,
  });
  const {page, calls, state} = virtualRow;

  contentRows.configureContentRows({
    getFocusedState: async () => state(),
    remotePress: async (_page, key, _delay, options = {}) => {
      calls.push(["press", key]);
      if (key === "ArrowRight") virtualRow.focusedIndex = Math.min(2, virtualRow.focusedIndex + 1);
      options.snapshotCache?.invalidate();
    },
    remoteFocusById: async (_page, id) => {
      virtualRow.focusedIndex = Number(id.replace("item-", ""));
    },
  });

  await assert.rejects(
    contentRows.focusRequestedContentRow(page, {
      rowName: "Thịnh hành",
      itemIndex: 7,
    }),
    /Hàng\/cate "Thịnh hành" chỉ có thể focus đến nội dung thứ 3; không thể focus nội dung thứ 7/u
  );

  assert.equal(virtualRow.focusedIndex, 2);
  assert.ok(calls.some(([type, key]) => type === "press" && key === "ArrowRight"));
});

function createVirtualizedRowPage({totalItems, initialFocusedIndex}) {
  let focusedIndex = initialFocusedIndex;
  const calls = [];
  const page = {
    evaluate: async (callback, argument) => {
      if (Array.isArray(argument)) return {route: "/", container: "content"};
      if (argument && typeof argument === "object" && Array.isArray(argument.rootSelectors)) {
        const firstVisibleIndex = Math.max(0, focusedIndex - 4);
        const records = Array.from({length: Math.min(5, totalItems - firstVisibleIndex)}, (_, offset) => {
          const index = firstVisibleIndex + offset;
          return {
            id: `item-${index}`,
            text: `Poster ${index + 1}`,
            attrs: {title: `Poster ${index + 1}`},
            poster: `poster-${index}`,
            backgroundImage: "",
            rect: {x: 100 + offset * 180, y: 200, width: 150, height: 200},
            visible: true,
          };
        });
        return {
          records,
          headings: [{
            id: "row-heading",
            text: "Thịnh hành",
            rect: {x: 100, y: 100, width: 240, height: 30},
            visible: true,
          }],
          metrics: {
            rootFound: true,
            usedFallback: false,
            fallbackBlocked: false,
            rootSelector: ".content-area",
            rootCount: 1,
            candidateCount: records.length,
            headingCount: 1,
          },
        };
      }
      if (typeof argument === "string") return argument === `item-${focusedIndex}`;
      if (typeof argument === "number") return Math.abs(200 - argument) <= 80;

      const source = String(callback);
      if (source.includes(".row_service")) return [];
      if (source.includes('document.querySelector(".focused")')) return true;
      return undefined;
    },
  };

  return {
    page,
    calls,
    state: () => ({
      id: `item-${focusedIndex}`,
      text: `Poster ${focusedIndex + 1}`,
      label: `Poster ${focusedIndex + 1}`,
      rect: {x: 100, y: 200, width: 150, height: 200},
    }),
    get focusedIndex() {
      return focusedIndex;
    },
    set focusedIndex(value) {
      focusedIndex = value;
    },
  };
}

test("returns from playback through the shared adaptive close helper", async () => {
  let closeOptions;
  const page = {evaluate: async () => true};

  contentRows.configureContentRows({
    closePlayerOrDetail: async (_page, options) => {
      closeOptions = options;
      assert.equal(await options.isClosed(page), true);
    },
  });

  await contentRows.returnToFirstRowContent(page, {
    item: null,
    rowY: 200,
  });

  assert.equal(typeof closeOptions.isClosed, "function");
  assert.equal(closeOptions.maxBackPresses, 2);
  assert.equal(closeOptions.backDelayMs, 1800);
});
