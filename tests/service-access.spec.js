const {test, expect} = require("playwright/test");
const {assertServiceOpened} = require("./lib/workflows");

async function setServiceScreen(page, body = "") {
  await page.setContent(`
    <style>
      .content-area { margin: 120px; }
      .service-card { display: block; width: 220px; height: 150px; }
      .toast, .popup { display: block; width: 360px; min-height: 80px; }
    </style>
    <div class="content-area" id="service-content-row">
      <div id="service-card-1" class="service-card" content_name="Demo">Demo content</div>
    </div>
    ${body}
  `);
  await page.evaluate(() => { window.location.hash = "#service-demo"; });
}

test("service access succeeds only after a non-Home screen exposes content rows", async ({page}) => {
  await setServiceScreen(page);

  await expect(assertServiceOpened(page, {
    service: "Demo",
    timeout: 200,
    polling: 5,
  })).resolves.toMatchObject({
    type: "service",
    service: "Demo",
    route: "service-demo",
    rowCount: 1,
    visibleCount: 1,
  });
});

test("does not accept a changed route while the visible screen is still Home", async ({page}) => {
  await page.setContent(`
    <style>
      .content-area { margin: 120px; }
      .service-card { display: block; width: 220px; height: 150px; }
    </style>
    <div class="content-area" id="homePage2_category">
      <div id="home-card" class="service-card" content_name="Home">Home poster</div>
    </div>
  `);
  await page.evaluate(() => {
    window.location.hash = "#specialModule";
    window.setTimeout(() => {
      document.body.innerHTML = `
        <div class="content-area" id="service-content-row">
          <div id="service-card-1" class="service-card" content_name="One">One</div>
          <div id="service-card-2" class="service-card" content_name="Two">Two</div>
        </div>
      `;
    }, 40);
  });

  await expect(assertServiceOpened(page, {
    service: "Demo",
    timeout: 300,
    polling: 5,
  })).resolves.toMatchObject({
    route: "specialModule",
    visibleCount: 2,
  });
});

test("service content wording that includes an error-like phrase is not treated as a popup", async ({page}) => {
  await page.setContent(`
    <style>
      .content-area { margin: 120px; }
      .service-card { display: block; width: 220px; height: 150px; }
    </style>
    <div class="content-area" id="service-content-row">
      <div id="service-card-1" class="service-card" content_name="Cất cánh: Không thể lãng quên">
        Cất cánh: Không thể lãng quên
      </div>
    </div>
  `);
  await page.evaluate(() => { window.location.hash = "#service-demo"; });

  await expect(assertServiceOpened(page, {
    service: "Demo",
    timeout: 200,
    polling: 5,
  })).resolves.toMatchObject({route: "service-demo", rowCount: 1});
});

test("TV xem lại schedule rows count as service destination content", async ({page}) => {
  await page.setContent(`
    <style>
      .tvod_container { display: block; margin: 100px; width: 800px; height: 400px; }
      .lw_r_item { display: block; width: 180px; height: 50px; }
    </style>
    <div class="tvod_container">
      <div class="lw_r_item">Khuyến học - Hành trình tri thức</div>
      <div class="lw_r_item">Thời sự</div>
    </div>
  `);
  await page.evaluate(() => { window.location.hash = "#tvod"; });

  await expect(assertServiceOpened(page, {
    service: "TV Xem lại",
    timeout: 200,
    polling: 5,
  })).resolves.toMatchObject({route: "tvod", rowCount: 1, visibleCount: 2});
});

test("service access rejects an auto-hide style toast even when old content remains visible", async ({page}) => {
  await setServiceScreen(page, '<div id="service-toast" class="toast">Không thể mở dịch vụ</div>');

  await expect(assertServiceOpened(page, {
    service: "Demo",
    timeout: 200,
    polling: 5,
  })).rejects.toThrow(/Không thể mở dịch vụ/u);
});

test("service access rejects a no-data popup instead of accepting the destination route", async ({page}) => {
  await setServiceScreen(page, `
    <div id="service-popup" class="popup">
      <div>Hiện tại dịch vụ chưa có dữ liệu.</div>
      <button>Đóng</button>
    </div>
  `);

  await expect(assertServiceOpened(page, {
    service: "Demo",
    timeout: 200,
    polling: 5,
  })).rejects.toThrow(/chưa có dữ liệu/u);
});
