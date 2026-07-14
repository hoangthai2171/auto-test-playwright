const textUtils = require("./text-utils");
const navigation = require("./navigation");
const contentRows = require("./content-rows");
const playback = require("./playback");
const artifacts = require("./artifacts");
const workflows = require("./workflows");
const selectors = require("./selectors");
const selectorValidation = require("./selector-validation");
const waits = require("./waits");
const domScan = require("./dom-scan");
const domSnapshots = require("./dom-snapshots");
const batchBudget = require("./batch-budget");

module.exports = {
  ...textUtils,
  ...navigation,
  ...contentRows,
  ...playback,
  ...artifacts,
  ...workflows,
  ...selectors,
  ...selectorValidation,
  ...waits,
  ...domScan,
  ...domSnapshots,
  ...batchBudget,
  __internal: {
    ...navigation.__internal,
    focusFirstRowStart: contentRows.focusFirstRowStart,
    findServiceIdInAllServices: workflows.__internal.findServiceIdInAllServices,
    closeAdvertisePopupIfVisible: workflows.__internal.closeAdvertisePopupIfVisible,
    getVisiblePopup: playback.getVisiblePopup,
    chooseDirection: navigation.__internal.chooseDirection,
  },
};
