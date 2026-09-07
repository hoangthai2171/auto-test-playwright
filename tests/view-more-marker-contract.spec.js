// Contract spec for the view-more marker. The marker is matched inside a
// page.evaluate callback, so a mocked evaluate cannot cover it - this runs
// against a real DOM via page.setContent. The case that motivated it: a Home
// row whose last poster carries item_view_more="1" WITHOUT the .view_more
// class. Row playback used to treat that poster as content and pressed OK on
// it, which opened the category screen mid-run.
const {test, expect} = require("playwright/test");
const contentRows = require("./lib/content-rows");

const ROW_ID = "homePage2_13";
const OTHER_ROW_ID = "homePage2_4";

function rowPage({viewMoreMarkup, focusedIndex}) {
  const posters = [0, 1].map((index) => `
    <div class="cate_content_item" id="${ROW_ID}_${index}"
         title_text="Poster ${index}"
         style="position:absolute;left:${100 + index * 250}px;top:200px;width:233px;height:131px">
      <img src="poster-${index}.jpg" alt="Poster ${index}">
    </div>
  `).join("");

  return `
    <div id="${OTHER_ROW_ID}" class="cate_content_row" style="position:absolute;left:0;top:520px;width:1280px;height:320px">
      <div class="cate_content_row_title">Hàng khác</div>
      <div class="cate_content_item" id="${OTHER_ROW_ID}_0" title_text="Poster khác"
           style="position:absolute;left:100px;top:540px;width:233px;height:131px"></div>
    </div>
    <div id="${ROW_ID}" class="cate_content_row" style="position:absolute;left:0;top:180px;width:1280px;height:320px">
      <div class="cate_content_row_title">Phim mới nhất</div>
      ${posters}
      ${viewMoreMarkup}
    </div>
    <script>
      document.querySelectorAll(".focused").forEach((element) => element.classList.remove("focused"));
      document.querySelectorAll("#${ROW_ID} > div")[${focusedIndex}]?.classList.add("focused");
    </script>
  `;
}

const VIEW_MORE_ATTRIBUTE_ONLY = `
  <div class="cate_content_item" id="${ROW_ID}_2" item_view_more="1"
       style="position:absolute;left:600px;top:200px;width:233px;height:131px">
    <img src="view-more.jpg" alt="Xem tất cả">
  </div>
`;

const VIEW_MORE_CLASS_ONLY = `
  <div class="cate_content_item view_more" id="${ROW_ID}_2"
       style="position:absolute;left:600px;top:200px;width:233px;height:131px">
    <img src="view-more.jpg" alt="Xem tất cả">
  </div>
`;

const VIEW_MORE_BOTH_MARKERS = `
  <div class="cate_content_item view_more" id="${ROW_ID}_2" item_view_more="1"
       style="position:absolute;left:600px;top:200px;width:233px;height:131px">
    <img src="view-more.jpg" alt="Xem tất cả">
  </div>
`;

// The focused element is the third child of the row: the two posters plus the
// row title element sit before it, so the index accounts for the title.
const FOCUSED_VIEW_MORE = 3;
const FOCUSED_FIRST_POSTER = 1;

test("detects a view-more poster that only carries the item_view_more attribute", async ({page}) => {
  await page.setContent(rowPage({viewMoreMarkup: VIEW_MORE_ATTRIBUTE_ONLY, focusedIndex: FOCUSED_VIEW_MORE}));

  const metadata = await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID});

  expect(metadata).not.toBeNull();
  expect(metadata.isViewMore).toBe(true);
  expect(metadata.id).toBe(`${ROW_ID}_2`);
});

test("detects a view-more poster that only carries the view_more class", async ({page}) => {
  await page.setContent(rowPage({viewMoreMarkup: VIEW_MORE_CLASS_ONLY, focusedIndex: FOCUSED_VIEW_MORE}));

  const metadata = await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID});

  expect(metadata).not.toBeNull();
  expect(metadata.id).toBe(`${ROW_ID}_2`);
});

test("still detects a poster carrying both markers", async ({page}) => {
  await page.setContent(rowPage({viewMoreMarkup: VIEW_MORE_BOTH_MARKERS, focusedIndex: FOCUSED_VIEW_MORE}));

  expect(await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID})).not.toBeNull();
});

test("does not report an ordinary content poster as view-more", async ({page}) => {
  await page.setContent(rowPage({viewMoreMarkup: VIEW_MORE_ATTRIBUTE_ONLY, focusedIndex: FOCUSED_FIRST_POSTER}));

  expect(await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID})).toBeNull();
});

test("ignores a view-more poster that belongs to another row", async ({page}) => {
  await page.setContent(rowPage({viewMoreMarkup: VIEW_MORE_ATTRIBUTE_ONLY, focusedIndex: FOCUSED_VIEW_MORE}));

  // The poster is real and focused, but it is not inside the row being asked
  // about, so it must not count as that row's view-more.
  expect(await contentRows.getFocusedViewMoreMetadata(page, {rowId: OTHER_ROW_ID})).toBeNull();
});

test("flags the attribute-only poster in the scanned row items", async ({page}) => {
  await page.setContent(rowPage({viewMoreMarkup: VIEW_MORE_ATTRIBUTE_ONLY, focusedIndex: FOCUSED_FIRST_POSTER}));

  const rows = await contentRows.collectVisibleContentRows(page);
  const row = rows.find((candidate) => candidate.rowId === ROW_ID);

  expect(row).toBeTruthy();
  expect(row.items.find((item) => item.id === `${ROW_ID}_2`)?.isViewMore).toBe(true);
  expect(row.items.find((item) => item.id === `${ROW_ID}_0`)?.isViewMore).toBe(false);
});

test("does not treat a row wrapper carrying the marker as a view-more poster", async ({page}) => {
  // If a wrapper won, every card under it would read as view-more and row
  // playback would skip the whole row while reporting nothing wrong.
  await page.setContent(`
    <div id="${ROW_ID}" class="cate_content_row" item_view_more="1"
         style="position:absolute;left:0;top:180px;width:1280px;height:320px">
      <div class="cate_content_row_title">Phim mới nhất</div>
      <div class="cate_content_item focused" id="${ROW_ID}_0" title_text="Poster 0"
           style="position:absolute;left:100px;top:200px;width:233px;height:131px"></div>
    </div>
  `);

  expect(await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID})).toBeNull();
});

test("does not treat a marked carousel wrapper as a view-more poster", async ({page}) => {
  await page.setContent(`
    <div id="${ROW_ID}" class="cate_content_row"
         style="position:absolute;left:0;top:180px;width:1280px;height:320px">
      <div class="cate_content_row_title">Phim mới nhất</div>
      <div class="view_more" style="position:absolute;left:0;top:200px;width:1000px;height:131px">
        <div class="cate_content_item focused" id="${ROW_ID}_0" title_text="Poster 0"
             style="position:absolute;left:100px;top:200px;width:233px;height:131px"></div>
      </div>
    </div>
  `);

  expect(await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID})).toBeNull();
});
