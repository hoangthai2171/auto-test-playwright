const FOCUSED_CLASS = "focused";
const POPUP_FOCUS_DIALOG_IDS = Object.freeze([
  "dialog_confirm_v2",
  "dialog_alert_v2",
  "dialog_alert_full",
  "dialog_confirm_full",
]);
const POPUP_ACTIVE_FOCUS_SELECTORS = Object.freeze(
  POPUP_FOCUS_DIALOG_IDS.map((id) => `#${id} .active`)
);
// Dialog focus is intentionally listed first. The underlying screen can keep
// its old `.focused` element while a modal dialog is open.
const FOCUS_SELECTORS = Object.freeze([
  ...POPUP_ACTIVE_FOCUS_SELECTORS,
  `.${FOCUSED_CLASS}`,
]);
const FOCUS_SELECTOR = FOCUS_SELECTORS.join(", ");

const SELECTOR_CONTRACTS = Object.freeze({
  focus: {
    severity: "required",
    alternatives: [
      {
        name: "focused-class",
        classPatterns: [FOCUSED_CLASS],
      },
      {
        name: "popup-active-class",
        selectors: POPUP_ACTIVE_FOCUS_SELECTORS,
      },
    ],
  },
  leftMenu: {
    severity: "required",
    locatorRoots: ["[id^='menu_text_']"],
    alternatives: [
      {
        name: "menu-id",
        idPrefixes: ["menu_"],
      },
      {
        name: "menu-attributes",
        attributes: ["menu_name", "service_name", "service_title"],
      },
    ],
  },
  contentContainer: {
    severity: "required",
    roots: [".content-area", ".service-grid", "[class*='content']", "[id*='content']", "[id*='service']"],
    alternatives: [
      {
        name: "known-content-containers",
        selectors: [".content-area", ".service-grid", "[class*='content']"],
      },
      {
        name: "content-id",
        idIncludes: ["content", "service", "row"],
      },
    ],
  },
  serviceContainer: {
    severity: "required",
    roots: [
      "[id^='dropdown_service_items_row']",
      ".service-grid",
      ".content-area",
      "[class*='service']",
      "[id*='service']",
    ],
    alternatives: [
      {
        name: "service-rows",
        selectors: ["[id^='dropdown_service_items_row']", ".service-grid"],
      },
    ],
  },
  contentItem: {
    severity: "required",
    geometry: {
      minWidth: 100,
      minHeight: 80,
      maxWidth: 520,
      maxHeight: 420,
      minX: 80,
      minY: 80,
    },
    attributes: [
      "title",
      "title_text",
      "movie_name",
      "vod_name",
      "content_name",
      "channel_name",
      "service_title",
      "alt",
      "content_id",
      "content-id",
      "data-content-id",
    ],
    excludeIdPrefixes: ["menu_", "key-"],
    alternatives: [
      {
        name: "identified-content",
        requiresId: true,
      },
      {
        name: "content-attribute",
        attributes: ["movie_name", "vod_name", "content_name", "channel_name"],
      },
    ],
  },
  channel: {
    severity: "optional",
    attributes: ["channel_name"],
    alternatives: [
      {
        name: "channel-name-attribute",
        attributes: ["channel_name"],
      },
    ],
  },
  menuItem: {
    severity: "required",
    attributes: ["title", "title_text", "menu_name", "service_name", "service_title"],
    alternatives: [
      {
        name: "menu-label-attributes",
        attributes: ["menu_name", "service_name", "service_title", "title", "title_text"],
      },
    ],
  },
  searchAction: {
    severity: "required",
    locatorRoots: ["#keyboard_btn_wr #callSearch", "#callSearch"],
    alternatives: [
      {
        name: "search-action-id",
        idIncludes: ["callSearch"],
      },
    ],
  },
  popup: {
    severity: "optional",
    selectors: ["[role='dialog']", "[class*='popup']", "[id*='popup']"],
    alternatives: [
      {
        name: "popup-role-or-name",
        selectors: ["[role='dialog']", "[class*='popup']", "[id*='popup']"],
      },
    ],
  },
  player: {
    severity: "optional",
    selectors: ["video", "audio", "[class*='player']", "[id*='player']"],
    alternatives: [
      {
        name: "media-or-player",
        selectors: ["video", "audio", "[class*='player']", "[id*='player']"],
      },
    ],
  },
});

function getSelectorContract(name) {
  const contract = SELECTOR_CONTRACTS[name];
  if (!contract) {
    throw new Error(`Unknown selector contract: ${name}`);
  }

  return contract;
}

function getSelectorAlternatives(name) {
  return getSelectorContract(name).alternatives || [];
}

module.exports = {
  FOCUSED_CLASS,
  POPUP_FOCUS_DIALOG_IDS,
  POPUP_ACTIVE_FOCUS_SELECTORS,
  FOCUS_SELECTORS,
  FOCUS_SELECTOR,
  SELECTOR_CONTRACTS,
  getSelectorContract,
  getSelectorAlternatives,
};
