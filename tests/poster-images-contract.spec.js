// Contract spec for check_poster_images. Image load state is only observable
// inside the browser, so this runs against a real DOM via page.setContent. The
// page imitates the app: remote Down moves focus to the next row and detaches
// the row two above it, and a carousel poster far to the right only receives
// its image once focus walks to it.
const {test, expect} = require("playwright/test");
const {checkPagePosterImages, observePosterImages} = require("./lib/poster-images");

const OK_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const MISSING_IMAGE = "missing-poster.png";
const PLACEHOLDER_IMAGE = "build-app/images/no-image-movie.png";

function card({row, col, name, src, left = 100 + col * 250, lazySrc = ""}) {
  const source = src === undefined ? "" : ` src="${src}"`;
  const lazy = lazySrc ? ` data-lazy="${lazySrc}"` : "";
  return `
    <div class="cate_content_item" id="homePage2_${row}_${col}" title_text="${name}"
         style="position:absolute;left:${left}px;top:20px;width:233px;height:131px">
      <img${source}${lazy} alt="${name}" style="width:233px;height:131px">
      <img src="${OK_IMAGE}" class="badge" style="width:20px;height:20px">
    </div>`;
}

function rowMarkup(row, title, cards) {
  return `
    <div id="homePage2_${row}" class="cate_content_row" style="position:absolute;left:0;width:1280px;height:200px">
      <div class="cate_content_row_title">${title}</div>
      ${cards.join("")}
    </div>`;
}

const ROWS = [
  rowMarkup(1, "Phim mới", [
    card({row: 1, col: 0, name: "Phim tốt", src: OK_IMAGE}),
    card({row: 1, col: 1, name: "Phim lỗi tải", src: MISSING_IMAGE}),
  ]),
  rowMarkup(2, "Kênh nổi bật", [
    card({row: 2, col: 0, name: "Kênh tốt", src: OK_IMAGE}),
    // Far right of the carousel with no source until focus reaches it.
    card({row: 2, col: 1, name: "Kênh xa bên phải", left: 3000, lazySrc: PLACEHOLDER_IMAGE}),
  ]),
  rowMarkup(3, "Thiếu nhi", [
    card({row: 3, col: 0, name: "Hoạt hình", src: OK_IMAGE}),
  ]),
  rowMarkup(4, "Thể thao", [
    card({row: 4, col: 0, name: "Bóng đá", src: MISSING_IMAGE}),
  ]),
];

function appPage(rows, {wrap = false} = {}) {
  return `
    <body style="margin:0;width:1280px;height:720px;overflow:hidden">
      <div id="rows"></div>
      <script>
        const ROWS = ${JSON.stringify(rows)};
        const container = document.getElementById("rows");
        let focusedRow = 0;
        let focusedCol = 0;
        window.downPresses = 0;
        function render() {
          container.innerHTML = "";
          // Only the rows around focus are in the DOM, like the app.
          for (let index = Math.max(0, focusedRow - 1); index < Math.min(ROWS.length, focusedRow + 2); index += 1) {
            container.insertAdjacentHTML("beforeend", ROWS[index]);
            container.lastElementChild.style.top = (index - focusedRow + 1) * 220 + "px";
          }
          const row = document.getElementById("homePage2_" + (focusedRow + 1));
          const cards = row.querySelectorAll(".cate_content_item");
          const target = cards[Math.min(focusedCol, cards.length - 1)];
          target.classList.add("focused");
          const lazy = target.querySelector("img[data-lazy]");
          if (lazy) {
            lazy.src = lazy.dataset.lazy;
            // Keep the loaded source when the row is rendered again.
            ROWS[focusedRow] = ROWS[focusedRow].replace('data-lazy="' + lazy.dataset.lazy + '"', 'src="' + lazy.dataset.lazy + '"');
          }
        }
        document.addEventListener("keydown", (event) => {
          const row = document.getElementById("homePage2_" + (focusedRow + 1));
          const count = row.querySelectorAll(".cate_content_item").length;
          if (event.key === "ArrowDown") window.downPresses += 1;
          if (event.key === "ArrowDown" && focusedRow < ROWS.length - 1) { focusedRow += 1; focusedCol = 0; }
          // A service page: Down on the last row focuses the first row again.
          else if (event.key === "ArrowDown" && ${wrap}) { focusedRow = 0; focusedCol = 0; }
          if (event.key === "ArrowRight" && focusedCol < count - 1) focusedCol += 1;
          render();
        });
        render();
      </script>
    </body>`;
}

