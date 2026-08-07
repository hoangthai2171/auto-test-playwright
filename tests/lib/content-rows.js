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
const VIEW_MORE_POSTER_SELECTOR = '.view_more[item_view_more="1"]';

function configureContentRows(next={}){Object.assign(dependencies,next);return module.exports;}
function createContentRowsApi(next={}){configureContentRows(next);return {collectVisibleContentRows,focusRequestedContentRow,focusViewMorePosterInCurrentRow,focusServiceCategoryItem,focusFirstItemInCurrentContentRow,findVisibleContentItemByName,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback};}
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
  let focusedState = await getFocusedState(page);
  // Focusing a Home row can vertically reflow the carousel into the active
  // viewport. The row snapshot was collected before that reflow, so anchor
  // subsequent marker checks to the verified focused poster's current y
  // coordinate instead of the stale snapshot geometry.
  const focusedRowY = focusedState?.rect?.y;
  const rowY = Number.isFinite(focusedRowY) && focusedState?.rect?.height >= 80
    ? focusedRowY
    : row.rowY || firstItem.rect?.y || 0;
  if (!isFocusedStateOnRow(focusedState, rowY)) {
    throw viewMoreFocusError(rowLabel, targetLabel, "focus không còn ở hàng đã chọn");
  }

  const visitedFocusStates = new Set([focusStateSignature(focusedState)]);
  for (let attempt = 0; attempt < ROW_HORIZONTAL_NAV_MAX_STEPS; attempt += 1) {
    const focusedViewMore = await getFocusedViewMoreMetadata(page, rowY);
    if (focusedViewMore) return focusedViewMore;

    const beforeSignature = focusStateSignature(focusedState);
    await remotePress(page, "ArrowRight", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache});
    const nextState = await getFocusedState(page);
    const nextSignature = focusStateSignature(nextState);
    const nextViewMore = await getFocusedViewMoreMetadata(page, rowY);
    if (nextViewMore) return nextViewMore;

    if (!isFocusedStateOnRow(nextState, rowY)) {
      throw viewMoreFocusError(rowLabel, targetLabel, "remote focus đã rời khỏi hàng");
    }
    if (nextSignature === beforeSignature || visitedFocusStates.has(nextSignature)) {
      throw viewMoreFocusError(
        rowLabel,
        targetLabel,
        await viewMoreNavigationFailureReason(
          page,
          row,
          rowY,
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
      rowY,
      `đã vượt quá ${ROW_HORIZONTAL_NAV_MAX_STEPS} lần di chuyển`,
    ),
  );
}

async function viewMoreNavigationFailureReason(page, row, rowY, fallbackReason) {
  const rowItems = row?.items || [];
  const rowHasMarker = rowItems.some((item) => {
    const attributes = item?.attributes || {};
    return String(attributes.item_view_more || item?.item_view_more || "").trim() === "1";
  });
  if (rowHasMarker) return fallbackReason;

  try {
    const hasMarker = await page.evaluate(({targetRowY, selector}) => {
      return Array.from(document.querySelectorAll(selector)).some((poster) => {
        const rect = poster.getBoundingClientRect();
        const style = getComputedStyle(poster);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 &&
          (targetRowY <= 0 || Math.abs(rect.y - targetRowY) <= 80);
      });
    }, {targetRowY: rowY, selector: VIEW_MORE_POSTER_SELECTOR});
    return hasMarker ? fallbackReason : "Không tìm thấy poster view more";
  } catch {
    return fallbackReason;
  }
}

