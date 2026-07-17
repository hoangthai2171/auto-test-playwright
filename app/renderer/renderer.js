const form = document.querySelector("#test-form");
const modeSelect = document.querySelector("#mode-select");
const channelModeSelect = document.querySelector("#channel-mode-select");
const movieModeSelect = document.querySelector("#movie-mode-select");
const runButton = document.querySelector("#run-button");
const stopButton = document.querySelector("#stop-button");
const openReportButton = document.querySelector("#open-report-button");
const showReportButton = document.querySelector("#show-report-button");
const settingsButton = document.querySelector("#settings-button");
const logsButton = document.querySelector("#logs-button");
const settingsModal = document.querySelector("#settings-modal");
const logsModal = document.querySelector("#logs-modal");
const settingsCloseButton = document.querySelector("#settings-close-button");
const logsCloseButton = document.querySelector("#logs-close-button");
const settingsSaveButton = document.querySelector("#settings-save-button");
const guiSettingsSaveButton = document.querySelector("#gui-settings-save-button");
const settingsTestButton = document.querySelector("#settings-test-button");
const aiProviderSelect = document.querySelector("#ai-provider-select");
const aiApiKeyInput = document.querySelector("#ai-api-key-input");
const aiModelSelect = document.querySelector("#ai-model-select");
const customModelField = document.querySelector("#custom-model-field");
const aiCustomModelInput = document.querySelector("#ai-custom-model-input");
const aiEndpointInput = document.querySelector("#ai-endpoint-input");
const settingsNavItems = document.querySelectorAll("[data-settings-panel]");
const settingsPanels = document.querySelectorAll("[data-settings-content]");
const settingsMessage = document.querySelector("#settings-message");
const formMessage = document.querySelector("#form-message");
const statusDot = document.querySelector("#status-dot");
const statusText = document.querySelector("#status-text");
const logOutput = document.querySelector("#log-output");
const browserMuteButton = document.querySelector("#browser-mute-button");
const browserPreviewEmpty = document.querySelector("#browser-preview-empty");
const browserPreviewImage = document.querySelector("#browser-preview-image");
const interactiveBrowser = document.querySelector("#interactive-browser");
let activePreviewType = "live";
let browserMuted = true;

const SETTINGS_STORAGE_KEY = "mytv-auto-test-settings";
const AI_PROVIDER_OPTIONS = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "custom"],
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "custom"],
  },
  custom: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["custom"],
  },
};

syncModeFields();
loadSettingsIntoForm();
syncModelOptions();

