const test = require("node:test");
const assert = require("node:assert/strict");

const contentRows = require("../lib/content-rows");
const {MAX_CLOSE_BACK_PRESSES} = require("../lib/playback");
const {ROW_RETURN_RENDER_DELAY_MS} = contentRows;

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

test("focuses a blank-name view-more poster through remote row navigation", async () => {
  let focusedIndex = 0;
  const calls = [];
  const page = {
    evaluate: async (_callback, argument) => {
      if (typeof argument === "string") return focusedIndex === 0;
      if (typeof argument === "number") {
        return focusedIndex === 2
          ? {
              id: "view-more",
              title: "",
              contentId: "",
              poster: "view-more.png",
              rect: {x: 460, y: 200, width: 150, height: 200},
              isViewMore: true,
            }
          : null;
      }
      return null;
    },
  };

  contentRows.configureContentRows({
    getFocusedState: async () => ({
      id: `poster-${focusedIndex}`,
      text: focusedIndex === 2 ? "" : `Poster ${focusedIndex + 1}`,
      label: focusedIndex === 2 ? "" : `Poster ${focusedIndex + 1}`,
      rect: {x: 100 + focusedIndex * 180, y: 200, width: 150, height: 200},
    }),
    remotePress: async (_page, key) => {
      calls.push(["press", key]);
      assert.equal(key, "ArrowRight");
      focusedIndex = Math.min(2, focusedIndex + 1);
    },
  });

  const focused = await contentRows.focusViewMorePosterInCurrentRow(page, {
    title: "Phim mới nhất",
    // The initial row snapshot can be below the viewport before focusing
    // reflows the active row upward; the helper must use the focused poster's
    // current geometry instead of this stale y coordinate.
    rowY: 915,
    items: [{id: "poster-0", title: "Poster 1", rect: {x: 100, y: 915, width: 150, height: 200}}],
  }, {targetLabel: "Xem tất cả"});

  assert.equal(focused.id, "view-more");
  assert.equal(focused.title, "");
  assert.equal(focused.isViewMore, true);
  assert.deepEqual(calls, [["press", "ArrowRight"], ["press", "ArrowRight"]]);
});

test("reports remote navigation failure when a known view-more poster cannot be reached", async () => {
  const page = {
    evaluate: async (_callback, argument) => {
      if (typeof argument === "string") return true;
      if (typeof argument === "number") return null;
      return null;
    },
  };

  contentRows.configureContentRows({
    getFocusedState: async () => ({
      id: "poster-0",
      text: "Poster 1",
      label: "Poster 1",
      rect: {x: 100, y: 200, width: 150, height: 200},
    }),
    remotePress: async () => {},
  });

  await assert.rejects(
    contentRows.focusViewMorePosterInCurrentRow(page, {
      title: "Phim mới nhất",
      rowY: 200,
      items: [
        {id: "poster-0", title: "Poster 1", rect: {x: 100, y: 200, width: 150, height: 200}},
        {id: "view-more", title: "", attributes: {item_view_more: "1"}, rect: {x: 280, y: 200, width: 150, height: 200}},
      ],
    }, {targetLabel: "Xem thêm"}),
    /view more.*Xem thêm.*Phim mới nhất.*không thể tiến tới/u
  );
});

