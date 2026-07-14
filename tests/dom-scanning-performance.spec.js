const {test, expect} = require("playwright/test");
const {createScopedDomScanner} = require("./lib/dom-scan");
const {collectVisibleContentRows} = require("./lib/content-rows");

const SCAN_OPTIONS = {
  contractName: "contentContainer",
  candidateSelector: "[id]",
  attributeNames: ["content_name", "title"],
  geometry: {minWidth: 100, minHeight: 80, maxWidth: 520, maxHeight: 420, minX: 80, minY: 80},
};

test("scoped scan uses the ordered content root and extracts only required records", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 900});
  await page.setContent(`
    <style>
      .content-area { position: relative; width: 900px; height: 600px; }
      .card { position: absolute; width: 180px; height: 120px; top: 140px; }
      #content-1 { left: 120px; }
      #unrelated { position: absolute; width: 300px; height: 200px; left: 10px; top: 10px; }
    </style>
    <div id="unrelated" title="must not be scanned">outside</div>
    <div class="content-area">
      <div id="content-1" class="card" content_name="Căn Phòng Tử Thần">Căn Phòng Tử Thần</div>
    </div>
  `);
  await page.evaluate(() => {
    const original = window.getComputedStyle;
    window.__unrelatedStyleReads = 0;
    window.getComputedStyle = (element, pseudo) => {
      if (element?.id === "unrelated") window.__unrelatedStyleReads += 1;
      return original.call(window, element, pseudo);
    };
  });

  const result = await createScopedDomScanner(page).scan(SCAN_OPTIONS);

  expect(result.metrics.rootFound).toBe(true);
  expect(result.metrics.usedFallback).toBe(false);
  expect(result.records.map((item) => item.id)).toEqual(["content-1"]);
  expect(result.records[0]).toEqual(expect.objectContaining({
    id: "content-1",
    attrs: expect.objectContaining({content_name: "Căn Phòng Tử Thần"}),
  }));
  expect(result.records[0]).not.toHaveProperty("computedStyle");
  expect(await page.evaluate(() => window.__unrelatedStyleReads)).toBe(0);
});

test("an existing empty root does not trigger a full-page fallback", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 900});
  await page.setContent(`
    <style>
      .content-area { width: 900px; height: 600px; }
      #decoy { width: 180px; height: 120px; margin: 120px; }
    </style>
    <div class="content-area"></div>
    <div id="decoy" content_name="outside root">decoy</div>
  `);

  const result = await createScopedDomScanner(page).scan(SCAN_OPTIONS);

  expect(result.metrics.rootFound).toBe(true);
  expect(result.metrics.usedFallback).toBe(false);
  expect(result.records).toEqual([]);
});

test("a missing root gets one bounded fallback per scanner operation", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 900});
  await page.setContent(`
    <style>#fallback-card { width: 180px; height: 120px; margin: 120px; }</style>
    <div id="fallback-card" content_name="fallback">fallback</div>
  `);

  const scanner = createScopedDomScanner(page);
  const first = await scanner.scan(SCAN_OPTIONS);
  const second = await scanner.scan(SCAN_OPTIONS);

  expect(first.metrics.rootFound).toBe(false);
  expect(first.metrics.usedFallback).toBe(true);
  expect(first.records.map((item) => item.id)).toContain("fallback-card");
  expect(second.metrics.fallbackBlocked).toBe(true);
  expect(second.records).toEqual([]);
});

test("content rows preserve heading association and row grouping", async ({page}) => {
  await page.setViewportSize({width: 1400, height: 1000});
  await page.setContent(`
    <style>
      .content-area { position: relative; width: 1200px; height: 800px; }
      .row-title { position: absolute; left: 100px; width: 700px; height: 30px; }
      .card { position: absolute; width: 180px; height: 120px; }
      #title-1 { top: 100px; }
      #row-1-item-1 { left: 120px; top: 150px; }
      #row-1-item-2 { left: 340px; top: 150px; }
      #title-2 { top: 330px; }
      #row-2-item-1 { left: 120px; top: 380px; }
    </style>
    <div class="content-area">
      <div id="title-1" class="row-title">Phim song song</div>
      <div id="row-1-item-1" class="card" content_name="A">A</div>
      <div id="row-1-item-2" class="card" content_name="B">B</div>
      <div id="title-2" class="row-title">Phim mới</div>
      <div id="row-2-item-1" class="card" content_name="C">C</div>
    </div>
  `);

  const rows = await collectVisibleContentRows(page);

  expect(rows).toHaveLength(2);
  expect(rows[0].title).toBe("Phim song song");
  expect(rows[0].items.map((item) => item.id)).toEqual(["row-1-item-1", "row-1-item-2"]);
  expect(rows[1].title).toBe("Phim mới");
  expect(rows[1].items[0].id).toBe("row-2-item-1");
});
