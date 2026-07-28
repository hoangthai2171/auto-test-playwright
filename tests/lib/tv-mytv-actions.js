"use strict";

function requiredOperation(semantic, name) {
  if (typeof semantic?.[name] !== "function") throw new Error(`Trusted TV semantic operation ${name} is unavailable.`);
  return semantic[name];
}

async function enterVirtualText(semantic, session, text) {
  for (const character of Array.from(String(text || ""))) {
    await requiredOperation(semantic, "enterVirtualKey")(session, character);
  }
}

function createTvMyTvActionHandlers({semantic} = {}) {
  return {
    login: async ({context, action}) => {
      await requiredOperation(semantic, "focusLogin")(context.session);
      await enterVirtualText(semantic, context.session, action.username);
      await requiredOperation(semantic, "submitVirtualField")(context.session, "username");
      await enterVirtualText(semantic, context.session, action.password);
      await requiredOperation(semantic, "submitVirtualField")(context.session, "password");
      return requiredOperation(semantic, "completeLogin")(context.session);
    },
    open_home: ({context}) => requiredOperation(semantic, "openHome")(context.session),
    focus_row: ({context, action}) => requiredOperation(semantic, "focusRow")(context.session, {rowName: action.rowName, itemIndex: action.itemIndex}),
    focus_row_first_item: ({context}) => requiredOperation(semantic, "focusRowFirstItem")(context.session),
    focus_text: ({context, action}) => requiredOperation(semantic, "focusText")(context.session, action.text),
    open_service: ({context, action}) => requiredOperation(semantic, "openService")(context.session, action.service),
    open_search: ({context}) => requiredOperation(semantic, "openSearch")(context.session),
    search_content: async ({context, action}) => {
      await enterVirtualText(semantic, context.session, action.name);
      return requiredOperation(semantic, "searchContent")(context.session, {name: action.name, type: action.type});
    },
    play_content: ({context, action}) => requiredOperation(semantic, "playContent")(context.session, {name: action.name, type: action.type}),
    play_search_result: ({context, action}) => requiredOperation(semantic, "playSearchResult")(context.session, {type: action.type}),
    play_row: ({context, action}) => requiredOperation(semantic, "playRow")(context.session, {rowIndex: action.rowIndex, rowName: action.rowName, count: action.count}),
  };
}

module.exports = {createTvMyTvActionHandlers, enterVirtualText};
