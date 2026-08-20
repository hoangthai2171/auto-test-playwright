// Contract spec for the channel-list profile. The channel grid marks focus with
// an is_focus attribute instead of the shared focus class and uses its own row
// and item classes, so the readers are exercised against a real DOM here.
const {test, expect} = require("playwright/test");
const contentRows = require("./lib/content-rows");

const CHANNEL_PAGE = `
  <div id="channellist_main_content">
    <div id="channellist_item_row_0" class="channellist_item_row_new" row_index="0">
      <span id="item_0_0" row="0" col="0" class="homepage_channel_item"
            content-id="1001" type-id="2" style="width:350px;height:207px;display:inline-block">
        <div class="channel-key-text">200</div>
        <img class="channellist_image" src="https://example.test/vtv1.png">
      </span>
      <span id="item_0_1" row="0" col="1" class="homepage_channel_item"
            content-id="1002" type-id="2" style="width:350px;height:207px;display:inline-block">
        <div class="channel-key-text">201</div>
        <img class="channellist_image" src="https://example.test/vtv2.png">
      </span>
    </div>
    <div id="channellist_item_row_1" class="channellist_item_row_new" row_index="1">
      <span id="item_1_0" row="1" col="0" class="homepage_channel_item"
            content-id="1003" type-id="2" style="width:350px;height:207px;display:inline-block">
        <div class="channel-key-text">202</div>
        <img class="channellist_image" src="https://example.test/vtv3.png">
      </span>
    </div>
  </div>
`;

async function setFocus(page, id) {
  await page.evaluate((targetId) => {
    document.querySelectorAll("[is_focus]").forEach((node) => node.setAttribute("is_focus", "0"));
    document.getElementById(targetId).setAttribute("is_focus", "1");
  }, id);
}

test("reads a channel-grid position from the is_focus marker", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);
  await setFocus(page, "item_0_1");

  const position = await contentRows.getFocusedListPagePosition(page);

  expect(position.profile).toBe("channel-grid");
  expect(position.id).toBe("item_0_1");
  expect(position.row).toBe(0);
  expect(position.col).toBe(1);
  expect(position.rowId).toBe("channellist_item_row_0");
  expect(position.rowItemCount).toBe(2);
});

test("counts the shorter last row of a channel grid", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);
  await setFocus(page, "item_1_0");

  const position = await contentRows.getFocusedListPagePosition(page);

  expect(position.row).toBe(1);
  expect(position.rowItemCount).toBe(1);
});

test("identifies a channel by its number and content id", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);
  await setFocus(page, "item_0_0");

  const metadata = await contentRows.getFocusedListPageMetadata(page);

  expect(metadata.profile).toBe("channel-grid");
  expect(metadata.contentId).toBe("1001");
  expect(metadata.channelNumber).toBe("200");
  expect(metadata.title).toBe("Kênh 200");
  expect(metadata.poster).toContain("vtv1.png");
});

test("reports no position when nothing in the channel grid is focused", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);

  expect(await contentRows.getFocusedListPagePosition(page)).toBeNull();
});

test("refuses to activate a channel item that is not the expected one", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);
  await setFocus(page, "item_0_1");
  contentRows.configureContentRows({remotePress: async () => { throw new Error("Enter must not be sent"); }});

  await expect(contentRows.activateFocusedChannelListItem(page, "item_0_0"))
    .rejects.toThrow(/item_0_0/u);
});

test("keeps reading the default grid profile from the focus class", async ({page}) => {
  await page.setContent(`
    <div id="specialModuleListRow_2" class="cate_content_row">
      <div id="specialModuleListRow_2_3" class="cate_content_item focused"
           content_id="9001" content_name="Phim A" style="width:233px;height:131px">
        <img src="https://example.test/a.png">
      </div>
    </div>
  `);

  const position = await contentRows.getFocusedListPagePosition(page);
  expect(position.profile).toBe("content-grid");
  expect(position.row).toBe(2);
  expect(position.col).toBe(3);

  const metadata = await contentRows.getFocusedListPageMetadata(page);
  expect(metadata.contentId).toBe("9001");
  expect(metadata.title).toBe("Phim A");
});

test("retries a swallowed Enter while the same channel item is still focused", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);
  await setFocus(page, "item_0_0");
  const enters = [];
  contentRows.configureContentRows({
    remotePress: async (_page, key) => enters.push(key),
    getPlayerState: async () => ({hasVideo: false, isProbablyPlaying: false}),
    observePlayerOrDetailState: async () => ({open: false}),
  });

  await contentRows.activateFocusedChannelListItem(page, "item_0_0");

  assert2(enters, ["Enter", "Enter"]);
});

test("does not double an Enter that already opened a channel", async ({page}) => {
  await page.setContent(CHANNEL_PAGE);
  await setFocus(page, "item_0_0");
  const enters = [];
  contentRows.configureContentRows({
    remotePress: async (_page, key) => enters.push(key),
    getPlayerState: async () => ({hasVideo: true, isProbablyPlaying: true}),
    observePlayerOrDetailState: async () => ({open: true}),
  });

  await contentRows.activateFocusedChannelListItem(page, "item_0_0");

  assert2(enters, ["Enter"]);
});

function assert2(actual, expected) {
  expect(actual).toEqual(expected);
}
