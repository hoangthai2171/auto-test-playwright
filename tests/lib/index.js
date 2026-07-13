const textUtils = require("./text-utils");
const navigation = require("./navigation");
const contentRows = require("./content-rows");
const playback = require("./playback");
const artifacts = require("./artifacts");
const workflows = require("./workflows");

module.exports = {
  ...textUtils,
  ...navigation,
  ...contentRows,
  ...playback,
  ...artifacts,
  ...workflows,
  __internal: {
    ...navigation.__internal,
    focusFirstRowStart: contentRows.focusFirstRowStart,
    findServiceIdInAllServices: workflows.__internal.findServiceIdInAllServices,
    closeAdvertisePopupIfVisible: workflows.__internal.closeAdvertisePopupIfVisible,
    getVisiblePopup: playback.getVisiblePopup,
    chooseDirection: navigation.__internal.chooseDirection,
  },
};
