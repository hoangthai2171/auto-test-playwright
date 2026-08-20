// Contract spec for the playback popup detector. It runs against a real DOM via
// page.setContent, so the browser-side predicate itself is covered without a
// live app.
const {test, expect} = require("playwright/test");
const {getVisiblePopup} = require("./lib/playback");

const SYNOPSIS = 'Một căn nhà bị ám ảnh bởi những bóng ma từ quá khứ. ' +
  'Một gia đình không thể rời đi.';

test("does not treat a content synopsis as an error popup", async ({page}) => {
  // The wording matches the error pattern, but it is page content, not a dialog.
  await page.setContent(`
    <div id="content_detail_wr" style="width:1280px;height:720px">
      <div class="content_title">Phim Gì Tối Nay - Tập 182: "Nhà Hai Chủ"</div>
      <div class="content_description">${SYNOPSIS}</div>
      <div class="content_action">Xem</div>
    </div>
  `);

  expect(await getVisiblePopup(page)).toBeNull();
});

test("still detects a real error dialog by its container", async ({page}) => {
  await page.setContent(`
    <div id="content_detail_wr" style="width:1280px;height:720px">
      <div class="content_description">${SYNOPSIS}</div>
    </div>
    <div id="dialog_alert_v2" style="width:600px;height:300px">
      <div id="dialog_alert_v2_title">Thông báo</div>
      <div id="dialog_alert_v2_content">Có lỗi xảy ra, vui lòng thử lại</div>
      <div id="btn_alert_v2_ok">Đóng</div>
    </div>
  `);

  const popup = await getVisiblePopup(page);
  expect(popup).not.toBeNull();
  expect(popup.text).toContain("Có lỗi xảy ra");
  expect(popup.closeText).toContain("Đóng");
});

test("reports the dialog message even when only its close button matches", async ({page}) => {
  // #btn_alert_v2_ok carries the "alert" marker itself, so the popup root must
  // resolve to the dialog rather than to the button.
  await page.setContent(`
    <div id="dialog_alert_v2" style="width:600px;height:300px">
      <div id="dialog_alert_v2_content">Thiết bị không hỗ trợ nội dung này</div>
      <div id="btn_alert_v2_ok">Đóng</div>
    </div>
  `);

  const popup = await getVisiblePopup(page);
  expect(popup.text).toContain("Thiết bị không hỗ trợ");
});

test("scopes the reported popup text to the dialog, not the whole page", async ({page}) => {
  await page.setContent(`
    <div id="page_wr" style="width:1280px;height:720px">
      <div class="content_description">${SYNOPSIS}</div>
      <div id="dialog_confirm_v2" style="width:600px;height:300px">
        <div>Vui lòng thử lại</div>
        <div>Quay về</div>
      </div>
    </div>
  `);

  const popup = await getVisiblePopup(page);
  expect(popup.text).toContain("Vui lòng thử lại");
  expect(popup.text).not.toContain("bóng ma");
});

test("ignores a hidden dialog", async ({page}) => {
  await page.setContent(`
    <div id="dialog_alert_v2" style="display:none">
      <div>Có lỗi xảy ra</div>
    </div>
  `);

  expect(await getVisiblePopup(page)).toBeNull();
});
