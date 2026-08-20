const {expect}=require("playwright/test");
const {getSelectorContract}=require("./selectors");
const {createScopedDomScanner}=require("./dom-scan");
const {createDomSnapshotCache,getDomSnapshotIdentity}=require("./dom-snapshots");
const {normalizeVietnameseText}=require("./text-utils");
const playback=require("./playback");

const dependencies={
  remotePress:async(page,key,delay=250)=>{await page.keyboard.press(key);await page.waitForTimeout(delay);},
  remoteFocusById:async()=>{throw new Error("Content-row navigation dependency is not configured");},
  remoteFocusByText:async()=>{throw new Error("Content-row text-navigation dependency is not configured");},
  getFocusedState:async()=>({id:"",text:"",label:"",rect:{x:0,y:0,width:0,height:0}}),
  getPlayerState:async()=>({hasVideo:false,isProbablyPlaying:false}),
  hasVisibleText:async()=>false,
  expectFocusedText:async()=>{},
  activateVerifiedTarget:async()=>{throw new Error("Content-row activation dependency is not configured");},
  observePlayerOrDetailState:playback.observePlayerOrDetailState,
  observeExitConfirmation:playback.observeExitConfirmation,
  closePlayerOrDetail:playback.closePlayerOrDetail,
};

const CONTENT_ITEM_CONTRACT = getSelectorContract("contentItem");
const NAMED_ROW_MAX_ATTEMPTS = 45;
const NAMED_ROW_SCROLL_DELAY = 1500;
const SERVICE_CATEGORY_MAX_SCAN_STEPS = 40;
const ROW_HORIZONTAL_NAV_DELAY = 500;
const ROW_HORIZONTAL_NAV_MAX_STEPS = 100;
const ROW_RETURN_BOUNDARY_TIMEOUT_MS = 3000;
const ROW_RETURN_RENDER_DELAY_MS = 1500;
const HOME_PAGE_ROW_MAX_ATTEMPTS = 18;
const HOME_PAGE_ROW_RENDER_TIMEOUT_MS = 5000;
const HOME_PAGE_ROW_RENDER_POLLING_MS = 250;
const VIEW_MORE_POSTER_SELECTOR = '.view_more[item_view_more="1"]';
// Content cards carry their own labels (status badges, countdown timers,
// episode counters) that match the generic heading selector. They belong to a
// single card, so they must never be read as a row heading.
const CONTENT_ITEM_LABEL_ANCESTOR_SELECTOR = ".cate_content_item, [item_view_more]";
// The app wraps every carousel in a row container that owns the row's title
// element and its cards. Row identity, row membership and row titles are read
// from this structure so they never depend on where a carousel is scrolled to.
const ROW_CONTAINER_SELECTOR = ".cate_content_row";
const ROW_TITLE_SELECTOR = ".cate_content_row_title";
const CONTENT_CARD_SELECTOR = ".cate_content_item";
const STRUCTURAL_ROW_CONTRACT = "cate_content_row";
// Attributes that hold a card's own human label. The joined attribute blob used
// for fuzzy content matching also contains ids and flags (a service card
// carries content-id="0"), so an exact-match lookup needs this single value.
const CARD_LABEL_ATTRIBUTES = Object.freeze([
  "service_title",
  "service_name",
  "cate_name",
  "title",
  "title_text",
  "content_name",
  "channel_name",
  "movie_name",
  "vod_name",
]);
// A content-list page (specialModuleList, specialModuleListV2, shortHome) renders
// the same `.cate_content_row`/`.cate_content_item` structure as a service page,
// but as a grid whose ids encode the data position: `<idName>_<row>_<col>`.  Rows
// scrolled out of the visible window are detached from the DOM and the page loads
// the next batch of rows while focus approaches the end, so list-page traversal
// has to step with the remote and read the position back instead of collecting
// every row up front.
const LIST_PAGE_ITEM_ID_PATTERN = /^(.*)_(\d+)_(\d+)$/u;
const LIST_PAGE_STEP_DELAY_MS = 700;
// A vertical step can be dropped while the page is fetching the next batch of
// rows, so a failed step is retried before the grid is called exhausted.
const LIST_PAGE_STEP_MAX_ATTEMPTS = 4;
const LIST_PAGE_STEP_RETRY_DELAY_MS = 1500;
const ROW_HEADING_MAX_DISTANCE_PX = 150;
const FOCUS_SETTLE_TOLERANCE_PX = 4;
const FOCUS_SETTLE_TIMEOUT_MS = 3000;
const FOCUS_SETTLE_POLL_MS = 120;

function configureContentRows(next={}){Object.assign(dependencies,next);return module.exports;}
function createContentRowsApi(next={}){configureContentRows(next);return {collectVisibleContentRows,focusRequestedContentRow,focusViewMorePosterInCurrentRow,focusServiceCategoryItem,focusFirstItemInCurrentContentRow,findVisibleContentItemByName,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,getFocusedViewMoreMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback,getFocusedListPagePosition,expectFocusedListPageContent,focusListPageGridStart,moveToNextListPageContent,returnToListPageContent};}
function remotePress(...args){return dependencies.remotePress(...args);}
function remoteFocusById(...args){return dependencies.remoteFocusById(...args);}
function remoteFocusByText(...args){return dependencies.remoteFocusByText(...args);}
function getFocusedState(...args){return dependencies.getFocusedState(...args);}
function getPlayerState(...args){return dependencies.getPlayerState(...args);}
function hasVisibleText(...args){return dependencies.hasVisibleText(...args);}
function expectFocusedText(...args){return dependencies.expectFocusedText(...args);}
function activateVerifiedTarget(...args){return dependencies.activateVerifiedTarget(...args);}
function observePlayerOrDetailState(...args){return dependencies.observePlayerOrDetailState(...args);}
function observeExitConfirmation(...args){return dependencies.observeExitConfirmation(...args);}
async function collectFirstRowPlayableItems(page, options = {}) {
  const rows = await collectVisibleContentRows(page, options);
  return rows[0]?.items || [];
}

async function focusRequestedContentRow(page, rowSelector = {}) {
  const snapshotCache = typeof rowSelector === "object" && rowSelector.snapshotCache
    ? rowSelector.snapshotCache
    : createDomSnapshotCache();
  const selector =
    typeof rowSelector === "string"
      ? { rowName: rowSelector, itemIndex: 1 }
      : {
          rowName: rowSelector.rowName || "",
          rowIndex: Number.isInteger(rowSelector.rowIndex) ? rowSelector.rowIndex : undefined,
          rowPosition: rowSelector.rowPosition || "",
          itemIndex: Number.isInteger(rowSelector.itemIndex) ? rowSelector.itemIndex : 1,
        };

  const hasItemIndex = typeof rowSelector === "object" && rowSelector !== null &&
    Number.isInteger(rowSelector.itemIndex);
  const { rowName, rowIndex, rowPosition, itemIndex } = selector;
  if (!rowName) {
    const row = await findContentRowByPosition(page, { rowIndex, rowPosition, snapshotCache });
    const items = row.items;
    if (hasItemIndex) {
      return focusIndexedContentRow(page, row, itemIndex, {
        snapshotCache,
        rowName: row.title || "hiện tại",
      });
    }

    await focusFirstRowStart(page, items[0], {snapshotCache});
    return {
      title: row.title || "",
      rowY: row.rowY || items[0]?.rect.y || 0,
      items,
    };
  }

  const targetPattern = normalizeVietnameseText(rowName);
  const visitedRowTitles = new Set();
  // Home rows can be lazy-loaded below the initial promotional rows. Keep
  // scanning while remote Down navigation reveals additional rows instead of
  // failing before the requested category enters the DOM.
  for (let attempt = 0; attempt < NAMED_ROW_MAX_ATTEMPTS; attempt++) {
    const rows = await collectVisibleContentRows(page, {snapshotCache});
    rows.forEach((row) => {
      const title = String(row.title || "").trim();
      if (title) visitedRowTitles.add(title);
    });
    const serviceCategoryRow = await findServiceCategoryRow(page, targetPattern);
    if (serviceCategoryRow) {
      if (hasItemIndex) {
        return focusIndexedContentRow(page, serviceCategoryRow, itemIndex, {
          snapshotCache,
          rowName,
          rowPattern: targetPattern,
          allowServiceFocus: true,
        });
      }

      await focusFirstRowStart(page, serviceCategoryRow.items[0], {snapshotCache, allowServiceFocus: true});
      await expect.poll(() => isFocusedOnRowItems(page, serviceCategoryRow.items), { timeout: 6000 }).toBe(true);
      return serviceCategoryRow;
    }
    const matchedRow = findBestContentRowMatch(rows, targetPattern);
    if (matchedRow) {
      if (hasItemIndex) {
        return focusIndexedContentRow(page, matchedRow, itemIndex, {
          snapshotCache,
          rowName,
          rowPattern: targetPattern,
        });
      }

      await focusFirstRowStart(page, matchedRow.items[0], {snapshotCache});
      await expect.poll(() => isFocusedOnRowItems(page, matchedRow.items), { timeout: 6000 }).toBe(true);
      return matchedRow;
    }

    await remotePress(page, "ArrowDown", NAMED_ROW_SCROLL_DELAY, {snapshotCache});
  }

  const visibleRows = await collectVisibleContentRows(page, {snapshotCache});
  throw new Error(
    `Không tìm thấy hàng/cate "${rowName}". Các hàng đã quét: ${[...visitedRowTitles].join(", ")}. ` +
    `Các hàng đang thấy: ${visibleRows
      .map((row) => row.title || `y=${row.rowY}`)
      .join(", ")}`
  );
}

