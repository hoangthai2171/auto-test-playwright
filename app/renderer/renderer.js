function maskActionForDisplay(action) {
    const displayAction = {...action};
    if (displayAction.action === "login" && Object.prototype.hasOwnProperty.call(displayAction, "password")) {
        displayAction.password = "••••••";
    }
    return displayAction;
}

function redactSensitiveText(value) {
    return String(value ?? "")
        .replace(/((?:tài khoản|tai khoan|username|user)\s*[=:]?\s*[^\/\s,;:]+)\s*\/\s*([^\s]+)/gi, "$1/••••••")
        .replace(/((?:mật khẩu|mat khau|password)\s*[=:]?\s*)([^\s]+)/gi, "$1••••••")
        .replace(/("password"\s*:\s*")[^"]*(")/gi, "$1••••••$2");
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
    const selectedCaseIds = Array.isArray(values?.selectedCaseIds)
        ? values.selectedCaseIds.filter((id) => String(id).trim())
        : values?.TEST_CASE_ID?.trim()
            ? [values.TEST_CASE_ID.trim()]
            : [];
    if (!selectedCaseIds.length) {
        return "Vui lòng chọn một test case trước khi chạy.";
    }

    return "";
}

const DEFAULT_SETTINGS = {
    APP_URL: "https://html5stage.mytv.vn/",
    API_DOMAIN: "http://172.16.240.254:30100",
    PROJECT_ID: "1",
    ENVIRONMENT: "UI",
    API_TIMEOUT_SECONDS: "30",
    PREVIEW_TYPE: "live",
};

function createRendererController({document, windowRef, runner, storage} = {}) {
    const doc = document || globalThis.document;
    const win = windowRef || globalThis.window;
    const api = runner || win?.mytvRunner;
    const store = storage || win?.localStorage;
    const get = (id) => doc?.querySelector(`#${id}`);
    const form = get("test-form");
    const folderSelect = get("folder-select");
    const refreshFoldersButton = get("refresh-folders-button");
    const getTestCasesButton = get("get-test-cases-button");
    const apiLoadingOverlay = get("api-loading-overlay");
    const settingsAppUrlInput = get("settings-app-url-input");
    const apiDomainInput = get("api-domain-input");
    const projectIdInput = get("project-id-input");
    const environmentSelect = get("environment-select");
    const apiTimeoutInput = get("api-timeout-input");
    const testCaseList = get("test-case-list");
    const testCaseListBody = get("test-case-list-body") || testCaseList;
    const testCaseSearchInput = get("test-case-search-input");
    const selectAllTestCases = get("select-all-test-cases");
    const selectedTestCaseCount = get("selected-test-case-count");
    const testCaseDetails = get("test-case-details");
    const testCaseDetailsModal = get("test-case-details-modal");
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
    const selectedCaseIds = new Set();
    const caseStatuses = new Map();
    const visibleCaseIds = new Set();
    let batchState = null;
    let activeCompletion = null;
    let activePreviewType = "live";
    let browserMuted = true;
    let settings = {...DEFAULT_SETTINGS};
    let activeFolderId = "";
    const foldersByPath = new Map();
    let apiRequestDepth = 0;
    const blockApiInteraction = (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
    };

    function loadSettings() {
        let saved = {};
        try {
            saved = JSON.parse(store?.getItem?.("mytv-auto-test-settings") || "{}");
        } catch {
            saved = {};
        }
        settings = {
            ...DEFAULT_SETTINGS,
            ...saved,
            ENVIRONMENT: ["API", "UI"].includes(saved.ENVIRONMENT) ? saved.ENVIRONMENT : DEFAULT_SETTINGS.ENVIRONMENT,
            API_TIMEOUT_SECONDS: Number(saved.API_TIMEOUT_SECONDS) > 0
                ? String(saved.API_TIMEOUT_SECONDS)
                : DEFAULT_SETTINGS.API_TIMEOUT_SECONDS,
            PREVIEW_TYPE: ["none", "live", "interactive"].includes(saved.PREVIEW_TYPE)
                ? saved.PREVIEW_TYPE
                : DEFAULT_SETTINGS.PREVIEW_TYPE,
        };
        activePreviewType = settings.PREVIEW_TYPE;
        if (settingsAppUrlInput) settingsAppUrlInput.value = settings.APP_URL;
        if (apiDomainInput) apiDomainInput.value = settings.API_DOMAIN;
        if (projectIdInput) projectIdInput.value = settings.PROJECT_ID;
        if (environmentSelect) environmentSelect.value = settings.ENVIRONMENT;
        if (apiTimeoutInput) apiTimeoutInput.value = settings.API_TIMEOUT_SECONDS;
        doc?.querySelectorAll?.('[name="preview-type"]').forEach((input) => {
            input.checked = input.value === activePreviewType;
        });
    }

    function currentSettings() {
        const timeoutSeconds = Number(apiTimeoutInput?.value);
        return {
            ...settings,
            APP_URL: settingsAppUrlInput?.value?.trim() || settings.APP_URL,
            API_DOMAIN: apiDomainInput?.value?.trim() || settings.API_DOMAIN,
            PROJECT_ID: projectIdInput?.value?.trim() || settings.PROJECT_ID,
            ENVIRONMENT: ["API", "UI"].includes(environmentSelect?.value)
                ? environmentSelect.value
                : settings.ENVIRONMENT,
            API_TIMEOUT_SECONDS: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
                ? String(timeoutSeconds)
                : settings.API_TIMEOUT_SECONDS,
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

    function appendLog(value) {
        if (!logOutput) return;
        logOutput.textContent += redactSensitiveText(value);
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    function clearLog() {
        if (logOutput) logOutput.textContent = "";
    }

    function setStatus(status, text) {
        if (statusDot) statusDot.className = `status-dot ${status}`;
        if (statusText) statusText.textContent = text;
    }

    function getSelectedCaseIds() {
        return cases
            .filter((testCase) => selectedCaseIds.has(String(testCase.id)))
            .map((testCase) => String(testCase.id));
    }

    function getVisibleCaseIds() {
        return cases
            .filter((testCase) => visibleCaseIds.has(String(testCase.id)))
            .map((testCase) => String(testCase.id));
    }

    function updateSelectionUi() {
        const selectedIds = getSelectedCaseIds();
        const visibleIds = getVisibleCaseIds();
        if (selectedTestCaseCount) selectedTestCaseCount.textContent = `${selectedIds.length} selected`;
        if (runButton) {
            runButton.textContent = `Run Selected (${selectedIds.length})`;
            runButton.disabled = selectedIds.length === 0;
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
            detailButton.addEventListener("click", () => openCaseDetails(testCase.id));
            detailCell.append(detailButton);

            const statusCell = doc.createElement("td");
            statusCell.append(renderStatusCell(testCase.id));

            row.append(selectionCell, idCell, nameCell, detailCell, statusCell);
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
        const displayValue = value === undefined || value === null || value === ""
            ? "—"
            : typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value);
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
            ["Metadata", testCase.metadata || {
                category: testCase.category,
                status: testCase.status,
                mode: testCase.mode,
                scriptVersion: testCase.scriptVersion,
                projectId: testCase.projectId,
                folderId: testCase.folderId,
                slug: testCase.slug,
            }],
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
        if (refreshFoldersButton) refreshFoldersButton.disabled = apiRequestDepth > 0;
        if (folderSelect) folderSelect.disabled = apiRequestDepth > 0;
    }

    function renderFolders(nextFolders = []) {
        foldersByPath.clear();
        const selectedPath = folderSelect?.value || "";
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

    async function loadFolders() {
        beginApiRequest();
        try {
            const response = await api.loadFlowCaseFolders(currentSettings());
            if (!response?.ok) {
                showApiError(response);
                return response;
            }
            renderFolders(response.folders || []);
            return response;
        } catch (error) {
            const response = {ok: false, message: error.message, timeout: Boolean(error.timeout)};
            showApiError(response);
            return response;
        } finally {
            endApiRequest();
            updateFolderControls();
        }
    }

    async function loadCasesFromFolder() {
        const selectedFolder = foldersByPath.get(folderSelect?.value || "");
        if (!selectedFolder) {
            setFormMessage("Please select a folder first.", "error");
            return {ok: false, message: "Please select a folder first."};
        }

        beginApiRequest();
        try {
            const response = await api.loadFlowCases({
                ...currentSettings(),
                FOLDER_ID: String(selectedFolder.id),
                FOLDER_NAME: selectedFolder.fullPath,
                FOLDER_NAME_LABEL: selectedFolder.name,
            });
            if (!response?.ok) {
                showApiError(response);
                return response;
            }
            activeFolderId = String(response.folder?.id ?? selectedFolder.id);
            renderCaseList(response.cases || []);
            setFormMessage(`Loaded ${response.cases?.length || 0} test cases.`, "ok");
            return response;
        } catch (error) {
            const response = {ok: false, message: error.message, timeout: Boolean(error.timeout)};
            showApiError(response);
            return response;
        } finally {
            endApiRequest();
            updateFolderControls();
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
        if (runButton) runButton.disabled = isRunning || getSelectedCaseIds().length === 0;
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
        updateFolderControls();
    });
    refreshFoldersButton?.addEventListener?.("click", () => loadFolders());
    getTestCasesButton?.addEventListener?.("click", () => loadCasesFromFolder());

    function savePreviewSettings() {
        activePreviewType = readPreviewType();
        const timeoutSeconds = Number(apiTimeoutInput?.value);
        settings = {
            APP_URL: settingsAppUrlInput?.value?.trim() || DEFAULT_SETTINGS.APP_URL,
            API_DOMAIN: apiDomainInput?.value?.trim() || DEFAULT_SETTINGS.API_DOMAIN,
            PROJECT_ID: projectIdInput?.value?.trim() || DEFAULT_SETTINGS.PROJECT_ID,
            ENVIRONMENT: ["API", "UI"].includes(environmentSelect?.value) ? environmentSelect.value : DEFAULT_SETTINGS.ENVIRONMENT,
            API_TIMEOUT_SECONDS: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
                ? String(timeoutSeconds)
                : DEFAULT_SETTINGS.API_TIMEOUT_SECONDS,
            PREVIEW_TYPE: activePreviewType,
        };
        if (apiTimeoutInput) apiTimeoutInput.value = settings.API_TIMEOUT_SECONDS;
        store?.setItem?.("mytv-auto-test-settings", JSON.stringify(settings));
        if (settingsMessage) settingsMessage.textContent = "Saved";
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

    async function runSingleCase(testCaseId, values, currentBatch) {
        const payload = {
            APP_URL: values.APP_URL,
            TEST_CASE_ID: String(testCaseId),
            PREVIEW_TYPE: values.PREVIEW_TYPE,
        };
        if (values.TEST_CASE_FOLDER_ID) payload.TEST_CASE_FOLDER_ID = String(values.TEST_CASE_FOLDER_ID);
        currentBatch.activeCaseId = String(testCaseId);
        renderCaseStatus(testCaseId, "running");
        const completion = new Promise((resolve) => {
            activeCompletion = resolve;
        });

        try {
            await preparePreview(payload);
            const response = await api.runTest(payload);
            if (response?.initialLog) appendLog(response.initialLog);
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
            return {passed, stopped: Boolean(result?.stopped)};
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

        const currentBatch = {ids, activeCaseId: null, stopRequested: false};
        batchState = currentBatch;
        ids.forEach((id) => renderCaseStatus(id, ""));
        setFormRunning(true);
        setStatus("running", "Running");
        let completed = 0;
        let failed = 0;
        let skipped = 0;
        let stopped = false;

        try {
            for (const id of ids) {
                if (currentBatch.stopRequested) {
                    renderCaseStatus(id, "skipped");
                    skipped += 1;
                    continue;
                }

                const result = await runSingleCase(id, values, currentBatch);
                if (result.passed) completed += 1;
                else failed += 1;
                if (result.stopped) {
                    stopped = true;
                    currentBatch.stopRequested = true;
                }
            }
        } finally {
            batchState = null;
            setFormRunning(false);
        }

        const summary = `Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`;
        setStatus(failed > 0 || stopped ? "failed" : "passed", failed > 0 || stopped ? "Failed" : "Passed");
        setFormMessage(summary, failed > 0 || stopped ? "error" : "ok");
        return {completed, failed, skipped, stopped};
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearLog();
        setFormMessage("");
        const runSettings = currentSettings();
        const values = {
            APP_URL: runSettings.APP_URL,
            PREVIEW_TYPE: activePreviewType,
        };
        if (activeFolderId) values.TEST_CASE_FOLDER_ID = activeFolderId;
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
        if (batchState) {
            batchState.stopRequested = true;
            try {
                await api.stopTest();
            } finally {
                resolveActiveCompletion({code: 1, stopped: true});
            }
            return;
        }
        await api.stopTest();
        setFormRunning(false);
        setStatus("idle", "Stopped");
    });
    get("open-report-button")?.addEventListener?.("click", () => api.openReport());
    get("show-report-button")?.addEventListener?.("click", () => api.showReportFolder());
    get("settings-button")?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        selectSettingsPanel("gui");
        openModal(settingsModal);
    });
    get("logs-button")?.addEventListener?.("click", async () => {
        await suspendInteractiveBrowserForModal();
        openModal(logsModal);
    });
    get("settings-close-button")?.addEventListener?.("click", async () => {
        closeModal(settingsModal);
        await resumeInteractiveBrowserAfterModal();
    });
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
        closeModal(settingsModal);
        await resumeInteractiveBrowserAfterModal();
    });
    logsModal?.querySelector?.("[data-close-logs]")?.addEventListener?.("click", async () => {
        closeModal(logsModal);
        await resumeInteractiveBrowserAfterModal();
    });
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
        if (resolveActiveCompletion(result)) return;
        setFormRunning(false);
        setStatus(result.code === 0 ? "passed" : "failed", result.code === 0 ? "Passed" : "Failed");
        appendLog(`\nFinished with code ${result.code}\n`);
    });

    loadSettings();
    updateFolderControls();

    return {
        loadCases,
        loadFolders,
        renderFolders,
        loadCasesFromFolder,
        renderCaseList,
        renderCaseDetails,
        openCaseDetails,
        selectCase,
        getSelectedCaseIds,
        getActiveFolderId: () => activeFolderId,
        runSelectedCases,
        maskActionForDisplay,
        redactSensitiveText,
        validateRunValues,
    };
}

function bootstrapRenderer() {
    const controller = createRendererController();
    controller.loadCases();
    controller.loadFolders();
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
        openCaseDetails: (id, dependencies) => createRendererController(dependencies).openCaseDetails(id),
        runSelectedCases: (values, dependencies) => createRendererController(dependencies).runSelectedCases(values),
        getSelectedCaseIds: (dependencies) => createRendererController(dependencies).getSelectedCaseIds(),
        maskActionForDisplay,
        redactSensitiveText,
        validateRunValues,
    };
}
