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