async function focusViewMorePosterInCurrentRow(page, row, options = {}) {
  const snapshotCache = options.snapshotCache || createDomSnapshotCache();
  const rowLabel = row?.title || options.rowName || "hiện tại";
  const targetLabel = options.targetLabel || "view more";
  const firstItem = row?.items?.[0];

  if (!firstItem) {
    throw viewMoreFocusError(rowLabel, targetLabel, "không có poster đầu tiên để bắt đầu");
  }

  await focusFirstRowStart(page, firstItem, {snapshotCache});
  // Focusing a row can reflow the carousel into the active viewport with a
  // smooth scroll, and the app drops keys sent mid-animation. Waiting for the
  // focused element to stop moving is about key pacing only - the row itself
  // is identified by its container below.
  let focusedState = await waitForFocusedGeometrySettled(page);
  const rowScope = {rowId: row?.rowId || "", rowY: resolveRowAnchorY(focusedState, row, firstItem)};
  if (!(await isFocusedOnRow(page, row, focusedState, rowScope.rowY))) {
    throw viewMoreFocusError(rowLabel, targetLabel, "focus không còn ở hàng đã chọn");
  }

  const visitedFocusStates = new Set([focusStateSignature(focusedState)]);
  for (let attempt = 0; attempt < ROW_HORIZONTAL_NAV_MAX_STEPS; attempt += 1) {
    const focusedViewMore = await getFocusedViewMoreMetadata(page, rowScope);
    if (focusedViewMore) return focusedViewMore;

    const beforeSignature = focusStateSignature(focusedState);
    await remotePress(page, "ArrowRight", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache});
    let nextState = await getFocusedState(page);

    if (!(await isFocusedOnRow(page, row, nextState, rowScope.rowY))) {
      // A row that is still scrolling can answer the press late. Re-check once
      // the focused element stops moving before calling this a row exit.
      nextState = await waitForFocusedGeometrySettled(page, {initialState: nextState});
      rowScope.rowY = resolveRowAnchorY(nextState, row, firstItem);
      if (!(await isFocusedOnRow(page, row, nextState, rowScope.rowY))) {
        throw viewMoreFocusError(rowLabel, targetLabel, "remote focus đã rời khỏi hàng");
      }
    }

    const nextSignature = focusStateSignature(nextState);
    const nextViewMore = await getFocusedViewMoreMetadata(page, rowScope);
    if (nextViewMore) return nextViewMore;
    if (nextSignature === beforeSignature || visitedFocusStates.has(nextSignature)) {
      throw viewMoreFocusError(
        rowLabel,
        targetLabel,
        await viewMoreNavigationFailureReason(
          page,
          row,
          rowScope,
          "remote focus không thể tiến tới poster cuối hàng",
        ),
      );
    }

    visitedFocusStates.add(nextSignature);
    focusedState = nextState;
  }

  throw viewMoreFocusError(
    rowLabel,
    targetLabel,
    await viewMoreNavigationFailureReason(
      page,
      row,
      rowScope,
      `đã vượt quá ${ROW_HORIZONTAL_NAV_MAX_STEPS} lần di chuyển`,
    ),
  );
}

async function viewMoreNavigationFailureReason(page, row, scope, fallbackReason) {
  const rowItems = row?.items || [];
  const rowHasMarker = rowItems.some((item) => {
    const attributes = item?.attributes || {};
    return item?.isViewMore === true ||
      String(attributes.item_view_more || item?.item_view_more || "").trim() === "1";
  });
  if (rowHasMarker) return fallbackReason;

  const rowId = typeof scope === "object" && scope !== null ? String(scope.rowId || "").trim() : "";
  const rowY = typeof scope === "number"
    ? scope
    : Number(typeof scope === "object" && scope !== null ? scope.rowY || 0 : 0);

  try {
    const hasMarker = await page.evaluate(({targetRowY, targetRowId, selector}) => {
      const container = targetRowId ? document.getElementById(targetRowId) : null;
      const scopeRoot = container || document;
      return Array.from(scopeRoot.querySelectorAll(selector)).some((poster) => {
        const rect = poster.getBoundingClientRect();
        const style = getComputedStyle(poster);
        const rendered = rect.width > 0 && rect.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
        if (!rendered) return false;
        // Scoping by row container makes the y window unnecessary.
        return container ? true : targetRowY <= 0 || Math.abs(rect.y - targetRowY) <= 80;
      });
    }, {targetRowY: rowY, targetRowId: rowId, selector: VIEW_MORE_POSTER_SELECTOR});
    return hasMarker ? fallbackReason : "Không tìm thấy poster view more";
  } catch {
    return fallbackReason;
  }
}

// `scope` is either a row descriptor/{rowId} - the structural answer - or a
// legacy rowY number used by screens without row containers.
async function getFocusedViewMoreMetadata(page, scope) {
  const rowId = typeof scope === "object" && scope !== null ? String(scope.rowId || "").trim() : "";
  const rowY = typeof scope === "number"
    ? scope
    : Number(typeof scope === "object" && scope !== null ? scope.rowY || 0 : 0);

  return page.evaluate(({targetRowY, targetRowId}) => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    const poster = focused?.closest?.('.view_more[item_view_more="1"]');
    if (!poster || !isVisible(poster)) return null;

    const rect = poster.getBoundingClientRect();
    const container = targetRowId ? document.getElementById(targetRowId) : null;
    if (container) {
      if (!container.contains(poster)) return null;
    } else if (targetRowY > 0 && Math.abs(rect.y - targetRowY) > 80) {
      return null;
    }

    const img = poster.querySelector("img");
    return {
      id: poster.id || focused.id || "",
      title: "",
      contentId: poster.getAttribute("content_id") || poster.getAttribute("content-id") ||
        poster.getAttribute("data-content-id") || "",
      poster: img?.currentSrc || img?.src || "",
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      isViewMore: true,
    };

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }
  }, {targetRowY: rowY, targetRowId: rowId});
}

// A row is titled by the closest heading above it. Distance ordering matters on
// Home: a label belonging to the row above can also fall inside this window and
// would otherwise win the row title.
function findRowHeading(headings, rowY) {
  return headings
    .filter((item) => item.rect.y < rowY && rowY - item.rect.y <= ROW_HEADING_MAX_DISTANCE_PX)
    .sort((a, b) => (rowY - a.rect.y) - (rowY - b.rect.y))[0];
}

// Row membership is a containment question, not a distance question: the app
// marks the focused element with `.focused`, and a row container owns its
// cards. Returns null when the screen exposes no row id to test against, so
// callers can fall back to the geometric predicate.
async function isFocusedInsideRow(page, rowId) {
  const targetId = String(rowId || "").trim();
  if (!targetId || typeof page?.evaluate !== "function") return null;

  try {
    const result = await page.evaluate(({rowContainerId}) => {
      const container = document.getElementById(rowContainerId);
      if (!container) return null;

      const focused = Array.from(document.querySelectorAll(".focused")).find((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
      });
      if (!focused) return false;

      return container.contains(focused) || focused.contains(container);
    }, {rowContainerId: targetId});
    return typeof result === "boolean" ? result : null;
  } catch {
    return null;
  }
}

// Prefers the structural answer and only falls back to the geometric window
// on screens that expose no row container id.
async function isFocusedOnRow(page, row, focusedState, rowY) {
  const contained = await isFocusedInsideRow(page, row?.rowId);
  if (contained !== null) return contained;
  return isFocusedStateOnRow(focusedState, rowY);
}

function resolveRowAnchorY(focusedState, row, firstItem) {
  const focusedRowY = focusedState?.rect?.y;
  return Number.isFinite(focusedRowY) && focusedState?.rect?.height >= 80
    ? focusedRowY
    : row?.rowY || firstItem?.rect?.y || 0;
}

// Remote focus moves are answered by smooth scroll/scale animations, so a rect
// read right after a key press can be a transient mid-animation value. Poll
// until two consecutive reads describe the same element at the same geometry.
async function waitForFocusedGeometrySettled(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? FOCUS_SETTLE_TIMEOUT_MS;
  const pollMs = options.pollMs ?? FOCUS_SETTLE_POLL_MS;
  const startedAt = Date.now();
  let previousState = options.initialState || (await getFocusedState(page));

  while (Date.now() - startedAt < timeoutMs) {
    if (typeof page?.waitForTimeout === "function") {
      await page.waitForTimeout(pollMs);
    }
    const currentState = await getFocusedState(page);
    if (isSameFocusedGeometry(previousState, currentState)) return currentState;
    previousState = currentState;
    if (typeof page?.waitForTimeout !== "function") break;
  }

  return previousState;
}

