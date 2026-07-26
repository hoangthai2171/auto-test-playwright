const {expect}=require("playwright/test");
const {getSelectorContract}=require("./selectors");
const {createScopedDomScanner}=require("./dom-scan");
const {createDomSnapshotCache,getDomSnapshotIdentity}=require("./dom-snapshots");
const {normalizeVietnameseText}=require("./text-utils");

const dependencies={
  remotePress:async(page,key,delay=250)=>{await page.keyboard.press(key);await page.waitForTimeout(delay);},
  remoteFocusById:async()=>{throw new Error("Content-row navigation dependency is not configured");},
  remoteFocusByText:async()=>{throw new Error("Content-row text-navigation dependency is not configured");},
  getFocusedState:async()=>({id:"",text:"",label:"",rect:{x:0,y:0,width:0,height:0}}),
  getPlayerState:async()=>({hasVideo:false,isProbablyPlaying:false}),
  hasVisibleText:async()=>false,
  expectFocusedText:async()=>{},
  activateVerifiedTarget:async()=>{throw new Error("Content-row activation dependency is not configured");},
};

const CONTENT_ITEM_CONTRACT = getSelectorContract("contentItem");
const NAMED_ROW_MAX_ATTEMPTS = 45;
const NAMED_ROW_SCROLL_DELAY = 1500;
const SERVICE_CATEGORY_MAX_SCAN_STEPS = 40;

function configureContentRows(next={}){Object.assign(dependencies,next);return module.exports;}
function createContentRowsApi(next={}){configureContentRows(next);return {collectVisibleContentRows,focusRequestedContentRow,focusServiceCategoryItem,focusFirstItemInCurrentContentRow,findVisibleContentItemByName,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback};}
function remotePress(...args){return dependencies.remotePress(...args);}
function remoteFocusById(...args){return dependencies.remoteFocusById(...args);}
function remoteFocusByText(...args){return dependencies.remoteFocusByText(...args);}
function getFocusedState(...args){return dependencies.getFocusedState(...args);}
function getPlayerState(...args){return dependencies.getPlayerState(...args);}
function hasVisibleText(...args){return dependencies.hasVisibleText(...args);}
function expectFocusedText(...args){return dependencies.expectFocusedText(...args);}
function activateVerifiedTarget(...args){return dependencies.activateVerifiedTarget(...args);}
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

  const { rowName, rowIndex, rowPosition, itemIndex } = selector;
  if (!rowName) {
    const row = await findContentRowByPosition(page, { rowIndex, rowPosition, snapshotCache });
    const items = row.items;
    await focusFirstRowStart(page, focusRowItem(row, itemIndex), {snapshotCache});
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
      await focusFirstRowStart(page, focusRowItem(serviceCategoryRow, itemIndex), {snapshotCache, allowServiceFocus: true});
      await expect.poll(() => isFocusedOnRowItems(page, serviceCategoryRow.items), { timeout: 6000 }).toBe(true);
      return serviceCategoryRow;
    }
    const matchedRow = findBestContentRowMatch(rows, targetPattern);
    if (matchedRow) {
      await focusFirstRowStart(page, focusRowItem(matchedRow, itemIndex), {snapshotCache});
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

  function focusRowItem(row, requestedItemIndex) {
    const item = row.items[requestedItemIndex - 1];
    if (item) return item;

    throw new Error(
      `Hàng/cate "${row.title || rowName || "hiện tại"}" chỉ có ${row.items.length} nội dung đang hiển thị; ` +
      `không thể focus nội dung thứ ${requestedItemIndex}`
    );
  }
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

  const hasTargetFocus = await isFocusedOnContentItem(page, firstItem);
  if (!hasTargetFocus) {
    options.snapshotCache?.invalidate();
    await remoteFocusById(page, firstItem.id, 80, {snapshotCache: options.snapshotCache}).catch(() => {});
    options.snapshotCache?.invalidate();
  }

  if (options.allowServiceFocus) {
    await expect.poll(() => isFocusedOnContentItem(page, firstItem), { timeout: 10000 }).toBe(true);
    return;
  }

  await expectFocusedContent(page);
  await expect.poll(() => isFocusedOnContentItem(page, firstItem), { timeout: 6000 }).toBe(true);
}

