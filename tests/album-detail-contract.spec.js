// Contract spec for the album detail screen an album poster opens instead of a
// player. It drives the real observation/traversal/activation code against a
// simulated #albumDetail page, including the virtualized card window that only
// keeps a dozen `album_card_<row>_<col>` cards in the DOM at a time, so the
// behavior is covered without a live app.
const {test, expect} = require("playwright/test");
const albumDetail = require("./lib/album-detail");

const CARD_WINDOW = 11;

async function createAlbumPage(page, {total = 13, locked = [], route = "albumDetail", title = "Thế Giới Warner Bros"} = {}) {
  await page.setViewportSize({width: 1280, height: 720});
  await page.setContent(`
    <style>
      body { margin: 0; width: 1280px; height: 720px; }
      #album_detail_leftside { position: absolute; left: 0; top: 0; width: 640px; height: 720px; }
      .album_detail_button { position: relative; width: 480px; height: 47px; margin: 8px 34px; }
      #album_detail_rightside { position: absolute; left: 640px; top: 33px; width: 640px; height: 700px; }
      .album_detail_elements { position: relative; width: 607px; height: 152px; margin-bottom: 20px; }
      .item_lock_icon { width: 20px; height: 20px; }
    </style>
    <div id="album_detail">
      <div id="album_detail_leftside">
        <div class="album_name">${title}</div>
        <div class="album_total">Tổng số phim, VOD : ${total}</div>
        <div id="album_detail_button_container">
          <div id="watch_all" class="album_detail_button">Xem toàn bộ</div>
          <div id="watch_all_loop" class="album_detail_button">Xem ở chế độ lặp lại</div>
          <div id="save_watch_later" class="album_detail_button">Lưu vào danh sách</div>
        </div>
      </div>
      <div id="album_detail_rightside"></div>
    </div>
  `);

  await page.evaluate(({total: albumTotal, lockedRows, cardWindow, routeValue}) => {
    location.hash = `${routeValue}?album_id=1598&type_id=77`;
    // The app builds a sliding window of cards around the focused row and
    // detaches the rest, so the traversal cannot rely on every card existing.
    window.__album = {
      total: albumTotal,
      locked: new Set(lockedRows),
      cardWindow,
      focus: {kind: "button", row: null, buttonIndex: 0},
      render,
    };
    render();

    function render() {
      const state = window.__album;
      const side = document.getElementById("album_detail_rightside");
      const focusedRow = state.focus.kind === "card" ? state.focus.row : 0;
      const start = Math.max(0, Math.min(focusedRow - Math.floor(state.cardWindow / 2), state.total - state.cardWindow));
      side.innerHTML = "";
      for (let row = Math.max(0, start); row < Math.min(state.total, Math.max(0, start) + state.cardWindow); row += 1) {
        const card = document.createElement("div");
        card.id = `album_card_${row}_0`;
        card.className = "album_detail_elements";
        card.setAttribute("action", "play_album_content");
        card.setAttribute("content-id", String(165257 + row));
        card.setAttribute("type-id", "2");
        card.setAttribute("album_id", "1598");
        card.innerHTML =
          `<div class="image_container"><div class="item_lock_icon" style="display: ${state.locked.has(row) ? "block" : "none"}"></div></div>` +
          `<div class="detail_container"><div class="card_title">Nội dung ${row + 1}</div></div>`;
        if (state.focus.kind === "card" && state.focus.row === row) card.classList.add("focused");
        side.appendChild(card);
      }

      document.querySelectorAll(".album_detail_button").forEach((button, index) => {
        button.classList.toggle("focused", state.focus.kind === "button" && state.focus.buttonIndex === index);
      });
    }
  }, {total, lockedRows: locked, cardWindow: CARD_WINDOW, routeValue: route});

  const state = {presses: [], activations: []};
  albumDetail.configureAlbumDetail({
    remotePress: async (candidatePage, key) => {
      state.presses.push(key);
      await candidatePage.evaluate((pressedKey) => {
        const album = window.__album;
        const focus = album.focus;
        if (focus.kind === "button") {
          if (pressedKey === "ArrowRight") {
            focus.kind = "card";
            focus.row = 0;
          } else if (pressedKey === "ArrowDown") {
            focus.buttonIndex = Math.min(focus.buttonIndex + 1, 2);
          } else if (pressedKey === "ArrowUp") {
            focus.buttonIndex = Math.max(focus.buttonIndex - 1, 0);
          }
        } else if (pressedKey === "ArrowDown") {
          focus.row = Math.min(focus.row + 1, album.total - 1);
        } else if (pressedKey === "ArrowUp") {
          focus.row = Math.max(focus.row - 1, 0);
        } else if (pressedKey === "ArrowLeft") {
          focus.kind = "button";
          focus.buttonIndex = 0;
        }
        album.render();
      }, key);
    },
    activateVerifiedTarget: async (candidatePage, options) => {
      state.activations.push(options.expectedId);
      await candidatePage.evaluate(() => {
        location.hash = "moviePlayerNew?id=165281&is_album=1";
      });
    },
    getPlayerState: async () => ({hasVideo: state.activations.length > 0, isProbablyPlaying: true}),
  });

  return state;
}