function isSameFocusedGeometry(previousState, currentState) {
  if ((previousState?.id || "") !== (currentState?.id || "")) return false;
  if ((previousState?.text || "") !== (currentState?.text || "")) return false;
  const previousRect = previousState?.rect;
  const currentRect = currentState?.rect;
  if (!previousRect || !currentRect) return false;
  return ["x", "y", "width", "height"].every(
    (key) => Math.abs((previousRect[key] || 0) - (currentRect[key] || 0)) <= FOCUS_SETTLE_TOLERANCE_PX
  );
}

function viewMoreFocusError(rowLabel, targetLabel, reason) {
  return new Error(
    `Không thể focus poster view more "${targetLabel}" của hàng/cate "${rowLabel}": ${reason}`
  );
}

async function focusIndexedContentRow(page, row, requestedItemIndex, options = {}) {
  const rowLabel = row.title || options.rowName || "hiện tại";
  const firstItem = row.items?.[0];
  if (!firstItem) {
    throw new Error(
      `Hàng/cate "${rowLabel}" không có nội dung hiển thị để bắt đầu; ` +
      `không thể focus nội dung thứ ${requestedItemIndex}`
    );
  }

  await focusFirstRowStart(page, firstItem, options);
  // Waiting for the reflow to finish keeps the next key press from being
  // dropped mid-scroll; row membership itself is checked structurally.
  let focusedState = await waitForFocusedGeometrySettled(page);
  const rowY = resolveRowAnchorY(focusedState, row, firstItem);
  if (!(await isFocusedOnRow(page, row, focusedState, rowY))) {
    throw new Error(
      `Hàng/cate "${rowLabel}" không giữ được focus trong hàng trước khi ` +
      `focus nội dung thứ ${requestedItemIndex}`
    );
  }

  focusedState = await moveFocusedRowToStart(page, focusedState, rowY, rowLabel, {...options, row});
  let reachedIndex = 1;
  for (let index = 1; index < requestedItemIndex; index += 1) {
    const beforeSignature = focusStateSignature(focusedState);
    await remotePress(page, "ArrowRight", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache: options.snapshotCache});
    const nextState = await getFocusedState(page);

    if (!(await isFocusedOnRow(page, row, nextState, rowY))) {
      throw indexedRowFocusError(rowLabel, requestedItemIndex, reachedIndex, "remote focus left the row");
    }
    if (focusStateSignature(nextState) === beforeSignature) {
      throw indexedRowFocusError(rowLabel, requestedItemIndex, reachedIndex, "remote focus stopped advancing");
    }

    focusedState = nextState;
    reachedIndex = index + 1;
  }

  if (options.rowPattern) {
    if (options.rowPattern === "the loai") {
      return (await findServiceCategoryRow(page, options.rowPattern)) || row;
    }

    const refreshedRows = await collectVisibleContentRows(page, {snapshotCache: options.snapshotCache});
    return findBestContentRowMatch(refreshedRows, options.rowPattern) || row;
  }

  return row;
}

async function moveFocusedRowToStart(page, focusedState, rowY, rowLabel, options = {}) {
  const row = options.row;
  let currentState = focusedState;
  for (let attempt = 0; attempt < ROW_HORIZONTAL_NAV_MAX_STEPS; attempt += 1) {
    const beforeSignature = focusStateSignature(currentState);
    await remotePress(page, "ArrowLeft", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache: options.snapshotCache});
    const nextState = await getFocusedState(page);

    if (!(await isFocusedOnRow(page, row, nextState, rowY))) {
      await remotePress(page, "ArrowRight", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache: options.snapshotCache});
      const restoredState = await getFocusedState(page);
      if (!(await isFocusedOnRow(page, row, restoredState, rowY))) {
        throw new Error(
          `Hàng/cate "${rowLabel}" không thể khôi phục focus sau khi tìm điểm bắt đầu của hàng`
        );
      }
      return restoredState;
    }

    if (focusStateSignature(nextState) === beforeSignature) return nextState;
    currentState = nextState;
  }

  throw new Error(
    `Hàng/cate "${rowLabel}" không tìm được điểm bắt đầu bằng phím điều hướng ` +
    `sau ${ROW_HORIZONTAL_NAV_MAX_STEPS} lần di chuyển`
  );
}

function isFocusedStateOnRow(state, rowY) {
  const rect = state?.rect;
  return Boolean(
    rect &&
    rect.width >= 100 &&
    rect.height >= 80 &&
    rect.x >= 80 &&
    (rowY <= 0 || Math.abs(rect.y - rowY) <= 80)
  );
}

function focusStateSignature(state) {
  return [
    state?.id || "",
    state?.text || "",
    state?.label || "",
    Math.round(state?.rect?.x || 0),
    Math.round(state?.rect?.y || 0),
  ].join("|");
}

function indexedRowFocusError(rowLabel, requestedItemIndex, reachedIndex, reason) {
  return new Error(
    `Hàng/cate "${rowLabel}" chỉ có thể focus đến nội dung thứ ${reachedIndex}; ` +
    `không thể focus nội dung thứ ${requestedItemIndex}${reason ? ` (${reason})` : ""}`
  );
}

async function findServiceCategoryRow(page, targetPattern) {
  if (targetPattern !== "the loai") return null;

  // Prefer the row container when this screen exposes one: the service row is
  // then identified by its own title element like any other row.
  const structuralRows = await collectStructuralContentRows(page).catch(() => null);
  const structuralMatch = (structuralRows || []).find(
    (row) => row.normalizedTitle === targetPattern
  );
  if (structuralMatch) {
    return {
      rowId: structuralMatch.rowId,
      title: "Thể loại",
      rowY: structuralMatch.rowY,
      items: structuralMatch.items,
    };
  }

  // Screens without that contract still need the heading-relative sweep.
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          text: normalize(element.textContent || ""),
          rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          visible: isVisible(rect, style),
        };
      })
      .filter((item) => item.visible && item.text === "the loai" && item.rect.width >= 30)
      .sort((a, b) => a.rect.y - b.rect.y || a.rect.width - b.rect.width);

    const items = Array.from(document.querySelectorAll("[id]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const explicitServiceLabel =
          element.getAttribute("service_title") || element.getAttribute("service_name") || "";
        const title = (
          explicitServiceLabel || element.getAttribute("title") || element.textContent || ""
        ).replace(/\s+/g, " ").trim();
        return {
          id: element.id || "",
          title,
          explicitServiceLabel: Boolean(explicitServiceLabel),
          rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          visible: isVisible(rect, style) && rect.width >= 100 && rect.height >= 80 &&
            rect.width <= 700 && rect.height <= 500 && rect.x >= 80,
        };
      })
      .filter((item) => item.id && item.visible);

    for (const heading of headings) {
      const nearbyItems = items
        .filter((item) => item.rect.y >= heading.rect.y + heading.rect.height - 20 &&
          item.rect.y - (heading.rect.y + heading.rect.height) <= 180)
        .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);

      const rowBuckets = [];
      for (const item of nearbyItems) {
        let row = rowBuckets.find((candidate) => Math.abs(candidate.rowY - item.rect.y) <= 40);
        if (!row) {
          row = {rowY: item.rect.y, items: []};
          rowBuckets.push(row);
        }
        row.items.push(item);
      }

      const row = rowBuckets
        .map((candidate) => ({
          ...candidate,
          items: dedupeByPosition(candidate.items).sort((a, b) => a.rect.x - b.rect.x),
        }))
        .filter((candidate) => candidate.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length || a.rowY - b.rowY)[0];

      if (row) return {title: "Thể loại", rowY: row.rowY, items: row.items};
    }

    return null;

    function normalize(value) {
      return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim().toLowerCase();
    }

    function isVisible(rect, style) {
      return rect.width > 0 && rect.height > 0 && rect.x + rect.width > 0 && rect.y + rect.height > 0 &&
        rect.x < (window.innerWidth || Number.MAX_SAFE_INTEGER) &&
        rect.y < (window.innerHeight || Number.MAX_SAFE_INTEGER) &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }

    function dedupeByPosition(values) {
      const output = [];
      for (const value of values) {
        const duplicateIndex = output.findIndex((existing) =>
          Math.abs(existing.rect.x - value.rect.x) <= 24 && Math.abs(existing.rect.y - value.rect.y) <= 24
        );
        if (duplicateIndex < 0) {
          output.push(value);
        } else if (value.explicitServiceLabel && !output[duplicateIndex].explicitServiceLabel) {
          output[duplicateIndex] = value;
        }
      }
      return output;
    }
  });
}

