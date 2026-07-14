const fs = require("fs");
const path = require("path");
const {test, expect} = require("playwright/test");
const {getContractLocator, resolveContractLocatorId, activateVerifiedTarget} = require("./lib/selector-validation");

test("stable menu Locator filtering selects the matching structural target", async ({page}) => {
  await page.setContent(`
    <style>
      [id^="menu_text_"] { display: block; width: 180px; height: 50px; margin: 8px; }
    </style>
    <div id="menu_text_home">Trang chủ</div>
    <div id="menu_text_settings">Cài đặt</div>
    <div id="menu_text_settings_duplicate">Cài đặt nâng cao</div>
  `);

  const locator = getContractLocator(page, "leftMenu").filter({hasText: /^Cài đặt$/i});
  expect(await locator.count()).toBe(1);
  const resolved = await resolveContractLocatorId(page, {
    contractName: "leftMenu",
    hasText: /^Cài đặt$/i,
    fallback: () => { throw new Error("evaluate fallback should not run"); },
  });

  expect(resolved).toMatchObject({id: "menu_text_settings", source: "locator", contractMiss: false});
});

test("Locator contract miss runs one diagnostic fallback and exposes the miss", async ({page}) => {
  await page.setContent('<div id="legacy-search" style="display:block;width:160px;height:60px">Tìm kiếm</div>');
  await page.evaluate(() => { window.__locatorFallbackCount = 0; });

  const resolved = await resolveContractLocatorId(page, {
    contractName: "searchAction",
    fallback: () => page.evaluate(() => {
      window.__locatorFallbackCount += 1;
      return document.querySelector("#legacy-search")?.id || "";
    }),
  });

  expect(resolved).toMatchObject({id: "legacy-search", source: "evaluate-fallback", contractMiss: true});
  expect(resolved.diagnostics).toMatchObject({fallbackUsed: true, fallbackId: "legacy-search"});
  expect(await page.evaluate(() => window.__locatorFallbackCount)).toBe(1);
});

test("Locator-resolved targets still require keyboard-only verified activation", async ({page}) => {
  await page.setContent(`
    <style>#menu_text_settings { display:block; width:180px; height:60px; }</style>
    <div id="menu_text_settings" class="focused" menu_name="Cài đặt">Cài đặt</div>
    <script>document.addEventListener("keydown", event => { if (event.key === "Enter") document.body.dataset.activated = "true"; });</script>
  `);

  const resolved = await resolveContractLocatorId(page, {
    contractName: "leftMenu",
    hasText: /^Cài đặt$/i,
  });
  await activateVerifiedTarget(page, {
    contractName: "menuItem",
    expectedId: resolved.id,
    expectedLabel: "Cài đặt",
    delay: 0,
  });

  expect(await page.locator("body").getAttribute("data-activated")).toBe("true");
  const workflows = fs.readFileSync(path.join(__dirname, "lib", "workflows.js"), "utf8");
  expect(workflows).not.toContain("locator.click(");
});