test.afterEach(() => {
  albumDetail.configureAlbumDetail({
    remotePress: require("./lib/navigation").remotePress,
    activateVerifiedTarget: require("./lib/selector-validation").activateVerifiedTarget,
    getPlayerState: require("./lib/playback").getPlayerState,
  });
});

test("reads the album's route, name, size and built card window", async ({page}) => {
  await createAlbumPage(page, {total: 13});

  const observed = await albumDetail.observeAlbumDetailScreen(page);

  expect(observed.isAlbumDetail).toBe(true);
  expect(observed.routeValue).toBe("albumDetail");
  expect(observed.albumTitle).toBe("Thế Giới Warner Bros");
  // The declared counter is the album's real size; only a window is built.
  expect(observed.contentCount).toBe(13);
  expect(observed.cards).toHaveLength(CARD_WINDOW);
  expect(observed.cards[0]).toMatchObject({
    id: "album_card_0_0",
    row: 0,
    col: 0,
    title: "Nội dung 1",
    contentId: "165257",
    action: "play_album_content",
    locked: false,
  });
  expect(observed.focused).toMatchObject({kind: "button", id: "watch_all"});
});

test("entering the list and walking to a card outside the built window", async ({page}) => {
  const state = await createAlbumPage(page, {total: 13});

  const focused = await albumDetail.focusAlbumContentRow(page, 12);

  expect(focused.focused).toMatchObject({kind: "card", id: "album_card_12_0", row: 12});
  // One Right press leaves the button column, then one Down press per row.
  expect(state.presses).toEqual(["ArrowRight", ...Array.from({length: 12}, () => "ArrowDown")]);
});

test("walking back up to a card above the focused one", async ({page}) => {
  await createAlbumPage(page, {total: 13});
  await albumDetail.focusAlbumContentRow(page, 10);

  const focused = await albumDetail.focusAlbumContentRow(page, 2);

  expect(focused.focused).toMatchObject({id: "album_card_2_0", row: 2});
});

test("plays the requested content and reports what reached the player", async ({page}) => {
  const state = await createAlbumPage(page, {total: 13});

  const result = await albumDetail.playRandomAlbumContent(page, null, {contentIndex: 4});

  expect(result).toMatchObject({
    type: "album_content",
    albumRoute: "albumDetail",
    albumTitle: "Thế Giới Warner Bros",
    contentCount: 13,
    requestedIndex: 4,
    contentIndex: 4,
    cardId: "album_card_4_0",
    contentId: "165261",
    name: "Nội dung 5",
    playerRoute: "moviePlayerNew",
  });
  expect(state.activations).toEqual(["album_card_4_0"]);
});

test("a random pick stays inside the album and plays one of its contents", async ({page}) => {
  const state = await createAlbumPage(page, {total: 13});

  const result = await albumDetail.playRandomAlbumContent(page, null, {random: () => 0.5});

  expect(result.contentIndex).toBe(6);
  expect(result.cardId).toBe("album_card_6_0");
  expect(state.activations).toEqual(["album_card_6_0"]);
});

test("a locked content is stepped over instead of being reported as a playback failure", async ({page}) => {
  const state = await createAlbumPage(page, {total: 4, locked: [2]});

  const result = await albumDetail.playRandomAlbumContent(page, null, {contentIndex: 2});

  expect(result.contentIndex).not.toBe(2);
  expect(state.activations).toEqual([result.cardId]);
});

test("an album whose every content is locked fails closed", async ({page}) => {
  await createAlbumPage(page, {total: 3, locked: [0, 1, 2]});

  await expect(albumDetail.playRandomAlbumContent(page, null, {contentIndex: 0}))
    .rejects.toThrow(/không có nội dung nào có thể phát/i);
});

test("an empty album fails closed instead of pressing OK on nothing", async ({page}) => {
  await createAlbumPage(page, {total: 0});

  // A short readiness wait keeps the spec fast; the wait itself is what lets a
  // still-building album through, and it is covered by the readiness test below.
  await expect(albumDetail.playRandomAlbumContent(page, null, {readyTimeoutMs: 200}))
    .rejects.toThrow(/không có nội dung nào để phát/i);
});

test("an album that is still building its list is waited for, not called empty", async ({page}) => {
  const state = await createAlbumPage(page, {total: 6});
  // The route flips before the counter and the first cards exist.
  await page.evaluate(() => {
    const total = document.querySelector(".album_total");
    const side = document.getElementById("album_detail_rightside");
    total.textContent = "";
    side.innerHTML = "";
    setTimeout(() => {
      total.textContent = "Tổng số phim, VOD : 6";
      window.__album.render();
    }, 1200);
  });

  const result = await albumDetail.playRandomAlbumContent(page, null, {contentIndex: 3});

  expect(result.contentCount).toBe(6);
  expect(result.cardId).toBe("album_card_3_0");
  expect(state.activations).toEqual(["album_card_3_0"]);
});

test("a screen that is not album detail fails closed", async ({page}) => {
  await createAlbumPage(page, {total: 5, route: "specialModuleList"});

  await expect(albumDetail.playRandomAlbumContent(page, null, {}))
    .rejects.toThrow(/không phải trang chi tiết album/i);
});

test("a content index outside the album fails closed", async ({page}) => {
  await createAlbumPage(page, {total: 5});

  await expect(albumDetail.playRandomAlbumContent(page, null, {contentIndex: 9}))
    .rejects.toThrow(/không hợp lệ/i);
});