async function focusServiceCategoryItem(page, serviceName, options = {}) {
  const snapshotCache = options.snapshotCache || createDomSnapshotCache();
  const observedServices = new Set();
  const visitedFocusIds = new Set();
  let row = options.initialRow || await findServiceCategoryRow(page, "the loai");

  // When the row container is available, every service card in the row is
  // addressable by id - including cards scrolled out of the carousel and cards
  // to the left of the current focus, which a rightward scan can never reach.
  const directTarget = await findServiceCardInRowContainer(page, row?.rowId, serviceName);
  if (directTarget) {
    try {
      await focusFirstRowStart(page, directTarget, {snapshotCache, allowServiceFocus: true});
      if (isFocusedServiceItem(await getFocusedState(page), directTarget)) return directTarget;
      if (await isFocusedOnContentItem(page, directTarget)) return directTarget;
    } catch {
      // Fall through to the remote scan below.
    }
  }

  for (let attempt = 0; attempt <= SERVICE_CATEGORY_MAX_SCAN_STEPS; attempt++) {
    const service = findServiceItemByName(row?.items, serviceName);
    const before = await getFocusedState(page);
    for (const item of row?.items || []) {
      const observed = item?.label || item?.title;
      if (observed) observedServices.add(observed);
    }
    if (service && isFocusedServiceItem(before, service)) return service;

    if (!row || attempt === SERVICE_CATEGORY_MAX_SCAN_STEPS) break;

    if (!before?.id || visitedFocusIds.has(before.id)) break;
    visitedFocusIds.add(before.id);

    await remotePress(page, "ArrowRight", 500, {snapshotCache});
    const after = await getFocusedState(page);
    if (!after?.id || after.id === before.id || visitedFocusIds.has(after.id)) break;

    row = await findServiceCategoryRow(page, "the loai");
  }

  throw new Error(
    `Không tìm thấy dịch vụ "${serviceName}" trong hàng/cate "Thể loại" sau khi quét toàn bộ poster. ` +
    `Các dịch vụ đã thấy: ${[...observedServices].join(", ")}`
  );
}

// Looks through every card of the row container, not just the on-screen window.
async function findServiceCardInRowContainer(page, rowId, serviceName) {
  if (!rowId) return null;

  const rows = await collectStructuralContentRows(page, {
    includeOffScreenRows: true,
    includeOffScreenItems: true,
  }).catch(() => null);
  const row = (rows || []).find((candidate) => candidate.rowId === rowId);
  const service = findServiceItemByName(row?.items, serviceName);
  return service?.id ? service : null;
}

function findServiceItemByName(items, serviceName) {
  const target = normalizeVietnameseText(serviceName);
  return (items || []).find((item) => {
    if (!item?.id) return false;
    return serviceItemLabels(item).some((label) => normalizeVietnameseText(label) === target);
  }) || null;
}

// A service card can be described by its explicit label, by one of its label
// attributes, or - on the geometric path - by the single title the scanner
// built. All are exact-match candidates; nothing here is fuzzy, so
// "Thể thao" never selects "Thể thao TV".
function serviceItemLabels(item) {
  const attributes = item?.attributes || {};
  return [
    item?.label,
    item?.title,
    ...CARD_LABEL_ATTRIBUTES.map((name) => attributes[name]),
  ].filter((value) => String(value || "").trim());
}

function isFocusedServiceItem(focused, service) {
  if (!focused || !service) return false;
  if (focused.id && focused.id === service.id) return true;

  const serviceLabels = serviceItemLabels(service).map((value) => normalizeVietnameseText(value));
  if (!serviceLabels.length) return false;
  return [focused.text, focused.label]
    .map((value) => normalizeVietnameseText(value))
    .some((value) => value && serviceLabels.includes(value));
}

async function focusFirstItemInCurrentContentRow(page, options = {}) {
  const snapshotCache = options.snapshotCache || createDomSnapshotCache();
  const rows = await collectVisibleContentRows(page, {snapshotCache});
  const focusedRow = await findFocusedRow(rows);

  if (!focusedRow) {
    throw new Error("Không xác định được hàng/cate hiện tại để focus nội dung đầu tiên");
  }

  await focusFirstRowStart(page, focusedRow.items[0], {snapshotCache});
  return focusedRow;

  async function findFocusedRow(candidates) {
    for (const row of candidates) {
      if (await isFocusedOnRowItems(page, row.items)) return row;
    }
    // Focus can sit on a card the visible-item window missed; the row
    // container still answers definitively.
    for (const row of candidates) {
      if ((await isFocusedInsideRow(page, row.rowId)) === true) return row;
    }

    const focused = await getFocusedState(page).catch(() => null);
    if (!focused?.rect) return null;

    return candidates
      .map((row) => ({
        row,
        distance: Math.abs((row.rowY || row.items[0]?.rect.y || 0) - focused.rect.y),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.row || null;
  }
}

async function findVisibleContentItemByName(page, name, {type = "content", snapshotCache} = {}) {
  const normalizedTarget = normalizeVietnameseText(name);
  const rows = await collectVisibleContentRows(page, {snapshotCache});
  const candidates = rows.flatMap((row, rowIndex) =>
    row.items
      .filter((item) => supportsContentType(item, type))
      .map((item, itemIndex) => ({item, row, rowIndex, itemIndex}))
  );

  const match = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreContentItemMatch(candidate.item.title, normalizedTarget),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.rowIndex - b.rowIndex || a.itemIndex - b.itemIndex)[0];

  if (!match) {
    throw new Error(
      `Không tìm thấy ${type} "${name}" trong các hàng đang hiển thị. ` +
        `Nội dung đang thấy: ${candidates.map(({item}) => item.title).join(", ")}`
    );
  }

  await focusFirstRowStart(page, match.item, {snapshotCache});
  return match;

  function supportsContentType(item, requestedType) {
    if (requestedType === "content") return true;
    const attributes = item.attributes || {};
    if (requestedType === "channel") return Boolean(attributes.channel_name);
    return Boolean(attributes.movie_name || attributes.vod_name);
  }

  function scoreContentItemMatch(label, target) {
    const normalizedLabel = normalizeVietnameseText(label);
    if (!normalizedLabel || !target) return 0;
    if (normalizedLabel === target) return 100;
    if (normalizedLabel.includes(target)) return 90;

    const labelTokens = normalizedLabel.split(/[^a-z0-9]+/u).filter((token) => token.length >= 2);
    const targetTokens = target.split(/[^a-z0-9]+/u).filter((token) => token.length >= 2);
    if (!labelTokens.length || !targetTokens.length) return 0;

    const matchedTokens = targetTokens.filter((token) =>
      labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token) || token.includes(labelToken))
    );
    const coverage = matchedTokens.length / targetTokens.length;
    if (coverage === 1) return 80;
    if (targetTokens.length >= 2 && coverage >= 0.6) return Math.round(50 + coverage * 20);
    return 0;
  }
}

async function findContentRowByPosition(page, { rowIndex, rowPosition, snapshotCache = createDomSnapshotCache() } = {}) {
  if (rowPosition === "last") {
    return findLastContentRow(page, {snapshotCache});
  }

  const index = Number.isInteger(rowIndex) ? rowIndex : 0;
  if (Number.isInteger(rowIndex) && index >= 0) {
    const homePageRow = await findHomePageRowByIndex(page, index, {snapshotCache});
    if (homePageRow) return homePageRow;
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const rows = await collectVisibleContentRows(page, {snapshotCache});
    const cateRows = rows.filter((row) => row.title);
    const selectableRows = cateRows.length ? cateRows : rows;
    if (selectableRows[index]) return selectableRows[index];
    await remotePress(page, "ArrowDown", 700, {snapshotCache});
  }

  const visibleRows = await collectVisibleContentRows(page, {snapshotCache});
  throw new Error(
    `Không tìm thấy hàng thứ ${index + 1}. Các hàng đang thấy: ${visibleRows
      .map((row) => row.title || `y=${row.rowY}`)
      .join(", ")}`
  );
}

async function findHomePageRowByIndex(page, rowIndex, {snapshotCache = createDomSnapshotCache()} = {}) {
  const rowPrefix = `homePage2_${rowIndex}_`;
  let hasHomePageRows = false;
  let lastFocusError;

  for (let attempt = 0; attempt < HOME_PAGE_ROW_MAX_ATTEMPTS; attempt += 1) {
    const target = await inspectHomePageRowTarget(page, rowPrefix);
    hasHomePageRows = hasHomePageRows || Boolean(target?.hasHomePageRows);

    if (target?.targetId) {
      try {
        await remoteFocusById(page, target.targetId, 120, {snapshotCache});
        const row = await waitForVisibleHomePageRow(page, rowPrefix, {snapshotCache});
        if (row) return row;
      } catch (error) {
        lastFocusError = error;
      }
    }

    await remotePress(page, "ArrowDown", 700, {snapshotCache});
  }

  if (hasHomePageRows && lastFocusError) throw lastFocusError;
  return null;
}

