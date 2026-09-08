// Contract spec for the two focus markers. The app marks the focused element
// with the `.focused` class on most screens, but the same widgets can instead
// carry an `is_focus="1"` attribute and no focus class at all - the channel
// list always does, and Home rows, album detail and the
// specialModule/specialModuleListV2/shortHome lists can. Every marker read
// happens inside a page.evaluate callback, so a mocked evaluate cannot cover
// it: this runs against a real DOM via page.setContent.
const {test, expect} = require("playwright/test");
const contentRows = require("./lib/content-rows");
const {getFocusedState} = require("./lib/navigation");

const ROW_ID = "homePage2_4";

// The focus geometry gate wants a poster at least 100x80 that starts at or
// right of x=80, so the markup below uses the real Home poster size.
function homeRow({marker, secondPosterClass = ""}) {
  return `
    <div id="${ROW_ID}" class="cate_content_row" style="position:absolute;left:0;top:180px;width:1280px;height:320px">
      <div class="cate_content_row_title">Phim mới nhất</div>
      <div class="cate_content_item" id="${ROW_ID}_0" title_text="Phim một" content_id="c1" ${marker}
           style="position:absolute;left:100px;top:200px;width:233px;height:131px">
        <img src="poster-0.jpg" alt="Phim một">
      </div>
      <div class="cate_content_item ${secondPosterClass}" id="${ROW_ID}_1" title_text="Phim hai" content_id="c2"
           style="position:absolute;left:400px;top:200px;width:233px;height:131px">
        <img src="poster-1.jpg" alt="Phim hai">
      </div>
    </div>
  `;
}

const ROW_ITEMS = [
  {id: `${ROW_ID}_0`, title: "Phim một"},
  {id: `${ROW_ID}_1`, title: "Phim hai"},
];

test("reads a poster focused with the is_focus attribute and no focus class", async ({page}) => {
  await page.setContent(homeRow({marker: 'is_focus="1"'}));

  expect(await contentRows.isFocusedContentItem(page)).toBe(true);
  expect(await contentRows.isFocusedOnContentItem(page, {id: `${ROW_ID}_0`})).toBe(true);
  expect(await contentRows.isFocusedOnRowItems(page, ROW_ITEMS)).toBe(true);
  expect(await contentRows.isFocusedNearRow(page, {rowId: ROW_ID})).toBe(true);

  const metadata = await contentRows.getFocusedContentMetadata(page);
  expect(metadata.id).toBe(`${ROW_ID}_0`);
  expect(metadata.contentId).toBe("c1");

  const state = await getFocusedState(page);
  expect(state.id).toBe(`${ROW_ID}_0`);
});

test("keeps the focus class as the answer when both markers are on screen", async ({page}) => {
  // A widget can leave a stale `is_focus="1"` behind after focus has moved on,
  // so the class - the live marker - has to win rather than document order.
  await page.setContent(homeRow({marker: 'is_focus="1"', secondPosterClass: "focused"}));

  const metadata = await contentRows.getFocusedContentMetadata(page);
  expect(metadata.id).toBe(`${ROW_ID}_1`);
  expect((await getFocusedState(page)).id).toBe(`${ROW_ID}_1`);
  expect(await contentRows.isFocusedOnContentItem(page, {id: `${ROW_ID}_1`})).toBe(true);
  expect(await contentRows.isFocusedOnContentItem(page, {id: `${ROW_ID}_0`})).toBe(false);
});

test("reports nothing focused when neither marker is present", async ({page}) => {
  await page.setContent(homeRow({marker: ""}));

  expect(await contentRows.isFocusedContentItem(page)).toBe(false);
  expect(await contentRows.isFocusedOnRowItems(page, ROW_ITEMS)).toBe(false);
  expect((await getFocusedState(page)).id).toBe("");
});

test("ignores an is_focus attribute that is not set to 1", async ({page}) => {
  await page.setContent(homeRow({marker: 'is_focus="0"'}));

  expect(await contentRows.isFocusedContentItem(page)).toBe(false);
  expect((await getFocusedState(page)).id).toBe("");
});

test("detects a view-more poster focused with the is_focus attribute", async ({page}) => {
  await page.setContent(`
    <div id="${ROW_ID}" class="cate_content_row" style="position:absolute;left:0;top:180px;width:1280px;height:320px">
      <div class="cate_content_row_title">Phim mới nhất</div>
      <div class="cate_content_item" id="${ROW_ID}_0" title_text="Phim một"
           style="position:absolute;left:100px;top:200px;width:233px;height:131px"></div>
      <div class="cate_content_item view_more" id="${ROW_ID}_1" is_focus="1"
           style="position:absolute;left:400px;top:200px;width:233px;height:131px">
        <img src="view-more.jpg" alt="Xem tất cả">
      </div>
    </div>
  `);

  const metadata = await contentRows.getFocusedViewMoreMetadata(page, {rowId: ROW_ID});
  expect(metadata).not.toBeNull();
  expect(metadata.id).toBe(`${ROW_ID}_1`);
});

test("reads a content-list grid position from the is_focus attribute", async ({page}) => {
  // specialModuleList / specialModuleListV2 / shortHome all render the default
  // content grid, which used to be read through the focus class only.
  await page.setContent(`
    <div id="listPage_1" class="cate_content_row" style="position:absolute;left:0;top:180px;width:1280px;height:320px">
      <div class="cate_content_item" id="listPage_1_0" title_text="Phim một"
           style="position:absolute;left:80px;top:200px;width:233px;height:131px"></div>
      <div class="cate_content_item" id="listPage_1_1" title_text="Phim hai" is_focus="1"
           style="position:absolute;left:340px;top:200px;width:233px;height:131px"></div>
    </div>
  `);

  const position = await contentRows.getFocusedListPagePosition(page);
  expect(position).not.toBeNull();
  expect(position.profile).toBe("content-grid");
  expect(position.id).toBe("listPage_1_1");
  expect(position.row).toBe(1);
  expect(position.col).toBe(1);
  expect(position.rowItemCount).toBe(2);

  expect((await contentRows.getFocusedListPageMetadata(page)).title).toBe("Phim hai");
});
