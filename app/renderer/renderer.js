function maskActionForDisplay(action) {
    const displayAction = {...action};
    if (displayAction.action === "login" && Object.prototype.hasOwnProperty.call(displayAction, "password")) {
        displayAction.password = "••••••";
    }
    return displayAction;
}

function validateRunValues(values) {
    if (!values?.TEST_CASE_ID?.trim()) {
        return "Vui lòng chọn một test case trước khi chạy.";
    }

    return "";
}

function createRendererController({document, windowRef, runner, storage} = {}) {
    const doc = document || globalThis.document;
    const win = windowRef || globalThis.window;
    const api = runner || win?.mytvRunner;
    const store = storage || win?.localStorage;
    const get = (id) => doc?.querySelector(`#${id}`);
    const form = get("test-form");
    const appUrlInput = get("app-url-input");
    const testCaseList = get("test-case-list");
    const testCaseDetails = get("test-case-details");
    const selectedTestCaseId = get("selected-test-case-id");
    const formMessage = get("form-message");
    const runButton = get("run-button");
    const stopButton = get("stop-button");
    const statusDot = get("status-dot");
    const statusText = get("status-text");
    const logOutput = get("log-output");
    const browserMuteButton = get("browser-mute-button");
    const browserPreviewEmpty = get("browser-preview-empty");
    const browserPreviewImage = get("browser-preview-image");
    const interactiveBrowser = get("interactive-browser");
    const settingsModal = get("settings-modal");
    const logsModal = get("logs-modal");
    const settingsMessage = get("settings-message");
    const settingsNavItems = doc?.querySelectorAll?.("[data-settings-panel]") || [];
    const settingsPanels = doc?.querySelectorAll?.("[data-settings-content]") || [];
    let cases = [];
    let selectedCase = null;
    let activePreviewType = "live";
    let browserMuted = true;

    function setFormMessage(message, type = "") {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`.trim();
        formMessage.classList.toggle("hidden", !message);
    }

    function appendLog(value) {
        if (!logOutput) return;
        logOutput.textContent += value;
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    function clearLog() {
        if (logOutput) logOutput.textContent = "";
    }

    function setStatus(status, text) {
        if (statusDot) statusDot.className = `status-dot ${status}`;
        if (statusText) statusText.textContent = text;
    }

    function renderCaseList(nextCases = cases) {
        cases = nextCases;
        if (!testCaseList) return;
        testCaseList.replaceChildren();
        cases.forEach((testCase) => {
            const card = doc.createElement("button");
            card.type = "button";
            card.className = "test-case-card";
            card.dataset.testCaseId = testCase.id;
            card.setAttribute("role", "option");
            card.setAttribute("aria-selected", "false");
            const title = doc.createElement("strong");
            title.textContent = testCase.name || `Test case ${testCase.id}`;
            const metadata = doc.createElement("span");
            metadata.className = "test-case-card-meta";
            metadata.textContent = `${testCase.id} · ${testCase.platform || "unknown"}`;
            card.append(title, metadata);
            card.addEventListener("click", () => selectCase(testCase.id));
            testCaseList.append(card);
        });
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
        content.textContent = value || "—";
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

    function selectCase(testCaseId) {
        selectedCase = cases.find((testCase) => String(testCase.id) === String(testCaseId)) || null;
        if (selectedTestCaseId) selectedTestCaseId.value = selectedCase ? String(selectedCase.id) : "";
        testCaseList?.querySelectorAll?.("[data-test-case-id]").forEach((card) => {
            const isSelected = selectedCase && String(card.dataset.testCaseId) === String(selectedCase.id);
            card.classList.toggle("selected", Boolean(isSelected));
            card.setAttribute("aria-selected", String(Boolean(isSelected)));
        });
        renderCaseDetails(selectedCase);
        setFormMessage("");
    }

    async function loadCases() {
        try {
            const response = await api.loadTestCases();
            if (!response?.ok) throw new Error(response?.message || "Không thể tải test cases.");
            renderCaseList(response.cases || []);
            if (response.cases?.length) selectCase(response.cases[0].id);
            return response;
        } catch (error) {
            renderCaseList([]);
            setFormMessage(`Không thể tải test cases: ${error.message}`, "error");
            return {ok: false, message: error.message, cases: []};
        }
    }

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
        if (runButton) runButton.disabled = isRunning;
        if (stopButton) stopButton.disabled = !isRunning;
    }

    function selectSettingsPanel(name) {
        settingsNavItems.forEach((item) => item.classList.toggle("active", item.dataset.settingsPanel === name));
        settingsPanels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.settingsContent !== name));
    }

    function openModal(modal) {
        if (modal) modal.classList.remove("hidden");
    }

    function closeModal(modal) {
        if (modal) modal.classList.add("hidden");
    }

    function savePreviewSettings() {
        activePreviewType = readPreviewType();
        store?.setItem?.("mytv-auto-test-settings", JSON.stringify({PREVIEW_TYPE: activePreviewType}));
        if (settingsMessage) settingsMessage.textContent = "Saved";
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearLog();
        setFormMessage("");
        const values = {
            APP_URL: appUrlInput?.value?.trim() || "",
            TEST_CASE_ID: selectedTestCaseId?.value || "",
            PREVIEW_TYPE: activePreviewType,
        };
        const validationMessage = validateRunValues(values);
        if (validationMessage) {
            setFormMessage(validationMessage, "error");
            return;
        }
        setStatus("running", "Running");
        try {
            await preparePreview(values);
            const response = await api.runTest(values);
            if (response?.initialLog) appendLog(response.initialLog);
            if (!response?.ok) {
                resetBrowserPreview();
                appendLog(`${response?.message || "Failed to start"}\n`);
                setFormMessage(response?.uiMessage || response?.message || "Failed to start", "error");
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
            await showInteractiveBrowser(values.APP_URL);
        }
    }

    async function showInteractiveBrowser(appUrl) {
        const stage = doc?.querySelector?.(".browser-preview-stage");
        const bounds = stage?.getBoundingClientRect?.() || {x: 0, y: 0, width: 0, height: 0};
        await api.showInteractiveBrowser({url: interactiveUrl(appUrl), bounds});
    }

    async function showInteractiveBrowserBounds() {
        const stage = doc?.querySelector?.(".browser-preview-stage");
        const bounds = stage?.getBoundingClientRect?.() || {x: 0, y: 0, width: 0, height: 0};
        await api.resumeInteractiveBrowser({bounds});
    }

    async function setBrowserMuted(muted) {
        browserMuted = muted;
        if (browserMuteButton) browserMuteButton.textContent = muted ? "Unmute" : "Mute";
        await api.setInteractiveBrowserMuted(muted);
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
        browserPreviewImage?.removeAttribute?.("src");
        browserPreviewImage?.classList.add("hidden");
        interactiveBrowser?.classList.add("hidden");
        browserMuteButton?.classList.add("hidden");
        api.hideInteractiveBrowser?.();
        browserPreviewEmpty?.classList.remove("hidden");
    }

    form?.addEventListener?.("submit", handleSubmit);
    get("stop-button")?.addEventListener?.("click", async () => {
        await api.stopTest();
        setFormRunning(false);
        setStatus("idle", "Stopped");
    });
    get("open-report-button")?.addEventListener?.("click", () => api.openReport());
    get("show-report-button")?.addEventListener?.("click", () => api.showReportFolder());
    get("settings-button")?.addEventListener?.("click", () => openModal(settingsModal));
    get("logs-button")?.addEventListener?.("click", () => openModal(logsModal));
    get("settings-close-button")?.addEventListener?.("click", () => closeModal(settingsModal));
    get("logs-close-button")?.addEventListener?.("click", () => closeModal(logsModal));
    settingsModal?.querySelector?.("[data-close-settings]")?.addEventListener?.("click", () => closeModal(settingsModal));
    logsModal?.querySelector?.("[data-close-logs]")?.addEventListener?.("click", () => closeModal(logsModal));
    get("gui-settings-save-button")?.addEventListener?.("click", savePreviewSettings);
    browserMuteButton?.addEventListener?.("click", () => setBrowserMuted(!browserMuted));
    settingsNavItems.forEach((item) => item.addEventListener("click", () => selectSettingsPanel(item.dataset.settingsPanel)));
    win?.addEventListener?.("resize", () => {
        if (activePreviewType === "interactive") showInteractiveBrowserBounds();
    });

    api.onStarted?.(() => {
        setFormRunning(true);
        setStatus("running", "Running");
    });
    api.onLog?.((line) => appendLog(line));
    api.onPreview?.((dataUrl) => {
        if (activePreviewType !== "live") return;
        if (!dataUrl) return resetBrowserPreview();
        browserPreviewImage.src = dataUrl;
        browserPreviewImage.classList.remove("hidden");
        browserPreviewEmpty.classList.add("hidden");
    });
    api.onFinished?.((result) => {
        setFormRunning(false);
        setStatus(result.code === 0 ? "passed" : "failed", result.code === 0 ? "Passed" : "Failed");
        appendLog(`\nFinished with code ${result.code}\n`);
    });

    return {
        loadCases,
        renderCaseList,
        renderCaseDetails,
        selectCase,
        maskActionForDisplay,
        validateRunValues,
    };
}

function bootstrapRenderer() {
    const controller = createRendererController();
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
        renderCaseList: (cases, dependencies) => createRendererController(dependencies).renderCaseList(cases),
        selectCase: (id, dependencies) => createRendererController(dependencies).selectCase(id),
        renderCaseDetails: (testCase, dependencies) => createRendererController(dependencies).renderCaseDetails(testCase),
        maskActionForDisplay,
        validateRunValues,
    };
}