async function waitForVisibleHomePageRow(page, rowPrefix, {snapshotCache, timeoutMs = HOME_PAGE_ROW_RENDER_TIMEOUT_MS} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    snapshotCache?.invalidate("visible-content-rows");
    const rows = await collectVisibleContentRows(page, {snapshotCache}).catch(() => []);
    const row = rows.find((candidate) => candidate.items.some((item) => item.id.startsWith(rowPrefix)));
    if (row) return row;

    // The Home carousel can expose the target poster before its title/heading
    // has finished rendering. The generic scanner intentionally requires a
    // non-empty label, so use the stable homePage2 row ID as the fallback
    // anchor while the card is already intersecting the viewport.
    const directRow = await collectVisibleHomePageRow(page, rowPrefix).catch(() => null);
    if (directRow) return directRow;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return null;
    const delayMs = Math.min(HOME_PAGE_ROW_RENDER_POLLING_MS, remainingMs);
    if (typeof page.waitForTimeout === "function") {
      await page.waitForTimeout(delayMs);
    } else {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function collectVisibleHomePageRow(page, rowPrefix) {
  return page.evaluate(({prefix, containerId, cardSelector}) => {
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || Number.MAX_SAFE_INTEGER;
    // Prefer the row container: it owns exactly this row's cards, in order.
    const container = containerId ? document.getElementById(containerId) : null;
    const cards = container
      ? Array.from(container.querySelectorAll(cardSelector))
      : Array.from(document.querySelectorAll("[id]")).filter((element) => element.id.startsWith(prefix));
    const items = cards
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const img = element.querySelector("img");
        const attributes = {};
        for (const name of [
          "title",
          "title_text",
          "movie_name",
          "vod_name",
          "content_name",
          "channel_name",
          "service_title",
          "alt",
          "content_id",
          "content-id",
          "data-content-id",
          "item_view_more",
        ]) {
          attributes[name] = element.getAttribute(name) || "";
        }
        return {
          id: element.id,
          title: [
            attributes.title,
            attributes.title_text,
            attributes.movie_name,
            attributes.vod_name,
            attributes.content_name,
            attributes.channel_name,
            element.textContent || "",
          ].join(" ").replace(/\s+/g, " ").trim(),
          contentId: attributes.content_id || attributes["content-id"] || attributes["data-content-id"] ||
            img?.getAttribute("content_id") || img?.getAttribute("content-id") || img?.getAttribute("data-content-id") || "",
          attributes,
          poster: img?.currentSrc || img?.src || extractCssUrl(style.backgroundImage || ""),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          visible: rect.width >= 100 && rect.height >= 80 &&
            rect.right > 0 && rect.bottom > 0 &&
            rect.left < viewportWidth && rect.top < viewportHeight &&
            style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
        };
      })
      // Cards stay in document order, which is the row's reading order.
      .filter((item) => item.visible);

    if (!items.length) return null;

    const titleElement = container?.querySelector(".cate_content_row_title");
    const title = (titleElement?.textContent || "").replace(/\s+/g, " ").trim();
    const rowY = items[0]?.rect?.y || 0;
    return {
      rowId: container?.id || "",
      title,
      normalizedTitle: "",
      rowY,
      items,
    };

    function extractCssUrl(value) {
      const match = String(value || "").match(/url\(["']?(.+?)["']?\)/);
      return match?.[1] || "";
    }
  }, {
    prefix: rowPrefix,
    containerId: homePageRowContainerId(rowPrefix),
    cardSelector: CONTENT_CARD_SELECTOR,
  });
}

// "homePage2_3_" addresses the cards of row container "homePage2_3".
function homePageRowContainerId(rowPrefix) {
  return String(rowPrefix || "").replace(/_$/u, "");
}

async function inspectHomePageRowTarget(page, rowPrefix) {
  return page.evaluate(({prefix, containerId}) => {
    const container = containerId ? document.getElementById(containerId) : null;
    const homePageItems = Array.from(document.querySelectorAll("[id]"))
      .filter((element) => /^homePage2_\d+_\d+$/u.test(element.id))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER;
        const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || Number.MAX_SAFE_INTEGER;
        const laidOut = rect.width >= 100 && rect.height >= 80 &&
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
        return {
          id: element.id,
          rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          laidOut,
          // A Home row can be exposed only partially at the bottom edge. It
          // is already a valid remote-navigation target at that point; wait
          // for a fully visible card and the ArrowDown sequence can jump past
          // the requested row and virtualize it out of the DOM.
          inViewport: laidOut && rect.right > 0 && rect.bottom > 0 &&
            rect.left < viewportWidth && rect.top < viewportHeight,
        };
      });
    const rowCardIds = container
      ? Array.from(container.querySelectorAll("[id]")).map((element) => element.id)
      : null;
    const belongsToRow = (id) => (rowCardIds ? rowCardIds.includes(id) : id.startsWith(prefix));
    // Document order is the row's own order, so the first on-screen card needs
    // no coordinate comparison.
    const target = homePageItems.find((item) => belongsToRow(item.id) && item.inViewport);

    return {
      hasHomePageRows: homePageItems.some((item) => item.laidOut),
      targetId: target?.id || "",
    };
  }, {prefix: rowPrefix, containerId: homePageRowContainerId(rowPrefix)});
}

async function findLastContentRow(page, {snapshotCache = createDomSnapshotCache()} = {}) {
  let lastRows = [];
  let lastSignature = "";
  let stableCount = 0;

  for (let attempt = 0; attempt < 18; attempt++) {
    const rows = await collectVisibleContentRows(page, {snapshotCache});
    const cateRows = rows.filter((row) => row.title);
    const selectableRows = cateRows.length ? cateRows : rows;
    if (selectableRows.length) {
      lastRows = selectableRows;
    }

    const signature = selectableRows.map((row) => `${row.title}:${row.rowY}`).join("|");
    if (signature && signature === lastSignature) {
      stableCount += 1;
      if (stableCount >= 2) break;
    } else {
      stableCount = 0;
      lastSignature = signature;
    }

    await remotePress(page, "ArrowDown", 700, {snapshotCache});
  }

  const row = lastRows[lastRows.length - 1];
  if (row) return row;

  throw new Error("Không tìm thấy hàng cuối cùng vì không có hàng nội dung nào đang hiển thị.");
}

function findBestContentRowMatch(rows, targetPattern) {
  return rows
    .map((row, index) => ({
      row,
      index,
      score: scoreNormalizedTextMatch(row.normalizedTitle || normalizeVietnameseText(row.title || ""), targetPattern),
    }))
    .filter((item) => item.score > 0)
    // Ties break on document order, which is stable regardless of scroll state.
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.row;
}

function scoreNormalizedTextMatch(label, target) {
  if (!label || !target) return 0;
  if (label === target) return 100;
  if (label.includes(target) || target.includes(label)) return 90;

  const labelTokens = label.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  const targetTokens = target.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  if (!labelTokens.length || !targetTokens.length) return 0;

  // Row/category names are labels, not content titles. Do not let a generic
  // fuzzy partial-token match select “Drama Trung không thể bỏ lỡ” for the
  // requested row “Thể loại”.
  const matchedTokens = targetTokens.filter((token) => labelTokens.includes(token));
  const coverage = matchedTokens.length / targetTokens.length;
  if (coverage === 1) return 80;
  return 0;
}

// Reads on-screen rows straight from the row containers. Returns null when the
// screen does not expose the contract, so callers fall back to the generic
// geometric scanner.
async function collectStructuralContentRows(page, options = {}) {
  if (typeof page?.evaluate !== "function") return null;

  let result;
  try {
    result = await page.evaluate((config) => {
      const isRendered = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
      };
      // On screen means the element currently intersects the viewport. This is
      // a rendering question, not an identity question: a card scrolled out of
      // the carousel is still the same card in the same row.
      const isOnScreen = (element) => {
        if (!isRendered(element)) return false;
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER;
        const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || Number.MAX_SAFE_INTEGER;
        return rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
      };

      const rows = Array.from(document.querySelectorAll(config.rowSelector)).map((container) => {
        const titleElement = container.querySelector(config.titleSelector);
        const cards = Array.from(container.querySelectorAll(config.cardSelector));

        return {
          rowId: container.id || "",
          title: (titleElement?.textContent || "").replace(/\s+/g, " ").trim(),
          onScreen: isOnScreen(container),
          items: cards.map((card) => {
            const rect = card.getBoundingClientRect();
            const attributes = {};
            for (const name of config.attributeNames) {
              attributes[name] = card.getAttribute(name) || "";
            }
            const image = card.querySelector("img");
            const text = (card.textContent || "").replace(/\s+/g, " ").trim();
            const joinedTitle = [...Object.values(attributes), text]
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            const label = config.labelAttributeNames
              .map((name) => (card.getAttribute(name) || "").replace(/\s+/g, " ").trim())
              .find(Boolean) || (image?.getAttribute("alt") || "").trim() || text;

            return {
              id: card.id || "",
              title: joinedTitle,
              label,
              contentId: attributes.content_id || attributes["content-id"] || attributes["data-content-id"] || "",
              attributes,
              poster: image?.currentSrc || image?.src || "",
              isViewMore: card.getAttribute("item_view_more") === "1",
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              visible: isOnScreen(card),
            };
          }),
        };
      });

      return {contract: config.contract, rows};
    }, {
      rowSelector: ROW_CONTAINER_SELECTOR,
      titleSelector: ROW_TITLE_SELECTOR,
      cardSelector: CONTENT_CARD_SELECTOR,
      contract: STRUCTURAL_ROW_CONTRACT,
      attributeNames: CONTENT_ITEM_CONTRACT.attributes || [],
      labelAttributeNames: CARD_LABEL_ATTRIBUTES,
    });
  } catch {
    return null;
  }

  if (result?.contract !== STRUCTURAL_ROW_CONTRACT || !Array.isArray(result.rows)) return null;

  const rows = result.rows
    .map((row) => {
      const items = options.includeOffScreenItems === true
        ? row.items
        : row.items.filter((item) => item.visible);
      return {
        rowId: row.rowId,
        title: row.title,
        normalizedTitle: normalizeVietnameseText(row.title),
        // Kept for reporting and for the geometric fallback helpers; row
        // identity itself comes from rowId, never from this value.
        rowY: items[0]?.rect?.y ?? row.items[0]?.rect?.y ?? 0,
        onScreen: row.onScreen,
        items,
      };
    })
    .filter((row) => row.items.length > 0);

  return options.includeOffScreenRows === true ? rows : rows.filter((row) => row.onScreen);
}

