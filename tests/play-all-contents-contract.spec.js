// Contract spec for play_all_contents. It drives the real traversal loop against
// a simulated content-list page - reading order, the count/rowCount bounds,
// per-poster evidence, continue-after-failure, and the route guard - so the loop
// is covered without a live app. `test.step` is why this runs under the
// Playwright runner instead of tests/unit.
const {test, expect} = require("playwright/test");
const workflows = require("./lib/workflows");
const contentRows = require("./lib/content-rows");

function createListPage({rowLengths, route = "specialModuleList", failAt = []}) {
  const state = {row: 0, col: 0, presses: [], activations: [], playerOpen: false};
  const rows = [...rowLengths];
  const cardId = (row, col) => `specialModuleListRow_${row}_${col}`;
  const focusedMetadata = () => ({
    id: cardId(state.row, state.col),
    title: `Poster ${state.row}-${state.col}`,
    contentId: `${state.row}${state.col}`,
    poster: `poster-${state.row}-${state.col}.jpg`,
    rect: {x: 100, y: 200 + state.row * 300, width: 233, height: 131},
  });

  const page = {
    url: () => `https://app.test/#${route}?module_id=1`,
    waitForTimeout: async () => {},
    screenshot: async () => Buffer.from("png"),
    keyboard: {press: async () => {}},
    evaluate: async (callback, argument) => {
      const source = String(callback);

      if (argument?.rowSelector) {
        return {
          contract: argument.contract,
          rows: rows.map((length, rowIndex) => ({
            rowId: `specialModuleListRow_${rowIndex}`,
            title: "",
            onScreen: true,
            items: Array.from({length}, (_unused, colIndex) => ({
              id: cardId(rowIndex, colIndex),
              title: `Poster ${rowIndex}-${colIndex}`,
              label: `Poster ${rowIndex}-${colIndex}`,
              contentId: `${rowIndex}${colIndex}`,
              attributes: {},
              poster: `poster-${rowIndex}-${colIndex}.jpg`,
              isViewMore: false,
              rect: {x: 100 + colIndex * 250, y: 200 + rowIndex * 300, width: 233, height: 131},
              visible: true,
            })),
          })),
        };
      }

      // getFocusedListPagePosition passes the id pattern source.
      if (typeof argument === "string" && argument.includes("\\d+)_(")) {
        return {
          id: cardId(state.row, state.col),
          idPrefix: "specialModuleListRow",
          row: state.row,
          col: state.col,
          rowId: `specialModuleListRow_${state.row}`,
          rowItemCount: rows[state.row],
          rect: focusedMetadata().rect,
        };
      }

      if (source.includes("item_view_more")) return null;
      if (source.includes('focused.getAttribute("title")')) return focusedMetadata();
      if (source.includes("rect.width >= 100")) return true;
      if (source.includes("closePatternSource")) return null;
      if (source.includes('querySelectorAll("video")')) {
        const failing = failAt.includes(cardId(state.row, state.col));
        return {hasVideo: state.playerOpen && !failing, isProbablyPlaying: state.playerOpen && !failing, reason: failing ? "no video" : ""};
      }
      if (source.includes("#promo-video-next")) return {open: state.playerOpen};
      if (source.includes("dialog_confirm_v2")) return {visible: false, unexpectedVisible: false};
      if (source.includes("cate_content_item")) return true;
      return false;
    },
  };

  contentRows.configureContentRows({
    remotePress: async (_page, key) => {
      state.presses.push(key);
      if (key === "ArrowRight" && state.col < rows[state.row] - 1) state.col += 1;
      else if (key === "ArrowLeft" && state.col > 0) state.col -= 1;
      else if (key === "ArrowDown" && state.row < rows.length - 1) {
        state.row += 1;
        state.col = Math.min(state.col, rows[state.row] - 1);
      }
    },
    remoteFocusById: async () => {},
    remoteFocusByText: async () => {},
    getFocusedState: async () => ({id: cardId(state.row, state.col), text: "", label: "", rect: focusedMetadata().rect}),
    getPlayerState: async () => ({hasVideo: state.playerOpen, isProbablyPlaying: state.playerOpen}),
    hasVisibleText: async () => false,
    activateVerifiedTarget: async (_page, options) => {
      state.activations.push(options.expectedId);
      state.playerOpen = true;
    },
    observePlayerOrDetailState: async () => ({open: state.playerOpen}),
    observeExitConfirmation: async () => ({visible: false, unexpectedVisible: false}),
    closePlayerOrDetail: async (candidatePage, options = {}) => {
      state.playerOpen = false;
      if (typeof options.isClosed === "function") {
        expect(await options.isClosed(candidatePage)).toBe(true);
      }
    },
  });

  return {page, state};
}

