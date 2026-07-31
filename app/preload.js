const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mytvRunner", {
  loadTestCases: () => ipcRenderer.invoke("load-test-cases"),
  loadFlowCaseFolders: (settings) => ipcRenderer.invoke("load-flow-case-folders", settings),
  loadFlowCases: (settings) => ipcRenderer.invoke("load-flow-cases", settings),
  listTvDevices: () => ipcRenderer.invoke("list-tv-devices"),
  validateAndSaveTvDevice: (candidate) => ipcRenderer.invoke("validate-and-save-tv-device", candidate),
  checkTvDeviceConnection: (deviceId) => ipcRenderer.invoke("check-tv-device-connection", {deviceId}),
  getTvToolchainConfiguration: () => ipcRenderer.invoke("get-tv-toolchain-configuration"),
  saveTvToolchainConfiguration: (configuration) => ipcRenderer.invoke("save-tv-toolchain-configuration", configuration),
  inspectTvToolchain: () => ipcRenderer.invoke("inspect-tv-toolchain"),
  getLgToolchainStatus: () => ipcRenderer.invoke("get-lg-toolchain-status"),
  getLgCompatibilityCatalogStatus: () => ipcRenderer.invoke("get-lg-compatibility-catalog-status"),
  refreshLgCompatibilityCatalog: (request) => ipcRenderer.invoke("refresh-lg-compatibility-catalog", request),
  getLgCompatibilityProductGateStatus: () => ipcRenderer.invoke("get-lg-compatibility-product-gate-status"),
  saveLgCompatibilityProductGateCredentials: (request) => ipcRenderer.invoke("save-lg-compatibility-product-gate-credentials", request),
  inspectLgCompatibilityDevice: (request) => ipcRenderer.invoke("inspect-lg-compatibility-device", request),
  runLgCompatibilityValidation: (request) => ipcRenderer.invoke("run-lg-compatibility-validation", request),
  discardLgCompatibilityAttempt: (request) => ipcRenderer.invoke("discard-lg-compatibility-attempt", request),
  planLgToolchainSetup: () => ipcRenderer.invoke("plan-lg-toolchain-setup"),
  installLgToolchain: (request) => ipcRenderer.invoke("install-lg-toolchain", request),
  activateManagedLgToolchain: () => ipcRenderer.invoke("activate-managed-lg-toolchain"),
  openLgCliDownloadPage: () => ipcRenderer.invoke("open-lg-cli-download-page"),
  chooseLgCliArchive: () => ipcRenderer.invoke("choose-lg-cli-archive"),
  getBrowserToolchainStatus: () => ipcRenderer.invoke("get-browser-toolchain-status"),
  planBrowserToolchainSetup: () => ipcRenderer.invoke("plan-browser-toolchain-setup"),
  installBrowserToolchain: (request) => ipcRenderer.invoke("install-browser-toolchain", request),
  getLgRunAvailability: (request) => ipcRenderer.invoke("get-lg-run-availability", request),
  runLgBatch: (request) => ipcRenderer.invoke("run-lg-batch", request),
  resolveLgRunRecovery: (request) => ipcRenderer.invoke("resolve-lg-run-recovery", request),
  submitFlowCaseResults: (values) => ipcRenderer.invoke("submit-flow-case-results", values),
  runTest: (values) => ipcRenderer.invoke("run-test", values),
  startReport: () => ipcRenderer.invoke("start-report"),
  showInteractiveBrowser: (values) => ipcRenderer.invoke("show-interactive-browser", values),
  hideInteractiveBrowser: () => ipcRenderer.invoke("hide-interactive-browser"),
  suspendInteractiveBrowser: () => ipcRenderer.invoke("suspend-interactive-browser"),
  resumeInteractiveBrowser: (values) => ipcRenderer.invoke("resume-interactive-browser", values),
  setInteractiveBrowserMuted: (muted) => ipcRenderer.invoke("set-interactive-browser-muted", muted),
  stopTest: () => ipcRenderer.invoke("stop-test"),
  setRunActive: (active) => ipcRenderer.invoke("set-run-active", Boolean(active)),
  setUnsyncedResultSubmission: (pending) => ipcRenderer.invoke("set-unsynced-result-submission", Boolean(pending)),
  openReport: () => ipcRenderer.invoke("open-report"),
  showReportFolder: () => ipcRenderer.invoke("show-report-folder"),
  onStarted: (callback) => ipcRenderer.on("test-started", callback),
  onLog: (callback) => ipcRenderer.on("test-log", (_event, value) => callback(value)),
  onPreview: (callback) => ipcRenderer.on("browser-preview", (_event, value) => callback(value)),
  onFinished: (callback) => ipcRenderer.on("test-finished", (_event, value) => callback(value)),
  onLgToolchainInstallProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("lg-toolchain-install-progress", listener);
    return () => ipcRenderer.removeListener("lg-toolchain-install-progress", listener);
  },
  onBrowserToolchainInstallProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("browser-toolchain-install-progress", listener);
    return () => ipcRenderer.removeListener("browser-toolchain-install-progress", listener);
  },
  onLgRunStatus: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("lg-run-status", listener);
    return () => ipcRenderer.removeListener("lg-run-status", listener);
  },
  onLgRunPreview: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("lg-run-preview", listener);
    return () => ipcRenderer.removeListener("lg-run-preview", listener);
  },
  onStopRequested: (callback) => ipcRenderer.on("request-stop-run", callback),
  onDiscardUnsyncedResultSubmission: (callback) => ipcRenderer.on("discard-unsynced-result-submission", callback),
});