async function collectVisibleContentRows(page, options = {}) {
  const snapshotCache = options.snapshotCache;
  const snapshotIdentity = snapshotCache
    ? await getDomSnapshotIdentity(page, "contentContainer")
    : null;
  const cached = snapshotCache?.get("visible-content-rows", snapshotIdentity);
  if (cached?.rows) return cached.rows;

  const structuralRows = await collectStructuralContentRows(page, options);
  if (structuralRows?.length) {
    if (snapshotCache) snapshotCache.set("visible-content-rows", snapshotIdentity, {rows: structuralRows});
    return structuralRows;
  }

  const scanner = createScopedDomScanner(page);
  const scan = await scanner.scan({
    contractName: "contentContainer",
    candidateSelector: "[id]",
    includeHeadings: true,
    headingExcludeAncestorSelector: CONTENT_ITEM_LABEL_ANCESTOR_SELECTOR,
    attributeNames: CONTENT_ITEM_CONTRACT.attributes || [],
    includeText: true,
    includePoster: true,
    includeBackgroundImage: true,
    geometry: {...CONTENT_ITEM_CONTRACT.geometry, minX: 100, minY: 100},
    headingGeometry: {minWidth: 30, minHeight: 12, maxHeight: 70, minX: 80, minY: 40},
    excludeIdPrefixes: CONTENT_ITEM_CONTRACT.excludeIdPrefixes || [],
  });
  const serviceRowHeadings = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll(".row_service"));
    return elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          id: element.id || "",
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
          rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          visible: rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
            rect.left < (window.innerWidth || Number.MAX_SAFE_INTEGER) &&
            rect.top < (window.innerHeight || Number.MAX_SAFE_INTEGER) &&
            style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
        };
      })
      .filter((item) => item.visible && item.text);
  });

  const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân|Tất cả dịch vụ)$/i;
  const candidates = scan.records
    .map((record) => {
      const title = [
        ...Object.values(record.attrs || {}),
        record.text || "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        id: record.id,
        title,
        contentId: record.attrs?.content_id || record.attrs?.["content-id"] || record.attrs?.["data-content-id"] || "",
        attributes: record.attrs || {},
        poster: record.poster || extractCssUrl(record.backgroundImage),
        rect: record.rect,
        visible: record.visible && !menuText.test(title),
      };
    })
    .filter((item) => item.visible && item.title)
    .sort((a, b) => {
      if (Math.abs(a.rect.y - b.rect.y) > 40) return a.rect.y - b.rect.y;
      return a.rect.x - b.rect.x;
    });

  const headings = [
    ...scan.headings,
    ...serviceRowHeadings,
  ]
    .filter((item) => item.visible && item.text && !item.id.startsWith("menu_") && !item.id.startsWith("key-"))
    .map((item) => ({text: item.text, rect: item.rect}))
    .sort((a, b) => a.rect.y - b.rect.y);

  const rowBuckets = [];
  for (const item of candidates) {
    let row = rowBuckets.find((bucket) => Math.abs(bucket.rowY - item.rect.y) <= 40);
    if (!row) {
      row = {rowY: item.rect.y, title: "", normalizedTitle: "", items: []};
      rowBuckets.push(row);
    }
    row.items.push(item);
  }

  const rows = rowBuckets
    .map((row) => {
      row.items = dedupeByPosition(row.items).slice(0, 30);
      const heading = findRowHeading(headings, row.rowY);
      row.title = heading?.text || "";
      row.normalizedTitle = normalizeVietnameseText(row.title);
      return row;
    })
    .filter((row) => row.items.length > 0)
    .sort((a, b) => a.rowY - b.rowY);

  if (snapshotCache) snapshotCache.set("visible-content-rows", snapshotIdentity, {rows});
  return rows;

  function extractCssUrl(value) {
    const match = String(value || "").match(/url\(["']?(.+?)["']?\)/);
    return match?.[1] || "";
  }

  function dedupeByPosition(items) {
    const output = [];
    for (const item of items) {
      const duplicate = output.find(
        (existing) => Math.abs(existing.rect.x - item.rect.x) <= 24 && Math.abs(existing.rect.y - item.rect.y) <= 24
      );
      if (!duplicate) output.push(item);
    }
    return output.sort((a, b) => a.rect.x - b.rect.x);
  }
}

async function focusFirstRowStart(page, firstItem, options = {}) {
  if (!firstItem?.id) {
    await expectFocusedContent(page);
    return;
  }

  const timeoutMs = options.allowServiceFocus ? 10000 : 6000;
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 0; attempt < 3 && Date.now() - startedAt < timeoutMs; attempt++) {
    if (await isFocusedOnContentItem(page, firstItem)) return;

    options.snapshotCache?.invalidate();
    try {
      await remoteFocusById(page, firstItem.id, 80, {snapshotCache: options.snapshotCache});
    } catch (error) {
      lastError = error;
    }
    options.snapshotCache?.invalidate();

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) break;
    try {
      await expect.poll(() => isFocusedOnContentItem(page, firstItem), {
        timeout: Math.min(2000, remainingMs),
      }).toBe(true);
      return;
    } catch (error) {
      lastError = error;
    }

    if (typeof page.waitForTimeout === "function") {
      await page.waitForTimeout(Math.min(250, Math.max(0, timeoutMs - (Date.now() - startedAt))));
    }
  }

  const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
  await expect
    .poll(() => isFocusedOnContentItem(page, firstItem), {timeout: remainingMs})
    .toBe(true)
    .catch(() => {
      if (lastError) throw lastError;
      throw new Error(`Could not focus row item "${firstItem.id}"`);
    });
}

async function expectFocusedContent(page) {
  await expect.poll(() => isFocusedContentItem(page), { timeout: 10000 }).toBe(true);
}

async function isFocusedContentItem(page) {
  return page.evaluate(() => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    if (!focused) return false;

    const rect = focused.getBoundingClientRect();
    const style = getComputedStyle(focused);
    const label = contentLabel(focused);
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || Number.MAX_SAFE_INTEGER;
    const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân|Tất cả dịch vụ)$/i;
    // The content contract starts at x=80.  The 1280x720 Home layout places
    // the first poster just inside that boundary; keeping a 100px focus gate
    // incorrectly rejects an otherwise valid focused poster at that
    // resolution after a row is revealed.
    const isMenuItem = focused.id.startsWith("menu_") || rect.x < 80;
    const isIdentifiedPoster = focused.classList.contains("cate_content_item") ||
      focused.classList.contains("lw_r_item") ||
      /^homePage\d+_/u.test(focused.id);

    return (
      rect.width >= 100 &&
      rect.height >= 80 &&
      rect.x >= 80 &&
      rect.width <= 620 &&
      rect.height <= 460 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < viewportWidth &&
      rect.top < viewportHeight &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      !isMenuItem &&
      !focused.id.startsWith("key-") &&
      (label || isIdentifiedPoster) &&
      (!menuText.test(label) || !isMenuItem)
    );

    function contentLabel(element) {
      return [
        element.getAttribute("title") || "",
        element.getAttribute("title_text") || "",
        element.getAttribute("movie_name") || "",
        element.getAttribute("vod_name") || "",
        element.getAttribute("content_name") || "",
        element.getAttribute("channel_name") || "",
        element.textContent || "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }
  });
}

async function isFocusedOnContentItem(page, item) {
  if (!item?.id) return false;

  return page.evaluate((targetId) => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    if (!focused) return false;
    const target = document.getElementById(targetId);
    return focusWithinTarget(focused, target);

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }

    function focusWithinTarget(focusedElement, targetElement) {
      if (!focusedElement || !targetElement) return false;
      if (
        focusedElement === targetElement ||
        focusedElement.contains(targetElement) ||
        targetElement.contains(focusedElement)
      ) {
        return true;
      }

      const focusedRect = focusedElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const intersects =
        focusedRect.left < targetRect.right &&
        focusedRect.right > targetRect.left &&
        focusedRect.top < targetRect.bottom &&
        focusedRect.bottom > targetRect.top;

      if (!intersects) return false;

      const overlapWidth =
        Math.min(focusedRect.right, targetRect.right) - Math.max(focusedRect.left, targetRect.left);
      const overlapHeight =
        Math.min(focusedRect.bottom, targetRect.bottom) - Math.max(focusedRect.top, targetRect.top);
      return overlapWidth >= 12 && overlapHeight >= 12;
    }
  }, item.id);
}