async function getFocusedViewMoreMetadata(page, rowY) {
  return page.evaluate((targetRowY) => {
    const focused = Array.from(document.querySelectorAll(".focused")).find(isVisible);
    const poster = focused?.closest?.('.view_more[item_view_more="1"]');
    if (!poster || !isVisible(poster)) return null;

    const rect = poster.getBoundingClientRect();
    if (targetRowY > 0 && Math.abs(rect.y - targetRowY) > 80) return null;

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
  }, rowY);
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
  const rowY = row.rowY || firstItem.rect?.y || 0;
  let focusedState = await getFocusedState(page);
  if (!isFocusedStateOnRow(focusedState, rowY)) {
    throw new Error(
      `Hàng/cate "${rowLabel}" không giữ được focus trong hàng trước khi ` +
      `focus nội dung thứ ${requestedItemIndex}`
    );
  }

  focusedState = await moveFocusedRowToStart(page, focusedState, rowY, rowLabel, options);
  let reachedIndex = 1;
  for (let index = 1; index < requestedItemIndex; index += 1) {
    const beforeSignature = focusStateSignature(focusedState);
    await remotePress(page, "ArrowRight", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache: options.snapshotCache});
    const nextState = await getFocusedState(page);

    if (!isFocusedStateOnRow(nextState, rowY)) {
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
  let currentState = focusedState;
  for (let attempt = 0; attempt < ROW_HORIZONTAL_NAV_MAX_STEPS; attempt += 1) {
    const beforeSignature = focusStateSignature(currentState);
    await remotePress(page, "ArrowLeft", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache: options.snapshotCache});
    const nextState = await getFocusedState(page);

    if (!isFocusedStateOnRow(nextState, rowY)) {
      await remotePress(page, "ArrowRight", ROW_HORIZONTAL_NAV_DELAY, {snapshotCache: options.snapshotCache});
      const restoredState = await getFocusedState(page);
      if (!isFocusedStateOnRow(restoredState, rowY)) {
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

  for (let attempt = 0; attempt <= SERVICE_CATEGORY_MAX_SCAN_STEPS; attempt++) {
    const service = findServiceItemByName(row?.items, serviceName);
    const before = await getFocusedState(page);
    for (const item of row?.items || []) {
      if (item?.title) observedServices.add(item.title);
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

function findServiceItemByName(items, serviceName) {
  const target = normalizeVietnameseText(serviceName);
  return (items || []).find((item) =>
    item?.id && normalizeVietnameseText(item?.title || "") === target
  ) || null;
}

function isFocusedServiceItem(focused, service) {
  if (!focused || !service) return false;
  if (focused.id && focused.id === service.id) return true;

  const serviceTitle = normalizeVietnameseText(service.title || "");
  if (!serviceTitle) return false;
  return [focused.text, focused.label]
    .map((value) => normalizeVietnameseText(value))
    .some((value) => value === serviceTitle);
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
    .sort((a, b) => b.score - a.score || a.row.rowY - b.row.rowY || a.itemIndex - b.itemIndex)[0];

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
        snapshotCache.invalidate();
        const rows = await collectVisibleContentRows(page, {snapshotCache});
        const row = rows.find((candidate) => candidate.items.some((item) => item.id.startsWith(rowPrefix)));
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

async function inspectHomePageRowTarget(page, rowPrefix) {
  return page.evaluate((prefix) => {
    const homePageItems = Array.from(document.querySelectorAll("[id]"))
      .filter((element) => /^homePage2_\d+_\d+$/u.test(element.id))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          id: element.id,
          rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          laidOut: rect.width >= 100 && rect.height >= 80 &&
            style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0,
        };
      });
    const target = homePageItems
      .filter((item) => item.id.startsWith(prefix) && item.laidOut)
      .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)[0];

    return {
      hasHomePageRows: homePageItems.some((item) => item.laidOut),
      targetId: target?.id || "",
    };
  }, rowPrefix);
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
    .map((row) => ({
      row,
      score: scoreNormalizedTextMatch(row.normalizedTitle || normalizeVietnameseText(row.title || ""), targetPattern),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.rowY - b.row.rowY)[0]?.row;
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

async function collectVisibleContentRows(page, options = {}) {
  const snapshotCache = options.snapshotCache;
  const snapshotIdentity = snapshotCache
    ? await getDomSnapshotIdentity(page, "contentContainer")
    : null;
  const cached = snapshotCache?.get("visible-content-rows", snapshotIdentity);
  if (cached?.rows) return cached.rows;

  const scanner = createScopedDomScanner(page);
  const scan = await scanner.scan({
    contractName: "contentContainer",
    candidateSelector: "[id]",
    includeHeadings: true,
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
      const heading = headings
        .filter((item) => item.rect.y < row.rowY && row.rowY - item.rect.y <= 150)
        .sort((a, b) => row.rowY - b.rect.y - (row.rowY - a.rect.y))[0];
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
    const viewportWidth = window.innerWidth || 1920;
    const viewportHeight = window.innerHeight || 1080;
    const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân|Tất cả dịch vụ)$/i;
    const isMenuItem = focused.id.startsWith("menu_") || rect.x < 100;
    const isIdentifiedPoster = focused.classList.contains("cate_content_item") ||
      focused.classList.contains("lw_r_item") ||
      /^homePage\d+_/u.test(focused.id);

    return (
      rect.width >= 100 &&
      rect.height >= 80 &&
      rect.x >= 100 &&
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

async function returnToFirstRowContent(page, { item, rowY }) {
  await dependencies.closePlayerOrDetail(page, {
    remotePress,
    observePopup: observeExitConfirmation,
    dismissUnexpectedPopup: dismissKnownPlaybackFailurePopup,
    isClosed: async (candidatePage) => (
      (await isFocusedContentItem(candidatePage)) &&
      ((await isFocusedNearRow(candidatePage, rowY)) ||
        (item?.id && (await isFocusedOnContentItem(candidatePage, item))))
    ),
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

async function moveToNextFirstRowContent(page, { previousSignature, rowY }) {
  const currentFocused = await getFocusedContentMetadata(page).catch(() => ({rect: null}));
  const currentRowY = currentFocused.rect?.y || rowY;
  for (let attempt = 0; attempt < 3; attempt++) {
    await remotePress(page, "ArrowRight", 800);

    if (!(await isFocusedContentItem(page)) || !(await isFocusedNearRow(page, currentRowY))) {
      return false;
    }

    const focusedItem = await getFocusedContentMetadata(page);
    if (contentItemSignature(focusedItem) !== previousSignature) {
      return true;
    }
  }

  return false;
}

async function isFocusedNearRow(page, rowY) {
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


module.exports={configureContentRows,createContentRowsApi,collectVisibleContentRows,focusRequestedContentRow,focusViewMorePosterInCurrentRow,focusServiceCategoryItem,focusFirstItemInCurrentContentRow,findVisibleContentItemByName,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback,ROW_RETURN_RENDER_DELAY_MS};
