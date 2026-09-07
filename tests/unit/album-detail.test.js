const test = require("node:test");
const assert = require("node:assert/strict");

const albumDetail = require("../lib/album-detail");
const {closePlayerOrDetail, ALBUM_WAY_STATION_BACK_PRESSES} = require("../lib/playback");

function observation({contentCount, cards = [], routeValue = "albumDetail"}) {
  return {routeValue, contentCount, cards, isAlbumDetail: routeValue === "albumDetail"};
}

test("album detail is recognized by its own route only", () => {
  assert.equal(albumDetail.isAlbumDetailRoute("albumDetail"), true);
  assert.equal(albumDetail.isAlbumDetailRoute(" albumDetail "), true);
  assert.equal(albumDetail.isAlbumDetailRoute("moviePlayerNew"), false);
  assert.equal(albumDetail.isAlbumDetailRoute("specialModuleList"), false);
  assert.equal(albumDetail.isAlbumDetailRoute(""), false);
});

test("a random pick covers the album's declared size, not the built card window", () => {
  const album = observation({
    contentCount: 13,
    cards: [{row: 0, locked: false}, {row: 1, locked: false}],
  });

  assert.equal(albumDetail.pickAlbumContentRow(album, {random: () => 0}), 0);
  assert.equal(albumDetail.pickAlbumContentRow(album, {random: () => 0.999}), 12);
  assert.equal(albumDetail.pickAlbumContentRow(album, {random: () => 0.5}), 6);
});

test("a random pick skips locked and already attempted contents", () => {
  const album = observation({
    contentCount: 4,
    cards: [{row: 1, locked: true}, {row: 2, locked: false}],
  });

  assert.equal(albumDetail.pickAlbumContentRow(album, {random: () => 0}), 0);
  assert.equal(
    albumDetail.pickAlbumContentRow(album, {random: () => 0, exclude: [0]}),
    2
  );
  assert.equal(
    albumDetail.pickAlbumContentRow(album, {random: () => 0, exclude: [0, 2, 3]}),
    null
  );
});

test("an album with no contents yields no pick", () => {
  assert.equal(albumDetail.pickAlbumContentRow(observation({contentCount: 0}), {}), null);
  assert.equal(albumDetail.pickAlbumContentRow(null, {}), null);
});

function createClosePage({hash, closedAfter}) {
  const state = {presses: 0};
  return {
    state,
    page: {
      waitForTimeout: async () => {},
      evaluate: async () => hash,
    },
    remotePress: async () => {
      state.presses += 1;
    },
    observePopup: async () => ({visible: false, unexpectedVisible: false}),
    isClosed: async () => state.presses >= closedAfter,
    boundaryTimeoutMs: 0,
  };
}

test("closing an album-launched player is granted the extra Back presses it needs", async () => {
  const harness = createClosePage({
    hash: "#moviePlayerNew?id=165281&is_album=1&type_id=2",
    closedAfter: 2 + ALBUM_WAY_STATION_BACK_PRESSES,
  });

  const result = await closePlayerOrDetail(harness.page, harness);

  assert.equal(result.closed, true);
  assert.equal(result.backPresses, 2 + ALBUM_WAY_STATION_BACK_PRESSES);
});

test("an ordinary player keeps the caller's own close budget", async () => {
  const harness = createClosePage({
    hash: "#moviePlayerNew?id=359375&type_id=2",
    closedAfter: 3,
  });

  await assert.rejects(
    () => closePlayerOrDetail(harness.page, harness),
    (error) => error.code === "PLAYER_CLOSE_FAILED"
  );
  assert.equal(harness.state.presses, 2);
});

test("a page that cannot report its route is never granted the album allowance", async () => {
  const harness = createClosePage({hash: "#albumDetail", closedAfter: 3});
  delete harness.page.evaluate;

  await assert.rejects(
    () => closePlayerOrDetail(harness.page, harness),
    (error) => error.code === "PLAYER_CLOSE_FAILED"
  );
  assert.equal(harness.state.presses, 2);
});