async function isFocusedOnRowItems(page, items) {
  const targetIds = (items || []).map((item) => item?.id).filter(Boolean);
  if (!targetIds.length) return false;

  return page.evaluate((ids) => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    if (!focused) return false;

    return ids.some((id) => {
      const target = document.getElementById(id);
      return focusWithinTarget(focused, target);
    });

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }

    function focusWithinTarget(focusedElement, targetElement) {
      if (!focusedElement || !targetElement) return false;
      if (
        focusedElement === targetElement ||
        focusedElement.contains(targetElement) ||
        targetElement.contains(focusedElement)
      ) {
        return true;
      }

      const focusedRect = focusedElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const intersects =
        focusedRect.left < targetRect.right &&
        focusedRect.right > targetRect.left &&
        focusedRect.top < targetRect.bottom &&
        focusedRect.bottom > targetRect.top;

      if (!intersects) return false;

      const overlapWidth =
        Math.min(focusedRect.right, targetRect.right) - Math.max(focusedRect.left, targetRect.left);
      const overlapHeight =
        Math.min(focusedRect.bottom, targetRect.bottom) - Math.max(focusedRect.top, targetRect.top);
      return overlapWidth >= 12 && overlapHeight >= 12;
    }
  }, targetIds);
}

async function getFocusedContentMetadata(page) {
  return page.evaluate(() => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    if (!focused) {
      return {
        id: "",
        title: "",
        contentId: "",
        poster: "",
        rect: null,
      };
    }

    const rect = focused.getBoundingClientRect();
    const img = focused.querySelector("img");
    const backgroundImage = getComputedStyle(focused).backgroundImage || "";
    const title = [
      focused.getAttribute("title") || "",
      focused.getAttribute("title_text") || "",
      focused.getAttribute("movie_name") || "",
      focused.getAttribute("vod_name") || "",
      focused.getAttribute("content_name") || "",
      focused.getAttribute("channel_name") || "",
      focused.textContent || "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id: focused.id || "",
      title,
      contentId: focused.getAttribute("content_id") || focused.getAttribute("content-id") || focused.getAttribute("data-content-id") ||
        img?.getAttribute("content_id") || img?.getAttribute("content-id") || img?.getAttribute("data-content-id") || "",
      poster: img?.currentSrc || img?.src || extractCssUrl(backgroundImage),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };

    function extractCssUrl(value) {
      const match = value.match(/url\(["']?(.+?)["']?\)/);
      return match?.[1] || "";
    }

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }
  });
}

async function openFocusedContentForPlayback(page, testInfo, expectedItem = null) {
  const focusedContent = await getFocusedContentMetadata(page).catch(() => ({id: "", title: ""}));
  const expectedId = focusedContent.id || expectedItem?.id || "";
  const expectedLabel = focusedContent.title || expectedItem?.title || "";
  const activationOptions = {
    testInfo,
    name: `content-${expectedId || "focused"}`,
    contractName: "contentItem",
    expectedId,
    expectedLabel,
    delay: 3500,
  };
  await activateVerifiedTarget(page, activationOptions);

  let playerState = await getPlayerState(page)
    .catch(() => false);
  if (playerState?.hasVideo) return;

  let destination = await observePlayerOrDetailState(page)
    .catch(() => ({open: false}));
  const focusedAfterActivation = await getFocusedContentMetadata(page)
    .catch(() => ({id: "", title: ""}));

  // At the product's 1920x1080 layout the Home carousel can finish its
  // reflow after the first Enter while keeping the same poster focused.  The
  // first activation was delivered; only retry when that exact poster is
  // still on Home and no player/detail boundary opened.  This avoids a blind
  // double-Enter on destinations that activated normally or opened a detail.
  if (!playerState?.hasVideo && destination.open !== true && expectedId &&
    focusedAfterActivation.id === expectedId) {
    await activateVerifiedTarget(page, {
      ...activationOptions,
      name: `${activationOptions.name}-reflow-retry`,
    });
    playerState = await getPlayerState(page)
      .catch(() => false);
    if (playerState?.hasVideo) return;
    destination = await observePlayerOrDetailState(page)
      .catch(() => ({open: false}));
  }

  const focused = await getFocusedState(page).catch(() => ({ text: "", label: "" }));
  const xemNgay = /^Xem ngay$/i;
  const focusedOnXemNgay = xemNgay.test(focused.text) || xemNgay.test(focused.label);
  const detailHasXemNgay = destination.open === true && await hasVisibleText(page, xemNgay);
  if (focusedOnXemNgay || detailHasXemNgay) {
    await remoteFocusByText(page, xemNgay, 60).catch(() => {});
    const fallback = await getFocusedState(page).catch(() => ({id: "", text: ""}));
    await activateVerifiedTarget(page, {
      testInfo,
      name: "content-xem-ngay-fallback",
      contractName: "menuItem",
      expectedId: fallback.id,
      expectedLabel: fallback.text,
      delay: 6000,
    });
  }
}

async function inspectPlaybackAfterWait(page, waitSeconds) {
  await page.waitForTimeout(waitSeconds * 1000);

  const popup = await getVisiblePopup(page);
  const playerState = await getPlayerState(page).catch((error) => ({
    hasVideo: false,
    isProbablyPlaying: false,
    reason: error?.message || String(error),
  }));

  return {
    ok: !popup && playerState.hasVideo && playerState.isProbablyPlaying,
    popup,
    playerState,
  };
}

async function returnFromPlayerOrDetail(page) {
  return dependencies.closePlayerOrDetail(page, {
    remotePress,
    maxBackPresses: 2,
    backDelayMs: 2500,
  });
}

async function returnToFirstRowContent(page, { item, rowY, rowId }) {
  await dependencies.closePlayerOrDetail(page, {
    remotePress,
    observePopup: observeExitConfirmation,
    dismissUnexpectedPopup: dismissKnownPlaybackFailurePopup,
    isClosed: async (candidatePage) => {
      if (
        (await isFocusedContentItem(candidatePage)) &&
        ((await isFocusedNearRow(candidatePage, {rowId, rowY})) ||
          (item?.id && (await isFocusedOnContentItem(candidatePage, item))))
      ) {
        return true;
      }

      // The Home carousel can restore focus to a different visible row before
      // the previous poster's geometry is rebuilt.  The route/content boundary
      // is still safe here; waiting for the original poster would otherwise
      // send Back again and can reach the app-exit dialog.
      return isHomeRowReturnBoundary(candidatePage);
    },
    maxBackPresses: playback.MAX_CLOSE_BACK_PRESSES,
    backDelayMs: 1800,
    boundaryTimeoutMs: ROW_RETURN_BOUNDARY_TIMEOUT_MS,
  });

  // The Home carousel can report its boundary before the previous screen has
  // finished rebuilding its poster geometry.  Let that render settle before
  // refocusing the current item or sending the next horizontal key.
  await page.waitForTimeout(ROW_RETURN_RENDER_DELAY_MS);

  if (item?.id) {
    await remoteFocusById(page, item.id, 20).catch(() => {});
  }

  await expectFocusedContent(page);
}

async function isHomeRowReturnBoundary(page) {
  const playerObservation = await observePlayerOrDetailState(page).catch(() => ({open: true}));
  if (playerObservation?.open === true) return false;

  return page.evaluate(() => {
    const routeValue = location.hash.replace(/^#/, "").split("?")[0];
    if (!/^homeNewUI$/iu.test(routeValue)) return false;

    return Array.from(document.querySelectorAll("[id]"))
      .filter((element) => /^homePage[12]_\d+_\d+$/u.test(element.id))
      .some((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width >= 100 && rect.height >= 80 &&
          rect.right > 0 && rect.bottom > 0 &&
          rect.left < (window.innerWidth || document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER) &&
          rect.top < (window.innerHeight || document.documentElement?.clientHeight || Number.MAX_SAFE_INTEGER) &&
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
      });
  }).catch(() => false);
}

async function dismissKnownPlaybackFailurePopup(page, popup) {
  const dialogText = (popup?.visibleDialogs || [])
    .map((dialog) => dialog?.text || "")
    .join(" ");
  // Match known playback error patterns: device not supported, error codes (mã xxx),
  // generic error messages (có lỗi), or DRM failures.
  if (!/(?:thiết bị\s+không\s+hỗ\s+trợ|không\s+hỗ\s+trợ|mã.*\d+|có\s+lỗi|playback\s+failed|drm.*fail)/iu.test(dialogText)) {
    return false;
  }

  const confirmPattern = /^(?:Đồng ý|OK|Đóng|Close)$/i;
  let focused = await getFocusedState(page).catch(() => ({text: "", label: ""}));
  if (!confirmPattern.test(focused.text || "")) {
    await remoteFocusByText(page, confirmPattern, 30).catch(() => {});
    focused = await getFocusedState(page).catch(() => ({text: "", label: ""}));
  }
  if (!confirmPattern.test(focused.text || "")) return false;

  await remotePress(page, "Enter", 500);
  await observeExitConfirmation(page).catch(() => {});
  return true;
}

async function moveToNextFirstRowContent(page, { previousSignature, rowY, rowId }) {
  const currentFocused = await getFocusedContentMetadata(page).catch(() => ({rect: null}));
  const rowScope = {rowId: rowId || "", rowY: currentFocused.rect?.y || rowY};
  for (let attempt = 0; attempt < 3; attempt++) {
    await remotePress(page, "ArrowRight", 800);

    if (!(await isFocusedContentItem(page)) || !(await isFocusedNearRow(page, rowScope))) {
      return false;
    }

    const focusedItem = await getFocusedContentMetadata(page);
    if (contentItemSignature(focusedItem) !== previousSignature) {
      return true;
    }
  }

  return false;
}

// `scope` is a row descriptor/{rowId, rowY} or a legacy rowY number.
async function isFocusedNearRow(page, scope) {
  const rowId = typeof scope === "object" && scope !== null ? scope.rowId : "";
  const contained = await isFocusedInsideRow(page, rowId);
  if (contained !== null) return contained;

  const rowY = typeof scope === "number"
    ? scope
    : Number(typeof scope === "object" && scope !== null ? scope.rowY || 0 : 0);
  return page.evaluate((targetY) => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    if (!focused) return false;

    const rect = focused.getBoundingClientRect();
    return Math.abs(Math.round(rect.y) - targetY) <= 80;

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }
  }, rowY);
}