async function expectFocusedContent(page) {
  await expect.poll(() => isFocusedContentItem(page), { timeout: 10000 }).toBe(true);
}

async function isFocusedContentItem(page) {
  return page.evaluate(() => {
    const focused = document.querySelector(".focused");
    if (!focused) return false;

    const rect = focused.getBoundingClientRect();
    const style = getComputedStyle(focused);
    const label = contentLabel(focused);
    const menuText = /^(Tìm kiếm|Trang chủ|Truyền hình|Phim truyện|Thiếu nhi|Thể thao|Cá nhân|Tất cả dịch vụ)$/i;
    const isMenuItem = focused.id.startsWith("menu_") || rect.x < 100;

    return (
      rect.width >= 100 &&
      rect.height >= 80 &&
      rect.x >= 100 &&
      rect.y >= 100 &&
      rect.width <= 620 &&
      rect.height <= 460 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      !isMenuItem &&
      !focused.id.startsWith("key-") &&
      label &&
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
  });
}

async function isFocusedOnContentItem(page, item) {
  if (!item?.id) return false;

  return page.evaluate((targetId) => {
    const focused = document.querySelector(".focused");
    if (!focused) return false;
    const target = document.getElementById(targetId);
    return focusWithinTarget(focused, target);

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
    const focused = document.querySelector(".focused");
    if (!focused) return false;

    return ids.some((id) => {
      const target = document.getElementById(id);
      return focusWithinTarget(focused, target);
    });

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
    const focused = document.querySelector(".focused");
    if (!focused) {
      return {
        id: "",
        title: "",
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
  });
}

async function openFocusedContentForPlayback(page, testInfo) {
  const focusedContent = await getFocusedContentMetadata(page).catch(() => ({id: "", title: ""}));
  await activateVerifiedTarget(page, {
    testInfo,
    name: `content-${focusedContent.id || "focused"}`,
    contractName: "contentItem",
    expectedId: focusedContent.id,
    expectedLabel: focusedContent.title,
    delay: 3500,
  });

  const hasVideo = await getPlayerState(page)
    .then((state) => state.hasVideo)
    .catch(() => false);
  if (hasVideo) return;

  const focused = await getFocusedState(page).catch(() => ({ text: "", label: "" }));
  const xemNgay = /^Xem ngay$/i;
  if (xemNgay.test(focused.text) || xemNgay.test(focused.label) || (await hasVisibleText(page, xemNgay))) {
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

async function returnFromPlayerOrDetail(page, backPresses) {
  for (let attempt = 0; attempt < backPresses; attempt++) {
    await remotePress(page, "Backspace", 2500);
  }
}

async function returnToFirstRowContent(page, { backPresses, item, rowY }) {
  const maxBackPresses = Math.max(backPresses, 1) + 4;

  for (let attempt = 0; attempt < maxBackPresses; attempt++) {
    if ((await isFocusedContentItem(page)) && (await isFocusedNearRow(page, rowY))) {
      return;
    }

    await remotePress(page, "Backspace", 1800);
  }

  if (item?.id) {
    await remoteFocusById(page, item.id, 20).catch(() => {});
  }

  await expectFocusedContent(page);
}

async function moveToNextFirstRowContent(page, { previousSignature, rowY }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await remotePress(page, "ArrowRight", 800);

    if (!(await isFocusedContentItem(page)) || !(await isFocusedNearRow(page, rowY))) {
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
    const focused = document.querySelector(".focused");
    if (!focused) return false;

    const rect = focused.getBoundingClientRect();
    return Math.abs(Math.round(rect.y) - targetY) <= 80;
  }, rowY);
}

function contentItemSignature(item) {
  return [item?.id || "", item?.title || "", item?.poster || ""].join("|").trim();
}


module.exports={configureContentRows,createContentRowsApi,collectVisibleContentRows,focusRequestedContentRow,focusServiceCategoryItem,focusFirstItemInCurrentContentRow,findVisibleContentItemByName,collectFirstRowPlayableItems,focusFirstRowStart,expectFocusedContent,isFocusedContentItem,isFocusedOnContentItem,isFocusedOnRowItems,getFocusedContentMetadata,contentItemSignature,isFocusedNearRow,moveToNextFirstRowContent,returnToFirstRowContent,openFocusedContentForPlayback};
