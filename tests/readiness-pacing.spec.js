const {test, expect} = require("playwright/test");
const api = require("./lib");
const helpers = require("./lib/mytv-helpers");
const workflows = require("./lib/workflows");

async function setScreen(page, {hash = "#login", body, focused = "Focus"}) {
  await page.setContent(`
    <style>
      body { margin: 0; color: white; background: #111; }
      .screen-marker, .focused, #menu_text_dynamic_menu_1, [title] {
        position: absolute;
        width: 180px;
        height: 100px;
        left: 220px;
        top: 220px;
      }
      #login-tabs { left: 20px; top: 20px; width: 300px; height: 60px; }
      #menu_text_dynamic_menu_1 { left: 20px; top: 120px; width: 180px; height: 60px; }
    </style>
    ${body || ""}
    ${focused ? `<div id="focus-target" class="focused">${focused}</div>` : ""}
  `);
  await page.evaluate((nextHash) => { location.hash = nextHash; }, hash);
}

async function setHome(page, overrides = {}) {
  const menu = overrides.menu === false
    ? ""
    : '<div id="menu_text_dynamic_menu_1">Truyền hình</div>';
  const content = overrides.content === false
    ? ""
    : '<div id="content-1" title="Phim mới" style="position:absolute;left:240px;top:360px;width:160px;height:120px;">Phim mới</div>';
  const focused = overrides.focus === false
    ? ""
    : overrides.content === false
      ? "<div id=\"home-focus\" class=\"focused\" style=\"position:absolute;left:40px;top:40px;width:20px;height:20px;\">Focus</div>"
      : "<div id=\"home-focus\" class=\"focused\" style=\"position:absolute;left:240px;top:360px;width:160px;height:120px;\">Phim mới</div>";

  await page.setContent(`
    <style>
      body { margin: 0; color: white; background: #111; }
      #menu_text_dynamic_menu_1 { position: absolute; left: 20px; top: 120px; width: 180px; height: 60px; }
      [title] { display: block; }
    </style>
    ${menu}
    ${content}
    ${focused}
  `);
  await page.evaluate((nextHash) => { location.hash = nextHash; }, overrides.hash || "#homeNewUI");
}

test("compatibility barrel exposes the shared readiness and pacing API", () => {
  expect(api.waitForFocusState).toEqual(expect.any(Function));
  expect(api.waitForContentVisible).toEqual(expect.any(Function));
  expect(api.waitForPlayerReady).toEqual(expect.any(Function));
  expect(api.WAIT_DEFAULTS.focus.timeout).toBe(30000);
  expect(api.DEFAULT_REMOTE_PRESS_DELAY).toBe(100);
  expect(helpers.waitForFocusState).toBe(api.waitForFocusState);
  expect(helpers.waitForContentVisible).toBe(api.waitForContentVisible);
  expect(helpers.waitForPlayerReady).toBe(api.waitForPlayerReady);
});

test("app-open readiness accepts login, welcome, and authenticated-home markers", async ({page}) => {
  const states = [
    {name: "login", hash: "#login", body: '<div id="login-tabs" class="screen-marker">Đăng nhập</div>'},
    {name: "welcome", hash: "#welcomePage", body: '<div class="screen-marker">Đăng nhập Trải nghiệm</div>'},
    {name: "home", hash: "#homeNewUI", body: '<div class="screen-marker">Trang chủ</div>'},
  ];

  for (const state of states) {
    await setScreen(page, state);
    const result = await workflows.__internal.waitForAppReady(page, undefined, {timeout: 200, polling: 5});
    expect(result.ok, state.name).toBe(true);
    expect(result.observation.marker, state.name).toBe(state.name);
    expect(result.observation.focused.id, state.name).toBe("focus-target");
  }
});

test("app-open readiness rejects body text without a valid focused element", async ({page}) => {
  await setScreen(page, {hash: "#welcomePage", body: '<div class="screen-marker">Đăng nhập Trải nghiệm</div>', focused: ""});

  await expect(
    workflows.__internal.waitForAppReady(page, undefined, {timeout: 30, polling: 5})
  ).rejects.toMatchObject({code: "WAIT_TIMEOUT", waitName: "app-ready"});
});

test("home readiness requires route, visible menu, content row, and focus", async ({page}) => {
  await setHome(page);
  const result = await workflows.__internal.waitForHomeReady(page, undefined, {timeout: 200, polling: 5});
  expect(result.ok).toBe(true);
  expect(result.observation).toMatchObject({route: true, menu: true, content: true});
  expect(result.observation.focused.id).toBe("home-focus");

  for (const missing of ["hash", "menu", "content", "focus"]) {
    await setHome(page, missing === "hash" ? {hash: "#other"} : {[missing]: false});
    await expect(
      workflows.__internal.waitForHomeReady(page, undefined, {timeout: 30, polling: 5})
    ).rejects.toMatchObject({code: "WAIT_TIMEOUT", waitName: "home-ready"});
  }
});

test("first-content readiness waits for a visible focused element", async ({page}) => {
  await page.setContent(`
    <style>.focused { width: 160px; height: 100px; }</style>
    <div id="movie-focus"></div>
    <script>
      setTimeout(() => document.querySelector('#movie-focus').className = 'focused', 30);
    </script>
  `);

  const result = await api.waitForFocusState(page, {
    name: "first-movie-focus",
    timeout: 300,
    polling: 5,
  });
  expect(result.ok).toBe(true);
  expect(result.observation.id).toBe("movie-focus");
});

test("remotePress uses 100 ms by default and honors per-call overrides", async () => {
  const delays = [];
  const page = {
    keyboard: {press: async () => {}},
    waitForTimeout: async (delay) => delays.push(delay),
  };

  await api.remotePress(page, "ArrowRight");
  await api.remotePress(page, "ArrowRight", 275);

  expect(delays).toEqual([100, 275]);
});
