const TEST_CONFIGURATION = typeof require === "function" ? require("../test-configuration") : globalThis.MYTV_TEST_CONFIGURATION;

function maskActionForDisplay(action) {
    const displayAction = {...action};
    if (displayAction.action === "login" && Object.prototype.hasOwnProperty.call(displayAction, "password")) {
        displayAction.password = "••••••";
    }
    return displayAction;
}

function redactSensitiveText(value) {
    return String(value ?? "")
        .replace(/("(?:password|api_authorization|authorization|token|secret|x-flowtest-service-token)"\s*:\s*")[^"]*(")/gi, "$1••••••$2")
        .replace(/((?:tài khoản|tai khoan|username|user)\s*[=:]?\s*[^\/\s,;:]+)\s*\/\s*([^\s]+)/gi, "$1/••••••")
        .replace(/((?:mật khẩu|mat khau|password)\s*[=:]?\s*)([^\s]+)/gi, "$1••••••");
}

function freezeSubmission(value) {
    if (Array.isArray(value)) {
        value.forEach(freezeSubmission);
    } else if (value && typeof value === "object") {
        Object.values(value).forEach(freezeSubmission);
    }
    return Object.freeze(value);
}

function cloneFrozenSubmission(value) {
    return freezeSubmission(JSON.parse(JSON.stringify(value)));
}

function formatGmtPlusSevenTimestamp(date = new Date()) {
    const offsetMs = 7 * 60 * 60 * 1000;
    return new Date(date.getTime() + offsetMs).toISOString().slice(0, 19).replace("T", " ");
}

function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function matchesCaseSearch(testCase, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    const id = normalizeSearchText(testCase.id);
    const name = normalizeSearchText(testCase.name || "");
    return id.includes(normalizedQuery) || name.includes(normalizedQuery);
}

function validateRunValues(values) {
    const selectedCaseIds = Array.isArray(values?.selectedCaseIds) ? values.selectedCaseIds.filter((id) => String(id).trim()) : values?.TEST_CASE_ID?.trim() ? [values.TEST_CASE_ID.trim()] : [];
    if (!selectedCaseIds.length) {
        return "Vui lòng chọn một test case trước khi chạy.";
    }
    return "";
}

const DEFAULT_SETTINGS = {
    API_DOMAIN: "http://172.16.240.254:30100",
    API_AUTHORIZATION: "",
    PROJECT_ID: "1",
    ENVIRONMENT: "UI",
    API_TIMEOUT_SECONDS: "30",
    PLAYER_CHECK_TIMEOUT_SECONDS: String(TEST_CONFIGURATION.DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS),
    TEST_CASE_MAX_TIME_MINUTES: String(TEST_CONFIGURATION.DEFAULT_TEST_CASE_MAX_TIME_MINUTES),
    TEST_RESOLUTION: TEST_CONFIGURATION.DEFAULT_TEST_RESOLUTION,
    SIMULTANEOUS_DEVICES: String(TEST_CONFIGURATION.DEFAULT_SIMULTANEOUS_DEVICES),
    PREVIEW_TYPE: "live",
    RUN_TARGET: "browser",
};

const SAVE_TOAST_DURATION_MS = 3000;
const MAX_BROWSER_PREVIEW_SLOTS = 6;
const MAX_BROWSER_LOG_LENGTH = 120000;
const BROWSER_LOG_TRUNCATION_MARKER = "[Older Playwright output truncated. Newest output retained.]\n";

const LG_INSTALL_PROGRESS_STEPS = Object.freeze([
    {code: "preparing", label: "Preparing the managed installation"},
    {code: "downloading-node", label: "Downloading reviewed Node"},
    {code: "verifying-node", label: "Verifying the reviewed Node archive"},
    {code: "extracting-node", label: "Extracting reviewed Node"},
    {code: "installing-appium", label: "Installing reviewed Appium and the LG driver"},
    {code: "verifying-lg-driver", label: "Registering and verifying the LG driver locally"},
    {code: "downloading-chromedriver", label: "Downloading the verified ChromeDriver"},
    {code: "verifying-chromedriver-archive", label: "Verifying the ChromeDriver archive"},
    {code: "extracting-chromedriver", label: "Extracting the verified ChromeDriver"},
    {code: "verifying-chromedriver", label: "Verifying ChromeDriver locally"},
    {code: "activating", label: "Activating verified local tools"},
    {code: "complete", label: "Installation complete"},
]);

const LG_INSTALL_FAILURE_STATUSES = new Set(["INSTALL_INPUT_INVALID", "DOWNLOAD_FAILED", "CHECKSUM_MISMATCH", "EXTRACTION_FAILED", "DEPENDENCY_INSTALL_FAILED", "VERIFICATION_FAILED", "ACTIVATION_FAILED", "INSTALL_FAILED"]);

const BROWSER_INSTALL_PROGRESS_STEPS = Object.freeze([
    {code: "preparing", label: "Preparing Browser installation"},
    {code: "downloading-chromium", label: "Downloading reviewed Chromium"},
    {code: "verifying-chromium", label: "Verifying Chromium locally"},
    {code: "complete", label: "Installation complete"},
]);

const BROWSER_INSTALL_FAILURE_STATUSES = new Set(["DOWNLOAD_FAILED", "VERIFICATION_FAILED", "INSTALL_FAILED"]);

function createRendererController({document, windowRef, runner, storage} = {}) {
    const doc = document || globalThis.document;
    const win = windowRef || globalThis.window;
    const api = runner || win?.mytvRunner;
    const store = storage || win?.localStorage;
    const get = (id) => doc?.querySelector(`#${id}`);
    const form = get("test-form");
    const campaignSelect = get("campaign-select");
    const folderSelect = get("folder-select");
    const refreshCampaignsButton = get("refresh-campaigns-button");
    const refreshFoldersButton = get("refresh-folders-button");
    const getTestCasesButton = get("get-test-cases-button");
    const apiLoadingOverlay = get("api-loading-overlay");
    const apiDomainInput = get("api-domain-input");
    const apiAuthorizationInput = get("api-authorization-input");
    const projectIdInput = get("project-id-input");
    const environmentSelect = get("environment-select");
    const apiTimeoutInput = get("api-timeout-input");
    const playerCheckTimeoutInput = get("player-check-timeout-input");
    const testCaseMaxTimeInput = get("test-case-max-time-input");
    const testResolutionInputs = doc?.querySelectorAll?.('[name="test-resolution"]') || [];
    const simultaneousDevicesSelect = get("simultaneous-devices-select");
    const dnsHostAddButton = get("dns-host-add-button");
    const dnsHostRemoveButton = get("dns-host-remove-button");
    const dnsHostStatus = get("dns-host-status");
    const browserTargetInput = get("run-target-browser");
    const webosTargetInput = get("run-target-webos");
    const lgDevicePanel = get("lg-device-panel");
    const tvDeviceSelect = get("tv-device-select");
    const tvDeviceAddButton = get("tv-device-add-button");
    const tvDeviceEditButton = get("tv-device-edit-button");
    const tvDeviceConnectionStatus = get("tv-device-connection-status");
    const tvDeviceConnectionDot = get("tv-device-connection-dot");
    const tvDeviceCheckConnectionButton = get("tv-device-check-connection-button");
    const lgRunAvailabilityElement = get("lg-run-availability");
    const configureLgSdkButton = get("configure-lg-sdk-button");
    const tvDeviceDialog = get("tv-device-dialog");
    const tvDeviceDialogTitle = get("tv-device-dialog-title");
    const tvDeviceDialogStatus = get("tv-device-dialog-status");
    const tvDeviceNameInput = get("tv-device-name-input");
    const tvDeviceHostInput = get("tv-device-host-input");
    const tvDevicePassphraseInput = get("tv-device-passphrase-input");
    const tvDevicePassphraseToggle = get("tv-device-passphrase-toggle");
    const tvDeviceDialogCancelButton = get("tv-device-dialog-cancel-button");
    const tvDeviceDialogSubmitButton = get("tv-device-dialog-submit-button");
    const tvDeviceStatus = get("tv-device-status");
    const tvToolchainStatus = get("tv-toolchain-status");
    const sdkAutoConfigureButton = get("sdk-auto-configure-button");
    const sdkInstallConfirmButton = get("sdk-install-confirm-button");
    const sdkUseManagedButton = get("sdk-use-managed-button");
    const sdkManagedToolchainStatus = get("sdk-managed-toolchain-status");
    const sdkComponentList = get("sdk-component-list");
    const sdkCompatibilityCatalogStatus = get("sdk-compatibility-catalog-status");
    const sdkCompatibilityCatalogRefreshButton = get("sdk-compatibility-catalog-refresh-button");
    const sdkCompatibilityCheckButton = get("sdk-compatibility-check-button");
    const lgCompatibilityProductGateStatus = get("lg-compatibility-product-gate-status");
    const lgCompatibilityProductGateUsernameInput = get("lg-compatibility-product-gate-username-input");
    const lgCompatibilityProductGatePasswordInput = get("lg-compatibility-product-gate-password-input");
    const lgCompatibilityProductGateSaveButton = get("lg-compatibility-product-gate-save-button");
    const lgCompatibilityDialog = get("lg-compatibility-dialog");
    const lgCompatibilityDialogStatus = get("lg-compatibility-dialog-status");
    const lgCompatibilityNameInput = get("lg-compatibility-name-input");
    const lgCompatibilityHostInput = get("lg-compatibility-host-input");
    const lgCompatibilityPassphraseInput = get("lg-compatibility-passphrase-input");
    const lgCompatibilityInspectionReviewButton = get("lg-compatibility-inspection-review-button");
    const lgCompatibilityInspectionConfirmButton = get("lg-compatibility-inspection-confirm-button");
    const lgCompatibilityValidationReviewButton = get("lg-compatibility-validation-review-button");
    const lgCompatibilityValidationConfirmButton = get("lg-compatibility-validation-confirm-button");
    const lgCompatibilityCloseButton = get("lg-compatibility-close-button");
    const sdkInstallReview = get("sdk-install-review");
    const sdkInstallProgress = get("sdk-install-progress");
    const sdkInstallProgressText = get("sdk-install-progress-text");
    const sdkInstallProgressSteps = get("sdk-install-progress-steps");
    const browserComponentList = get("browser-component-list");
    const browserAutoConfigureButton = get("browser-auto-configure-button");
    const browserInstallConfirmButton = get("browser-install-confirm-button");
    const browserInstallReview = get("browser-install-review");
    const browserInstallProgress = get("browser-install-progress");
    const browserInstallProgressText = get("browser-install-progress-text");
    const browserInstallProgressSteps = get("browser-install-progress-steps");
    const browserToolchainRunStatus = get("browser-toolchain-run-status");
    const configureBrowserButton = get("configure-browser-button");
    const tvToolchainSdkHomeInput = get("tv-toolchain-sdk-home-input");
    const tvToolchainAppiumHomeInput = get("tv-toolchain-appium-home-input");
    const tvToolchainAppiumBinInput = get("tv-toolchain-appium-bin-input");
    const tvToolchainChromedriverInput = get("tv-toolchain-chromedriver-input");
    const tvToolchainSaveButton = get("tv-toolchain-save-button");
    const sdkDownloadLgCliButton = get("sdk-download-lg-cli-button");
    const sdkChooseLgCliButton = get("sdk-choose-lg-cli-button");
    const tvHelpButton = get("tv-help-button");
    const tvHelpModal = get("tv-help-modal");
    const tvHelpCloseButton = get("tv-help-close-button");
    const testCaseList = get("test-case-list");
    const testCaseListBody = get("test-case-list-body") || testCaseList;
    const testCaseSearchInput = get("test-case-search-input");
    const selectAllTestCases = get("select-all-test-cases");
    const selectedTestCaseCount = get("selected-test-case-count");
    const workspaceSelectedCount = get("workspace-selected-count");
    const testCaseDetails = get("test-case-details");
    const testCaseDetailsModal = get("test-case-details-modal");
    const selectedTestCaseId = get("selected-test-case-id");

    if (sdkInstallConfirmButton) sdkInstallConfirmButton.disabled = true;
    if (sdkUseManagedButton) sdkUseManagedButton.disabled = true;
    if (browserInstallConfirmButton) browserInstallConfirmButton.disabled = true;
    if (dnsHostAddButton) dnsHostAddButton.disabled = true;
    if (dnsHostRemoveButton) dnsHostRemoveButton.disabled = true;
    const formMessage = get("form-message");
    const runButton = get("run-button");
    const stopButton = get("stop-button");
    const retrySyncButton = get("retry-sync-button");
    const statusDot = get("status-dot");
    const statusText = get("status-text");
    const logOutput = get("log-output");
    const logsClearButton = get("logs-clear-button");
    const browserMuteButton = get("browser-mute-button");
    const browserPreviewEmpty = get("browser-preview-empty");
    const browserPreviewImage = get("browser-preview-image");
    const lgPreviewEmpty = get("lg-preview-empty");
    const lgPreviewImage = get("lg-preview-image");
    const lgRunState = get("lg-run-state");
    const browserSlotGrid = get("browser-slot-grid");
    const browserLogPanel = get("browser-log-panel");
    const browserSelectedLog = get("browser-selected-log");
    const browserLogSelection = get("browser-log-selection");
    const browserLogEmpty = get("browser-log-empty");
    const legacyPreview = doc?.querySelector?.(".legacy-browser-preview");
    const lgRunConfirmationDialog = get("lg-run-confirmation-dialog");
    const lgRunConfirmationCount = get("lg-run-confirmation-count");
    const lgRunConfirmButton = get("lg-run-confirm-button");
    const lgRunCancelButton = get("lg-run-cancel-button");
    const lgRecoveryDialog = get("lg-recovery-dialog");
    const lgRecoveryRetryButton = get("lg-recovery-retry-button");
    const lgRecoveryStopButton = get("lg-recovery-stop-button");
    const interactiveBrowser = get("interactive-browser");
    const settingsModal = get("settings-modal");
    const logsModal = get("logs-modal");
    const appToast = get("app-toast");
    const previewTargetStatus = get("preview-target-status");
    const settingsNavItems = doc?.querySelectorAll?.("[data-settings-panel]") || [];
    const settingsPanels = doc?.querySelectorAll?.("[data-settings-content]") || [];
    let cases = [];
    let selectedCase = null;
    const selectedCaseIds = new Set();
    const caseStatuses = new Map();
    const visibleCaseIds = new Set();
    let batchState = null;
    let activeCompletion = null;
    let activePreviewType = "live";
    let browserMuted = true;
    let appToastTimer = null;
    let settings = {...DEFAULT_SETTINGS};
    let activeCampaignId = "";
    let activeCacheKey = "";
    let activeFolderId = "";
    let activeFolderPath = "";
    const campaignsById = new Map();
    const foldersByPath = new Map();
    let apiRequestDepth = 0;
    let activeRunnerLog = null;
    let activeBrowserBatchId = "";
    let activeBrowserBatchSettings = null;
    let activeLogCaseId = "";
    const browserSlots = new Map();
    const browserCaseLogs = new Map();
    let pendingResultSubmission = null;
    let runTarget = "browser";
    let tvDevices = [];
    let deviceDialogMode = "add";
    let editingDeviceId = "";
    let activeLgInstallStepIndex = -1;
    let testConfigurationSync = Promise.resolve();
    let sdkInstallProgressDismissed = false;
    let browserToolchainReady = true;
    let activeBrowserInstallStepIndex = -1;
    let browserInstallProgressDismissed = false;
    let lgRunAvailability = {ok: false, status: "DEVICE_NOT_FOUND"};
    let pendingLgRunValues = null;
    let activeLgCompatibilityAttemptId = "";
    let lgCompatibilityPhase = "editing";
    const blockApiInteraction = (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
    };

    function updateRetrySyncButton() {
        if (retrySyncButton) retrySyncButton.disabled = !pendingResultSubmission;
    }

    function setRunActive(active) {
        void api.setRunActive?.(Boolean(active));
    }

    function setPendingResultSubmission(submission) {
        pendingResultSubmission = submission ? cloneFrozenSubmission(submission) : null;
        updateRetrySyncButton();
        void api.setUnsyncedResultSubmission?.(Boolean(pendingResultSubmission));
    }

    function loadSettings() {
        let saved = {};
        try {
            saved = JSON.parse(store?.getItem?.("mytv-auto-test-settings") || "{}");
        } catch {
            saved = {};
        }
        const {APP_URL: _savedAppUrl, DNS_HOST: _savedDnsHost, ...persistedSettings} = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
        settings = {
            ...DEFAULT_SETTINGS,
            ...persistedSettings,
            API_AUTHORIZATION: String(saved.API_AUTHORIZATION ?? DEFAULT_SETTINGS.API_AUTHORIZATION).trim(),
            ENVIRONMENT: ["API", "UI"].includes(saved.ENVIRONMENT) ? saved.ENVIRONMENT : DEFAULT_SETTINGS.ENVIRONMENT,
            API_TIMEOUT_SECONDS: Number(saved.API_TIMEOUT_SECONDS) > 0 ? String(saved.API_TIMEOUT_SECONDS) : DEFAULT_SETTINGS.API_TIMEOUT_SECONDS,
            PLAYER_CHECK_TIMEOUT_SECONDS: String(TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(saved.PLAYER_CHECK_TIMEOUT_SECONDS, TEST_CONFIGURATION.DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS)),
            TEST_CASE_MAX_TIME_MINUTES: String(TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(saved.TEST_CASE_MAX_TIME_MINUTES, TEST_CONFIGURATION.DEFAULT_TEST_CASE_MAX_TIME_MINUTES)),
            TEST_RESOLUTION: TEST_CONFIGURATION.normalizeTestResolution(saved.TEST_RESOLUTION, TEST_CONFIGURATION.DEFAULT_TEST_RESOLUTION),
            SIMULTANEOUS_DEVICES: String(TEST_CONFIGURATION.normalizeSimultaneousDevices(saved.SIMULTANEOUS_DEVICES, TEST_CONFIGURATION.DEFAULT_SIMULTANEOUS_DEVICES)),
            PREVIEW_TYPE: ["none", "live", "interactive"].includes(saved.PREVIEW_TYPE) ? saved.PREVIEW_TYPE : DEFAULT_SETTINGS.PREVIEW_TYPE,
            RUN_TARGET: saved.RUN_TARGET === "webos" ? "webos" : DEFAULT_SETTINGS.RUN_TARGET,
        };
        activePreviewType = settings.PREVIEW_TYPE;
        runTarget = settings.RUN_TARGET;
        if (apiDomainInput) apiDomainInput.value = settings.API_DOMAIN;
        if (apiAuthorizationInput) apiAuthorizationInput.value = settings.API_AUTHORIZATION;
        if (projectIdInput) projectIdInput.value = settings.PROJECT_ID;
        if (environmentSelect) environmentSelect.value = settings.ENVIRONMENT;
        if (apiTimeoutInput) apiTimeoutInput.value = settings.API_TIMEOUT_SECONDS;
        if (playerCheckTimeoutInput) playerCheckTimeoutInput.value = settings.PLAYER_CHECK_TIMEOUT_SECONDS;
        if (testCaseMaxTimeInput) testCaseMaxTimeInput.value = settings.TEST_CASE_MAX_TIME_MINUTES;
        testResolutionInputs.forEach((input) => { input.checked = input.value === settings.TEST_RESOLUTION; });
        if (simultaneousDevicesSelect) simultaneousDevicesSelect.value = settings.SIMULTANEOUS_DEVICES;
        doc?.querySelectorAll?.('[name="preview-type"]').forEach((input) => {
            input.checked = input.value === activePreviewType;
        });
        syncRunTargetControls();
        syncTestConfiguration();
    }

    function syncTestConfiguration(
        playerTimeoutSeconds = settings.PLAYER_CHECK_TIMEOUT_SECONDS,
        maxTimeMinutes = settings.TEST_CASE_MAX_TIME_MINUTES,
        resolution = settings.TEST_RESOLUTION,
        devices = settings.SIMULTANEOUS_DEVICES,
    ) {
        testConfigurationSync = Promise.resolve()
            .then(() =>
                api.setTestConfiguration?.({
                    PLAYER_CHECK_TIMEOUT_SECONDS: playerTimeoutSeconds,
                    TEST_CASE_MAX_TIME_MINUTES: maxTimeMinutes,
                    TEST_RESOLUTION: TEST_CONFIGURATION.normalizeTestResolution(resolution, settings.TEST_RESOLUTION),
                    SIMULTANEOUS_DEVICES: String(TEST_CONFIGURATION.normalizeSimultaneousDevices(devices, settings.SIMULTANEOUS_DEVICES)),
                }),
            )
            .then((response) => (response === undefined ? {ok: true} : response))
            .catch((error) => ({
                ok: false,
                message: error?.message || "Could not synchronize test configuration.",
            }));
        return testConfigurationSync;
    }

    function currentSettings() {
        const timeoutSeconds = Number(apiTimeoutInput?.value);
        const playerTimeoutSeconds = TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(playerCheckTimeoutInput?.value, settings.PLAYER_CHECK_TIMEOUT_SECONDS);
        const maxTimeMinutes = TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(testCaseMaxTimeInput?.value, settings.TEST_CASE_MAX_TIME_MINUTES);
        const resolution = TEST_CONFIGURATION.normalizeTestResolution(
            [...testResolutionInputs].find((input) => input.checked)?.value,
            settings.TEST_RESOLUTION,
        );
        const devices = String(TEST_CONFIGURATION.normalizeSimultaneousDevices(simultaneousDevicesSelect?.value, settings.SIMULTANEOUS_DEVICES));
        return {
            ...settings,
            API_DOMAIN: apiDomainInput?.value?.trim() || settings.API_DOMAIN,
            API_AUTHORIZATION: apiAuthorizationInput?.value?.trim() || "",
            PROJECT_ID: projectIdInput?.value?.trim() || settings.PROJECT_ID,
            ENVIRONMENT: ["API", "UI"].includes(environmentSelect?.value) ? environmentSelect.value : settings.ENVIRONMENT,
            API_TIMEOUT_SECONDS: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? String(timeoutSeconds) : settings.API_TIMEOUT_SECONDS,
            PLAYER_CHECK_TIMEOUT_SECONDS: String(playerTimeoutSeconds),
            TEST_CASE_MAX_TIME_MINUTES: String(maxTimeMinutes),
            TEST_RESOLUTION: resolution,
            SIMULTANEOUS_DEVICES: devices,
            RUN_TARGET: runTarget,
        };
    }

    function showApiError(response) {
        if (response?.timeout) {
            win?.alert?.("API request timed out. Please check the Network config timeout.");
        }
        setFormMessage(response?.message || "API request failed.", "error");
    }

    function beginApiRequest() {
        apiRequestDepth += 1;
        if (apiRequestDepth !== 1) return;
        apiLoadingOverlay?.classList.remove("hidden");
        apiLoadingOverlay?.setAttribute("aria-busy", "true");
        doc?.activeElement?.blur?.();
        doc?.addEventListener?.("keydown", blockApiInteraction, true);
        updateFolderControls();
    }

    function endApiRequest() {
        apiRequestDepth = Math.max(apiRequestDepth - 1, 0);
        if (apiRequestDepth !== 0) return;
        apiLoadingOverlay?.classList.add("hidden");
        apiLoadingOverlay?.setAttribute("aria-busy", "false");
        doc?.removeEventListener?.("keydown", blockApiInteraction, true);
        updateFolderControls();
    }

    function setFormMessage(message, type = "") {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`.trim();
        formMessage.classList.toggle("hidden", !message);
    }

    function showAppToast(message, type = "") {
        if (!appToast) return;
        if (appToastTimer !== null) {
            if (typeof win?.clearTimeout === "function") win.clearTimeout(appToastTimer);
            else clearTimeout(appToastTimer);
        }
        appToast.textContent = message;
        appToast.className = `app-toast ${type}`.trim();
        const schedule = typeof win?.setTimeout === "function" ? win.setTimeout.bind(win) : setTimeout;
        appToastTimer = schedule(() => {
            appToast.textContent = "";
            appToast.className = "app-toast hidden";
            appToastTimer = null;
        }, SAVE_TOAST_DURATION_MS);
    }

    function updateLogEntryOverflow(entry, content) {
        const scrollHeight = Number(content?.scrollHeight);
        const clientHeight = Number(content?.clientHeight);
        if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight) || clientHeight <= 0) return;

        const isCollapsible = scrollHeight > clientHeight + 1;
        entry.classList.toggle("is-collapsible", isCollapsible);
        if (!isCollapsible) entry.classList.remove("is-expanded");
        entry.setAttribute("aria-expanded", String(!isCollapsible || entry.classList.contains("is-expanded")));
        if (isCollapsible) {
            entry.setAttribute("role", "button");
            entry.setAttribute("tabindex", "0");
        } else {
            entry.removeAttribute("role");
            entry.removeAttribute("tabindex");
        }
    }

    function appendLog(value, label = "Runner", {preserveWhitespace = false} = {}) {
        if (!logOutput || !doc?.createElement) return;

        const entry = doc.createElement("article");
        entry.className = "log-entry";
        const header = doc.createElement("header");
        header.className = "log-entry-header";
        const timestamp = formatGmtPlusSevenTimestamp();
        const time = doc.createElement("time");
        time.className = "log-entry-timestamp";
        time.dateTime = `${timestamp.replace(" ", "T")}+07:00`;
        time.textContent = timestamp;
        const entryLabel = doc.createElement("span");
        entryLabel.className = "log-entry-label";
        entryLabel.textContent = label;
        const expandHint = doc.createElement("span");
        expandHint.className = "log-entry-expand-hint";
        expandHint.textContent = "Expand";
        header.append(time, entryLabel, expandHint);

        const content = doc.createElement("pre");
        content.className = "log-entry-content";
        const text = redactSensitiveText(value);
        content.textContent = preserveWhitespace ? text : text.trim();
        entry.append(header, content);
        const toggleExpanded = () => {
            if (!entry.classList.contains("is-collapsible")) return;
            const expanded = entry.classList.toggle("is-expanded");
            entry.setAttribute("aria-expanded", String(expanded));
        };
        entry.addEventListener("click", toggleExpanded);
        entry.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault?.();
            toggleExpanded();
        });
        content.addEventListener("click", (event) => {
            if (entry.classList.contains("is-expanded")) event.stopPropagation?.();
        });
        logOutput.prepend(entry);
        updateLogEntryOverflow(entry, content);
        win?.requestAnimationFrame?.(() => updateLogEntryOverflow(entry, content));
        logOutput.scrollTop = 0;
        return {entry, content};
    }

    function appendRunnerLog(value) {
        if (!value) return;
        activeRunnerLog ||= appendLog("", "Playwright runner output", {preserveWhitespace: true});
        const runnerLog = activeRunnerLog;
        runnerLog.content.textContent += redactSensitiveText(value);
        updateLogEntryOverflow(runnerLog.entry, runnerLog.content);
        win?.requestAnimationFrame?.(() => updateLogEntryOverflow(runnerLog.entry, runnerLog.content));
        logOutput.scrollTop = 0;
    }

    function refreshLogEntryOverflows() {
        logOutput?.querySelectorAll?.(".log-entry").forEach((entry) => {
            updateLogEntryOverflow(entry, entry.querySelector(".log-entry-content"));
        });
    }

    function formatLogDetails(value) {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value ?? "");
        }
    }

    function appendApiRequestLog(operation, request) {
        appendLog(formatLogDetails(request), `[API] ${operation} request`);
    }

    function appendApiResponseLog(operation, response) {
        const details = response?.apiLog;
        const result = {
            ok: Boolean(response?.ok),
            message: response?.message || "",
            timeout: Boolean(response?.timeout),
            request: details?.request || null,
            response: details?.response || null,
        };
        appendLog(formatLogDetails(result), `[API] ${operation} response`);
    }

    function clearLog() {
        activeRunnerLog = null;
        if (logOutput) logOutput.textContent = "";
    }

    function setStatus(status, text) {
        if (statusDot) statusDot.className = `status-dot ${status}`;
        if (statusText) statusText.textContent = text;
    }

    function browserCaseById(caseId) {
        return cases.find((testCase) => String(testCase.id) === String(caseId)) || null;
    }

    function browserStatusLabel(status) {
        const labels = {idle: "Idle", queued: "Queued", running: "Running", passed: "Passed", failed: "Failed", stopped: "Stopped", skipped: "Skipped"};
        return labels[String(status || "idle")] || String(status || "Idle");
    }

    function createBrowserSlot(slotId) {
        const state = {
            slotId,
            caseId: "",
            name: "",
            status: "idle",
            image: "",
            root: null,
            idElement: null,
            nameElement: null,
            statusElement: null,
            imageElement: null,
            emptyElement: null,
        };
        browserSlots.set(slotId, state);
        if (!browserSlotGrid || !doc?.createElement) return state;

        const root = doc.createElement("article");
        root.className = "browser-slot browser-slot-idle";
        root.dataset.slotId = String(slotId);
        root.setAttribute("aria-label", `Browser preview slot ${slotId}`);
        root.tabIndex = 0;
        const header = doc.createElement("header");
        header.className = "browser-slot-header";
        const idElement = doc.createElement("span");
        idElement.className = "browser-slot-case-id";
        const nameElement = doc.createElement("span");
        nameElement.className = "browser-slot-case-name";
        const statusElement = doc.createElement("span");
        statusElement.className = "browser-slot-status status-idle";
        header.append(idElement, nameElement, statusElement);
        const stage = doc.createElement("div");
        stage.className = "browser-slot-stage";
        stage.dataset.slotId = String(slotId);
        const emptyElement = doc.createElement("span");
        emptyElement.className = "browser-slot-empty";
        const imageElement = doc.createElement("img");
        imageElement.className = "browser-slot-image hidden";
        imageElement.alt = `Browser preview slot ${slotId}`;
        stage.append(emptyElement, imageElement);
        root.append(header, stage);
        root.addEventListener?.("click", () => {
            if (state.caseId) selectBrowserLogCase(state.caseId);
        });
        root.addEventListener?.("keydown", (event) => {
            if ((event.key === "Enter" || event.key === " ") && state.caseId) {
                event.preventDefault?.();
                selectBrowserLogCase(state.caseId);
            }
        });
        browserSlotGrid.append(root);
        Object.assign(state, {root, idElement, nameElement, statusElement, imageElement, emptyElement});
        renderBrowserSlot(state);
        return state;
    }

    function initializeBrowserSlots() {
        if (browserSlots.size) return;
        for (let slotId = 1; slotId <= MAX_BROWSER_PREVIEW_SLOTS; slotId += 1) createBrowserSlot(slotId);
    }

    function renderBrowserSlot(state) {
        if (!state) return;
        const label = browserStatusLabel(state.status);
        state.root?.classList?.remove?.("browser-slot-idle", "browser-slot-assigned");
        state.root?.classList?.add?.(state.caseId ? "browser-slot-assigned" : "browser-slot-idle");
        state.root?.classList?.toggle?.("browser-slot-selected", Boolean(state.caseId && activeLogCaseId === state.caseId));
        if (state.idElement) state.idElement.textContent = state.caseId || "—";
        if (state.nameElement) {
            state.nameElement.textContent = state.caseId ? state.name || `Test case ${state.caseId}` : "Idle";
            state.nameElement.title = state.nameElement.textContent;
        }
        if (state.statusElement) {
            state.statusElement.className = `browser-slot-status status-${state.status}`;
            state.statusElement.textContent = label;
        }
        if (state.imageElement) {
            if (state.image) {
                state.imageElement.src = state.image;
                state.imageElement.classList.remove("hidden");
                state.emptyElement?.classList.add("hidden");
            } else {
                state.imageElement.removeAttribute?.("src");
                state.imageElement.classList.add("hidden");
                state.emptyElement?.classList.remove("hidden");
            }
        }
    }

    function resetBrowserDashboard({clearLogs = false} = {}) {
        activeBrowserBatchId = "";
        activeBrowserBatchSettings = null;
        if (clearLogs) browserCaseLogs.clear();
        browserSlots.forEach((state) => {
            state.caseId = "";
            state.name = "";
            state.status = "idle";
            state.image = "";
            renderBrowserSlot(state);
        });
        if (clearLogs) {
            activeLogCaseId = "";
            refreshBrowserLogPanel();
        }
    }

    function selectBrowserLogCase(caseId) {
        const id = String(caseId ?? "").trim();
        if (!id) return;
        activeLogCaseId = id;
        testCaseListBody?.querySelectorAll?.("[data-test-case-id]").forEach((row) => {
            row.classList.toggle("browser-log-selected", String(row.dataset.testCaseId) === id);
        });
        browserSlots.forEach(renderBrowserSlot);
        refreshBrowserLogPanel();
    }

    function refreshBrowserLogPanel() {
        const testCase = browserCaseById(activeLogCaseId);
        if (browserLogSelection) browserLogSelection.textContent = testCase ? `${testCase.id} · ${testCase.name || "Unnamed test case"}` : "Select a test case to view Playwright output";
        const text = activeLogCaseId ? browserCaseLogs.get(activeLogCaseId) || "" : "";
        if (browserSelectedLog) browserSelectedLog.textContent = text;
        browserLogEmpty?.classList?.toggle?.("hidden", Boolean(text));
    }

    function appendBrowserCaseLog(event) {
        const id = String(event?.caseId || "").trim();
        if (!id) return;
        let text = `${browserCaseLogs.get(id) || ""}${redactSensitiveText(event.text || "")}`;
        if (text.length > MAX_BROWSER_LOG_LENGTH) {
            const retainedLength = Math.max(MAX_BROWSER_LOG_LENGTH - BROWSER_LOG_TRUNCATION_MARKER.length, 0);
            text = BROWSER_LOG_TRUNCATION_MARKER + text.slice(-retainedLength);
        }
        browserCaseLogs.set(id, text);
        if (activeLogCaseId === id) refreshBrowserLogPanel();
    }

    function renderBrowserBatchEvent(event) {
        if (!event || typeof event !== "object") return;
        if (event.type === "batch-started") {
            activeBrowserBatchId = String(event.batchId || "");
            activeBrowserBatchSettings = event.settings || null;
            resetBrowserDashboard({clearLogs: true});
            activeBrowserBatchId = String(event.batchId || "");
            (event.caseIds || []).forEach((id) => renderCaseStatus(id, "queued"));
            return;
        }
        if (!activeBrowserBatchId || String(event.batchId || "") !== activeBrowserBatchId) return;
        const id = String(event.caseId || "");
        const state = browserSlots.get(Number(event.slotId));
        if (event.type === "case-queued") {
            renderCaseStatus(id, "queued");
        } else if (event.type === "case-assigned") {
            if (!state) return;
            state.caseId = id;
            state.name = browserCaseById(id)?.name || "";
            state.status = "queued";
            state.image = "";
            renderBrowserSlot(state);
            renderCaseStatus(id, "queued");
            selectBrowserLogCase(id);
        } else if (event.type === "case-started") {
            if (state && state.caseId === id) {
                state.status = "running";
                renderBrowserSlot(state);
            }
            renderCaseStatus(id, "running");
        } else if (event.type === "case-log") {
            appendBrowserCaseLog(event);
        } else if (event.type === "preview-frame") {
            if (!state || state.caseId !== id || typeof event.dataUrl !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(event.dataUrl)) return;
            state.image = event.dataUrl;
            renderBrowserSlot(state);
        } else if (event.type === "preview-clear") {
            if (state && state.caseId === id) {
                state.image = "";
                renderBrowserSlot(state);
            }
        } else if (event.type === "case-finished") {
            const status = ["passed", "failed", "stopped"].includes(event.status) ? event.status : "failed";
            if (state && state.caseId === id) {
                state.status = status;
                renderBrowserSlot(state);
            }
            renderCaseStatus(id, status);
        } else if (event.type === "case-skipped") {
            renderCaseStatus(id, "skipped");
        } else if (event.type === "batch-finished") {
            activeBrowserBatchSettings = event.settings || activeBrowserBatchSettings;
        }
    }

    function getSelectedCaseIds() {
        return cases.filter((testCase) => selectedCaseIds.has(String(testCase.id))).map((testCase) => String(testCase.id));
    }

    function getVisibleCaseIds() {
        return cases.filter((testCase) => visibleCaseIds.has(String(testCase.id))).map((testCase) => String(testCase.id));
    }

    function canRunLg() {
        return runTarget === "webos" && lgRunAvailability?.ok === true && lgRunAvailability.status === "READY";
    }

    function updateSelectionUi({refreshLg = true} = {}) {
        const selectedIds = getSelectedCaseIds();
        const visibleIds = getVisibleCaseIds();
        if (selectedTestCaseCount) selectedTestCaseCount.textContent = `${selectedIds.length} selected`;
        if (workspaceSelectedCount) workspaceSelectedCount.textContent = `${selectedIds.length} selected`;
        if (runButton) {
            const label = `Run Selected (${selectedIds.length})`;
            runButton.setAttribute("aria-label", label);
            runButton.closest?.(".workspace-action-tooltip")?.setAttribute("data-tooltip", label);
            runButton.disabled = selectedIds.length === 0 || (runTarget === "browser" ? !browserToolchainReady : !canRunLg());
        }
        if (selectAllTestCases) {
            selectAllTestCases.checked = visibleIds.length > 0 && visibleIds.every((id) => selectedCaseIds.has(id));
        }
        testCaseListBody?.querySelectorAll?.("[data-test-case-id]").forEach((row) => {
            const id = String(row.dataset.testCaseId);
            const isSelected = selectedCaseIds.has(id);
            const checkbox = row.querySelector("input");
            checkbox.checked = isSelected;
            row.setAttribute("aria-selected", String(isSelected));
        });
        if (selectedTestCaseId) selectedTestCaseId.value = selectedIds.length === 1 ? selectedIds[0] : "";
        if (refreshLg && runTarget === "webos") void refreshLgRunAvailability();
    }

    function applyCaseFilter(query = "") {
        visibleCaseIds.clear();
        cases.forEach((testCase) => {
            if (matchesCaseSearch(testCase, query)) visibleCaseIds.add(String(testCase.id));
        });
        testCaseListBody?.querySelectorAll?.("[data-test-case-id]").forEach((row) => {
            row.classList.toggle("hidden", !visibleCaseIds.has(String(row.dataset.testCaseId)));
        });
        updateSelectionUi();
    }

    function setCaseSelected(testCaseId, isSelected) {
        const id = String(testCaseId);
        if (isSelected) selectedCaseIds.add(id);
        else selectedCaseIds.delete(id);
        updateSelectionUi();
    }

    function renderStatusCell(testCaseId) {
        const status = doc.createElement("span");
        const currentStatus = caseStatuses.get(String(testCaseId)) || "";
        status.className = `test-case-status ${currentStatus}`.trim();
        status.dataset.testCaseStatus = String(testCaseId);
        status.textContent = currentStatus ? currentStatus[0].toUpperCase() + currentStatus.slice(1) : "—";
        return status;
    }

    function renderCaseStatus(testCaseId, statusValue) {
        const id = String(testCaseId);
        if (statusValue) caseStatuses.set(id, statusValue);
        else caseStatuses.delete(id);
        const status = testCaseListBody?.querySelector?.(`[data-test-case-status="${id}"]`);
        if (status) {
            status.className = `test-case-status ${statusValue || ""}`.trim();
            status.textContent = statusValue ? statusValue[0].toUpperCase() + statusValue.slice(1) : "—";
        }
    }

    function renderCaseList(nextCases = cases) {
        cases = nextCases;
        selectedCaseIds.clear();
        caseStatuses.clear();
        visibleCaseIds.clear();
        resetBrowserDashboard({clearLogs: true});
        if (!testCaseListBody) return;
        testCaseListBody.replaceChildren();
        cases.forEach((testCase) => {
            const row = doc.createElement("tr");
            row.className = "test-case-row";
            row.dataset.testCaseId = String(testCase.id);
            row.setAttribute("aria-selected", "false");

            const selectionCell = doc.createElement("td");
            selectionCell.className = "selection-column";
            const checkbox = doc.createElement("input");
            checkbox.type = "checkbox";
            checkbox.setAttribute("aria-label", `Select ${testCase.name || testCase.id}`);
            checkbox.addEventListener("change", (event) => {
                setCaseSelected(testCase.id, event.target?.checked ?? checkbox.checked);
            });
            selectionCell.append(checkbox);

            const idCell = doc.createElement("td");
            idCell.textContent = String(testCase.id);

            const nameCell = doc.createElement("td");
            nameCell.textContent = testCase.name || `Test case ${testCase.id}`;

            const detailCell = doc.createElement("td");
            const detailButton = doc.createElement("button");
            detailButton.type = "button";
            detailButton.className = "secondary-button detail-button";
            detailButton.textContent = "Detail";
            detailButton.addEventListener("click", (event) => {
                event.stopPropagation?.();
                openCaseDetails(testCase.id);
            });
            detailCell.append(detailButton);

            const statusCell = doc.createElement("td");
            statusCell.append(renderStatusCell(testCase.id));

            row.append(selectionCell, idCell, nameCell, detailCell, statusCell);
            row.addEventListener?.("click", (event) => {
                if (event.target?.closest?.("button, input, select, textarea")) return;
                selectBrowserLogCase(testCase.id);
            });
            testCaseListBody.append(row);
        });
        applyCaseFilter(testCaseSearchInput?.value || "");
        if (!cases.length && testCaseDetails) {
            testCaseDetails.textContent = "Không có test case nào.";
        }
    }

    function renderField(label, value) {
        const row = doc.createElement("div");
        row.className = "test-case-detail-row";
        const heading = doc.createElement("strong");
        heading.textContent = label;
        const content = doc.createElement("span");
        const displayValue = value === undefined || value === null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
        content.textContent = redactSensitiveText(displayValue);
        row.append(heading, content);
        return row;
    }

    function renderCaseDetails(testCase) {
        if (!testCaseDetails) return;
        testCaseDetails.replaceChildren();
        if (!testCase) {
            testCaseDetails.textContent = "Chọn một test case để xem chi tiết.";
            return;
        }

        const heading = doc.createElement("h3");
        heading.textContent = testCase.name || `Test case ${testCase.id}`;
        testCaseDetails.append(heading);
        [
            ["ID", testCase.id],
            ["Platform", testCase.platform],
            ["Environment", testCase.environment],
            ["Pre-condition", testCase.preCondition],
            ["QA description", testCase.qaDescription],
            ["Expected result", testCase.expectedResult],
            [
                "Metadata",
                testCase.metadata || {
                    category: testCase.category,
                    status: testCase.status,
                    mode: testCase.mode,
                    scriptVersion: testCase.scriptVersion,
                    projectId: testCase.projectId,
                    folderId: testCase.folderId,
                    slug: testCase.slug,
                },
            ],
        ].forEach(([label, value]) => testCaseDetails.append(renderField(label, value)));

        const actionsHeading = doc.createElement("h4");
        actionsHeading.textContent = "Actions";
        testCaseDetails.append(actionsHeading);
        const actionList = doc.createElement("ol");
        actionList.className = "action-preview";
        (testCase.actions || []).forEach((action) => {
            const item = doc.createElement("li");
            item.textContent = formatAction(maskActionForDisplay(action));
            actionList.append(item);
        });
        testCaseDetails.append(actionList);
    }

    function openCaseDetails(testCaseId) {
        const testCase = cases.find((candidate) => String(candidate.id) === String(testCaseId));
        if (!testCase) return;
        if (activePreviewType === "interactive") api.suspendInteractiveBrowser?.();
        renderCaseDetails(testCase);
        openModal(testCaseDetailsModal);
    }

    function selectCase(testCaseId) {
        selectedCase = cases.find((testCase) => String(testCase.id) === String(testCaseId)) || null;
        selectedCaseIds.clear();
        if (selectedCase) selectedCaseIds.add(String(selectedCase.id));
        updateSelectionUi();
        renderCaseDetails(selectedCase);
        setFormMessage("");
    }

    async function loadCases() {
        try {
            const response = await api.loadTestCases();
            if (!response?.ok) throw new Error(response?.message || "Không thể tải test cases.");
            if (response.source === "cache") {
                activeCampaignId = response.campaign?.id !== undefined && response.campaign?.id !== null
                    ? String(response.campaign.id)
                    : "";
                activeCacheKey = String(response.cacheKey || (activeCampaignId ? `campaign:${activeCampaignId}` : response.folder?.id || ""));
                activeFolderId = response.folder?.id !== undefined && response.folder?.id !== null
                    ? String(response.folder.id)
                    : "";
                activeFolderPath = String(response.folder?.fullPath || "");
            } else {
                activeCampaignId = "";
                activeCacheKey = "";
                activeFolderId = "";
                activeFolderPath = "";
            }
            renderCaseList(response.cases || []);
            return response;
        } catch (error) {
            renderCaseList([]);
            setFormMessage(`Không thể tải test cases: ${error.message}`, "error");
            return {ok: false, message: error.message, cases: []};
        }
    }

    function updateFolderControls() {
        if (getTestCasesButton) {
            getTestCasesButton.disabled = !folderSelect?.value || apiRequestDepth > 0;
        }
        if (refreshCampaignsButton) refreshCampaignsButton.disabled = apiRequestDepth > 0;
        if (refreshFoldersButton) refreshFoldersButton.disabled = apiRequestDepth > 0;
        if (campaignSelect) campaignSelect.disabled = apiRequestDepth > 0;
        if (folderSelect) folderSelect.disabled = apiRequestDepth > 0;
    }

    function resetLoadedCaseSource() {
        activeCampaignId = "";
        activeCacheKey = "";
        activeFolderId = "";
        activeFolderPath = "";
        renderCaseList([]);
    }

    async function clearLoadedCaseCache() {
        let response = {ok: true};
        try {
            if (typeof api.clearTestCaseCache === "function") response = await api.clearTestCaseCache();
        } catch (error) {
            response = {ok: false, message: error.message};
        }
        resetLoadedCaseSource();
        if (!response?.ok) showApiError(response);
        return response;
    }

    function renderCampaigns(nextCampaigns = []) {
        campaignsById.clear();
        const selectedId = activeCampaignId || campaignSelect?.value || "";
        if (!campaignSelect) return;
        campaignSelect.replaceChildren();
        const placeholder = doc.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a campaign...";
        campaignSelect.append(placeholder);
        nextCampaigns.forEach((entry) => {
            const campaign = entry?.campaign || entry;
            const id = String(campaign?.id ?? "").trim();
            const name = String(campaign?.name ?? "").trim();
            if (!id || !name) return;
            const normalizedEntry = {
                ...entry,
                campaign: {...campaign, id, name},
            };
            campaignsById.set(id, normalizedEntry);
            const option = doc.createElement("option");
            option.value = id;
            option.textContent = name;
            option.dataset.campaignId = id;
            campaignSelect.append(option);
        });
        campaignSelect.value = campaignsById.has(selectedId) ? selectedId : "";
        updateFolderControls();
    }

    function renderFolders(nextFolders = []) {
        foldersByPath.clear();
        const selectedPath = activeFolderPath || folderSelect?.value || "";
        if (!folderSelect) return;
        folderSelect.replaceChildren();
        const placeholder = doc.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a folder...";
        folderSelect.append(placeholder);
        nextFolders.forEach((folder) => {
            const normalizedFolder = {
                id: folder.id,
                name: String(folder.name ?? ""),
                fullPath: String(folder.fullPath ?? ""),
            };
            foldersByPath.set(normalizedFolder.fullPath, normalizedFolder);
            const option = doc.createElement("option");
            option.value = normalizedFolder.fullPath;
            option.textContent = normalizedFolder.name;
            option.dataset.folderId = String(normalizedFolder.id);
            folderSelect.append(option);
        });
        folderSelect.value = foldersByPath.has(selectedPath) ? selectedPath : "";
        updateFolderControls();
    }

    async function loadFolders({campaignId = String(campaignSelect?.value || "").trim(), resetSelection = false} = {}) {
        const normalizedCampaignId = String(campaignId ?? "").trim();
        const requestSettings = currentSettings();
        if (normalizedCampaignId) requestSettings.CAMPAIGN_ID = normalizedCampaignId;
        else delete requestSettings.CAMPAIGN_ID;
        if (resetSelection) {
            if (folderSelect) folderSelect.value = "";
            renderFolders([]);
        }
        appendApiRequestLog("Load flow-case folders", {
            apiDomain: requestSettings.API_DOMAIN,
            projectId: requestSettings.PROJECT_ID,
            timeoutSeconds: requestSettings.API_TIMEOUT_SECONDS,
            ...(normalizedCampaignId ? {CAMPAIGN_ID: normalizedCampaignId} : {}),
        });
        beginApiRequest();
        try {
            const response = await api.loadFlowCaseFolders(requestSettings);
            appendApiResponseLog("Load flow-case folders", response);
            if (!response?.ok) {
                showApiError(response);
                return response;
            }
            await clearLoadedCaseCache();
            renderFolders(response.folders || []);
            return response;
        } catch (error) {
            const response = {ok: false, message: error.message, timeout: Boolean(error.timeout)};
            appendApiResponseLog("Load flow-case folders", response);
            showApiError(response);
            return response;
        } finally {
            endApiRequest();
            updateFolderControls();
        }
    }

    async function loadCampaigns() {
        const requestSettings = currentSettings();
        const previousCampaignId = String(campaignSelect?.value || "").trim();
        appendApiRequestLog("Load running campaigns", {
            apiDomain: requestSettings.API_DOMAIN,
            projectId: requestSettings.PROJECT_ID,
            timeoutSeconds: requestSettings.API_TIMEOUT_SECONDS,
        });
        beginApiRequest();
        try {
            if (typeof api.loadFlowCaseCampaigns !== "function") {
                const response = {ok: false, message: "Running campaign loading is unavailable."};
                appendApiResponseLog("Load running campaigns", response);
                showApiError(response);
                return response;
            }
            const response = await api.loadFlowCaseCampaigns(requestSettings);
            appendApiResponseLog("Load running campaigns", response);
            if (!response?.ok) {
                showApiError(response);
                return response;
            }
            await clearLoadedCaseCache();
            renderCampaigns(response.campaigns || []);
            if (previousCampaignId && !campaignSelect?.value) {
                resetLoadedCaseSource();
                if (folderSelect) folderSelect.value = "";
                void loadFolders({campaignId: "", resetSelection: true});
            }
            return response;
        } catch (error) {
            const response = {ok: false, message: error.message, timeout: Boolean(error.timeout)};
            appendApiResponseLog("Load running campaigns", response);
            showApiError(response);
            return response;
        } finally {
            endApiRequest();
            updateFolderControls();
        }
    }

    async function loadCasesFromSelection() {
        const selectedCampaign = campaignsById.get(campaignSelect?.value || "");
        const selectedFolder = foldersByPath.get(folderSelect?.value || "");
        if (!selectedFolder) {
            const message = selectedCampaign ? "Please select a folder from the selected campaign first." : "Please select a folder first.";
            setFormMessage(message, "error");
            return {ok: false, message};
        }

        const request = {...currentSettings()};
        delete request.CAMPAIGN_ID;
        delete request.CAMPAIGN_NAME;
        Object.assign(
            request,
            selectedCampaign
                ? {
                      CAMPAIGN_ID: String(selectedCampaign.campaign.id),
                      CAMPAIGN_NAME: String(selectedCampaign.campaign.name || ""),
                  }
                : {},
            {
                FOLDER_ID: String(selectedFolder.id),
                FOLDER_NAME: selectedFolder.fullPath,
                FOLDER_NAME_LABEL: selectedFolder.name,
            },
        );
        resetLoadedCaseSource();
        appendApiRequestLog("Load flow cases", request);
        beginApiRequest();
        try {
            const response = await api.loadFlowCases(request);
            appendApiResponseLog("Load flow cases", response);
            if (!response?.ok) {
                showApiError(response);
                return response;
            }
            activeCampaignId = selectedCampaign ? String(response.campaign?.id ?? selectedCampaign.campaign.id) : "";
            activeCacheKey = String(response.cacheKey || (activeCampaignId ? `campaign:${activeCampaignId}` : response.folder?.id || selectedFolder?.id || ""));
            activeFolderId = response.folder?.id !== undefined && response.folder?.id !== null ? String(response.folder.id) : String(selectedFolder?.id ?? "");
            activeFolderPath = String(response.folder?.fullPath || selectedFolder?.fullPath || "");
            renderCaseList(response.cases || []);
            setFormMessage(`Loaded ${response.cases?.length || 0} test cases.`, "ok");
            return response;
        } catch (error) {
            const response = {ok: false, message: error.message, timeout: Boolean(error.timeout)};
            appendApiResponseLog("Load flow cases", response);
            showApiError(response);
            return response;
        } finally {
            endApiRequest();
            updateFolderControls();
        }
    }

    const loadCasesFromFolder = loadCasesFromSelection;

    function formatAction(action) {
        const values = Object.entries(action)
            .filter(([key]) => key !== "action")
            .map(([key, value]) => `${key}=${value}`)
            .join(", ");
        return values ? `${action.action} (${values})` : action.action;
    }

    function readPreviewType() {
        const input = [...(doc?.querySelectorAll?.('[name="preview-type"]') || [])].find((item) => item.checked);
        return input?.value || activePreviewType;
    }

    function setFormRunning(isRunning) {
        form?.querySelectorAll?.("input, select, textarea").forEach((element) => {
            element.disabled = isRunning;
        });
        if (runButton) runButton.disabled = isRunning || getSelectedCaseIds().length === 0 || (runTarget === "browser" ? !browserToolchainReady : !canRunLg());
        if (stopButton) stopButton.disabled = !isRunning;
    }

    function syncRunTargetControls() {
        if (browserTargetInput) browserTargetInput.checked = runTarget === "browser";
        if (webosTargetInput) webosTargetInput.checked = runTarget === "webos";
        lgDevicePanel?.classList?.toggle("hidden", runTarget !== "webos");
        if (tvDeviceSelect) tvDeviceSelect.disabled = runTarget !== "webos" || tvDevices.length === 0;
        if (tvDeviceAddButton) tvDeviceAddButton.disabled = runTarget !== "webos";
        if (tvDeviceEditButton) tvDeviceEditButton.disabled = runTarget !== "webos" || !tvDeviceSelect?.value;
        if (tvDeviceCheckConnectionButton) tvDeviceCheckConnectionButton.disabled = !canCheckTvDeviceConnection();
        doc?.querySelectorAll?.('[name="preview-type"]').forEach((input) => {
            input.disabled = runTarget !== "browser";
        });
        if (previewTargetStatus) {
            previewTargetStatus.textContent = runTarget === "webos" ? "Preview type is available for the Browser runner only." : "";
            previewTargetStatus.classList.toggle("hidden", runTarget === "browser");
        }
        const browserConfigCtaDiv = doc?.getElementById?.("browser-configuration-cta");
        const shouldShowBrowserCta = runTarget === "browser" && !browserToolchainReady;
        if (browserToolchainRunStatus) {
            browserToolchainRunStatus.textContent = shouldShowBrowserCta ? "Browser tests require the project-pinned Chromium. Configure Browser to continue." : "";
        }
        configureBrowserButton?.classList?.toggle("hidden", !shouldShowBrowserCta);
        if (browserConfigCtaDiv) {
            browserConfigCtaDiv.classList.toggle("hidden", !shouldShowBrowserCta);
        }
        configureLgSdkButton?.classList?.toggle("hidden", runTarget !== "webos" || lgRunAvailability?.status === "READY");
    }

    function lgAvailabilityText(value) {
        const status = String(value?.status || "DEVICE_NOT_FOUND");
        const copy = {
            READY: "LG SDK and selected device are ready.",
            DEVICE_NOT_FOUND: "Select a saved LG device to review readiness.",
            LG_BATCH_INVALID: "Select at least one test case to review LG readiness.",
            TOOLCHAIN_UNAVAILABLE: "Configure SDK before running LG cases.",
            COMPATIBILITY_PROFILE_UNVERIFIED: "This LG device needs a verified compatibility profile.",
            REGISTERED_TARGET_REQUIRED: "This LG device needs a registered local target.",
            SAVED_CONNECTION_REQUIRED: "This LG device needs its saved connection.",
            ACTION_CAPABILITY_UNSUPPORTED: "A selected case is not supported for LG execution.",
        };
        return copy[status] || "LG execution is unavailable for the selected device.";
    }

    async function refreshLgRunAvailability() {
        if (runTarget !== "webos") return {ok: false, status: "DEVICE_NOT_FOUND"};
        const deviceId = String(tvDeviceSelect?.value || "");
        const selectedCaseIds = getSelectedCaseIds();
        if (!deviceId) {
            lgRunAvailability = {ok: false, status: "DEVICE_NOT_FOUND"};
        } else if (typeof api?.getLgRunAvailability !== "function") {
            lgRunAvailability = {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } else {
            try {
                const sourceRequest = activeCampaignId && activeCacheKey ? {cacheKey: activeCacheKey} : activeFolderId ? {folderId: activeFolderId} : {};
                lgRunAvailability = (await api.getLgRunAvailability({deviceId, selectedCaseIds, ...sourceRequest})) || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
            } catch {
                lgRunAvailability = {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
            }
        }
        if (lgRunAvailabilityElement) lgRunAvailabilityElement.textContent = lgAvailabilityText(lgRunAvailability);
        syncRunTargetControls();
        updateSelectionUi({refreshLg: false});
        return lgRunAvailability;
    }

    function resetTvDeviceConnectionStatus() {
        if (tvDeviceConnectionStatus) tvDeviceConnectionStatus.textContent = "Connection not checked";
        tvDeviceConnectionDot?.classList?.remove("checking", "connected", "unavailable");
        tvDeviceConnectionDot?.classList?.add("not-checked");
        if (tvDeviceCheckConnectionButton) tvDeviceCheckConnectionButton.disabled = !canCheckTvDeviceConnection();
    }

    function canCheckTvDeviceConnection() {
        return runTarget === "webos" && Boolean(tvDeviceSelect?.value) && typeof api?.checkTvDeviceConnection === "function";
    }

    function renderTvDeviceConnectionStatus(response) {
        const connected = response?.ok === true && response?.status === "CONNECTED";
        if (tvDeviceConnectionStatus) tvDeviceConnectionStatus.textContent = connected ? "Connected" : "Connection unavailable";
        tvDeviceConnectionDot?.classList?.remove("not-checked", "checking", "connected", "unavailable");
        tvDeviceConnectionDot?.classList?.add(connected ? "connected" : "unavailable");
    }

    async function checkTvDeviceConnection() {
        if (!canCheckTvDeviceConnection()) return {ok: false, status: "DEVICE_NOT_FOUND"};
        const deviceId = String(tvDeviceSelect.value || "");
        if (tvDeviceCheckConnectionButton) tvDeviceCheckConnectionButton.disabled = true;
        if (tvDeviceConnectionStatus) tvDeviceConnectionStatus.textContent = "Checking connection…";
        tvDeviceConnectionDot?.classList?.remove("not-checked", "connected", "unavailable");
        tvDeviceConnectionDot?.classList?.add("checking");
        try {
            const response = await api.checkTvDeviceConnection(deviceId);
            if (String(tvDeviceSelect?.value || "") === deviceId) renderTvDeviceConnectionStatus(response);
            return response || {ok: false, status: "CONNECTION_UNAVAILABLE"};
        } catch {
            const response = {ok: false, status: "CONNECTION_UNAVAILABLE"};
            if (String(tvDeviceSelect?.value || "") === deviceId) renderTvDeviceConnectionStatus(response);
            return response;
        } finally {
            if (String(tvDeviceSelect?.value || "") === deviceId && tvDeviceCheckConnectionButton) {
                tvDeviceCheckConnectionButton.disabled = !canCheckTvDeviceConnection();
            }
        }
    }

    function renderTvDevices() {
        if (!tvDeviceSelect || !doc?.createElement) return;
        const options = tvDevices.map((device) => {
            const option = doc.createElement("option");
            option.value = String(device.id || "");
            option.textContent = String(device.label || device.id || "Saved LG device");
            return option;
        });
        if (!options.length) {
            const option = doc.createElement("option");
            option.value = "";
            option.textContent = "No saved LG device";
            options.push(option);
        }
        const selectedDeviceId = String(tvDeviceSelect.value || "");
        tvDeviceSelect.replaceChildren(...options);
        tvDeviceSelect.value = tvDevices.some((device) => String(device.id || "") === selectedDeviceId) ? selectedDeviceId : options[0].value;
        resetTvDeviceConnectionStatus();
        syncRunTargetControls();
    }

    async function loadTvDevices() {
        if (typeof api.listTvDevices !== "function") {
            tvDevices = [];
            renderTvDevices();
            if (tvDeviceStatus) tvDeviceStatus.textContent = "LG device management is unavailable.";
            return;
        }
        const response = await api.listTvDevices();
        if (!response?.ok) {
            tvDevices = [];
            renderTvDevices();
            if (tvDeviceStatus) tvDeviceStatus.textContent = response?.message || "Could not load saved LG devices.";
            return;
        }
        tvDevices = Array.isArray(response.devices) ? response.devices.filter((device) => device?.platform === "webos") : [];
        renderTvDevices();
        if (tvDeviceStatus) {
            tvDeviceStatus.textContent = tvDevices.length ? "Select a saved LG device and test case. Run is enabled only after the main-process LG readiness review reports Ready." : "No saved LG device is available.";
        }
    }

    function clearTvDeviceDialog() {
        if (tvDeviceNameInput) tvDeviceNameInput.value = "";
        if (tvDeviceHostInput) tvDeviceHostInput.value = "";
        if (tvDevicePassphraseInput) {
            tvDevicePassphraseInput.value = "";
            tvDevicePassphraseInput.setAttribute?.("type", "password");
        }
        if (tvDevicePassphraseToggle) tvDevicePassphraseToggle.textContent = "Show";
        if (tvDeviceDialogStatus) tvDeviceDialogStatus.textContent = "";
    }

    function openTvDeviceDialog(mode) {
        deviceDialogMode = mode === "edit" ? "edit" : "add";
        editingDeviceId = deviceDialogMode === "edit" ? String(tvDeviceSelect?.value || "") : "";
        clearTvDeviceDialog();
        const selected = tvDevices.find((device) => String(device?.id || "") === editingDeviceId);
        if (deviceDialogMode === "edit" && selected && tvDeviceNameInput) tvDeviceNameInput.value = String(selected.label || "");
        if (tvDeviceDialogTitle) tvDeviceDialogTitle.textContent = deviceDialogMode === "edit" ? "Edit LG device" : "Add LG device";
        openModal(tvDeviceDialog);
    }

    function closeTvDeviceDialog() {
        clearTvDeviceDialog();
        editingDeviceId = "";
        closeModal(tvDeviceDialog);
    }

    function toggleTvDevicePassphrase() {
        if (!tvDevicePassphraseInput) return;
        const revealed = tvDevicePassphraseInput.getAttribute?.("type") === "text";
        tvDevicePassphraseInput.setAttribute?.("type", revealed ? "password" : "text");
        if (tvDevicePassphraseToggle) tvDevicePassphraseToggle.textContent = revealed ? "Show" : "Hide";
    }

    async function submitTvDeviceDialog() {
        if (typeof api.validateAndSaveTvDevice !== "function") return {ok: false, status: "VALIDATION_UNAVAILABLE"};
        const candidate = {
            ...(editingDeviceId ? {deviceId: editingDeviceId} : {}),
            label: String(tvDeviceNameInput?.value || "").trim(),
            host: String(tvDeviceHostInput?.value || "").trim(),
            passphrase: String(tvDevicePassphraseInput?.value || ""),
        };
        if (tvDeviceDialogSubmitButton) tvDeviceDialogSubmitButton.disabled = true;
        try {
            const response = await api.validateAndSaveTvDevice(candidate);
            if (!response?.ok || !response.device) {
                if (tvDeviceDialogStatus) tvDeviceDialogStatus.textContent = response?.status === "VALIDATION_UNAVAILABLE" ? "Connection validation is not available in this build." : "Connection validation did not complete. No device was saved.";
                return response || {ok: false, status: "VALIDATION_FAILED"};
            }
            await loadTvDevices();
            if (tvDeviceSelect) tvDeviceSelect.value = String(response.device.id || "");
            if (tvDeviceStatus) tvDeviceStatus.textContent = "LG device saved after verified validation.";
            closeTvDeviceDialog();
            return response;
        } catch {
            if (tvDeviceDialogStatus) tvDeviceDialogStatus.textContent = "Connection validation did not complete. No device was saved.";
            return {ok: false, status: "VALIDATION_FAILED"};
        } finally {
            if (tvDeviceDialogSubmitButton) tvDeviceDialogSubmitButton.disabled = false;
        }
    }

    async function inspectTvToolchain() {
        if (typeof api.inspectTvToolchain !== "function") {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "The local LG toolchain inspector is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        try {
            const response = await api.inspectTvToolchain();
            if (tvToolchainStatus) {
                tvToolchainStatus.textContent = Array.isArray(response?.tools) ? toolchainStatusText(response, "The local LG toolchain inspector is unavailable.") : response?.message || "The local LG toolchain inspector is unavailable.";
            }
            return response || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } catch {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "The local LG toolchain inspector is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
    }

    async function planLgToolchainSetup() {
        if (typeof api.planLgToolchainSetup !== "function") {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Local LG setup review is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        if (sdkAutoConfigureButton) sdkAutoConfigureButton.disabled = true;
        try {
            const response = await api.planLgToolchainSetup();
            renderSdkComponentList(response);
            renderSdkInstallReview(response?.ok ? (response.state === "ready" ? "Review complete. All reviewed components are already verified locally." : "Review complete. Nothing is installed until you confirm.") : "Local LG setup review is unavailable.");
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = "";
            if (sdkInstallConfirmButton) sdkInstallConfirmButton.disabled = !(response?.ok && response.state !== "ready");
            return response || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } catch {
            renderSdkInstallReview("Local LG setup review is unavailable.");
            if (sdkInstallConfirmButton) sdkInstallConfirmButton.disabled = true;
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } finally {
            if (sdkAutoConfigureButton) sdkAutoConfigureButton.disabled = false;
        }
    }

    async function installLgToolchain() {
        if (typeof api.installLgToolchain !== "function") {
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = "Local LG installation is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        if (sdkInstallConfirmButton) sdkInstallConfirmButton.disabled = true;
        resetSdkInstallProgress();
        renderSdkInstallProgress({code: "preparing"});
        try {
            const response = await api.installLgToolchain({
                confirmed: true,
                deviceId: String(tvDeviceSelect?.value || ""),
            });
            if (response?.ok) renderSdkComponentList(response);
            renderSdkInstallReview(response?.ok ? "Installation completed. Review the component status above." : lgInstallationFailureText(response?.status, response?.verification));
            renderSdkInstallProgress(response?.ok ? {code: "complete"} : {code: "failed", status: response?.status});
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = "";
            return response || {ok: false, status: "INSTALL_FAILED"};
        } catch {
            renderSdkInstallProgress({code: "failed", status: "INSTALL_FAILED"});
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = "Local LG installation did not complete.";
            return {ok: false, status: "INSTALL_FAILED"};
        }
    }

    async function loadLgToolchainStatus() {
        if (typeof api.getLgToolchainStatus !== "function") {
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = "Local LG managed availability is unavailable.";
            if (sdkUseManagedButton) sdkUseManagedButton.disabled = true;
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        try {
            const response = await api.getLgToolchainStatus();
            renderSdkComponentList(response);
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = response?.ok ? "" : "Local LG managed availability is unavailable.";
            if (sdkUseManagedButton) sdkUseManagedButton.disabled = !(response?.ok && response.state === "ready");
            return response || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } catch {
            if (sdkManagedToolchainStatus) sdkManagedToolchainStatus.textContent = "Local LG managed availability is unavailable.";
            if (sdkUseManagedButton) sdkUseManagedButton.disabled = true;
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
    }

    async function activateManagedLgToolchain() {
        if (typeof api.activateManagedLgToolchain !== "function") {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Verified managed LG tools are unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        if (sdkUseManagedButton) sdkUseManagedButton.disabled = true;
        try {
            const response = await api.activateManagedLgToolchain();
            if (tvToolchainStatus) {
                tvToolchainStatus.textContent = response?.ok ? `Selected source: Managed local tools. ${toolchainStatusText(response, "Ready.")}` : "Verified managed LG tools are unavailable.";
            }
            return response || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } catch {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Verified managed LG tools are unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
    }

    async function loadSdkToolchainStatus() {
        const configuration = await loadTvToolchainConfiguration();
        const managed = await loadLgToolchainStatus();
        const catalog = await loadLgCompatibilityCatalogStatus();
        const productGate = await loadLgCompatibilityProductGateStatus();
        return {configuration, managed, catalog, productGate};
    }

    function compatibilityProductGateStatusText(status) {
        const messages = {
            LG_COMPATIBILITY_CREDENTIALS_REQUIRED: "Set the local compatibility account before validation.",
            LG_COMPATIBILITY_CREDENTIALS_INVALID: "Enter both compatibility account fields before saving.",
            LG_COMPATIBILITY_CREDENTIALS_SAVED: "Compatibility account saved locally with encryption.",
            LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE: "The encrypted local compatibility account is unavailable.",
        };
        return messages[status] || "The encrypted local compatibility account is unavailable.";
    }

    async function loadLgCompatibilityProductGateStatus() {
        if (typeof api.getLgCompatibilityProductGateStatus !== "function") {
            if (lgCompatibilityProductGateStatus) lgCompatibilityProductGateStatus.textContent = compatibilityProductGateStatusText("LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE");
            return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
        }
        try {
            const response = await api.getLgCompatibilityProductGateStatus();
            if (lgCompatibilityProductGateStatus) lgCompatibilityProductGateStatus.textContent = compatibilityProductGateStatusText(response?.status);
            return response || {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
        } catch {
            if (lgCompatibilityProductGateStatus) lgCompatibilityProductGateStatus.textContent = compatibilityProductGateStatusText("LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE");
            return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
        }
    }

    async function saveLgCompatibilityProductGateCredentials() {
        if (typeof api.saveLgCompatibilityProductGateCredentials !== "function") {
            if (lgCompatibilityProductGateStatus) lgCompatibilityProductGateStatus.textContent = compatibilityProductGateStatusText("LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE");
            return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
        }
        const request = {
            username: String(lgCompatibilityProductGateUsernameInput?.value || "").trim(),
            password: String(lgCompatibilityProductGatePasswordInput?.value || ""),
        };
        if (lgCompatibilityProductGateSaveButton) lgCompatibilityProductGateSaveButton.disabled = true;
        try {
            const response = await api.saveLgCompatibilityProductGateCredentials(request);
            if (lgCompatibilityProductGateUsernameInput) lgCompatibilityProductGateUsernameInput.value = "";
            if (lgCompatibilityProductGatePasswordInput) lgCompatibilityProductGatePasswordInput.value = "";
            if (lgCompatibilityProductGateStatus) lgCompatibilityProductGateStatus.textContent = compatibilityProductGateStatusText(response?.status);
            return response || {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
        } catch {
            if (lgCompatibilityProductGateUsernameInput) lgCompatibilityProductGateUsernameInput.value = "";
            if (lgCompatibilityProductGatePasswordInput) lgCompatibilityProductGatePasswordInput.value = "";
            if (lgCompatibilityProductGateStatus) lgCompatibilityProductGateStatus.textContent = compatibilityProductGateStatusText("LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE");
            return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
        } finally {
            if (lgCompatibilityProductGateSaveButton) lgCompatibilityProductGateSaveButton.disabled = false;
        }
    }

    function compatibilityCatalogStatusText(response) {
        if (response?.ok && response.state === "available") {
            const count = Number(response.profileCount) || 0;
            const profileText = `${count} ${count === 1 ? "profile" : "profiles"}`;
            return response.source === "cached" ? `Compatibility catalog available: ${profileText}. Updated locally.` : `Compatibility catalog available: ${profileText}. Using the bundled catalog.`;
        }
        if (response?.status === "CATALOG_REFRESH_UNAVAILABLE") return "Compatibility catalog update needs the configured API authorization.";
        if (response?.status === "CATALOG_INVALID") return "Compatibility catalog update was not accepted. The existing catalog is unchanged.";
        return "Compatibility catalog could not be updated. The existing catalog is unchanged.";
    }

    async function loadLgCompatibilityCatalogStatus() {
        if (typeof api.getLgCompatibilityCatalogStatus !== "function") {
            if (sdkCompatibilityCatalogStatus) sdkCompatibilityCatalogStatus.textContent = "Compatibility catalog status is unavailable.";
            return {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"};
        }
        try {
            const response = await api.getLgCompatibilityCatalogStatus();
            if (sdkCompatibilityCatalogStatus) sdkCompatibilityCatalogStatus.textContent = compatibilityCatalogStatusText(response);
            return response || {ok: false, status: "CATALOG_REFRESH_FAILED"};
        } catch {
            if (sdkCompatibilityCatalogStatus) sdkCompatibilityCatalogStatus.textContent = "Compatibility catalog status is unavailable.";
            return {ok: false, status: "CATALOG_REFRESH_FAILED"};
        }
    }

    async function refreshLgCompatibilityCatalog() {
        if (typeof api.refreshLgCompatibilityCatalog !== "function") {
            if (sdkCompatibilityCatalogStatus) sdkCompatibilityCatalogStatus.textContent = "Compatibility catalog update is unavailable.";
            return {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"};
        }
        if (sdkCompatibilityCatalogRefreshButton) sdkCompatibilityCatalogRefreshButton.disabled = true;
        try {
            const current = currentSettings();
            const response = await api.refreshLgCompatibilityCatalog({
                apiDomain: current.API_DOMAIN,
                authorization: current.API_AUTHORIZATION,
                timeoutMs: Number(current.API_TIMEOUT_SECONDS) * 1000,
            });
            if (sdkCompatibilityCatalogStatus) sdkCompatibilityCatalogStatus.textContent = compatibilityCatalogStatusText(response);
            return response || {ok: false, status: "CATALOG_REFRESH_FAILED"};
        } catch {
            if (sdkCompatibilityCatalogStatus) sdkCompatibilityCatalogStatus.textContent = "Compatibility catalog could not be updated. The existing catalog is unchanged.";
            return {ok: false, status: "CATALOG_REFRESH_FAILED"};
        } finally {
            if (sdkCompatibilityCatalogRefreshButton) sdkCompatibilityCatalogRefreshButton.disabled = false;
        }
    }

    function compatibilityStatusText(value) {
        const status = typeof value === "string" ? value : value?.status;
        const failedAction = typeof value === "object" && value ? String(value.failedAction || "").trim() : "";
        const failureCode = typeof value === "object" && value ? String(value.failureCode || "").trim() : "";
        const appiumFailureCode = typeof value === "object" && value ? String(value.appiumFailureCode || "").trim() : "";
        const failureStage = typeof value === "object" && value ? String(value.failureStage || "").trim() : "";
        const failedActionMessages = {
            wait_for_ready: "The compatibility readiness step did not pass. The temporary setup was removed.",
            login: "The compatibility login step did not pass. The temporary setup was removed.",
            open_home: "The compatibility home step did not pass. The temporary setup was removed.",
            open_search: "The compatibility search page did not open. The temporary setup was removed.",
            search_content: "The compatibility search step did not pass. The temporary setup was removed.",
            play_search_result: "The compatibility playback step did not pass. The temporary setup was removed.",
            press_ok: "The compatibility OK step did not pass. The temporary setup was removed.",
            press_back: "The compatibility back step did not pass. The temporary setup was removed.",
            assert_screen: "The compatibility screen check did not pass. The temporary setup was removed.",
            logout_cleanup: "The compatibility cleanup step did not pass. The temporary setup was removed.",
        };
        const failedCodeMessages = {
            SESSION_UNAVAILABLE: "The compatibility session could not start. The temporary setup was removed.",
            DOM_INSPECTION_UNAVAILABLE: "The compatibility session could not inspect the device. The temporary setup was removed.",
            VISUAL_CAPTURE_UNAVAILABLE: "The compatibility session could not capture a genuine Appium screenshot. The temporary setup was removed.",
            TV_CLEANUP_FAILED: "The compatibility cleanup did not complete. The temporary setup was removed.",
        };
        const appiumFailureMessages = {
            APPIUM_CAPABILITY_APP_ID: "The compatibility setup rejected the LG appId capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_APP_LAUNCH_PARAMS: "The compatibility setup rejected the LG appLaunchParams capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_AUTO_EXTEND_DEV_MODE: "The compatibility setup rejected the LG autoExtendDevMode capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_AUTOMATION_NAME: "The compatibility setup rejected the LG automationName capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_CHROMEDRIVER_EXECUTABLE: "The compatibility setup rejected the LG chromedriverExecutable capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_DEVICE_HOST: "The compatibility setup rejected the LG deviceHost capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_DEVICE_NAME: "The compatibility setup rejected the LG deviceName capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_FULL_RESET: "The compatibility setup rejected the LG fullReset capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_NO_RESET: "The compatibility setup rejected the LG noReset capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_PLATFORM_NAME: "The compatibility setup rejected the LG platformName capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_RC_MODE: "The compatibility setup rejected the LG rcMode capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_REMOTE_ONLY: "The compatibility setup rejected the LG remoteOnly capability. The temporary setup was removed.",
            APPIUM_CAPABILITY_USE_SECURE_WEBSOCKET: "The compatibility setup rejected the LG useSecureWebsocket capability. The temporary setup was removed.",
            APPIUM_CAPABILITIES: "The compatibility setup rejected the LG Appium capabilities. The temporary setup was removed.",
            APPIUM_CHROMEDRIVER: "The compatibility setup could not start the verified ChromeDriver. The temporary setup was removed.",
            APPIUM_DEVICE_CONNECTION: "The compatibility setup could not connect the LG Appium session to the device. The temporary setup was removed.",
            APPIUM_DRIVER: "The compatibility setup could not resolve the LG Appium driver. The temporary setup was removed.",
            APPIUM_SESSION: "The compatibility setup could not create the LG Appium session. The temporary setup was removed.",
        };
        const failedStageMessages = {
            "attempt-claim": "The compatibility review expired before validation could begin. Start a new inspection.",
            "temporary-driver-create": "The compatibility check could not create a temporary ChromeDriver workspace. The temporary setup was removed.",
            "chromedriver-download": "The compatibility check could not download the verified temporary ChromeDriver. The temporary setup was removed.",
            "chromedriver-archive-verify": "The compatibility check could not verify the downloaded ChromeDriver archive. The temporary setup was removed.",
            "chromedriver-extract": "The compatibility check could not extract the verified temporary ChromeDriver. The temporary setup was removed.",
            "chromedriver-binary-verify": "The compatibility check could not verify the extracted ChromeDriver binary. The temporary setup was removed.",
            "target-acquire": "The compatibility check could not recreate the temporary LG target. The temporary setup was removed.",
            "identity-check": "The compatibility check could not reread the LG device identity. The temporary setup was removed.",
            "case-run": "The built-in compatibility case failed before a runner stage was reported. The temporary setup was removed.",
            "preflight-ready": "The compatibility setup failed before the temporary Appium session started. The temporary setup was removed.",
            "appium-started": "The compatibility setup failed while starting the temporary Appium session. The temporary setup was removed.",
            "session-creating": "The compatibility setup failed while creating the temporary Appium session. The temporary setup was removed.",
            "session-starting": "The compatibility setup failed while starting the temporary Appium session. The temporary setup was removed.",
            "session-started": "The compatibility setup failed after the session started but before the case began. The temporary setup was removed.",
            "case-started": "The compatibility case failed before any step was reported. The temporary setup was removed.",
            "case-finished": "The compatibility case finished but the overall validation still failed. The temporary setup was removed.",
        };
        const messages = {
            INSPECTION_INPUT_INVALID: "Enter a device name, host, and passphrase before reviewing inspection.",
            CONNECTION_UNAVAILABLE: "The device inspection could not connect. Nothing was saved.",
            INSPECTION_FAILED: "The device inspection did not complete. Nothing was saved.",
            COMPATIBILITY_PROFILE_UNVERIFIED: "This device does not have a verified compatibility profile. Ask a maintainer to validate this model and firmware combination.",
            COMPATIBILITY_VERIFIED: "Compatibility profile verified. Review the built-in product-gate validation.",
            LG_COMPATIBILITY_CREDENTIALS_REQUIRED: "Set the local compatibility account in SDK configuration before validation.",
            LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE: "The encrypted local compatibility account is unavailable.",
            LG_COMPATIBILITY_CASE_UNSUPPORTED: "The built-in LG compatibility case is not supported by the current adapter.",
            ATTEMPT_NOT_FOUND: "This compatibility review expired. Start a new inspection.",
            TEMPORARY_DRIVER_UNAVAILABLE: "The verified temporary ChromeDriver could not be prepared.",
            DEVICE_IDENTITY_MISMATCH: "The device identity changed after inspection. Start a new inspection.",
            VALIDATION_PASSED: "Compatibility validation passed for the selected case.",
            VALIDATION_FAILED: "Compatibility validation did not pass. The temporary setup was removed.",
        };
        if (status === "VALIDATION_FAILED" && failedActionMessages[failedAction]) return failedActionMessages[failedAction];
        if (status === "VALIDATION_FAILED" && appiumFailureMessages[appiumFailureCode]) return appiumFailureMessages[appiumFailureCode];
        if (status === "VALIDATION_FAILED" && failedCodeMessages[failureCode]) return failedCodeMessages[failureCode];
        if (status === "VALIDATION_FAILED" && failedStageMessages[failureStage]) return failedStageMessages[failureStage];
        return messages[status] || "Compatibility check is unavailable. Nothing was saved.";
    }

    function setLgCompatibilityStatus(status) {
        if (lgCompatibilityDialogStatus) lgCompatibilityDialogStatus.textContent = compatibilityStatusText(status);
    }

    function setLgCompatibilityControls() {
        const inspecting = lgCompatibilityPhase === "inspect-confirmation";
        const inspected = lgCompatibilityPhase === "inspected";
        const validating = lgCompatibilityPhase === "validation-confirmation";
        lgCompatibilityInspectionReviewButton?.classList.toggle("hidden", inspecting || inspected || validating || lgCompatibilityPhase === "result");
        lgCompatibilityInspectionConfirmButton?.classList.toggle("hidden", !inspecting);
        lgCompatibilityValidationReviewButton?.classList.toggle("hidden", !inspected);
        lgCompatibilityValidationConfirmButton?.classList.toggle("hidden", !validating);
    }

    function clearLgCompatibilityDialog() {
        activeLgCompatibilityAttemptId = "";
        lgCompatibilityPhase = "editing";
        if (lgCompatibilityNameInput) lgCompatibilityNameInput.value = "";
        if (lgCompatibilityHostInput) lgCompatibilityHostInput.value = "";
        if (lgCompatibilityPassphraseInput) lgCompatibilityPassphraseInput.value = "";
        if (lgCompatibilityDialogStatus) lgCompatibilityDialogStatus.textContent = "";
        setLgCompatibilityControls();
    }

    function openLgCompatibilityDialog() {
        clearLgCompatibilityDialog();
        openModal(lgCompatibilityDialog);
    }

    function reviewLgCompatibilityInspection() {
        const label = String(lgCompatibilityNameInput?.value || "").trim();
        const host = String(lgCompatibilityHostInput?.value || "").trim();
        const passphrase = String(lgCompatibilityPassphraseInput?.value || "");
        if (!label || !host || !passphrase) {
            setLgCompatibilityStatus("INSPECTION_INPUT_INVALID");
            return false;
        }
        lgCompatibilityPhase = "inspect-confirmation";
        if (lgCompatibilityDialogStatus) lgCompatibilityDialogStatus.textContent = "Confirm inspection to create a temporary local target and read the device model and firmware. This does not run a test.";
        setLgCompatibilityControls();
        return true;
    }

    async function confirmLgCompatibilityInspection() {
        if (lgCompatibilityPhase !== "inspect-confirmation") return {ok: false, status: "INSPECTION_CONFIRMATION_REQUIRED"};
        if (typeof api.inspectLgCompatibilityDevice !== "function") {
            setLgCompatibilityStatus("INSPECTION_FAILED");
            return {ok: false, status: "INSPECTION_FAILED"};
        }
        const request = {
            confirmed: true,
            label: String(lgCompatibilityNameInput?.value || "").trim(),
            host: String(lgCompatibilityHostInput?.value || "").trim(),
            passphrase: String(lgCompatibilityPassphraseInput?.value || ""),
        };
        if (lgCompatibilityInspectionConfirmButton) lgCompatibilityInspectionConfirmButton.disabled = true;
        try {
            const response = await api.inspectLgCompatibilityDevice(request);
            if (lgCompatibilityHostInput) lgCompatibilityHostInput.value = "";
            if (lgCompatibilityPassphraseInput) lgCompatibilityPassphraseInput.value = "";
            if (response?.ok && response.status === "COMPATIBILITY_VERIFIED" && typeof response.attemptId === "string") {
                activeLgCompatibilityAttemptId = response.attemptId;
                lgCompatibilityPhase = "inspected";
            } else {
                lgCompatibilityPhase = "editing";
            }
            setLgCompatibilityStatus(response?.status);
            setLgCompatibilityControls();
            return response || {ok: false, status: "INSPECTION_FAILED"};
        } catch {
            if (lgCompatibilityHostInput) lgCompatibilityHostInput.value = "";
            if (lgCompatibilityPassphraseInput) lgCompatibilityPassphraseInput.value = "";
            lgCompatibilityPhase = "editing";
            setLgCompatibilityStatus("INSPECTION_FAILED");
            setLgCompatibilityControls();
            return {ok: false, status: "INSPECTION_FAILED"};
        } finally {
            if (lgCompatibilityInspectionConfirmButton) lgCompatibilityInspectionConfirmButton.disabled = false;
        }
    }

    function reviewLgCompatibilityValidation() {
        if (!activeLgCompatibilityAttemptId) {
            setLgCompatibilityStatus("ATTEMPT_NOT_FOUND");
            return false;
        }
        lgCompatibilityPhase = "validation-confirmation";
        if (lgCompatibilityDialogStatus) lgCompatibilityDialogStatus.textContent = "Confirm the built-in MyTV product-gate case. It will run once with the verified temporary driver and then remove all temporary resources.";
        setLgCompatibilityControls();
        return true;
    }

    async function confirmLgCompatibilityValidation() {
        if (lgCompatibilityPhase !== "validation-confirmation") return {ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED"};
        if (!activeLgCompatibilityAttemptId || typeof api.runLgCompatibilityValidation !== "function") {
            lgCompatibilityPhase = "inspected";
            setLgCompatibilityStatus("ATTEMPT_NOT_FOUND");
            setLgCompatibilityControls();
            return {ok: false, status: "ATTEMPT_NOT_FOUND"};
        }
        if (lgCompatibilityValidationConfirmButton) lgCompatibilityValidationConfirmButton.disabled = true;
        try {
            const response = await api.runLgCompatibilityValidation({
                confirmed: true,
                attemptId: activeLgCompatibilityAttemptId,
            });
            lgCompatibilityPhase = "result";
            setLgCompatibilityStatus(response);
            setLgCompatibilityControls();
            return response || {ok: false, status: "VALIDATION_FAILED"};
        } catch {
            lgCompatibilityPhase = "result";
            setLgCompatibilityStatus("VALIDATION_FAILED");
            setLgCompatibilityControls();
            return {ok: false, status: "VALIDATION_FAILED"};
        } finally {
            if (lgCompatibilityValidationConfirmButton) lgCompatibilityValidationConfirmButton.disabled = false;
        }
    }

    async function closeLgCompatibilityDialog() {
        const attemptId = activeLgCompatibilityAttemptId;
        clearLgCompatibilityDialog();
        closeModal(lgCompatibilityDialog);
        if (attemptId && typeof api.discardLgCompatibilityAttempt === "function") {
            try {
                await api.discardLgCompatibilityAttempt({attemptId});
            } catch {
                // Main-process discard is idempotent and no cleanup detail is renderer-visible.
            }
        }
    }

    function renderBrowserComponentList(response) {
        if (!browserComponentList) return;
        const component = response?.component;
        browserComponentList.replaceChildren();
        if (!component) {
            const empty = doc.createElement("p");
            empty.className = "field-note";
            empty.textContent = "Browser component status is unavailable.";
            browserComponentList.append(empty);
            return;
        }
        const ready = component.status === "ready";
        const row = doc.createElement("article");
        row.className = "sdk-component-row";
        const identity = doc.createElement("div");
        identity.className = "sdk-component-identity";
        const name = doc.createElement("strong");
        name.textContent = String(component.label || "Playwright Chromium");
        const version = doc.createElement("span");
        version.className = "sdk-component-version";
        version.textContent = component.version ? `Version ${component.version}` : "Project-pinned version";
        identity.append(name, version);
        const detail = doc.createElement("div");
        detail.className = "sdk-component-detail";
        const badge = doc.createElement("span");
        badge.className = `sdk-component-badge ${ready ? "ready" : "missing"}`;
        badge.textContent = ready ? "Ready" : "Missing";
        const guidance = doc.createElement("span");
        guidance.className = "sdk-component-guidance";
        guidance.textContent = ready ? "Verified in private app storage." : "Install the reviewed project-pinned Chromium.";
        detail.append(badge, guidance);
        row.append(identity, detail);
        browserComponentList.append(row);
    }

    function renderBrowserInstallReview(message) {
        if (!browserInstallReview) return;
        browserInstallReview.textContent = String(message || "");
        browserInstallReview.classList.toggle("hidden", !message);
    }

    function renderBrowserInstallProgress(event) {
        if (!browserInstallProgress || !browserInstallProgressText || !browserInstallProgressSteps || !event || browserInstallProgressDismissed) return;
        const code = typeof event.code === "string" ? event.code : "";
        const stepIndex = BROWSER_INSTALL_PROGRESS_STEPS.findIndex((step) => step.code === code);
        const isFailure = code === "failed" && BROWSER_INSTALL_FAILURE_STATUSES.has(event.status);
        if (stepIndex < 0 && !isFailure) return;
        browserInstallProgress.classList.remove("hidden", "attention", "complete");
        if (isFailure) {
            browserInstallProgress.classList.add("attention");
            browserInstallProgressText.textContent = "Installation stopped. Chromium was not activated.";
        } else {
            activeBrowserInstallStepIndex = stepIndex;
            if (code === "complete") browserInstallProgress.classList.add("complete");
            browserInstallProgressText.textContent = BROWSER_INSTALL_PROGRESS_STEPS[stepIndex].label;
        }
        const progressBar = browserInstallProgress.querySelector?.(".sdk-install-progress-bar");
        progressBar?.setAttribute?.("aria-valuetext", browserInstallProgressText.textContent);
        progressBar?.setAttribute?.("aria-valuenow", String(Math.max(0, activeBrowserInstallStepIndex + 1)));
        const activeIndex = isFailure ? Math.max(0, activeBrowserInstallStepIndex) : stepIndex;
        browserInstallProgressSteps.replaceChildren(
            ...BROWSER_INSTALL_PROGRESS_STEPS.map((step, index) => {
                const row = doc.createElement("li");
                row.textContent = step.label;
                row.className = index < activeIndex ? "complete" : index === activeIndex ? "current" : "pending";
                return row;
            }),
        );
    }

    function resetBrowserInstallProgress({dismiss = false} = {}) {
        browserInstallProgressDismissed = dismiss;
        activeBrowserInstallStepIndex = -1;
        if (!browserInstallProgress || !browserInstallProgressText || !browserInstallProgressSteps) return;
        browserInstallProgress.classList.add("hidden");
        browserInstallProgress.classList.remove("attention", "complete");
        browserInstallProgressText.textContent = "";
        browserInstallProgressSteps.replaceChildren();
        const progressBar = browserInstallProgress.querySelector?.(".sdk-install-progress-bar");
        progressBar?.removeAttribute?.("aria-valuenow");
        progressBar?.setAttribute?.("aria-valuetext", "Preparing");
    }

    async function loadBrowserToolchainStatus() {
        if (typeof api.getBrowserToolchainStatus !== "function") {
            browserToolchainReady = false;
            renderBrowserComponentList();
            syncRunTargetControls();
            updateSelectionUi();
            return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        }
        try {
            const response = await api.getBrowserToolchainStatus();
            browserToolchainReady = Boolean(response?.ok && response.state === "ready");
            renderBrowserComponentList(response);
            syncRunTargetControls();
            updateSelectionUi();
            return response || {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        } catch {
            browserToolchainReady = false;
            renderBrowserComponentList();
            syncRunTargetControls();
            updateSelectionUi();
            return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        }
    }

    async function planBrowserToolchainSetup() {
        if (typeof api.planBrowserToolchainSetup !== "function") return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        if (browserAutoConfigureButton) browserAutoConfigureButton.disabled = true;
        try {
            const response = await api.planBrowserToolchainSetup();
            browserToolchainReady = Boolean(response?.ok && response.state === "ready");
            renderBrowserComponentList(response);
            renderBrowserInstallReview(response?.ok ? (browserToolchainReady ? "Review complete. The project-pinned Chromium is verified locally." : "Review complete. Nothing is installed until you confirm.") : "Browser setup review is unavailable.");
            if (browserInstallConfirmButton) browserInstallConfirmButton.disabled = !(response?.ok && response.state !== "ready");
            syncRunTargetControls();
            updateSelectionUi();
            return response || {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        } catch {
            renderBrowserInstallReview("Browser setup review is unavailable.");
            return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        } finally {
            if (browserAutoConfigureButton) browserAutoConfigureButton.disabled = false;
        }
    }

    async function installBrowserToolchain() {
        if (typeof api.installBrowserToolchain !== "function") return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
        if (browserInstallConfirmButton) browserInstallConfirmButton.disabled = true;
        resetBrowserInstallProgress();
        renderBrowserInstallProgress({code: "preparing"});
        try {
            const response = await api.installBrowserToolchain({confirmed: true});
            browserToolchainReady = Boolean(response?.ok && response.state === "ready");
            renderBrowserComponentList(response);
            renderBrowserInstallReview(response?.ok ? "Installation completed. Browser tests are ready." : "The reviewed Chromium installation did not complete. Nothing was changed.");
            renderBrowserInstallProgress(response?.ok ? {code: "complete"} : {code: "failed", status: response?.status || "INSTALL_FAILED"});
            syncRunTargetControls();
            updateSelectionUi();
            return response || {ok: false, status: "INSTALL_FAILED"};
        } catch {
            renderBrowserInstallProgress({code: "failed", status: "INSTALL_FAILED"});
            return {ok: false, status: "INSTALL_FAILED"};
        }
    }

    function toolchainStatusText(response, fallback) {
        const components = Array.isArray(response?.components) ? response.components : [];
        const tools = Array.isArray(response?.tools) ? response.tools : [];
        const entries = [...components, ...tools];
        return entries.length ? entries.map((entry) => `${entry.label || entry.id}: ${entry.status || "unknown"}${entry.version ? ` (${entry.version})` : ""}`).join("; ") : fallback;
    }

    function sdkComponentPresentation(component) {
        const status = String(component?.status || "unknown").toLowerCase();
        if (status === "ready") return {label: "Ready", className: "ready", guidance: "Verified locally."};
        if (status === "missing") {
            if (component?.id === "webos-cli") return {label: "Missing", className: "missing", guidance: "Download from LG, then choose the original archive."};
            if (component?.id === "chromedriver") return {label: "Missing", className: "missing", guidance: "Requires a verified compatibility profile."};
            return {label: "Missing", className: "missing", guidance: "Included in reviewed installation."};
        }
        if (status === "downloading") return {label: "Downloading", className: "progress", guidance: "Downloading the reviewed local component."};
        if (status === "verifying") return {label: "Verifying", className: "progress", guidance: "Verifying the local component."};
        if (status === "repair-needed") return {label: "Needs attention", className: "attention", guidance: "Review the component before repairing it."};
        if (status === "unsupported-profile" || status === "compatibility_profile_unverified") {
            return {label: "Needs attention", className: "attention", guidance: "Requires a verified compatibility profile."};
        }
        return {label: "Needs attention", className: "attention", guidance: "Review this component in Advanced paths or LG help."};
    }

    function renderSdkComponentList(response) {
        if (!sdkComponentList) return;
        const components = Array.isArray(response?.components) ? response.components : [];
        if (!components.length) {
            sdkComponentList.replaceChildren();
            const empty = doc.createElement("p");
            empty.className = "field-note";
            empty.textContent = response?.ok ? "No local components were found." : "Component status is unavailable.";
            sdkComponentList.append(empty);
            return;
        }
        const rows = components.map((component) => {
            const presentation = sdkComponentPresentation(component);
            const row = doc.createElement("article");
            row.className = "sdk-component-row";
            const identity = doc.createElement("div");
            identity.className = "sdk-component-identity";
            const name = doc.createElement("strong");
            name.textContent = String(component.label || component.id || "LG component");
            const version = doc.createElement("span");
            version.className = "sdk-component-version";
            version.textContent = component.version ? `Version ${component.version}` : "Version unavailable";
            identity.append(name, version);
            const detail = doc.createElement("div");
            detail.className = "sdk-component-detail";
            const badge = doc.createElement("span");
            badge.className = `sdk-component-badge ${presentation.className}`;
            badge.textContent = presentation.label;
            const guidance = doc.createElement("span");
            guidance.className = "sdk-component-guidance";
            guidance.textContent = presentation.guidance;
            detail.append(badge, guidance);
            row.append(identity, detail);
            return row;
        });
        sdkComponentList.replaceChildren(...rows);
    }

    function renderSdkInstallReview(message) {
        if (!sdkInstallReview) return;
        sdkInstallReview.textContent = String(message || "");
        sdkInstallReview.classList.toggle("hidden", !message);
    }

    function renderSdkInstallProgress(event) {
        if (!sdkInstallProgress || !sdkInstallProgressText || !sdkInstallProgressSteps || !event || typeof event !== "object") return;
        if (sdkInstallProgressDismissed) return;
        const code = typeof event.code === "string" ? event.code : "";
        const stepIndex = LG_INSTALL_PROGRESS_STEPS.findIndex((step) => step.code === code);
        const isFailure = code === "failed" && LG_INSTALL_FAILURE_STATUSES.has(event.status);
        if (stepIndex < 0 && !isFailure) return;

        sdkInstallProgress.classList.remove("hidden", "attention", "complete");
        if (isFailure) {
            sdkInstallProgress.classList.add("attention");
            sdkInstallProgressText.textContent = "Installation stopped. No changes were activated.";
        } else {
            activeLgInstallStepIndex = stepIndex;
            if (code === "complete") sdkInstallProgress.classList.add("complete");
            sdkInstallProgressText.textContent = LG_INSTALL_PROGRESS_STEPS[stepIndex].label;
        }

        const progressBar = sdkInstallProgress.querySelector?.(".sdk-install-progress-bar");
        if (progressBar) {
            progressBar.setAttribute("aria-valuetext", sdkInstallProgressText.textContent);
            progressBar.setAttribute("aria-valuenow", String(Math.max(0, activeLgInstallStepIndex + 1)));
        }
        const activeIndex = isFailure ? Math.max(0, activeLgInstallStepIndex) : stepIndex;
        const rows = LG_INSTALL_PROGRESS_STEPS.map((step, index) => {
            const row = doc.createElement("li");
            row.textContent = step.label;
            row.className = index < activeIndex ? "complete" : index === activeIndex ? "current" : "pending";
            return row;
        });
        sdkInstallProgressSteps.replaceChildren(...rows);
    }

    function resetSdkInstallProgress({dismiss = false} = {}) {
        sdkInstallProgressDismissed = dismiss;
        activeLgInstallStepIndex = -1;
        if (!sdkInstallProgress || !sdkInstallProgressText || !sdkInstallProgressSteps) return;
        sdkInstallProgress.classList.add("hidden");
        sdkInstallProgress.classList.remove("attention", "complete");
        sdkInstallProgressText.textContent = "";
        sdkInstallProgressSteps.replaceChildren();
        const progressBar = sdkInstallProgress.querySelector?.(".sdk-install-progress-bar");
        progressBar?.removeAttribute?.("aria-valuenow");
        progressBar?.setAttribute?.("aria-valuetext", "Preparing");
    }

    function lgInstallationFailureText(status, verification) {
        if (status === "DOWNLOAD_FAILED") return "The reviewed Node download could not complete. Nothing was changed.";
        if (status === "CHECKSUM_MISMATCH") return "The reviewed download did not verify. Nothing was changed.";
        if (status === "EXTRACTION_FAILED") return "The reviewed Node archive could not be prepared. Nothing was changed.";
        if (status === "DEPENDENCY_INSTALL_FAILED") return "The reviewed Appium installation could not complete. Nothing was changed.";
        if (status === "VERIFICATION_FAILED" && verification === "NODE_UNVERIFIED") return "Managed Node.js and npm did not verify. Nothing was changed.";
        if (status === "VERIFICATION_FAILED" && verification === "APPIUM_UNVERIFIED") return "Managed Appium did not verify. Nothing was changed.";
        if (status === "VERIFICATION_FAILED" && verification === "LG_DRIVER_UNVERIFIED") return "The LG webOS driver did not verify. Nothing was changed.";
        if (status === "VERIFICATION_FAILED" && verification === "CHROMEDRIVER_UNVERIFIED") return "ChromeDriver did not verify. Nothing was changed.";
        if (status === "COMPATIBILITY_PROFILE_UNVERIFIED") return "The selected LG device does not have a verified compatibility profile. Nothing was changed.";
        if (status === "VERIFICATION_FAILED") return "Installed local tools did not verify. Nothing was changed.";
        if (status === "ACTIVATION_FAILED") return "Verified local tools could not be activated. Nothing was changed.";
        return "Local LG installation did not complete. Nothing was changed.";
    }

    async function loadTvToolchainConfiguration() {
        if (typeof api.getTvToolchainConfiguration !== "function") {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Local LG toolchain configuration is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        try {
            const response = await api.getTvToolchainConfiguration();
            if (tvToolchainStatus) {
                const source = response?.source === "managed" ? "Managed local tools" : "Advanced paths";
                tvToolchainStatus.textContent = response?.configured ? `Selected source: ${source}. ${toolchainStatusText(response, "Ready.")}` : "No local LG toolchain source is selected.";
            }
            return response || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } catch {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Local LG toolchain configuration is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
    }

    async function saveTvToolchainConfiguration() {
        if (typeof api.saveTvToolchainConfiguration !== "function") {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Local LG toolchain configuration is unavailable.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
        const configuration = {
            webosSdkHome: String(tvToolchainSdkHomeInput?.value || "").trim(),
            appiumHome: String(tvToolchainAppiumHomeInput?.value || "").trim(),
            appiumBin: String(tvToolchainAppiumBinInput?.value || "").trim(),
            chromedriverPath: String(tvToolchainChromedriverInput?.value || "").trim(),
        };
        if (Object.values(configuration).some((value) => !value)) {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Complete every local LG toolchain field first.";
            return {ok: false, status: "TOOLCHAIN_INCOMPLETE"};
        }
        if (tvToolchainSaveButton) tvToolchainSaveButton.disabled = true;
        try {
            const response = await api.saveTvToolchainConfiguration(configuration);
            if (!response?.ok) {
                if (tvToolchainStatus) tvToolchainStatus.textContent = response?.message || "Could not save local LG toolchain configuration.";
                return response || {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
            }
            if (tvToolchainSdkHomeInput) tvToolchainSdkHomeInput.value = "";
            if (tvToolchainAppiumHomeInput) tvToolchainAppiumHomeInput.value = "";
            if (tvToolchainAppiumBinInput) tvToolchainAppiumBinInput.value = "";
            if (tvToolchainChromedriverInput) tvToolchainChromedriverInput.value = "";
            if (tvToolchainStatus) tvToolchainStatus.textContent = `Local LG toolchain saved. ${toolchainStatusText(response, "Ready.")}`;
            return response;
        } catch {
            if (tvToolchainStatus) tvToolchainStatus.textContent = "Could not save local LG toolchain configuration.";
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        } finally {
            if (tvToolchainSaveButton) tvToolchainSaveButton.disabled = false;
        }
    }

    async function selectRunTarget(target, {persist = true} = {}) {
        runTarget = target === "webos" ? "webos" : "browser";
        settings = {...settings, RUN_TARGET: runTarget};
        if (persist) store?.setItem?.("mytv-auto-test-settings", JSON.stringify(settings));
        syncRunTargetControls();
        resetBrowserPreview();
        resetBrowserDashboard({clearLogs: true});
        legacyPreview?.classList?.toggle?.("hidden", runTarget !== "webos");
        browserSlotGrid?.classList?.toggle?.("hidden", runTarget === "webos");
        browserLogPanel?.classList?.toggle?.("hidden", runTarget === "webos");
        if (browserPreviewEmpty) browserPreviewEmpty.textContent = "Browser preview will appear here when a test starts.";
        if (runTarget === "webos") {
            await loadTvDevices();
            await loadTvToolchainConfiguration();
            await refreshLgRunAvailability();
            resetLgPreview();
            browserPreviewEmpty?.classList.add("hidden");
        } else if (tvDeviceStatus) {
            tvDeviceStatus.textContent = "Browser runner is selected.";
            resetLgPreview();
            browserPreviewEmpty?.classList.remove("hidden");
        }
        updateSelectionUi();
    }

    function selectSettingsPanel(name) {
        settingsNavItems.forEach((item) => item.classList.toggle("active", item.dataset.settingsPanel === name));
        settingsPanels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.settingsContent !== name));
        if (name === "sdk") {
            void loadSdkToolchainStatus();
            void loadBrowserToolchainStatus();
        }
    }

    function openModal(modal) {
        if (modal) modal.classList.remove("hidden");
    }

    function closeModal(modal) {
        if (modal) modal.classList.add("hidden");
    }

    function closeSettingsModal() {
        closeModal(settingsModal);
        void closeLgCompatibilityDialog();
        resetSdkInstallProgress({dismiss: true});
        resetBrowserInstallProgress({dismiss: true});
    }

    let dnsHostStatusRequest = 0;
    async function refreshDnsHostStatus() {
        const requestId = ++dnsHostStatusRequest;
        if (dnsHostAddButton) dnsHostAddButton.disabled = true;
        if (dnsHostRemoveButton) dnsHostRemoveButton.disabled = true;
        const response = await api.getHostEntryStatus?.();
        if (requestId !== dnsHostStatusRequest) return;
        if (!response?.ok) {
            if (dnsHostStatus) {
                dnsHostStatus.textContent = response?.message || "Could not read the hosts file.";
                dnsHostStatus.className = "field-note settings-message error";
            }
            return;
        }
        if (dnsHostAddButton) dnsHostAddButton.disabled = response.exists;
        if (dnsHostRemoveButton) dnsHostRemoveButton.disabled = !response.exists;
        if (dnsHostStatus) {
            dnsHostStatus.textContent = response.exists ? "Host is present in the hosts file." : "Host is not present in the hosts file.";
            dnsHostStatus.className = "field-note settings-message";
        }
    }

    async function updateDnsHost(action) {
        if (dnsHostAddButton) dnsHostAddButton.disabled = true;
        if (dnsHostRemoveButton) dnsHostRemoveButton.disabled = true;
        const response = await api[action]?.();
        if (dnsHostStatus) {
            dnsHostStatus.textContent = response?.ok ? (action === "addHostEntry" ? "Host added to the hosts file." : "Host removed from the hosts file.") : response?.message || "Could not update the hosts file.";
            dnsHostStatus.className = response?.ok ? "field-note settings-message ok" : "field-note settings-message error";
        }
        await refreshDnsHostStatus();
    }

    selectAllTestCases?.addEventListener?.("change", (event) => {
        const shouldSelect = event.target?.checked ?? selectAllTestCases.checked;
        const visibleIds = getVisibleCaseIds();
        visibleIds.forEach((id) => {
            if (shouldSelect) selectedCaseIds.add(id);
            else selectedCaseIds.delete(id);
        });
        updateSelectionUi();
    });
    testCaseSearchInput?.addEventListener?.("input", (event) => {
        applyCaseFilter(event.target?.value ?? testCaseSearchInput.value);
    });
    folderSelect?.addEventListener?.("change", () => {
        resetLoadedCaseSource();
        updateFolderControls();
    });
    campaignSelect?.addEventListener?.("change", () => {
        resetLoadedCaseSource();
        void loadFolders({campaignId: String(campaignSelect?.value || "").trim(), resetSelection: true});
        updateFolderControls();
    });
    refreshCampaignsButton?.addEventListener?.("click", () => loadCampaigns());
    refreshFoldersButton?.addEventListener?.("click", () => loadFolders());
    getTestCasesButton?.addEventListener?.("click", () => loadCasesFromFolder());

    async function savePreviewSettings() {
        activePreviewType = readPreviewType();
        const timeoutSeconds = Number(apiTimeoutInput?.value);
        const playerTimeoutSeconds = TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(playerCheckTimeoutInput?.value, settings.PLAYER_CHECK_TIMEOUT_SECONDS);
        const maxTimeMinutes = TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(testCaseMaxTimeInput?.value, settings.TEST_CASE_MAX_TIME_MINUTES);
        settings = {
            ...settings,
            API_DOMAIN: apiDomainInput?.value?.trim() || DEFAULT_SETTINGS.API_DOMAIN,
            API_AUTHORIZATION: apiAuthorizationInput?.value?.trim() || "",
            PROJECT_ID: projectIdInput?.value?.trim() || DEFAULT_SETTINGS.PROJECT_ID,
            ENVIRONMENT: ["API", "UI"].includes(environmentSelect?.value) ? environmentSelect.value : DEFAULT_SETTINGS.ENVIRONMENT,
            API_TIMEOUT_SECONDS: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? String(timeoutSeconds) : DEFAULT_SETTINGS.API_TIMEOUT_SECONDS,
            PLAYER_CHECK_TIMEOUT_SECONDS: String(playerTimeoutSeconds),
            TEST_CASE_MAX_TIME_MINUTES: String(maxTimeMinutes),
            TEST_RESOLUTION: TEST_CONFIGURATION.normalizeTestResolution(
                [...testResolutionInputs].find((input) => input.checked)?.value,
                settings.TEST_RESOLUTION,
            ),
            SIMULTANEOUS_DEVICES: String(TEST_CONFIGURATION.normalizeSimultaneousDevices(simultaneousDevicesSelect?.value, settings.SIMULTANEOUS_DEVICES)),
            PREVIEW_TYPE: activePreviewType,
            RUN_TARGET: runTarget,
        };
        if (apiTimeoutInput) apiTimeoutInput.value = settings.API_TIMEOUT_SECONDS;
        if (playerCheckTimeoutInput) playerCheckTimeoutInput.value = settings.PLAYER_CHECK_TIMEOUT_SECONDS;
        if (testCaseMaxTimeInput) testCaseMaxTimeInput.value = settings.TEST_CASE_MAX_TIME_MINUTES;
        testResolutionInputs.forEach((input) => { input.checked = input.value === settings.TEST_RESOLUTION; });
        if (simultaneousDevicesSelect) simultaneousDevicesSelect.value = settings.SIMULTANEOUS_DEVICES;
        store?.setItem?.("mytv-auto-test-settings", JSON.stringify(settings));
        const response = await syncTestConfiguration(
            settings.PLAYER_CHECK_TIMEOUT_SECONDS,
            settings.TEST_CASE_MAX_TIME_MINUTES,
            settings.TEST_RESOLUTION,
            settings.SIMULTANEOUS_DEVICES,
        );
        showAppToast(response?.ok === false ? "Could not save settings." : "Settings saved successfully.", response?.ok === false ? "error" : "ok");
    }

    async function saveTestConfiguration() {
        const playerTimeoutSeconds = TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(playerCheckTimeoutInput?.value, settings.PLAYER_CHECK_TIMEOUT_SECONDS);
        const maxTimeMinutes = TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(testCaseMaxTimeInput?.value, settings.TEST_CASE_MAX_TIME_MINUTES);
        const resolution = TEST_CONFIGURATION.normalizeTestResolution(
            [...testResolutionInputs].find((input) => input.checked)?.value,
            settings.TEST_RESOLUTION,
        );
        const devices = String(TEST_CONFIGURATION.normalizeSimultaneousDevices(simultaneousDevicesSelect?.value, settings.SIMULTANEOUS_DEVICES));
        settings = {
            ...settings,
            PLAYER_CHECK_TIMEOUT_SECONDS: String(playerTimeoutSeconds),
            TEST_CASE_MAX_TIME_MINUTES: String(maxTimeMinutes),
            TEST_RESOLUTION: resolution,
            SIMULTANEOUS_DEVICES: devices,
        };
        if (playerCheckTimeoutInput) playerCheckTimeoutInput.value = settings.PLAYER_CHECK_TIMEOUT_SECONDS;
        if (testCaseMaxTimeInput) testCaseMaxTimeInput.value = settings.TEST_CASE_MAX_TIME_MINUTES;
        testResolutionInputs.forEach((input) => { input.checked = input.value === settings.TEST_RESOLUTION; });
        if (simultaneousDevicesSelect) simultaneousDevicesSelect.value = settings.SIMULTANEOUS_DEVICES;
        store?.setItem?.("mytv-auto-test-settings", JSON.stringify(settings));
        const response = await syncTestConfiguration(
            settings.PLAYER_CHECK_TIMEOUT_SECONDS,
            settings.TEST_CASE_MAX_TIME_MINUTES,
            settings.TEST_RESOLUTION,
            settings.SIMULTANEOUS_DEVICES,
        );
        showAppToast(response?.ok === false ? "Could not save test configuration." : "Test configuration saved successfully.", response?.ok === false ? "error" : "ok");
    }

    async function suspendInteractiveBrowserForModal() {
        if (activePreviewType === "interactive") {
            await api.suspendInteractiveBrowser?.();
        }
    }

    async function resumeInteractiveBrowserAfterModal() {
        if (activePreviewType !== "interactive") return;
        if (!settingsModal?.classList.contains("hidden") || !logsModal?.classList.contains("hidden")) return;
        await showInteractiveBrowserBounds();
    }

    function resolveActiveCompletion(result) {
        if (!activeCompletion) return false;
        const resolve = activeCompletion;
        activeCompletion = null;
        resolve(result || {code: 1});
        return true;
    }

    async function runBrowserBatch(values = {}) {
        const ids = getSelectedCaseIds();
        const validationMessage = validateRunValues({selectedCaseIds: ids});
        if (validationMessage) {
            setFormMessage(validationMessage, "error");
            return {completed: 0, failed: 0, skipped: 0, stopped: false};
        }
        const previewType = values.PREVIEW_TYPE || activePreviewType || "live";
        if (previewType === "interactive" && ids.length !== 1) {
            const message = "Interactive preview supports one Browser test case at a time. Choose Live or None for multiple cases.";
            setFormMessage(message, "error");
            return {ok: false, message};
        }
        const resolution = TEST_CONFIGURATION.normalizeTestResolution(values.TEST_RESOLUTION, settings.TEST_RESOLUTION);
        const devices = String(TEST_CONFIGURATION.normalizeSimultaneousDevices(values.SIMULTANEOUS_DEVICES, settings.SIMULTANEOUS_DEVICES));
        const playerTimeoutSeconds = TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(values.PLAYER_CHECK_TIMEOUT_SECONDS, settings.PLAYER_CHECK_TIMEOUT_SECONDS);
        const maxTimeMinutes = TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(values.TEST_CASE_MAX_TIME_MINUTES, settings.TEST_CASE_MAX_TIME_MINUTES);
        const payload = {
            selectedCaseIds: ids,
            PREVIEW_TYPE: previewType,
            TEST_RESOLUTION: resolution,
            SIMULTANEOUS_DEVICES: devices,
            PLAYER_CHECK_TIMEOUT_SECONDS: String(playerTimeoutSeconds),
            TEST_CASE_MAX_TIME_MINUTES: String(maxTimeMinutes),
        };
        if (values.TEST_CASE_CACHE_KEY) payload.TEST_CASE_CACHE_KEY = String(values.TEST_CASE_CACHE_KEY);
        if (values.TEST_CASE_FOLDER_ID) payload.TEST_CASE_FOLDER_ID = String(values.TEST_CASE_FOLDER_ID);

        const currentBatch = {ids, activeCaseId: null, stopRequested: false, browser: true};
        batchState = currentBatch;
        setRunActive(true);
        setFormRunning(true);
        setStatus("running", "Running");
        resetBrowserDashboard({clearLogs: true});
        activePreviewType = previewType;
        ids.forEach((id) => renderCaseStatus(id, "queued"));

        try {
            if (previewType === "interactive") await preparePreview({...payload, PREVIEW_TYPE: previewType});
            const response = await api.runBrowserBatch(payload);
            if (!response?.ok) {
                const message = response?.message || "The Browser batch could not start.";
                setStatus("failed", "Failed");
                setFormMessage(message, "error");
                appendLog(`${message}\n`);
                return {ok: false, message, completed: 0, failed: 0, skipped: ids.length, stopped: false};
            }

            const rawRuns = Array.isArray(response.caseRuns) ? response.caseRuns : [];
            const caseRuns = rawRuns.map((run) => ({
                id: String(run?.caseId || run?.id || ""),
                result: run,
            })).filter(({id}) => id);
            const completed = caseRuns.filter(({result}) => result?.passed === true).length;
            const failed = caseRuns.filter(({result}) => result?.passed !== true && !result?.stopped && !result?.skipped).length;
            const skipped = caseRuns.filter(({result}) => result?.skipped || result?.stopped).length;
            const stopped = response.stopped === true || caseRuns.some(({result}) => result?.stopped === true);
            const summary = `Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`;
            setStatus(failed || stopped ? "failed" : "passed", failed || stopped ? "Failed" : "Passed");

            const allSelectedCasesRan = !stopped && skipped === 0 && caseRuns.length === ids.length && caseRuns.every(({result}) => result?.started && !result?.stopped);
            const fullyCompletedCaseRuns = caseRuns.filter(({result}) => result?.started && !result?.stopped && !result?.skipped);
            let resultSubmission;
            if ((allSelectedCasesRan || (stopped && fullyCompletedCaseRuns.length > 0)) && values.FLOW_CASE_RESULT_CONTEXT) {
                const submission = buildFlowCaseResultSubmission(values.FLOW_CASE_RESULT_CONTEXT, fullyCompletedCaseRuns);
                appendApiRequestLog("Send flow-case results", submission);
                try {
                    resultSubmission = await api.submitFlowCaseResults?.(submission);
                    appendApiResponseLog("Send flow-case results", resultSubmission);
                    if (!resultSubmission?.ok) throw new Error(resultSubmission?.message || "Failed to send flow-case results.");
                } catch (error) {
                    setPendingResultSubmission(submission);
                    const message = `Failed to send flow-case results: ${error.message}`;
                    appendLog(`${message}\n`);
                    setFormMessage(`${summary}. ${message}`, "error");
                    return {completed, failed, skipped, stopped, caseRuns, resultSubmission: {ok: false, message: error.message}};
                }
            }
            setFormMessage(summary, failed || stopped ? "error" : "ok");
            return {completed, failed, skipped, stopped, caseRuns, resultSubmission, batchId: response.batchId};
        } catch (error) {
            const message = error?.message || "The Browser batch failed.";
            setStatus("failed", "Failed");
            setFormMessage(message, "error");
            appendLog(`${message}\n`);
            return {ok: false, message, completed: 0, failed: ids.length, skipped: 0, stopped: false};
        } finally {
            batchState = null;
            setRunActive(false);
            setFormRunning(false);
        }
    }

    async function runSingleCase(testCaseId, values, currentBatch) {
        const playerTimeoutSeconds = TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(values.PLAYER_CHECK_TIMEOUT_SECONDS, settings.PLAYER_CHECK_TIMEOUT_SECONDS);
        const maxTimeMinutes = TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(values.TEST_CASE_MAX_TIME_MINUTES, settings.TEST_CASE_MAX_TIME_MINUTES);
        const payload = {
            TEST_CASE_ID: String(testCaseId),
            PREVIEW_TYPE: values.PREVIEW_TYPE,
            PLAYER_CHECK_TIMEOUT_SECONDS: String(playerTimeoutSeconds),
            TEST_CASE_MAX_TIME_MINUTES: String(maxTimeMinutes),
        };
        if (values.TEST_CASE_CACHE_KEY) payload.TEST_CASE_CACHE_KEY = String(values.TEST_CASE_CACHE_KEY);
        if (values.TEST_CASE_FOLDER_ID) payload.TEST_CASE_FOLDER_ID = String(values.TEST_CASE_FOLDER_ID);
        currentBatch.activeCaseId = String(testCaseId);
        renderCaseStatus(testCaseId, "running");
        const completion = new Promise((resolve) => {
            activeCompletion = resolve;
        });

        try {
            await preparePreview({
                ...payload,
                TEST_RESOLUTION: TEST_CONFIGURATION.normalizeTestResolution(values.TEST_RESOLUTION, settings.TEST_RESOLUTION),
            });
            const response = await api.runTest(payload);
            activeRunnerLog = null;
            if (response?.initialLog) appendRunnerLog(response.initialLog);
            if (!response?.ok) {
                activeCompletion = null;
                appendLog(`${response?.message || "Failed to start"}\n`);
                renderCaseStatus(testCaseId, "failed");
                resetBrowserPreview();
                return {passed: false, started: false};
            }

            const result = await completion;
            const passed = result?.code === 0;
            renderCaseStatus(testCaseId, passed ? "passed" : "failed");
            appendLog(`\n${testCaseId}: ${passed ? "Passed" : "Failed"}\n`);
            resetBrowserPreview();
            return {
                passed,
                started: true,
                stopped: Boolean(result?.stopped),
                executionResult: result,
            };
        } catch (error) {
            activeCompletion = null;
            renderCaseStatus(testCaseId, "failed");
            resetBrowserPreview();
            appendLog(`${testCaseId}: ${error.message}\n`);
            return {passed: false, started: false};
        } finally {
            currentBatch.activeCaseId = null;
        }
    }

    async function runSelectedCases(values = {}) {
        const ids = getSelectedCaseIds();
        const validationMessage = validateRunValues({selectedCaseIds: ids});
        if (validationMessage) {
            setFormMessage(validationMessage, "error");
            return {completed: 0, failed: 0, skipped: 0, stopped: false};
        }
        if (values.target === "webos") {
            openLgBatchConfirmation({selectedCaseCount: ids.length, values});
            return {completed: 0, failed: 0, skipped: 0, stopped: false, awaitingConfirmation: true};
        }

        if (typeof api.runBrowserBatch === "function") return runBrowserBatch(values);

        const currentBatch = {ids, activeCaseId: null, stopRequested: false};
        batchState = currentBatch;
        setRunActive(true);
        ids.forEach((id) => renderCaseStatus(id, ""));
        setFormRunning(true);
        setStatus("running", "Running");
        if (typeof api.startReport === "function") await api.startReport();
        let completed = 0;
        let failed = 0;
        let skipped = 0;
        let stopped = false;
        const caseRuns = [];

        try {
            for (const id of ids) {
                if (currentBatch.stopRequested) {
                    renderCaseStatus(id, "skipped");
                    skipped += 1;
                    continue;
                }

                const result = await runSingleCase(id, values, currentBatch);
                caseRuns.push({id, result});
                if (result.passed) completed += 1;
                else failed += 1;
                if (result.stopped) {
                    stopped = true;
                    currentBatch.stopRequested = true;
                }
            }
        } finally {
            batchState = null;
            setRunActive(false);
        }

        const summary = `Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`;
        setStatus(failed > 0 || stopped ? "failed" : "passed", failed > 0 || stopped ? "Failed" : "Passed");
        const allSelectedCasesRan = !stopped && skipped === 0 && caseRuns.length === ids.length && caseRuns.every(({result}) => result.started && !result.stopped);
        const fullyCompletedCaseRuns = caseRuns.filter(({result}) => result.started && !result.stopped);
        let resultSubmission;

        if ((allSelectedCasesRan || (stopped && fullyCompletedCaseRuns.length > 0)) && values.FLOW_CASE_RESULT_CONTEXT) {
            const submission = buildFlowCaseResultSubmission(values.FLOW_CASE_RESULT_CONTEXT, fullyCompletedCaseRuns);
            appendApiRequestLog("Send flow-case results", submission);
            try {
                resultSubmission = await api.submitFlowCaseResults?.(submission);
                appendApiResponseLog("Send flow-case results", resultSubmission);
                if (!resultSubmission?.ok) {
                    throw new Error(resultSubmission?.message || "Failed to send flow-case results.");
                }
            } catch (error) {
                setPendingResultSubmission(submission);
                const message = `Failed to send flow-case results: ${error.message}`;
                appendLog(`${message}\n`);
                setFormMessage(`${summary}. ${message}`, "error");
                setFormRunning(false);
                return {completed, failed, skipped, stopped, resultSubmission: {ok: false, message: error.message}};
            }
        }

        setFormRunning(false);
        setFormMessage(summary, failed > 0 || stopped ? "error" : "ok");
        return {completed, failed, skipped, stopped, resultSubmission};
    }

    async function retryResultSync() {
        if (!pendingResultSubmission) {
            return {ok: false, message: "There are no unsynced completed test results."};
        }
        const retrySettings = currentSettings();
        const retrySubmission = {
            ...pendingResultSubmission,
            API_AUTHORIZATION: retrySettings.API_AUTHORIZATION,
        };
        appendApiRequestLog("Retry flow-case results", retrySubmission);
        try {
            const result = await api.submitFlowCaseResults?.(retrySubmission);
            appendApiResponseLog("Retry flow-case results", result);
            if (!result?.ok) throw new Error(result?.message || "Failed to send flow-case results.");
            setPendingResultSubmission(null);
            return result;
        } catch (error) {
            return {ok: false, message: error.message};
        }
    }

    function buildFlowCaseResultSubmission(context, caseRuns) {
        const campaignId = String(context.CAMPAIGN_ID ?? "").trim();
        return {
            API_DOMAIN: context.API_DOMAIN,
            API_AUTHORIZATION: context.API_AUTHORIZATION,
            PROJECT_ID: context.PROJECT_ID,
            API_TIMEOUT_SECONDS: context.API_TIMEOUT_SECONDS,
            FOLDER_PATH: context.FOLDER_PATH,
            testcases: caseRuns.map(({id, result}) => buildFlowCaseResult(id, result, campaignId)),
        };
    }

    function buildFlowCaseResult(testCaseId, run, campaignId = "") {
        const passed = Boolean(run.passed);
        const executionResult = run.executionResult || run;
        const caseResult = executionResult.caseResult || run.caseResult || null;
        const failedStepMessage = caseResult?.steps?.find((step) => step?.status === "failed" && step.message)?.message;
        const message = passed
            ? "Testcase chạy thành công."
            : String(failedStepMessage || executionResult.message || run.message || "Testcase chạy thất bại.");

        return {
            id: testCaseId,
            ...(campaignId ? {campaignId} : {}),
            status: "tested",
            testResult: {
                status: passed ? "success" : "failed",
                message,
                passed: passed ? 1 : 0,
                failed: passed ? 0 : 1,
                finishedAt: new Date().toISOString(),
            },
        };
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearLog();
        setFormMessage("");
        const runSettings = currentSettings();
        const values = {
            PREVIEW_TYPE: activePreviewType,
            TEST_RESOLUTION: runSettings.TEST_RESOLUTION,
            SIMULTANEOUS_DEVICES: runSettings.SIMULTANEOUS_DEVICES,
            PLAYER_CHECK_TIMEOUT_SECONDS: runSettings.PLAYER_CHECK_TIMEOUT_SECONDS,
            TEST_CASE_MAX_TIME_MINUTES: runSettings.TEST_CASE_MAX_TIME_MINUTES,
            target: runTarget,
        };
        if (activeCacheKey) values.TEST_CASE_CACHE_KEY = activeCacheKey;
        if (activeFolderId) values.TEST_CASE_FOLDER_ID = activeFolderId;
        if (activeCampaignId && !activeFolderPath) {
            setFormMessage("The selected campaign has no result folder path. Select a folder and reload its cases before running.", "error");
            return;
        }
        if (activeFolderPath) {
            values.FLOW_CASE_RESULT_CONTEXT = {
                API_DOMAIN: runSettings.API_DOMAIN,
                API_AUTHORIZATION: runSettings.API_AUTHORIZATION,
                PROJECT_ID: runSettings.PROJECT_ID,
                API_TIMEOUT_SECONDS: runSettings.API_TIMEOUT_SECONDS,
                FOLDER_PATH: activeFolderPath,
                ...(activeCampaignId ? {CAMPAIGN_ID: activeCampaignId} : {}),
            };
        }
        await runSelectedCases(values);
    }

    async function preparePreview(values) {
        const previewType = values.PREVIEW_TYPE || "live";
        resetBrowserPreview();
        activePreviewType = previewType;
        if (previewType === "none") {
            if (browserPreviewEmpty) browserPreviewEmpty.textContent = "Preview is disabled.";
            return;
        }
        if (previewType === "interactive") {
            browserPreviewEmpty?.classList.add("hidden");
            browserMuteButton?.classList.remove("hidden");
            await setBrowserMuted(true);
            await showInteractiveBrowser(values);
        }
    }

    async function showInteractiveBrowser(values = {}) {
        const stage = doc?.querySelector?.('.browser-slot-stage[data-slot-id="1"]') || doc?.querySelector?.(".browser-preview-stage");
        const bounds = stage?.getBoundingClientRect?.() || {x: 0, y: 0, width: 0, height: 0};
        const resolution = TEST_CONFIGURATION.normalizeTestResolution(
            values.TEST_RESOLUTION,
            activeBrowserBatchSettings?.TEST_RESOLUTION || settings.TEST_RESOLUTION,
        );
        await api.showInteractiveBrowser({bounds, TEST_RESOLUTION: resolution});
    }

    async function showInteractiveBrowserBounds() {
        const stage = doc?.querySelector?.('.browser-slot-stage[data-slot-id="1"]') || doc?.querySelector?.(".browser-preview-stage");
        const bounds = stage?.getBoundingClientRect?.() || {x: 0, y: 0, width: 0, height: 0};
        const resolution = TEST_CONFIGURATION.normalizeTestResolution(
            activeBrowserBatchSettings?.TEST_RESOLUTION,
            settings.TEST_RESOLUTION,
        );
        await api.resumeInteractiveBrowser({bounds, TEST_RESOLUTION: resolution});
    }

    async function setBrowserMuted(muted) {
        browserMuted = muted;
        if (browserMuteButton) browserMuteButton.textContent = muted ? "Unmute" : "Mute";
        await api.setInteractiveBrowserMuted(muted);
    }

    function resetBrowserPreview() {
        browserPreviewImage?.removeAttribute?.("src");
        browserPreviewImage?.classList.add("hidden");
        interactiveBrowser?.classList.add("hidden");
        browserMuteButton?.classList.add("hidden");
        api.hideInteractiveBrowser?.();
        browserPreviewEmpty?.classList.remove("hidden");
    }

    function resetLgPreview() {
        lgPreviewImage?.removeAttribute?.("src");
        lgPreviewImage?.classList.add("hidden");
        lgPreviewEmpty?.classList.toggle("hidden", runTarget !== "webos");
        lgRunState?.classList.add("hidden");
        if (lgRunState) lgRunState.textContent = "";
    }

    function renderLgPreview(dataUrl) {
        if (runTarget !== "webos" || typeof dataUrl !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl)) return;
        lgPreviewImage.src = dataUrl;
        lgPreviewImage.classList.remove("hidden");
        lgPreviewEmpty?.classList.add("hidden");
    }

    function renderLgRunStatus(event) {
        const copy = {
            preflight: "Checking LG prerequisites",
            "case-started": "Starting selected case",
            "case-retry": "Retrying current case",
            "case-finished": "Selected case finished",
            "recovery-required": "Waiting for your decision",
            "batch-finished": "LG batch finished",
            stopped: "LG batch stopped",
        };
        if (!copy[event?.code]) return;
        if (lgRunState) {
            lgRunState.textContent = copy[event.code];
            lgRunState.classList.remove("hidden");
        }
        if (event.caseId && event.code === "case-started") renderCaseStatus(event.caseId, "running");
        if (event.caseId && event.code === "case-finished") renderCaseStatus(event.caseId, "passed");
        if (event.code === "recovery-required") openModal(lgRecoveryDialog);
    }

    function openLgBatchConfirmation({selectedCaseCount, values = {}} = {}) {
        pendingLgRunValues = {selectedCaseCount: Number(selectedCaseCount) || 0, values};
        if (lgRunConfirmationCount) lgRunConfirmationCount.textContent = `${pendingLgRunValues.selectedCaseCount} selected case${pendingLgRunValues.selectedCaseCount === 1 ? "" : "s"} will run on the selected LG device.`;
        openModal(lgRunConfirmationDialog);
    }

    async function runLgSelectedCases(values = {}) {
        const ids = getSelectedCaseIds();
        const deviceId = String(tvDeviceSelect?.value || "");
        if (!deviceId || !canRunLg() || typeof api?.runLgBatch !== "function") return {ok: false, status: "LG_BATCH_INVALID"};
        const playerTimeoutSeconds = TEST_CONFIGURATION.normalizePlayerCheckTimeoutSeconds(values.PLAYER_CHECK_TIMEOUT_SECONDS, settings.PLAYER_CHECK_TIMEOUT_SECONDS);
        const maxTimeMinutes = TEST_CONFIGURATION.normalizeTestCaseMaxTimeMinutes(values.TEST_CASE_MAX_TIME_MINUTES, settings.TEST_CASE_MAX_TIME_MINUTES);
        syncTestConfiguration(String(playerTimeoutSeconds), String(maxTimeMinutes));
        closeModal(lgRunConfirmationDialog);
        pendingLgRunValues = null;
        batchState = {ids, activeCaseId: null, stopRequested: false, lg: true};
        setRunActive(true);
        setFormRunning(true);
        setStatus("running", "Running");
        if (typeof api.startReport === "function") await api.startReport();
        try {
            await testConfigurationSync;
            const sourceRequest = values.TEST_CASE_CACHE_KEY && activeCampaignId ? {cacheKey: values.TEST_CASE_CACHE_KEY} : values.TEST_CASE_FOLDER_ID ? {folderId: values.TEST_CASE_FOLDER_ID} : {};
            const result = await api.runLgBatch({deviceId, selectedCaseIds: ids, ...sourceRequest, confirmed: true});
            if (!result?.ok) {
                setStatus("failed", "Failed");
                setFormMessage("The LG batch could not start. Review the LG SDK configuration and selected device.", "error");
                return {completed: 0, failed: 0, skipped: 0, stopped: false, status: result?.status || "LG_BATCH_UNAVAILABLE"};
            }
            const caseRuns = Array.isArray(result?.caseRuns) ? result.caseRuns : [];
            caseRuns.forEach(({id, result: caseResult}) => renderCaseStatus(id, caseResult?.stopped ? "skipped" : caseResult?.passed ? "passed" : "failed"));
            const completed = caseRuns.filter(({result: caseResult}) => caseResult?.passed).length;
            const failed = caseRuns.filter(({result: caseResult}) => !caseResult?.passed && !caseResult?.stopped).length;
            const skipped = caseRuns.filter(({result: caseResult}) => caseResult?.stopped).length;
            const stopped = result?.stopped === true;
            const summary = `Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`;
            const allSelectedCasesRan = !stopped && skipped === 0 && caseRuns.length === ids.length && caseRuns.every(({result: caseResult}) => caseResult?.started && !caseResult?.stopped);
            const fullyCompletedCaseRuns = caseRuns.filter(({result: caseResult}) => caseResult?.started && !caseResult?.stopped);
            let resultSubmission;
            if ((allSelectedCasesRan || (stopped && fullyCompletedCaseRuns.length > 0)) && values.FLOW_CASE_RESULT_CONTEXT) {
                const submission = buildFlowCaseResultSubmission(values.FLOW_CASE_RESULT_CONTEXT, fullyCompletedCaseRuns);
                appendApiRequestLog("Send flow-case results", submission);
                try {
                    resultSubmission = await api.submitFlowCaseResults?.(submission);
                    appendApiResponseLog("Send flow-case results", resultSubmission);
                    if (!resultSubmission?.ok) throw new Error(resultSubmission?.message || "Failed to send flow-case results.");
                } catch (error) {
                    setPendingResultSubmission(submission);
                    const message = `Failed to send flow-case results: ${error.message}`;
                    appendLog(`${message}\n`);
                    setFormMessage(`${summary}. ${message}`, "error");
                    return {completed, failed, skipped, stopped, caseRuns, resultSubmission: {ok: false, message: error.message}};
                }
            }
            setStatus(failed || stopped ? "failed" : "passed", failed || stopped ? "Failed" : "Passed");
            setFormMessage(summary, failed || stopped ? "error" : "ok");
            return {completed, failed, skipped, stopped, caseRuns, resultSubmission};
        } finally {
            batchState = null;
            setRunActive(false);
            setFormRunning(false);
        }
    }

    form?.addEventListener?.("submit", handleSubmit);
    async function requestStop({notifyMain = true} = {}) {
        if (batchState) {
            batchState.stopRequested = true;
            try {
                if (notifyMain) await api.stopTest();
            } finally {
                resolveActiveCompletion({code: 1, stopped: true});
            }
            return;
        }
        if (notifyMain) await api.stopTest();
        setFormRunning(false);
        setStatus("idle", "Stopped");
    }

    get("stop-button")?.addEventListener?.("click", requestStop);
    retrySyncButton?.addEventListener?.("click", async () => {
        const result = await retryResultSync();
        setFormMessage(result.ok ? "Completed test results synced." : result.message, result.ok ? "ok" : "error");
    });
    get("open-report-button")?.addEventListener?.("click", () => api.openReport());
    get("show-report-button")?.addEventListener?.("click", () => api.showReportFolder());
    get("settings-button")?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        selectSettingsPanel("gui");
        openModal(settingsModal);
        void refreshDnsHostStatus();
    });
    get("logs-button")?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        openModal(logsModal);
        refreshLogEntryOverflows();
        win?.requestAnimationFrame?.(refreshLogEntryOverflows);
    });
    get("settings-close-button")?.addEventListener?.("click", async () => {
        closeSettingsModal();
        await resumeInteractiveBrowserAfterModal();
    });
    logsClearButton?.addEventListener?.("click", () => clearLog());
    get("logs-close-button")?.addEventListener?.("click", async () => {
        closeModal(logsModal);
        await resumeInteractiveBrowserAfterModal();
    });
    get("test-case-details-close-button")?.addEventListener?.("click", async () => {
        closeModal(testCaseDetailsModal);
        await resumeInteractiveBrowserAfterModal();
    });
    testCaseDetailsModal?.querySelector?.("[data-close-test-case-details]")?.addEventListener?.("click", async () => {
        closeModal(testCaseDetailsModal);
        await resumeInteractiveBrowserAfterModal();
    });
    settingsModal?.querySelector?.("[data-close-settings]")?.addEventListener?.("click", async () => {
        closeSettingsModal();
        await resumeInteractiveBrowserAfterModal();
    });
    logsModal?.querySelector?.("[data-close-logs]")?.addEventListener?.("click", async () => {
        closeModal(logsModal);
        await resumeInteractiveBrowserAfterModal();
    });
    get("gui-settings-save-button")?.addEventListener?.("click", () => {
        void savePreviewSettings();
    });
    get("test-configuration-save-button")?.addEventListener?.("click", () => {
        void saveTestConfiguration();
    });
    playerCheckTimeoutInput?.addEventListener?.("input", () => {
        playerCheckTimeoutInput.value = String(playerCheckTimeoutInput.value || "").replace(/[^0-9]/g, "");
    });
    testCaseMaxTimeInput?.addEventListener?.("input", () => {
        testCaseMaxTimeInput.value = String(testCaseMaxTimeInput.value || "").replace(/[^0-9]/g, "");
    });
    dnsHostAddButton?.addEventListener?.("click", () => {
        void updateDnsHost("addHostEntry");
    });
    dnsHostRemoveButton?.addEventListener?.("click", () => {
        void updateDnsHost("removeHostEntry");
    });
    browserTargetInput?.addEventListener?.("change", () => {
        void selectRunTarget("browser");
    });
    webosTargetInput?.addEventListener?.("change", () => {
        void selectRunTarget("webos");
    });
    tvDeviceAddButton?.addEventListener?.("click", () => {
        openTvDeviceDialog("add");
    });
    tvDeviceEditButton?.addEventListener?.("click", () => {
        openTvDeviceDialog("edit");
    });
    tvDeviceCheckConnectionButton?.addEventListener?.("click", () => {
        void checkTvDeviceConnection();
    });
    tvDeviceSelect?.addEventListener?.("change", () => {
        resetTvDeviceConnectionStatus();
        syncRunTargetControls();
        void refreshLgRunAvailability();
    });
    tvDeviceDialogCancelButton?.addEventListener?.("click", closeTvDeviceDialog);
    tvDeviceDialog?.querySelector?.("[data-close-tv-device-dialog]")?.addEventListener?.("click", closeTvDeviceDialog);
    tvDevicePassphraseToggle?.addEventListener?.("click", toggleTvDevicePassphrase);
    tvDeviceDialogSubmitButton?.addEventListener?.("click", () => {
        void submitTvDeviceDialog();
    });
    sdkAutoConfigureButton?.addEventListener?.("click", () => {
        void planLgToolchainSetup();
    });
    sdkCompatibilityCatalogRefreshButton?.addEventListener?.("click", () => {
        void refreshLgCompatibilityCatalog();
    });
    sdkCompatibilityCheckButton?.addEventListener?.("click", openLgCompatibilityDialog);
    lgCompatibilityProductGateSaveButton?.addEventListener?.("click", () => {
        void saveLgCompatibilityProductGateCredentials();
    });
    lgCompatibilityInspectionReviewButton?.addEventListener?.("click", reviewLgCompatibilityInspection);
    lgCompatibilityInspectionConfirmButton?.addEventListener?.("click", () => {
        void confirmLgCompatibilityInspection();
    });
    lgCompatibilityValidationReviewButton?.addEventListener?.("click", reviewLgCompatibilityValidation);
    lgCompatibilityValidationConfirmButton?.addEventListener?.("click", () => {
        void confirmLgCompatibilityValidation();
    });
    lgCompatibilityCloseButton?.addEventListener?.("click", () => {
        void closeLgCompatibilityDialog();
    });
    lgCompatibilityDialog?.querySelector?.("[data-close-lg-compatibility-dialog]")?.addEventListener?.("click", () => {
        void closeLgCompatibilityDialog();
    });
    sdkInstallConfirmButton?.addEventListener?.("click", () => {
        void installLgToolchain();
    });
    sdkUseManagedButton?.addEventListener?.("click", () => {
        void activateManagedLgToolchain();
    });
    browserAutoConfigureButton?.addEventListener?.("click", () => {
        void planBrowserToolchainSetup();
    });
    browserInstallConfirmButton?.addEventListener?.("click", () => {
        void installBrowserToolchain();
    });
    configureBrowserButton?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        selectSettingsPanel("sdk");
        openModal(settingsModal);
    });
    configureLgSdkButton?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        selectSettingsPanel("sdk");
        openModal(settingsModal);
    });
    lgRunConfirmButton?.addEventListener?.("click", () => {
        const values = pendingLgRunValues?.values || {
            target: "webos",
            ...(activeCacheKey ? {TEST_CASE_CACHE_KEY: activeCacheKey} : {}),
            ...(activeFolderId ? {TEST_CASE_FOLDER_ID: activeFolderId} : {}),
        };
        void runLgSelectedCases(values);
    });
    lgRunCancelButton?.addEventListener?.("click", () => {
        pendingLgRunValues = null;
        closeModal(lgRunConfirmationDialog);
    });
    lgRunConfirmationDialog?.querySelector?.("[data-close-lg-run-confirmation]")?.addEventListener?.("click", () => {
        pendingLgRunValues = null;
        closeModal(lgRunConfirmationDialog);
    });
    lgRecoveryRetryButton?.addEventListener?.("click", async () => {
        const result = await api.resolveLgRunRecovery?.({action: "retry"});
        if (result?.ok) closeModal(lgRecoveryDialog);
    });
    lgRecoveryStopButton?.addEventListener?.("click", async () => {
        const result = await api.resolveLgRunRecovery?.({action: "stop"});
        if (result?.ok) closeModal(lgRecoveryDialog);
    });
    lgRecoveryDialog?.querySelector?.("[data-close-lg-recovery]")?.addEventListener?.("click", () => {
        void api.resolveLgRunRecovery?.({action: "stop"});
        closeModal(lgRecoveryDialog);
    });
    tvToolchainSaveButton?.addEventListener?.("click", () => {
        void saveTvToolchainConfiguration();
    });
    sdkDownloadLgCliButton?.addEventListener?.("click", () => {
        void api.openLgCliDownloadPage?.();
    });
    sdkChooseLgCliButton?.addEventListener?.("click", async () => {
        const result = await api.chooseLgCliArchive?.();
        if (result?.ok) {
            await loadLgToolchainStatus();
        } else if (result && sdkManagedToolchainStatus) {
            sdkManagedToolchainStatus.textContent = "webOS CLI import was not completed.";
        }
    });
    tvHelpButton?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        openModal(tvHelpModal);
    });
    tvHelpCloseButton?.addEventListener?.("click", async () => {
        closeModal(tvHelpModal);
        await resumeInteractiveBrowserAfterModal();
    });
    tvHelpModal?.querySelector?.("[data-close-tv-help]")?.addEventListener?.("click", async () => {
        closeModal(tvHelpModal);
        await resumeInteractiveBrowserAfterModal();
    });
    browserMuteButton?.addEventListener?.("click", () => setBrowserMuted(!browserMuted));
    settingsNavItems.forEach((item) => item.addEventListener("click", () => selectSettingsPanel(item.dataset.settingsPanel)));
    win?.addEventListener?.("resize", () => {
        if (activePreviewType === "interactive") showInteractiveBrowserBounds();
    });

    api.onStarted?.(() => {
        setFormRunning(true);
        setStatus("running", "Running");
    });
    const unsubscribeBrowserBatchEvent = api.onBrowserBatchEvent?.((event) => renderBrowserBatchEvent(event));
    api.onLog?.((line) => appendRunnerLog(line));
    api.onPreview?.((dataUrl) => {
        if (activePreviewType !== "live") return;
        if (!dataUrl) return resetBrowserPreview();
        browserPreviewImage.src = dataUrl;
        browserPreviewImage.classList.remove("hidden");
        browserPreviewEmpty.classList.add("hidden");
    });
    api.onFinished?.((result) => {
        if (resolveActiveCompletion(result)) {
            activeRunnerLog = null;
            return;
        }
        activeRunnerLog = null;
        setFormRunning(false);
        setStatus(result.code === 0 ? "passed" : "failed", result.code === 0 ? "Passed" : "Failed");
        appendLog(`\nFinished with code ${result.code}\n`);
    });
    api.onStopRequested?.(() => {
        void requestStop({notifyMain: false});
    });
    api.onDiscardUnsyncedResultSubmission?.(() => {
        setPendingResultSubmission(null);
    });
    const unsubscribeLgToolchainInstallProgress = api.onLgToolchainInstallProgress?.((event) => {
        renderSdkInstallProgress(event);
    });
    const unsubscribeBrowserToolchainInstallProgress = api.onBrowserToolchainInstallProgress?.((event) => {
        renderBrowserInstallProgress(event);
    });
    const unsubscribeLgRunStatus = api.onLgRunStatus?.((event) => renderLgRunStatus(event));
    const unsubscribeLgRunPreview = api.onLgRunPreview?.((dataUrl) => renderLgPreview(dataUrl));
    win?.addEventListener?.("beforeunload", () => {
        if (typeof unsubscribeLgToolchainInstallProgress === "function") unsubscribeLgToolchainInstallProgress();
        if (typeof unsubscribeBrowserToolchainInstallProgress === "function") unsubscribeBrowserToolchainInstallProgress();
        if (typeof unsubscribeLgRunStatus === "function") unsubscribeLgRunStatus();
        if (typeof unsubscribeLgRunPreview === "function") unsubscribeLgRunPreview();
        if (typeof unsubscribeBrowserBatchEvent === "function") unsubscribeBrowserBatchEvent();
    });

    initializeBrowserSlots();
    loadSettings();
    void refreshDnsHostStatus();
    void loadBrowserToolchainStatus();
    if (runTarget === "webos") void selectRunTarget("webos", {persist: false});
    updateFolderControls();
    updateRetrySyncButton();

    api.getAppVersion?.()
        .then((version) => {
            const versionEl = doc.getElementById("app-version");
            if (versionEl) versionEl.textContent = `v${version}`;
        })
        .catch((err) => console.error("Failed to load app version:", err));

    return {
        loadCases,
        loadFolders,
        loadCampaigns,
        renderCampaigns,
        renderFolders,
        loadCasesFromFolder,
        renderCaseList,
        renderCaseDetails,
        openCaseDetails,
        selectCase,
        getSelectedCaseIds,
        getActiveCampaignId: () => activeCampaignId,
        getActiveCacheKey: () => activeCacheKey,
        getActiveFolderId: () => activeFolderId,
        runBrowserBatch,
        renderBrowserBatchEvent,
        selectBrowserLogCase,
        runSelectedCases,
        retryResultSync,
        selectRunTarget,
        refreshLgRunAvailability,
        openLgBatchConfirmation,
        runLgSelectedCases,
        renderLgRunStatus,
        renderLgPreview,
        openTvDeviceDialog,
        closeTvDeviceDialog,
        submitTvDeviceDialog,
        checkTvDeviceConnection,
        toggleTvDevicePassphrase,
        loadTvToolchainConfiguration,
        inspectTvToolchain,
        loadLgToolchainStatus,
        loadLgCompatibilityCatalogStatus,
        loadLgCompatibilityProductGateStatus,
        loadBrowserToolchainStatus,
        loadSdkToolchainStatus,
        refreshLgCompatibilityCatalog,
        saveLgCompatibilityProductGateCredentials,
        openLgCompatibilityDialog,
        reviewLgCompatibilityInspection,
        confirmLgCompatibilityInspection,
        reviewLgCompatibilityValidation,
        confirmLgCompatibilityValidation,
        closeLgCompatibilityDialog,
        activateManagedLgToolchain,
        planLgToolchainSetup,
        installLgToolchain,
        planBrowserToolchainSetup,
        installBrowserToolchain,
        saveTvToolchainConfiguration,
        maskActionForDisplay,
        redactSensitiveText,
        validateRunValues,
    };
}

function bootstrapRenderer(dependencies) {
    const controller = createRendererController(dependencies);
    controller.loadCases();
    return controller;
}

if (typeof document !== "undefined" && typeof window !== "undefined" && window.mytvRunner) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrapRenderer);
    } else {
        bootstrapRenderer();
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        createRendererController,
        bootstrapRenderer,
        renderCaseList: (cases, dependencies) => createRendererController(dependencies).renderCaseList(cases),
        selectCase: (id, dependencies) => createRendererController(dependencies).selectCase(id),
        renderCaseDetails: (testCase, dependencies) => createRendererController(dependencies).renderCaseDetails(testCase),
        openCaseDetails: (id, dependencies) => createRendererController(dependencies).openCaseDetails(id),
        runSelectedCases: (values, dependencies) => createRendererController(dependencies).runSelectedCases(values),
        getSelectedCaseIds: (dependencies) => createRendererController(dependencies).getSelectedCaseIds(),
        maskActionForDisplay,
        redactSensitiveText,
        validateRunValues,
    };
}
