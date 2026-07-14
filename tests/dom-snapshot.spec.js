const {test, expect} = require("playwright/test");
const {createDomSnapshotCache, getDomSnapshotIdentity} = require("./lib/dom-snapshots");
const {collectVisibleContentRows} = require("./lib/content-rows");
const {remotePress} = require("./lib/navigation");

test("snapshot cache clones records and rejects route or container identity mismatches", () => {
  const cache = createDomSnapshotCache();
  const identity = {route: "/home#homeNewUI", container: ".content-area|row-1"};
  const source = {rows: [{items: [{id: "item-1", rect: {x: 1, y: 2, width: 3, height: 4}}]}]};

  cache.set("rows", identity, source);
  source.rows[0].items[0].id = "mutated-source";
  const firstRead = cache.get("rows", identity);
  firstRead.rows[0].items[0].id = "mutated-read";

  expect(cache.get("rows", identity).rows[0].items[0].id).toBe("item-1");
  expect(cache.get("rows", {...identity, route: "/detail#player"})).toBeNull();
  expect(cache.get("rows", {...identity, container: ".content-area|row-2"})).toBeNull();
  expect(() => cache.set("invalid", {route: "/home"}, {})).toThrow("container");
});

test("content-row retries reuse a snapshot until an explicit remote action invalidates it", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 900});
  await page.setContent(`
    <style>
      .content-area { position: relative; width: 900px; height: 600px; }
      .card { position: absolute; left: 120px; top: 140px; width: 180px; height: 120px; }
    </style>
    <div class="content-area"><div id="item-1" class="card" content_name="First">First</div></div>
  `);
  await page.evaluate(() => {
    const original = Element.prototype.querySelectorAll;
    window.__idQueryCount = 0;
    Element.prototype.querySelectorAll = function querySelectorAll(selector) {
      if (selector === "[id]") window.__idQueryCount += 1;
      return original.call(this, selector);
    };
  });

  const cache = createDomSnapshotCache();
  const first = await collectVisibleContentRows(page, {snapshotCache: cache});
  const firstCount = await page.evaluate(() => window.__idQueryCount);
  const second = await collectVisibleContentRows(page, {snapshotCache: cache});
  const secondCount = await page.evaluate(() => window.__idQueryCount);

  expect(first[0].items[0].id).toBe("item-1");
  expect(second[0].items[0].id).toBe("item-1");
  expect(secondCount).toBe(firstCount);

  await page.evaluate(() => {
    const item = document.querySelector("#item-1");
    item.id = "item-2";
    item.textContent = "Second";
    item.setAttribute("content_name", "Second");
  });
  await remotePress(page, "ArrowRight", 0, {snapshotCache: cache});

  const refreshed = await collectVisibleContentRows(page, {snapshotCache: cache});
  expect(refreshed[0].items[0].id).toBe("item-2");
  expect(await page.evaluate(() => window.__idQueryCount)).toBeGreaterThan(secondCount);
});

test("snapshot identity follows the current route and scoped container", async ({page}) => {
  await page.setContent(`<div class="content-area" id="home-root"></div>`);
  const home = await getDomSnapshotIdentity(page, "contentContainer");
  await page.evaluate(() => {
    location.hash = "detail";
    document.querySelector("#home-root").id = "detail-root";
  });
  const detail = await getDomSnapshotIdentity(page, "contentContainer");

  expect(detail.route).not.toBe(home.route);
  expect(detail.container).not.toBe(home.container);
});
