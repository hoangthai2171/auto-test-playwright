const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mytvRunner", {
  loadTestCases: () => ipcRenderer.invoke("load-test-cases"),
  loadFlowCaseFolders: (settings) => ipcRenderer.invoke("load-flow-case-folders", settings),
  loadFlowCases: (settings) => ipcRenderer.invoke("load-flow-cases", settings),
  runTest: (values) => ipcRenderer.invoke("run-test", values),
  showInteractiveBrowser: (values) => ipcRenderer.invoke("show-interactive-browser", values),
  hideInteractiveBrowser: () => ipcRenderer.invoke("hide-interactive-browser"),
  suspendInteractiveBrowser: () => ipcRenderer.invoke("suspend-interactive-browser"),
  resumeInteractiveBrowser: (values) => ipcRenderer.invoke("resume-interactive-browser", values),
  setInteractiveBrowserMuted: (muted) => ipcRenderer.invoke("set-interactive-browser-muted", muted),
  stopTest: () => ipcRenderer.invoke("stop-test"),
  openReport: () => ipcRenderer.invoke("open-report"),
  showReportFolder: () => ipcRenderer.invoke("show-report-folder"),
  onStarted: (callback) => ipcRenderer.on("test-started", callback),
  onLog: (callback) => ipcRenderer.on("test-log", (_event, value) => callback(value)),
  onPreview: (callback) => ipcRenderer.on("browser-preview", (_event, value) => callback(value)),
  onFinished: (callback) => ipcRenderer.on("test-finished", (_event, value) => callback(value)),
});
