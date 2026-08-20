const test = require("node:test");
const assert = require("node:assert/strict");

const workflows = require("../lib/workflows");
const contentRows = require("../lib/content-rows");

test("skips a focused view-more poster with remote Right navigation", async () => {
  let focusedIndex = 0;
  const calls = [];
  const page = {
    evaluate: async (callback) => {
      const source = String(callback);
      if (source.includes("closest?.('.view_more[item_view_more=\"1\"]')")) {
        return focusedIndex === 0
          ? {id: "view-more", title: "", rect: {x: 280, y: 200, width: 150, height: 200}, isViewMore: true}
          : null;
      }
      if (source.includes('focused.getAttribute("title")')) {
        return focusedIndex === 0
          ? {id: "view-more-child", title: "", contentId: "", poster: "", rect: {x: 280, y: 200, width: 150, height: 200}}
          : {id: "poster-next", title: "Poster next", contentId: "next", poster: "next.png", rect: {x: 460, y: 200, width: 150, height: 200}};
      }
      if (source.includes("Math.abs(Math.round(rect.y) - targetY)")) return true;
      if (source.includes("rect.width >= 100")) return true;
      return false;
    },
  };

  contentRows.configureContentRows({
    remotePress: async (_page, key) => {
      calls.push(key);
      assert.equal(key, "ArrowRight");
      focusedIndex = 1;
    },
  });

  const result = await workflows.__internal.skipFocusedViewMorePoster(page, {
    focusedItem: {id: "view-more-child", title: "", contentId: "", poster: ""},
    rowY: 200,
  });

  assert.deepEqual(result, {skipped: true, movedToNext: true});
  assert.deepEqual(calls, ["ArrowRight"]);
});

test("advances a list page from the focus it restored after playback", async () => {
  // The list page rebuilds its rows and restores its own row/column when the
  // player closes, so a position captured before playback can be stale.
  const state = {row: 0, col: 1, rowItemCount: 3};
  const page = {
    waitForTimeout: async () => {},
    evaluate: async (_callback, argument) => {
      if (!argument?.pattern) return null;
      return {
        profile: "content-grid",
        id: `specialModuleListRow_${state.row}_${state.col}`,
        idPrefix: "specialModuleListRow",
        row: state.row,
        col: state.col,
        rowId: `specialModuleListRow_${state.row}`,
        rowItemCount: state.rowItemCount,
        rect: {x: 100, y: 200, width: 233, height: 131},
      };
    },
  };

  contentRows.configureContentRows({
    remotePress: async (_page, key) => {
      if (key === "ArrowRight" && state.col < state.rowItemCount - 1) state.col += 1;
    },
  });

  const next = await workflows.__internal.advanceListPagePosition(page, {
    id: "specialModuleListRow_0_0",
    row: 0,
    col: 0,
    rowId: "specialModuleListRow_0",
    rowItemCount: 3,
  });

  assert.equal(next.id, "specialModuleListRow_0_2");
});
