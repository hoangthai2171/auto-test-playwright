const test = require("node:test");
const assert = require("node:assert/strict");

const {createTvMyTvActionHandlers} = require("../lib/tv-mytv-actions");

test("maps every semantic server action to trusted local operations", async () => {
  const calls = [];
  const handlers = createTvMyTvActionHandlers({
    semantic: new Proxy({}, {
      get(_target, name) {
        return async (...args) => calls.push([name, ...args]);
      },
    }),
  });
  const context = {session: {id: "fake"}};

  await handlers.login({context, action: {username: "user", password: "secret"}});
  await handlers.open_home({context, action: {}});
  await handlers.focus_row({context, action: {rowName: "Phim", itemIndex: 2}});
  await handlers.focus_row_first_item({context, action: {}});
  await handlers.focus_text({context, action: {text: "VIP"}});
  await handlers.open_service({context, action: {service: "Phim"}});
  await handlers.open_search({context, action: {}});
  await handlers.search_content({context, action: {name: "ab", type: "movie"}});
  await handlers.play_content({context, action: {name: "M", type: "movie"}});
  await handlers.play_search_result({context, action: {type: "movie"}});
  await handlers.play_row({context, action: {rowIndex: 1, count: 2}});

  assert.deepEqual(calls, [
    ["focusLogin"],
    ["enterVirtualKey", "u"],
    ["enterVirtualKey", "s"],
    ["enterVirtualKey", "e"],
    ["enterVirtualKey", "r"],
    ["submitVirtualField", "username"],
    ["enterVirtualKey", "s"],
    ["enterVirtualKey", "e"],
    ["enterVirtualKey", "c"],
    ["enterVirtualKey", "r"],
    ["enterVirtualKey", "e"],
    ["enterVirtualKey", "t"],
    ["submitVirtualField", "password"],
    ["completeLogin"],
    ["openHome"],
    ["focusRow", {rowName: "Phim", itemIndex: 2}],
    ["focusRowFirstItem"],
    ["focusText", "VIP"],
    ["openService", "Phim"],
    ["openSearch"],
    ["enterVirtualKey", "a"],
    ["enterVirtualKey", "b"],
    ["searchContent", {name: "ab", type: "movie"}],
    ["playContent", {name: "M", type: "movie"}],
    ["playSearchResult", {type: "movie"}],
    ["playRow", {rowIndex: 1, rowName: undefined, count: 2}],
  ]);
});

test("rejects a missing trusted semantic operation without exposing a fallback", async () => {
  const handlers = createTvMyTvActionHandlers({semantic: {}});
  assert.throws(
    () => handlers.open_search({context: {session: {}}, action: {}}),
    /openSearch.*unavailable/i,
  );
});
