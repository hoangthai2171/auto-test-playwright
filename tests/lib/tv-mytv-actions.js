"use strict";

function requiredOperation(semantic, name) {
  if (typeof semantic?.[name] !== "function") throw new Error(`Trusted TV semantic operation ${name} is unavailable.`);
  return semantic[name];
}

async function enterVirtualText(semantic, text) {
  for (const character of Array.from(String(text || ""))) {
    await requiredOperation(semantic, "enterVirtualKey")(character);
  }
}

function createTvMyTvActionHandlers({semantic} = {}) {
  return {
    login: async ({action}) => {
      await requiredOperation(semantic, "focusLogin")();
      await enterVirtualText(semantic, action.username);
      await requiredOperation(semantic, "submitVirtualField")("username");
      await enterVirtualText(semantic, action.password);
      await requiredOperation(semantic, "submitVirtualField")("password");
      return requiredOperation(semantic, "completeLogin")();
    },
    open_home: () => requiredOperation(semantic, "openHome")(),
    focus_row: ({action}) => requiredOperation(semantic, "focusRow")({rowName: action.rowName, itemIndex: action.itemIndex}),
    focus_row_first_item: () => requiredOperation(semantic, "focusRowFirstItem")(),
    focus_text: ({action}) => requiredOperation(semantic, "focusText")(action.text),
    open_service: ({action}) => requiredOperation(semantic, "openService")(action.service),
    open_search: () => requiredOperation(semantic, "openSearch")(),
    search_content: async ({action}) => {
      await enterVirtualText(semantic, action.name);
      return requiredOperation(semantic, "searchContent")({name: action.name, type: action.type});
    },
    play_content: ({action}) => requiredOperation(semantic, "playContent")({name: action.name, type: action.type}),
    play_search_result: ({action}) => requiredOperation(semantic, "playSearchResult")({type: action.type}),
    play_row: ({action}) => requiredOperation(semantic, "playRow")({rowIndex: action.rowIndex, rowName: action.rowName, count: action.count}),
  };
}

module.exports = {createTvMyTvActionHandlers, enterVirtualText};