test("reads broken, placeholder and pending posters from the DOM", async ({page}) => {
  await page.setContent(appPage(ROWS));

  const observation = await observePosterImages(page);
  const byId = Object.fromEntries(observation.cards.map((item) => [item.id, item]));

  expect(byId.homePage2_1_0.status).toBe("ok");
  expect(byId.homePage2_1_1.status).toBe("broken");
  expect(byId.homePage2_1_1.name).toBe("Phim lỗi tải");
  // Off-screen with no source yet: no verdict, not a failure.
  expect(byId.homePage2_2_1.status).toBe("pending");
  expect(byId.homePage2_2_1.inViewport).toBe(false);
  expect(observation.focusedCardId).toBe("homePage2_1_0");
});

test("walks every row and reports each broken poster by id and name", async ({page}) => {
  test.setTimeout(60000);
  await page.setContent(appPage(ROWS));

  const error = await checkPagePosterImages(page, null, {imageLoadTimeoutMs: 1000}).catch((caught) => caught);

  expect(error).toBeInstanceOf(Error);
  expect(error.message).toMatch(/^Có 3 poster bị lỗi hình/u);
  const failed = error.details.results.map(({id, name}) => ({id, name}));
  expect(failed).toEqual([
    {id: "homePage2_1_1", name: "Phim lỗi tải"},
    // Reached only by walking the carousel to the right.
    {id: "homePage2_2_1", name: "Kênh xa bên phải"},
    // Row 4 is not in the DOM until focus reaches row 3.
    {id: "homePage2_4_0", name: "Bóng đá"},
  ]);
  expect(error.details.rowCount).toBe(4);
  expect(error.details.uncheckedCount).toBe(0);
});

test("passes when every poster image loaded", async ({page}) => {
  test.setTimeout(60000);
  await page.setContent(appPage([
    rowMarkup(1, "Phim mới", [card({row: 1, col: 0, name: "Phim tốt", src: OK_IMAGE})]),
    rowMarkup(2, "Kênh", [card({row: 2, col: 0, name: "Kênh tốt", src: OK_IMAGE})]),
  ]));

  const result = await checkPagePosterImages(page, null, {imageLoadTimeoutMs: 1000});

  expect(result.brokenCount).toBe(0);
  expect(result.checkedCount).toBe(2);
  expect(result.results).toEqual([]);
});

test("stops at the wrap back to the first row on a service page", async ({page}) => {
  test.setTimeout(60000);
  await page.setContent(appPage(ROWS, {wrap: true}));

  const error = await checkPagePosterImages(page, null, {imageLoadTimeoutMs: 1000}).catch((caught) => caught);

  expect(error.details.endReason).toBe("wrapped");
  expect(error.details.results.map((item) => item.id)).toEqual([
    "homePage2_1_1",
    "homePage2_2_1",
    "homePage2_4_0",
  ]);
  // One Down per row: the fourth press wraps to the top and ends the walk.
  expect(await page.evaluate(() => window.downPresses)).toBe(ROWS.length);
});

test("still ends on Home, where Down on the last row does nothing", async ({page}) => {
  test.setTimeout(60000);
  await page.setContent(appPage(ROWS));

  const error = await checkPagePosterImages(page, null, {imageLoadTimeoutMs: 1000}).catch((caught) => caught);

  expect(error.details.endReason).toBe("last_row");
});
