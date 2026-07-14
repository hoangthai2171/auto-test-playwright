const {test, expect} = require("playwright/test");
const {SELECTOR_CONTRACTS, getSelectorContract, getSelectorAlternatives} = require("./lib/selectors");
const {
  collectSelectorDiagnostics,
  verifyFocusedTarget,
  captureActivationDiagnostics,
  activateVerifiedTarget,
  runSelectorHealthCheck,
  assertSelectorHealth,
  fuzzyLabelMatch,
} = require("./lib/selector-validation");

const CONTENT_FIXTURE = `
  <style>
    body { margin: 0; background: #111; color: white; }
    .content-area { position: relative; width: 900px; height: 600px; }
    .card { position: absolute; width: 180px; height: 120px; top: 120px; display: flex; align-items: center; justify-content: center; }
    #content-1 { left: 120px; }
    #content-2 { left: 360px; }
  </style>
  <div id="menu_home" style="position:absolute;left:0;top:0;width:90px;height:50px">Trang chủ</div>
  <div class="content-area">
    <div id="content-1" class="card focused" content_name="Căn Phòng Tử Thần">Căn Phòng Tử Thần</div>
    <div id="content-2" class="card" content_name="Căn Phòng Tử Thần">Căn Phòng Tử Thần</div>
  </div>
`;

test("selector contracts expose role-based alternatives and geometry", () => {
  expect(Object.keys(SELECTOR_CONTRACTS)).toEqual(
    expect.arrayContaining(["focus", "leftMenu", "contentContainer", "contentItem", "channel", "menuItem", "searchAction", "popup", "player"])
  );
  expect(getSelectorAlternatives("contentItem").length).toBeGreaterThan(0);
  expect(getSelectorContract("contentItem").geometry.minWidth).toBe(100);
  expect(getSelectorAlternatives("searchAction")).toEqual([
    expect.objectContaining({idIncludes: ["callSearch"]}),
  ]);
});

test("search action verification ignores the virtual-keyboard input candidate", async ({page}) => {
  await page.setContent(`
    <style>
      #keyboard_search_keyword { width: 1540px; height: 42px; }
      #callSearch { width: 156px; height: 68px; }
    </style>
    <input id="keyboard_search_keyword" title="can phong tu than search" />
    <button id="callSearch" class="focused">Tìm kiếm</button>
  `);

  const diagnostics = await collectSelectorDiagnostics(page, {
    contractName: "searchAction",
    expectedId: "callSearch",
  });
  expect(diagnostics.candidate.id).toBe("callSearch");
  expect(diagnostics.candidate.score).toBe(100);

  const verified = await verifyFocusedTarget(page, {
    contractName: "searchAction",
    expectedId: "callSearch",
  });
  expect(verified.valid).toBe(true);
});

test("diagnostics keep only the top candidate and focused state", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 800});
  await page.setContent(CONTENT_FIXTURE);

  const diagnostics = await collectSelectorDiagnostics(page, {
    contractName: "contentItem",
    expectedLabel: "Căn phòng",
  });

  expect(diagnostics.focused.id).toBe("content-1");
  expect(diagnostics.candidate.id).toBe("content-1");
  expect(diagnostics.candidates).toBeUndefined();
  expect(diagnostics.candidate.candidateCount).toBe(2);
  expect(diagnostics.candidate.scoreMargin).toBe(0);
});

test("clear fuzzy identity verifies while ambiguous candidates are rejected", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 800});
  await page.setContent(CONTENT_FIXTURE);

  const ambiguous = await verifyFocusedTarget(page, {
    contractName: "contentItem",
    expectedLabel: "Căn phòng",
    threshold: 70,
    margin: 10,
  });
  expect(ambiguous.valid).toBe(false);
  expect(ambiguous.reason).toContain("scoreMargin");

  await page.locator("#content-2").evaluate((element) => element.remove());
  const clear = await verifyFocusedTarget(page, {
    contractName: "contentItem",
    expectedId: "content-1",
    expectedLabel: "Căn phòng",
  });
  expect(clear.valid).toBe(true);
  expect(fuzzyLabelMatch("can phong tu than", "can phong")).toBe(true);
});

test("activation diagnostics attach JSON and screenshot", async ({page}) => {
  await page.setContent(CONTENT_FIXTURE);
  const attachments = [];
  await captureActivationDiagnostics(page, {attach: async (name, payload) => attachments.push({name, payload})}, "activation", {
    focused: {id: "content-1"},
    candidate: {id: "content-1"},
  });

  expect(attachments.map((item) => item.name)).toEqual(["activation.json", "activation.png"]);
  expect(attachments[0].payload.contentType).toBe("application/json");
  expect(attachments[1].payload.contentType).toBe("image/png");
});

test("verified activation presses Enter only for a clear focused target", async ({page}) => {
  await page.setContent(`
    <style>#movie-1 { width: 180px; height: 120px; margin: 120px; }</style>
    <div id="movie-1" class="focused" content_name="Căn Phòng Tử Thần">Căn Phòng Tử Thần</div>
    <script>document.addEventListener("keydown", (event) => { if (event.key === "Enter") document.body.dataset.activated = "true"; });</script>
  `);

  await activateVerifiedTarget(page, {
    contractName: "contentItem",
    expectedId: "movie-1",
    expectedLabel: "Căn Phòng Tử Thần",
    delay: 0,
  });

  await expect(page.locator("body")).toHaveAttribute("data-activated", "true");
});

test("backward-compatible helper alias exposes selector APIs", () => {
  const helpers = require("./lib/mytv-helpers");
  expect(typeof helpers.openMovieContent).toBe("function");
  expect(typeof helpers.activateVerifiedTarget).toBe("function");
  expect(typeof helpers.runSelectorHealthCheck).toBe("function");
});

test("health check distinguishes required failure from optional warning", async ({page}) => {
  await page.setViewportSize({width: 1200, height: 800});
  await page.setContent(CONTENT_FIXTURE);

  const passing = await runSelectorHealthCheck(page);
  expect(passing.status).toBe("pass");
  expect(passing.results.every((item) => item.status === "pass")).toBe(true);

  const optional = await runSelectorHealthCheck(page, {contractNames: ["player"]});
  expect(optional.status).toBe("warning");
  expect(optional.results[0].status).toBe("warning");

  await page.setContent("<div>empty</div>");
  await expect(assertSelectorHealth(page, {contractNames: ["focus"]})).rejects.toThrow("Selector health check failed");
});