modeSelect.addEventListener("change", syncModeFields);
channelModeSelect.addEventListener("change", syncModeFields);
movieModeSelect.addEventListener("change", syncModeFields);
settingsButton.addEventListener("click", openSettings);
logsButton.addEventListener("click", openLogs);
settingsCloseButton.addEventListener("click", closeSettings);
logsCloseButton.addEventListener("click", closeLogs);
settingsModal.querySelector("[data-close-settings]").addEventListener("click", closeSettings);
logsModal.querySelector("[data-close-logs]").addEventListener("click", closeLogs);
settingsSaveButton.addEventListener("click", saveSettings);
guiSettingsSaveButton.addEventListener("click", saveSettings);
settingsTestButton.addEventListener("click", testConnection);
aiProviderSelect.addEventListener("change", () => {
  syncModelOptions();
  aiEndpointInput.value = AI_PROVIDER_OPTIONS[aiProviderSelect.value].endpoint;
});
aiModelSelect.addEventListener("change", syncCustomModelField);
settingsNavItems.forEach((item) => {
  item.addEventListener("click", () => selectSettingsPanel(item.dataset.settingsPanel));
});
browserMuteButton.addEventListener("click", toggleBrowserMute);
window.addEventListener("resize", () => {
  if (activePreviewType === "interactive") {
    showInteractiveBrowserBounds();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLog();
  setFormMessage("");

  const values = {
    ...Object.fromEntries(new FormData(form).entries()),
    ...getSavedAiSettings(),
  };

  const validationMessage = validateRunValues(values);
  if (validationMessage) {
    setFormMessage(validationMessage, "error");
    return;
  }

  setStatus("running", "Running");
  try {
    await preparePreview(values);
    const response = await window.mytvRunner.runTest(values);
    if (response.initialLog) {
      appendLog(response.initialLog);
    }
    if (!response.ok) {
      resetBrowserPreview();
      appendLog(`${response.message}\n`);
      setFormMessage(response.uiMessage || response.message, "error");
      if (response.settingsPanel) {
        selectSettingsPanel(response.settingsPanel);
      }
      setStatus("failed", "Failed to start");
      setFormRunning(false);
    }
  } catch (error) {
    resetBrowserPreview();
    appendLog(`Failed to start: ${error.message}\n`);
    setFormMessage(error.message, "error");
    setStatus("failed", "Failed to start");
    setFormRunning(false);
  }
});

stopButton.addEventListener("click", async () => {
  await window.mytvRunner.stopTest();
  setFormRunning(false);
  setStatus("idle", "Stopped");
});

openReportButton.addEventListener("click", () => {
  window.mytvRunner.openReport();
});

showReportButton.addEventListener("click", () => {
  window.mytvRunner.showReportFolder();
});

window.mytvRunner.onStarted(() => {
  setFormRunning(true);
  stopButton.disabled = false;
  setStatus("running", "Running");
});

window.mytvRunner.onLog((line) => {
  appendLog(line);
});

window.mytvRunner.onPreview((dataUrl) => {
  if (getSavedAiSettings().PREVIEW_TYPE !== "live") return;

  if (!dataUrl) {
    resetBrowserPreview();
    return;
  }

  browserPreviewImage.src = dataUrl;
  browserPreviewImage.classList.remove("hidden");
  browserPreviewEmpty.classList.add("hidden");
});

window.mytvRunner.onFinished((result) => {
  setFormRunning(false);
  setStatus(result.code === 0 ? "passed" : "failed", result.code === 0 ? "Passed" : "Failed");
  appendLog(`\nFinished with code ${result.code}\n`);
});

function syncModeFields() {
  const mode = modeSelect.value;
  const channelMode = channelModeSelect.value;
  const movieMode = movieModeSelect.value;

  toggleField("channel", mode === "channel");
  toggleField("channel-name", mode === "channel" && channelMode === "by_name");
  toggleField("channel-cate", mode === "channel" && channelMode === "by_cate");
  toggleField("movie", mode === "movie");
  toggleField("movie-name", mode === "movie" && movieMode === "by_name");
  toggleField("movie-cate", mode === "movie" && movieMode === "by_cate");
  toggleField("search", mode === "search");
  toggleField("ai-manual", mode === "ai-manual");
  if (mode !== "ai-manual") {
    setFormMessage("");
  }
}

function validateRunValues(values) {
  if (values.PLAYBACK_MODE === "channel" && values.CHANNEL_PLAY_MODE === "by_cate") {
    if (!values.CHANNEL_CATE_NAME?.trim()) {
      return "Vui lòng nhập tên cate kênh muốn play.";
    }

    const limit = Number(values.CHANNEL_CATE_LIMIT || 0);
    if (!Number.isInteger(limit) || limit < 0) {
      return "Số lượng kênh phải là số nguyên từ 0 trở lên.";
    }
  }

  if (values.PLAYBACK_MODE === "movie" && values.MOVIE_PLAY_MODE === "by_cate") {
    if (!values.MOVIE_CATE_NAME?.trim()) {
      return "Vui lòng nhập tên cate muốn play.";
    }

    const limit = Number(values.MOVIE_CATE_LIMIT || 0);
    if (!Number.isInteger(limit) || limit < 0) {
      return "Số lượng phim phải là số nguyên từ 0 trở lên.";
    }
  }

  return "";
}

function toggleField(name, visible) {
  document.querySelectorAll(`[data-field="${name}"]`).forEach((element) => {
    element.classList.toggle("hidden", !visible);
  });
}

function appendLog(value) {
  logOutput.textContent += value;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function clearLog() {
  logOutput.textContent = "";
}

function setFormMessage(message, type = "") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`.trim();
  formMessage.classList.toggle("hidden", !message);
}

function setStatus(status, text) {
  statusDot.className = `status-dot ${status}`;
  statusText.textContent = text;
}

function setFormRunning(isRunning) {
  form.querySelectorAll("input, select, textarea").forEach((element) => {
    element.disabled = isRunning;
  });

  runButton.disabled = isRunning;
  stopButton.disabled = !isRunning;
}

function openSettings() {
  suspendInteractiveBrowserForModal();
  loadSettingsIntoForm();
  syncModelOptions();
  selectSettingsPanel("api-key");
  settingsModal.classList.remove("hidden");
}

function openLogs() {
  suspendInteractiveBrowserForModal();
  logsModal.classList.remove("hidden");
}

function closeLogs() {
  logsModal.classList.add("hidden");
  resumeInteractiveBrowserAfterModal();
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  setSettingsMessage("");
  resumeInteractiveBrowserAfterModal();
}

function saveSettings() {
  const settings = readSettingsForm();
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  setSettingsMessage("Saved", "ok");
}

async function testConnection() {
  const settings = readSettingsForm();
  setSettingsMessage("Testing connection...");
  settingsTestButton.disabled = true;

  try {
    const response = await window.mytvRunner.testAiConnection(settings);
    setSettingsMessage(response.message, response.ok ? "ok" : "error");
  } catch (error) {
    setSettingsMessage(`Connection failed: ${error.message}`, "error");
  } finally {
    settingsTestButton.disabled = false;
  }
}

function loadSettingsIntoForm() {
  const settings = getSavedAiSettings();
  aiProviderSelect.value = settings.AI_PROVIDER;
  aiApiKeyInput.value = settings.AI_API_KEY;
  aiEndpointInput.value = settings.AI_ENDPOINT;
  syncModelOptions(settings.AI_MODEL);
  const previewTypeInput =
    document.querySelector(`[name="preview-type"][value="${settings.PREVIEW_TYPE}"]`) ||
    document.querySelector('[name="preview-type"][value="live"]');
  previewTypeInput.checked = true;
}

function getSavedAiSettings() {
  const defaults = defaultAiSettings();
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
  } catch {
    saved = {};
  }

  if (!AI_PROVIDER_OPTIONS[saved.AI_PROVIDER]) {
    saved.AI_PROVIDER = defaults.AI_PROVIDER;
  }
  if (!["none", "live", "interactive"].includes(saved.PREVIEW_TYPE)) {
    saved.PREVIEW_TYPE = defaults.PREVIEW_TYPE;
  }

  return {
    ...defaults,
    ...saved,
  };
}

function defaultAiSettings() {
  return {
    AI_PROVIDER: "openai",
    AI_API_KEY: "",
    AI_MODEL: "gpt-4.1-mini",
    AI_ENDPOINT: AI_PROVIDER_OPTIONS.openai.endpoint,
    PREVIEW_TYPE: "live",
  };
}

function readSettingsForm() {
  const provider = aiProviderSelect.value;
  const selectedModel = aiModelSelect.value;
  return {
    AI_PROVIDER: provider,
    AI_API_KEY: aiApiKeyInput.value.trim(),
    AI_MODEL: selectedModel === "custom" ? aiCustomModelInput.value.trim() : selectedModel,
    AI_ENDPOINT: aiEndpointInput.value.trim(),
    PREVIEW_TYPE: document.querySelector('[name="preview-type"]:checked')?.value || "live",
  };
}

function syncModelOptions(preferredModel) {
  const provider = AI_PROVIDER_OPTIONS[aiProviderSelect.value] ? aiProviderSelect.value : "openai";
  aiProviderSelect.value = provider;
  const options = AI_PROVIDER_OPTIONS[provider].models;
  const targetModel = preferredModel || aiModelSelect.value || options[0];
  const hasTarget = options.includes(targetModel);

  aiModelSelect.replaceChildren(
    ...options.map((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model === "custom" ? "Tự nhập" : model;
      return option;
    })
  );

  aiModelSelect.value = hasTarget ? targetModel : "custom";
  aiCustomModelInput.value = hasTarget ? "" : targetModel;
  syncCustomModelField();
}

function syncCustomModelField() {
  customModelField.classList.toggle("hidden", aiModelSelect.value !== "custom");
}

function setSettingsMessage(message, type = "") {
  settingsMessage.textContent = message;
  settingsMessage.className = `settings-message ${type}`.trim();
}

function selectSettingsPanel(name) {
  settingsNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.settingsPanel === name);
  });

  settingsPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.settingsContent !== name);
  });
}

async function preparePreview(values) {
  const previewType = values.PREVIEW_TYPE || "live";
  resetBrowserPreview();
  activePreviewType = previewType;

  if (previewType === "none") {
    browserPreviewEmpty.textContent = "Preview is disabled.";
    return;
  }

  if (previewType === "interactive") {
    browserPreviewEmpty.classList.add("hidden");
    browserMuteButton.classList.remove("hidden");
    await setBrowserMuted(true);
    await showInteractiveBrowser(values.APP_URL);
    return;
  }

  browserPreviewEmpty.textContent = "Browser preview will appear here when a test starts.";
}

async function showInteractiveBrowser(appUrl) {
  await showInteractiveBrowserBounds(interactiveUrl(appUrl));
}

async function showInteractiveBrowserBounds(url) {
  const bounds = document.querySelector(".browser-preview-stage").getBoundingClientRect();
  await window.mytvRunner.showInteractiveBrowser({
    url,
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  });
}

async function suspendInteractiveBrowserForModal() {
  if (activePreviewType !== "interactive") return;
  await window.mytvRunner.suspendInteractiveBrowser();
}

async function resumeInteractiveBrowserAfterModal() {
  if (activePreviewType !== "interactive") return;
  if (!settingsModal.classList.contains("hidden") || !logsModal.classList.contains("hidden")) return;

  const bounds = document.querySelector(".browser-preview-stage").getBoundingClientRect();
  await window.mytvRunner.resumeInteractiveBrowser({
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  });
}

async function toggleBrowserMute() {
  await setBrowserMuted(!browserMuted);
}

async function setBrowserMuted(muted) {
  browserMuted = muted;
  browserMuteButton.textContent = muted ? "Unmute" : "Mute";
  await window.mytvRunner.setInteractiveBrowserMuted(muted);
}

function interactiveUrl(appUrl) {
  try {
    const url = new URL(appUrl);
    url.searchParams.set("_interactive", Date.now().toString());
    return url.toString();
  } catch {
    const separator = appUrl.includes("?") ? "&" : "?";
    return `${appUrl}${separator}_interactive=${Date.now()}`;
  }
}

function resetBrowserPreview() {
  browserPreviewImage.removeAttribute("src");
  browserPreviewImage.classList.add("hidden");
  interactiveBrowser.classList.add("hidden");
  browserMuteButton.classList.add("hidden");
  window.mytvRunner.hideInteractiveBrowser();
  browserPreviewEmpty.classList.remove("hidden");
}