test("reports a missing view-more poster when the row ends without the marker", async () => {
  let metadataEvaluateCalls = 0;
  const page = {
    evaluate: async (_callback, argument) => {
      if (typeof argument === "string") return true;
      if (typeof argument === "number") {
        metadataEvaluateCalls += 1;
        assert.ok(metadataEvaluateCalls <= 2);
        return null;
      }
      assert.deepEqual(argument, {
        targetRowY: 200,
        selector: '.view_more[item_view_more="1"]',
      });
      return false;
    },
  };

  contentRows.configureContentRows({
    getFocusedState: async () => ({
      id: "poster-0",
      text: "Poster 1",
      label: "Poster 1",
      rect: {x: 100, y: 200, width: 150, height: 200},
    }),
    remotePress: async () => {},
  });

  await assert.rejects(
    contentRows.focusViewMorePosterInCurrentRow(page, {
      title: "Phim",
      rowY: 200,
      items: [{id: "poster-0", title: "Poster 1", rect: {x: 100, y: 200, width: 150, height: 200}}],
    }, {targetLabel: "Xem tất cả"}),
    /Không thể focus poster view more "Xem tất cả" của hàng\/cate "Phim": Không tìm thấy poster view more/u
  );
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

test("maps a numeric Home row to the zero-based homePage2 row id", async () => {
  let requestedPrefix = "";
  const calls = [];
  const page = {
    evaluate: async (_callback, argument) => {
      if (Array.isArray(argument)) return {route: "/", container: "content"};
      if (typeof argument === "string") {
        if (argument === "homePage2_4_0") return true;
        requestedPrefix = argument;
        return {hasHomePageRows: true, targetId: "homePage2_4_0"};
      }
      if (argument && Array.isArray(argument.rootSelectors)) {
        return {
          records: [
            {
              id: "homePage2_4_0",
              text: "Poster 5",
              attrs: {title: "Poster 5", content_id: "content-5"},
              poster: "poster-5.png",
              backgroundImage: "",
              rect: {x: 100, y: 200, width: 150, height: 200},
              visible: true,
            },
          ],
          headings: [{
            id: "homePage2_4-heading",
            text: "Phim bộ hàng 5",
            rect: {x: 100, y: 100, width: 240, height: 30},
            visible: true,
          }],
          metrics: {rootFound: true, usedFallback: false, fallbackBlocked: false, rootSelector: ".content-area", rootCount: 1, candidateCount: 1, headingCount: 1},
        };
      }
      if (argument && typeof argument === "object") return true;
      return [];
    },
    waitForTimeout: async () => {},
  };

  contentRows.configureContentRows({
    remoteFocusById: async (_page, id) => calls.push(["focus", id]),
    remotePress: async (_page, key) => calls.push(["press", key]),
  });

  const row = await contentRows.focusRequestedContentRow(page, {rowIndex: 4});

  assert.equal(requestedPrefix, "homePage2_4_");
  assert.equal(row.items[0].id, "homePage2_4_0");
  assert.deepEqual(calls, [["focus", "homePage2_4_0"]]);
});

test("reveals an offscreen numeric Home row before direct focus", async () => {
  const calls = [];
  const inspections = [];
  let targetInViewport = false;
  const targetId = "homePage2_2_0";
  const page = {
    evaluate: async (callback, argument) => {
      const source = String(callback);
      if (Array.isArray(argument)) return {route: "/", container: "content"};
      if (source.includes("homePageItems")) {
        inspections.push(targetInViewport);
        return {
          hasHomePageRows: true,
          targetId: targetInViewport ? targetId : "",
        };
      }
      if (argument && Array.isArray(argument.rootSelectors)) {
        return {
          records: [{
            id: targetId,
            text: "Kênh 1",
            attrs: {title: "Kênh 1", content_id: "content-1"},
            poster: "poster-1.png",
            backgroundImage: "",
            rect: {x: 100, y: 200, width: 150, height: 200},
            visible: true,
          }],
          headings: [{
            id: "homePage2_2-heading",
            text: "Kênh yêu thích",
            rect: {x: 100, y: 100, width: 240, height: 30},
            visible: true,
          }],
          metrics: {
            rootFound: true,
            usedFallback: false,
            fallbackBlocked: false,
            rootSelector: ".content-area",
            rootCount: 1,
            candidateCount: 1,
            headingCount: 1,
          },
        };
      }
      if (typeof argument === "string") return argument === targetId;
      return [];
    },
  };

  contentRows.configureContentRows({
    remotePress: async (_page, key) => {
      calls.push(["press", key]);
      if (key === "ArrowDown") targetInViewport = true;
    },
    remoteFocusById: async (_page, id) => calls.push(["focus", id]),
  });

  const row = await contentRows.focusRequestedContentRow(page, {rowIndex: 2});

  assert.deepEqual(inspections, [false, true]);
  assert.deepEqual(calls, [["press", "ArrowDown"], ["focus", targetId]]);
  assert.equal(row.items[0].id, targetId);
});

test("waits for a numeric Home row to finish rendering after direct focus", async () => {
  const calls = [];
  const targetId = "homePage2_2_0";
  let scannerCalls = 0;
  let waitCalls = 0;
  const page = {
    evaluate: async (callback, argument) => {
      const source = String(callback);
      if (Array.isArray(argument)) return {route: "/", container: "content"};
      if (source.includes("homePageItems")) {
        return {hasHomePageRows: true, targetId};
      }
      if (argument && Array.isArray(argument.rootSelectors)) {
        scannerCalls += 1;
        if (scannerCalls === 1) {
          return {
            records: [],
            headings: [],
            metrics: {rootFound: true, usedFallback: false, fallbackBlocked: false, rootSelector: ".content-area", rootCount: 1, candidateCount: 0, headingCount: 0},
          };
        }
        return {
          records: [{
            id: targetId,
            text: "Kênh yêu thích",
            attrs: {title: "Kênh yêu thích", content_id: "content-1"},
            poster: "poster-1.png",
            backgroundImage: "",
            rect: {x: 100, y: 200, width: 150, height: 200},
            visible: true,
          }],
          headings: [{
            id: "homePage2_2-heading",
            text: "Kênh yêu thích",
            rect: {x: 100, y: 100, width: 240, height: 30},
            visible: true,
          }],
          metrics: {rootFound: true, usedFallback: false, fallbackBlocked: false, rootSelector: ".content-area", rootCount: 1, candidateCount: 1, headingCount: 1},
        };
      }
      if (typeof argument === "string") return argument === targetId;
      return [];
    },
    waitForTimeout: async () => {
      waitCalls += 1;
    },
  };

  contentRows.configureContentRows({
    remoteFocusById: async (_page, id) => calls.push(["focus", id]),
    remotePress: async (_page, key) => calls.push(["press", key]),
  });

  const row = await contentRows.focusRequestedContentRow(page, {rowIndex: 2});

  assert.equal(row.items[0].id, targetId);
  assert.equal(scannerCalls, 2);
  assert.equal(waitCalls, 1);
  assert.deepEqual(calls, [["focus", targetId]]);
});

test("uses a stable Home row ID while a titleless poster is partially visible", async () => {
  const calls = [];
  const targetId = "homePage2_2_0";
  const rowPrefix = "homePage2_2_";
  const page = {
    evaluate: async (callback, argument) => {
      const source = String(callback);
      if (Array.isArray(argument)) return {route: "/", container: "content"};
      if (source.includes("homePageItems")) {
        return {hasHomePageRows: true, targetId};
      }
      if (argument && Array.isArray(argument.rootSelectors)) {
        return {
          records: [],
          headings: [],
          metrics: {rootFound: true, usedFallback: false, fallbackBlocked: false, rootSelector: ".content-area", rootCount: 1, candidateCount: 0, headingCount: 0},
        };
      }
      if (argument === rowPrefix) {
        return {
          title: "",
          normalizedTitle: "",
          rowY: 692,
          items: [{
            id: targetId,
            title: "",
            contentId: "content-1",
            attributes: {},
            poster: "poster-1.png",
            rect: {x: 100, y: 692, width: 233, height: 131},
            visible: true,
          }],
        };
      }
      if (typeof argument === "string") return argument === targetId;
      return [];
    },
  };

  contentRows.configureContentRows({
    remoteFocusById: async (_page, id) => calls.push(["focus", id]),
    remotePress: async (_page, key) => calls.push(["press", key]),
  });

  const row = await contentRows.focusRequestedContentRow(page, {rowIndex: 2});

  assert.equal(row.items[0].id, targetId);
  assert.deepEqual(calls, [["focus", targetId]]);
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
  const waits = [];
  const page = {
    evaluate: async () => true,
    waitForTimeout: async (durationMs) => waits.push(durationMs),
  };

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
  assert.equal(closeOptions.maxBackPresses, MAX_CLOSE_BACK_PRESSES);
  assert.equal(closeOptions.backDelayMs, 1800);
  assert.equal(closeOptions.boundaryTimeoutMs, 3000);
  assert.equal(typeof closeOptions.dismissUnexpectedPopup, "function");
  assert.deepEqual(waits, [ROW_RETURN_RENDER_DELAY_MS]);
});

test("stops row cleanup at Home even when focus returns to a different row", async () => {
  let settled = false;
  let closeOptions;
  const page = {
    evaluate: async (callback) => {
      const source = String(callback);
      if (source.includes("routeLooksLikePlayerOrDetail")) return {open: false, routeValue: "homeNewUI"};
      if (source.includes("homeNewUI")) return true;
      if (source.includes("querySelectorAll(\".focused\")")) return settled;
      return false;
    },
    waitForTimeout: async () => {
      settled = true;
    },
  };

  contentRows.configureContentRows({
    closePlayerOrDetail: async (_page, options) => {
      closeOptions = options;
      assert.equal(await options.isClosed(page), true);
    },
  });

  await contentRows.returnToFirstRowContent(page, {item: null, rowY: 200});

  assert.equal(typeof closeOptions.isClosed, "function");
  assert.equal(settled, true);
});

test("opens a focused row poster through the verified content activation path", async () => {
  let activationOptions;
  const page = {
    evaluate: async () => ({
      id: "poster-1",
      title: "Poster 1",
      poster: "poster-1.png",
      rect: {x: 100, y: 200, width: 150, height: 200},
    }),
  };

  contentRows.configureContentRows({
    activateVerifiedTarget: async (_page, options) => {
      activationOptions = options;
    },
    getPlayerState: async () => ({hasVideo: true, isProbablyPlaying: true}),
  });

  await contentRows.openFocusedContentForPlayback(page, {id: "test-info"});

  assert.equal(activationOptions.testInfo.id, "test-info");
  assert.equal(activationOptions.contractName, "contentItem");
  assert.equal(activationOptions.expectedId, "poster-1");
  assert.equal(activationOptions.expectedLabel, "Poster 1");
});

test("retries Enter once when the same focused poster only completed a 1920x1080 carousel reflow", async () => {
  const activations = [];
  let playerOpen = false;
  const page = {
    evaluate: async () => ({
      id: "poster-1",
      title: "Poster 1",
      poster: "poster-1.png",
      rect: {x: 100, y: 200, width: 150, height: 200},
    }),
  };

  contentRows.configureContentRows({
    activateVerifiedTarget: async (_page, options) => {
      activations.push(options);
      if (activations.length === 2) playerOpen = true;
    },
    getPlayerState: async () => ({hasVideo: playerOpen, isProbablyPlaying: playerOpen}),
    observePlayerOrDetailState: async () => ({open: false}),
  });

  await contentRows.openFocusedContentForPlayback(page, {id: "test-info"});

  assert.equal(activations.length, 2);
  assert.match(activations[1].name, /reflow-retry$/u);
  assert.equal(activations[1].expectedId, "poster-1");
});

test("does not treat an empty video element as an active player", async () => {
  let focused = {id: "poster-1", text: "Poster 1", label: "Poster 1"};
  const activations = [];
  const page = {
    evaluate: async () => ({
      id: focused.id,
      title: focused.text,
      poster: "poster-1.png",
      rect: {x: 100, y: 200, width: 150, height: 200},
    }),
  };

  contentRows.configureContentRows({
    activateVerifiedTarget: async (_page, options) => {
      activations.push(options);
      if (activations.length === 2) focused = {id: "detail-play", text: "Xem ngay", label: "Xem ngay"};
    },
    getPlayerState: async () => ({hasVideo: false, isProbablyPlaying: false}),
    observePlayerOrDetailState: async () => ({open: true}),
    getFocusedState: async () => focused,
    hasVisibleText: async () => true,
    remoteFocusByText: async () => {
      focused = {id: "detail-play", text: "Xem ngay", label: "Xem ngay"};
    },
  });

  await contentRows.openFocusedContentForPlayback(page, {id: "test-info"});

  assert.equal(activations.length, 2);
  assert.equal(activations[0].expectedId, "poster-1");
  assert.equal(activations[1].expectedId, "detail-play");
  assert.equal(activations[1].expectedLabel, "Xem ngay");
});

test("uses target identity when a focused poster has no generic label", async () => {
  const page = {
    evaluate: async (callback, argument) => {
      if (typeof argument === "string") return argument === "poster-1";
      return false;
    },
  };

  await contentRows.focusFirstRowStart(page, {id: "poster-1"});
});

test("retries row focus while a visible row is still settling", async () => {
  let remoteFocusCalls = 0;
  let focused = false;
  const page = {
    evaluate: async (_callback, argument) => typeof argument === "string" ? focused : false,
    waitForTimeout: async () => {},
  };

  contentRows.configureContentRows({
    remoteFocusById: async () => {
      remoteFocusCalls += 1;
      if (remoteFocusCalls === 2) focused = true;
      if (remoteFocusCalls === 1) throw new Error("row still loading");
    },
  });

  await contentRows.focusFirstRowStart(page, {id: "poster-1"});

  assert.equal(remoteFocusCalls, 2);
});