function contentItemSignature(item) {
  return [item?.id || "", item?.contentId || "", item?.title || "", item?.poster || ""].join("|").trim();
}


// The focused card's grid position. `null` means focus is not on a list-page
// grid card at all (a header control, the left menu, or nothing focused), which
// callers treat as "the grid is not reachable from here" rather than as row 0.
async function getFocusedListPagePosition(page) {
  return page.evaluate((pattern) => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    if (!focused) return null;

    const card = focused.classList.contains("cate_content_item")
      ? focused
      : focused.closest?.(".cate_content_item");
    if (!card || !isVisible(card)) return null;

    const match = new RegExp(pattern, "u").exec(card.id || "");
    if (!match) return null;

    const rowContainer = document.getElementById(`${match[1]}_${match[2]}`);
    const rect = card.getBoundingClientRect();

    return {
      id: card.id,
      idPrefix: match[1],
      row: Number(match[2]),
      col: Number(match[3]),
      rowId: rowContainer?.id || "",
      rowItemCount: rowContainer
        ? rowContainer.querySelectorAll(".cate_content_item").length
        : 0,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }
  }, LIST_PAGE_ITEM_ID_PATTERN.source);
}

// A list-page grid card is identified by its structure - a `.cate_content_item`
// whose id encodes a grid position - not by the Home/service focus geometry
// window. The leftmost column of a list page sits left of that window's x=80
// boundary at 1280x720, so the geometric gate would reject a genuinely focused
// card.
async function expectFocusedListPageContent(page) {
  let position = null;
  await expect
    .poll(async () => {
      position = await getFocusedListPagePosition(page).catch(() => null);
      return Boolean(position);
    }, {timeout: 10000})
    .toBe(true);
  return position;
}

// Playback order is the reading order of the page, so traversal always starts at
// the first card of the first row even when the page restored focus elsewhere.
async function focusListPageGridStart(page, options = {}) {
  const focused = await getFocusedListPagePosition(page).catch(() => null);
  if (focused && focused.row === 0 && focused.col === 0) return focused;

  const rows = await collectStructuralContentRows(page, {
    includeOffScreenItems: true,
    includeOffScreenRows: true,
    ...options,
  });
  const firstItem = (rows || [])
    .flatMap((row) => row.items || [])
    .map((item) => ({item, position: LIST_PAGE_ITEM_ID_PATTERN.exec(item?.id || "")}))
    .filter((candidate) => candidate.position)
    .sort((a, b) =>
      Number(a.position[2]) - Number(b.position[2]) ||
      Number(a.position[3]) - Number(b.position[3])
    )[0]?.item;
  if (!firstItem?.id) {
    throw new Error("Trang danh sách không có poster nội dung nào để bắt đầu");
  }

  await focusFirstRowStart(page, firstItem, {});
  const position = await getFocusedListPagePosition(page).catch(() => null);
  if (!position) {
    throw new Error(
      `Không thể focus poster đầu tiên "${firstItem.id}" của trang danh sách`
    );
  }
  return position;
}

async function stepListPageFocus(page, key, accept, {attempts = LIST_PAGE_STEP_MAX_ATTEMPTS} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      // A press answered late must not be answered with another press, or the
      // grid would move twice and skip a poster.
      const settled = await getFocusedListPagePosition(page).catch(() => null);
      if (settled && accept(settled)) return settled;
    }

    await remotePress(page, key, LIST_PAGE_STEP_DELAY_MS);
    const next = await getFocusedListPagePosition(page).catch(() => null);
    if (next && accept(next)) return next;
    if (attempt + 1 < attempts) await page.waitForTimeout(LIST_PAGE_STEP_RETRY_DELAY_MS);
  }
  return null;
}

// Advances one card in reading order and returns the new position, or `null`
// when the grid has no further card.  Horizontal movement stops at the end of a
// row (the page never wraps), and vertical movement keeps the previous column
// because the grid focuses in parallel, so the next row is walked back to its
// leftmost card.
async function moveToNextListPageContent(page, position) {
  const current = position || (await getFocusedListPagePosition(page).catch(() => null));
  if (!current) return null;

  const atRowEnd = current.rowItemCount > 0 && current.col >= current.rowItemCount - 1;
  if (!atRowEnd) {
    const nextInRow = await stepListPageFocus(
      page,
      "ArrowRight",
      (candidate) => candidate.row === current.row && candidate.col > current.col
    );
    if (nextInRow) return nextInRow;
  }

  const nextRow = await stepListPageFocus(
    page,
    "ArrowDown",
    (candidate) => candidate.row > current.row
  );
  if (!nextRow) return null;

  let rowStart = nextRow;
  for (let step = 0; step < ROW_HORIZONTAL_NAV_MAX_STEPS && rowStart.col > 0; step += 1) {
    const afterLeft = await stepListPageFocus(
      page,
      "ArrowLeft",
      (candidate) => candidate.row === rowStart.row && candidate.col < rowStart.col,
      {attempts: 2}
    );
    if (!afterLeft) break;
    rowStart = afterLeft;
  }

  return rowStart;
}

async function isListPageReturnBoundary(page, routes = []) {
  const playerObservation = await observePlayerOrDetailState(page).catch(() => ({open: true}));
  if (playerObservation?.open === true) return false;

  return page.evaluate((allowedRoutes) => {
    const routeValue = location.hash.replace(/^#/, "").split("?")[0];
    if (allowedRoutes.length && !allowedRoutes.includes(routeValue)) return false;

    return Array.from(document.querySelectorAll(".cate_content_item")).some((card) => {
      const rect = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    });
  }, routes).catch(() => false);
}

// The list page restores its own row/column when the player closes, so the
// boundary check accepts either the original card or any rebuilt list-page grid.
async function returnToListPageContent(page, {item, routes = []} = {}) {
  await dependencies.closePlayerOrDetail(page, {
    remotePress,
    observePopup: observeExitConfirmation,
    dismissUnexpectedPopup: dismissKnownPlaybackFailurePopup,
    isClosed: async (candidatePage) => {
      const position = await getFocusedListPagePosition(candidatePage).catch(() => null);
      if (position && item?.id && (await isFocusedOnContentItem(candidatePage, item))) {
        return true;
      }

      return isListPageReturnBoundary(candidatePage, routes);
    },
    maxBackPresses: playback.MAX_CLOSE_BACK_PRESSES,
    backDelayMs: 1800,
    boundaryTimeoutMs: ROW_RETURN_BOUNDARY_TIMEOUT_MS,
  });

  await page.waitForTimeout(ROW_RETURN_RENDER_DELAY_MS);

  if (item?.id) {
    await remoteFocusById(page, item.id, 20).catch(() => {});
  }

  await expectFocusedListPageContent(page);
}


module.exports={configureContentRows,createContentRowsApi,collectVisibleContentRows,findRowHeading,focusRequestedContentRow,focusViewMorePosterInCurrentRow,focusServiceCategoryItem,focusFirstItemInCurrentContentRow,findVisibleContentItemByName,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,getFocusedViewMoreMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback,getFocusedListPagePosition,expectFocusedListPageContent,focusListPageGridStart,moveToNextListPageContent,returnToListPageContent,isListPageReturnBoundary,ROW_RETURN_RENDER_DELAY_MS};