test("plays every poster of a simulated list page in reading order", async ({}, testInfo) => {
  const {page, state} = createListPage({rowLengths: [2, 2]});

  const result = await workflows.playAllListPageContents(page, testInfo, {waitSeconds: 0});

  expect(result.type).toBe("play_all_contents");
  expect(result.route).toBe("specialModuleList");
  expect(result.results.map((item) => item.id)).toEqual([
    "specialModuleListRow_0_0",
    "specialModuleListRow_0_1",
    "specialModuleListRow_1_0",
    "specialModuleListRow_1_1",
  ]);
  expect(result.results.every((item) => item.status === "playable")).toBe(true);
  expect(result.results.every((item) => item.screenshotDataUrl.startsWith("data:image/png"))).toBe(true);
  expect(state.activations).toEqual(result.results.map((item) => item.id));
  expect(result.budget.reason).toBe("list-exhausted");
});

test("stops a list run at the requested row count", async ({}, testInfo) => {
  const {page} = createListPage({rowLengths: [2, 2, 2]});

  const result = await workflows.playAllListPageContents(page, testInfo, {waitSeconds: 0, rowCount: 2});

  expect(result.results.map((item) => item.id)).toEqual([
    "specialModuleListRow_0_0",
    "specialModuleListRow_0_1",
    "specialModuleListRow_1_0",
    "specialModuleListRow_1_1",
  ]);
  expect(result.budget.reason).toBe("row-limit");
});

test("stops a list run at the requested poster count", async ({}, testInfo) => {
  const {page} = createListPage({rowLengths: [3, 3]});

  const result = await workflows.playAllListPageContents(page, testInfo, {waitSeconds: 0, count: 4});

  expect(result.results.map((item) => item.id)).toEqual([
    "specialModuleListRow_0_0",
    "specialModuleListRow_0_1",
    "specialModuleListRow_0_2",
    "specialModuleListRow_1_0",
  ]);
  expect(result.budget.reason).toBe("item-limit");
});

test("keeps going after one poster fails and then fails the action", async ({}, testInfo) => {
  const {page} = createListPage({rowLengths: [2], failAt: ["specialModuleListRow_0_0"]});

  const error = await workflows
    .playAllListPageContents(page, testInfo, {waitSeconds: 0})
    .then(() => null, (caught) => caught);

  expect(error).not.toBeNull();
  expect(error.message).toContain("1 list content item(s) failed to play");
  expect(error.details.results.map((item) => item.status)).toEqual(["failed", "playable"]);
});

test("refuses a screen that is not a supported content-list page", async ({}, testInfo) => {
  const {page} = createListPage({rowLengths: [2], route: "homeNewUI"});

  const error = await workflows
    .playAllListPageContents(page, testInfo, {waitSeconds: 0})
    .then(() => null, (caught) => caught);

  expect(error?.message).toContain("homeNewUI");
});

test("refuses the channel list with its own message", async ({}, testInfo) => {
  const {page} = createListPage({rowLengths: [2], route: "channel-list"});

  const error = await workflows
    .playAllListPageContents(page, testInfo, {waitSeconds: 0})
    .then(() => null, (caught) => caught);

  expect(error?.message).toContain("channel-list");
});
