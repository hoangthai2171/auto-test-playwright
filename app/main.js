const path = require("node:path");
const fs = require("node:fs/promises");
const {spawn} = require("node:child_process");
const {app, BrowserView, BrowserWindow, ipcMain, shell} = require("electron");
const {loadLocalTestCases, loadCachedTestCases, findTestCaseById} = require("../tests/lib/test-case-source");
const {validateTestCaseList} = require("../tests/lib/test-case-schema");
const {redactSensitiveText, createLogRedactor} = require("./credential-redaction");
const {fetchFlowCaseFolders, fetchFlowCases, submitFlowCaseResults, normalizeTimeoutMs} = require("./flow-case-api");
const {replaceFolderCacheEntry, readMostRecentFolderCacheEntry} = require("./test-case-cache");
const {createEmptyReport, buildTestReportEntry, upsertTestReport, renderUserReport} = require("./test-report");

const INTERACTIVE_BROWSER_DEBUG_PORT = Number(process.env.MYTV_INTERACTIVE_BROWSER_DEBUG_PORT) || 43000 + Math.floor(Math.random() * 1000);

app.commandLine.appendSwitch("remote-debugging-port", String(INTERACTIVE_BROWSER_DEBUG_PORT));

let mainWindow;
let runningProcess;
let previewWatcher;
let interactiveView;
let interactiveViewScale = 1;
let interactiveAudioMuted = true;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1240,
        height: 900,
        minWidth: 920,
        minHeight: 760,
        title: "MyTV Auto Test",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
        },
    });

    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function testCasesCachePath() {
    return path.join(app.getPath("userData"), "testcases-cache.json");
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("load-test-cases", async () => {
    try {
        const cached = await readMostRecentFolderCacheEntry({cachePath: testCasesCachePath()});
        if (cached) {
            const cases = validateTestCaseList(cached.cases, "test-case cache");
            return {
                ok: true,
                source: "cache",
                folder: cached.folder,
                cases: cases.map(sanitizeCaseForUi),
            };
        }
    } catch (error) {
        console.warn(`Could not restore cached API test cases: ${error.message}`);
    }

    const fixturePath = path.join(app.getAppPath(), "testcased.json");
    const cases = await loadLocalTestCases(fixturePath);
    return {ok: true, source: "local", cases: cases.map(sanitizeCaseForUi)};
});

ipcMain.handle("load-flow-case-folders", async (_event, settings = {}) => {
    const result = await fetchFlowCaseFolders({
        apiDomain: settings.API_DOMAIN,
        authorization: settings.API_AUTHORIZATION,
        projectId: settings.PROJECT_ID,
        timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
    });
    return withApiLog(result);
});

ipcMain.handle("load-flow-cases", async (_event, settings = {}) => {
    const result = await fetchFlowCases({
        apiDomain: settings.API_DOMAIN,
        authorization: settings.API_AUTHORIZATION,
        projectId: settings.PROJECT_ID,
        folderName: settings.FOLDER_NAME,
        environment: settings.ENVIRONMENT,
        timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
    });
    if (!result.ok) return withApiLog(result);

    try {
        const folder = {
            id: settings.FOLDER_ID,
            name: settings.FOLDER_NAME_LABEL,
            fullPath: settings.FOLDER_NAME,
        };
        const cases = validateTestCaseList(result.cases, "flow-case API");
        await replaceFolderCacheEntry({cachePath: testCasesCachePath(), folder, cases});
        return {
            ok: true,
            folder,
            cases: cases.map(sanitizeCaseForUi),
            source: "api",
            apiLog: sanitizeApiLog(result),
        };
    } catch (error) {
        return {
            ok: false,
            message: error.message,
            timeout: false,
            apiLog: sanitizeApiLog(result),
        };
    }
});

ipcMain.handle("submit-flow-case-results", async (_event, values = {}) => {
    try {
        const payload = normalizeFlowCaseResultsPayload(values);
        const result = await submitFlowCaseResults({
            apiDomain: values.API_DOMAIN,
            authorization: values.API_AUTHORIZATION,
            projectId: values.PROJECT_ID,
            folderPath: payload.folderPath,
            testcases: payload.testcases,
            timeoutMs: normalizeTimeoutMs(values.API_TIMEOUT_SECONDS),
        });
        return withApiLog(result);
    } catch (error) {
        return {ok: false, message: error.message, timeout: false};
    }
});

function normalizeFlowCaseResultsPayload(values) {
    const folderPath = String(values.FOLDER_PATH ?? "").trim();
    if (!/^\/(?:[^/]+(?:\/[^/]+)*)?$/u.test(folderPath)) {
        throw new Error("Flow-case result folderPath must be an absolute path.");
    }

    if (!Array.isArray(values.testcases) || values.testcases.length === 0) {
        throw new Error("Flow-case results require at least one testcase.");
    }

    return {
        folderPath,
        testcases: values.testcases.map((testCase, index) => normalizeFlowCaseResult(testCase, index)),
    };
}

function normalizeFlowCaseResult(testCase, index) {
    const path = `testcases[${index}]`;
    if (!testCase || typeof testCase !== "object") {
        throw new Error(`${path} must be an object.`);
    }

    if (testCase.id === null || testCase.id === undefined || String(testCase.id).trim() === "") {
        throw new Error(`${path}.id is required.`);
    }

    if (testCase.status !== "tested") {
        throw new Error(`${path}.status must be tested.`);
    }

    const result = testCase.testResult;
    if (!result || typeof result !== "object" || !["success", "failed"].includes(result.status)) {
        throw new Error(`${path}.testResult.status must be success or failed.`);
    }

    const passed = Number(result.passed);
    const failed = Number(result.failed);
    if (!Number.isInteger(passed) || passed < 0 || !Number.isInteger(failed) || failed < 0) {
        throw new Error(`${path}.testResult.passed and failed must be non-negative integers.`);
    }
    if (result.status === "success" && failed !== 0) {
        throw new Error(`${path}.testResult.failed must be 0 for success.`);
    }
    if (result.status === "failed" && failed < 1) {
        throw new Error(`${path}.testResult.failed must be at least 1 for failed.`);
    }

    const message = String(result.message ?? "").trim();
    if (result.status === "failed" && !message) {
        throw new Error(`${path}.testResult.message is required for failed results.`);
    }

    const normalizedResult = {
        status: result.status,
        message,
        passed,
        failed,
    };
    if (result.finishedAt !== undefined && result.finishedAt !== null && String(result.finishedAt).trim()) {
        normalizedResult.finishedAt = String(result.finishedAt);
    }

    return {id: testCase.id, status: "tested", testResult: normalizedResult};
}

function withApiLog(result) {
    const {request, response, ...payload} = result;
    return {...payload, apiLog: sanitizeApiLog({request, response})};
}

function sanitizeApiLog(value) {
    return cloneApiLogValue(value);
}

function cloneApiLogValue(value, key = "") {
    if (/^(?:password|token|authorization|cookie|secret)$/iu.test(key)) {
        return "••••••";
    }

    if (Array.isArray(value)) {
        return value.map((item) => cloneApiLogValue(item));
    }

    if (typeof value === "string") {
        return redactSensitiveText(value);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, cloneApiLogValue(nestedValue, nestedKey)]));
}

function sanitizeCaseForUi(testCase) {
    return cloneForUi(testCase);
}

function cloneForUi(value) {
    if (Array.isArray(value)) {
        return value.map(cloneForUi);
    }

    if (typeof value === "string") {
        return redactSensitiveText(value);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, value.action === "login" && key === "password" ? "••••••" : cloneForUi(nestedValue)]));
}

ipcMain.handle("run-test", async (event, values = {}) => {
    if (runningProcess) {
        return {ok: false, message: "A test run is already in progress."};
    }

    const projectRoot = app.getAppPath();
    const fixturePath = path.join(projectRoot, "testcased.json");
    const outputRoot = app.getPath("userData");
    const reportDir = path.join(outputRoot, "playwright-report");
    const userReportDir = path.join(outputRoot, "user-report");
    const userReportHtmlFile = path.join(userReportDir, "test-report.html");
    const caseResultPath = path.join(userReportDir, "case-" + safeFileName(values.TEST_CASE_ID) + ".json");
    const testResultsDir = path.join(outputRoot, "test-results");
    let testCase;

    try {
        const cases = values.TEST_CASE_FOLDER_ID ? await loadCachedTestCases(testCasesCachePath(), values.TEST_CASE_FOLDER_ID) : await loadLocalTestCases(fixturePath);
        testCase = findTestCaseById(cases, values.TEST_CASE_ID);
    } catch (error) {
        return {ok: false, message: error.message};
    }

    const playwrightCli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
    const runnerBinary = testRunnerBinary();
    const usesElectronAsNode = runnerBinary === process.execPath;
    const previewPath = path.join(outputRoot, "browser-preview", "current.png");
    const previewType = values.PREVIEW_TYPE || "live";
    const interactiveCdpUrl = previewType === "interactive" ? `http://127.0.0.1:${INTERACTIVE_BROWSER_DEBUG_PORT}` : "";
    const args = [playwrightCli, "test", "tests/run-test-case-mytv.spec.js", "--project=chromium", "--output", testResultsDir];

    const env = {
        ...process.env,
        TEST_CASE_PATH: fixturePath,
        TEST_CASE_ID: String(testCase.id),
        TEST_CASE_CACHE_PATH: values.TEST_CASE_FOLDER_ID ? testCasesCachePath() : "",
        TEST_CASE_FOLDER_ID: values.TEST_CASE_FOLDER_ID ? String(values.TEST_CASE_FOLDER_ID) : "",
        APP_URL: values.APP_URL,
        PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath(projectRoot),
        PLAYWRIGHT_HTML_REPORT: reportDir,
        MYTV_CASE_RESULT_PATH: caseResultPath,
        MYTV_PREVIEW_PATH: previewType === "live" ? previewPath : "",
        MYTV_INTERACTIVE_CDP_URL: interactiveCdpUrl,
        MYTV_INTERACTIVE_VIEW_SCALE: interactiveCdpUrl ? String(interactiveViewScale) : "",
    };

    if (usesElectronAsNode) {
        env.ELECTRON_RUN_AS_NODE = "1";
    } else {
        delete env.ELECTRON_RUN_AS_NODE;
    }

    const initialLog = [
        `Runner: ${runnerBinary}`,
        `Cwd: ${projectRoot}`,
        "Specs: tests/run-test-case-mytv.spec.js",
        `Test case: ${testCase.id}`,
        `Browsers: ${env.PLAYWRIGHT_BROWSERS_PATH}`,
        `User report: ${userReportHtmlFile}`,
        `Playwright debug report: ${reportDir}`,
        `Preview type: ${previewType}`,
        previewType === "live" ? `Preview: ${previewPath}` : "",
        interactiveCdpUrl ? `Interactive CDP: ${interactiveCdpUrl}` : "",
        "",
    ]
        .filter(Boolean)
        .join("\n");

    runningProcess = spawn(runnerBinary, args, {
        cwd: projectRoot,
        env,
        stdio: ["ignore", "pipe", "pipe"],
    });

    event.sender.send("test-started");
    event.sender.send("browser-preview", "");
    if (previewType === "live") {
        previewWatcher = startPreviewWatcher(event, previewPath);
    }

    const processFinishState = {done: false};
    const stdoutLogRedactor = createLogRedactor((text) => event.sender.send("test-log", text));
    const stderrLogRedactor = createLogRedactor((text) => event.sender.send("test-log", text));

    runningProcess.stdout.on("data", (chunk) => {
        stdoutLogRedactor.push(chunk.toString());
    });

    runningProcess.stderr.on("data", (chunk) => {
        stderrLogRedactor.push(chunk.toString());
    });

    runningProcess.on("error", (error) => {
        void finishTestProcess({
            event,
            testCase,
            caseResultPath,
            stdoutLogRedactor,
            stderrLogRedactor,
            processFinishState,
            code: 1,
            message: error.message,
        });
    });

    runningProcess.on("exit", (code, signal) => {
        void finishTestProcess({
            event,
            testCase,
            caseResultPath,
            stdoutLogRedactor,
            stderrLogRedactor,
            processFinishState,
            code: code ?? 1,
            signal,
        });
    });

    return {ok: true, initialLog};
});

async function finishTestProcess({event, testCase, caseResultPath, stdoutLogRedactor, stderrLogRedactor, processFinishState, code, signal, message}) {
    if (processFinishState.done) return;
    processFinishState.done = true;
    const outputRoot = app.getPath("userData");
    const reportJson = userReportJsonPath();
    const reportHtml = userReportHtmlPath();
    let caseResult;

    try {
        caseResult = JSON.parse(await fs.readFile(caseResultPath, "utf8"));
    } catch {
        caseResult = null;
    }

    try {
        const current = JSON.parse(await fs.readFile(reportJson, "utf8"));
        const entry = buildTestReportEntry({
            testCaseId: testCase.id,
            testCaseName: testCase.name,
            exitCode: code,
            caseResult,
            errorMessage: message,
        });
        const updated = upsertTestReport(current, entry);
        await fs.writeFile(reportJson, JSON.stringify(updated, null, 2), "utf8");
        await fs.writeFile(reportHtml, renderUserReport(updated), "utf8");
    } catch (error) {
        message = message || error.message;
    }

    stdoutLogRedactor.flush();
    stderrLogRedactor.flush();
    stopPreviewWatcher();
    applyInteractiveViewFitZoom();
    event.sender.send("test-finished", {
        code,
        signal,
        message,
        reportPath: reportHtml,
        debugReportPath: path.join(outputRoot, "playwright-report", "index.html"),
        caseResult,
    });
    runningProcess = null;
}

ipcMain.handle("start-report", async () => {
    const report = createEmptyReport();
    const jsonPath = userReportJsonPath();
    const htmlPath = userReportHtmlPath();
    await fs.mkdir(path.dirname(jsonPath), {recursive: true});
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
    await fs.writeFile(htmlPath, renderUserReport(report), "utf8");
    return {ok: true, reportPath: htmlPath};
});

ipcMain.handle("stop-test", async () => {
    if (!runningProcess) return {ok: true};
    runningProcess.kill();
    runningProcess = null;
    stopPreviewWatcher();
    applyInteractiveViewFitZoom();
    return {ok: true};
});

ipcMain.handle("show-interactive-browser", async (_event, values) => {
    if (!mainWindow) return {ok: false, message: "Main window is not ready."};

    if (!interactiveView) {
        interactiveView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        interactiveView.webContents.setAudioMuted(interactiveAudioMuted);
    }

    if (!mainWindow.getBrowserViews().includes(interactiveView)) {
        mainWindow.addBrowserView(interactiveView);
    }

    setInteractiveViewBounds(values.bounds);
    if (values.url) {
        await loadInteractiveView(values.url);
    }
    return {ok: true};
});

ipcMain.handle("hide-interactive-browser", async () => {
    hideInteractiveView();
    return {ok: true};
});

ipcMain.handle("suspend-interactive-browser", async () => {
    suspendInteractiveView();
    return {ok: true};
});

ipcMain.handle("resume-interactive-browser", async (_event, values) => {
    if (!interactiveView || !mainWindow) return {ok: true};

    if (!mainWindow.getBrowserViews().includes(interactiveView)) {
        mainWindow.addBrowserView(interactiveView);
    }

    setInteractiveViewBounds(values?.bounds || {});
    return {ok: true};
});

ipcMain.handle("set-interactive-browser-muted", async (_event, muted) => {
    interactiveAudioMuted = Boolean(muted);
    if (interactiveView && !interactiveView.webContents.isDestroyed()) {
        interactiveView.webContents.setAudioMuted(interactiveAudioMuted);
    }
    return {ok: true};
});

ipcMain.handle("open-report", async () => {
    const target = reportPath();
    const result = await shell.openPath(target);
    return {ok: !result, message: result};
});

ipcMain.handle("show-report-folder", async () => {
    shell.showItemInFolder(reportPath());
    return {ok: true};
});

function reportPath() {
    return userReportHtmlPath();
}

function userReportJsonPath() {
    return path.join(app.getPath("userData"), "user-report", "test-report.json");
}

function userReportHtmlPath() {
    return path.join(app.getPath("userData"), "user-report", "test-report.html");
}

function safeFileName(value) {
    return (
        String(value || "case")
            .replace(/[^a-z0-9_-]+/giu, "-")
            .replace(/^-+|-+$/g, "") || "case"
    );
}

function playwrightBrowsersPath(projectRoot) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "playwright-browsers");
    }

    return path.join(projectRoot, ".playwright-browsers");
}

function testRunnerBinary() {
    if (!app.isPackaged && process.env.MYTV_NODE_BINARY) {
        return process.env.MYTV_NODE_BINARY;
    }

    return process.execPath;
}

function setInteractiveViewBounds(bounds = {}) {
    if (!interactiveView) return;

    const logicalWidth = 1920;
    const logicalHeight = 1080;
    const containerWidth = Math.max(Math.round(bounds.width || logicalWidth), 1);
    const containerHeight = Math.max(Math.round(bounds.height || logicalHeight), 1);
    const scale = Math.min(containerWidth / logicalWidth, containerHeight / logicalHeight, 1);
    interactiveViewScale = scale;
    const visualWidth = Math.max(Math.floor(logicalWidth * scale), 1);
    const visualHeight = Math.max(Math.floor(logicalHeight * scale), 1);
    const x = Math.round((bounds.x || 0) + Math.max((containerWidth - visualWidth) / 2, 0));
    const y = Math.round((bounds.y || 0) + Math.max((containerHeight - visualHeight) / 2, 0));

    interactiveView.setBounds({
        x,
        y,
        width: visualWidth,
        height: visualHeight,
    });
    applyInteractiveViewZoom();
    interactiveView.setAutoResize({width: false, height: false});
}

function loadInteractiveView(url) {
    return new Promise((resolve) => {
        const webContents = interactiveView.webContents;
        let resolved = false;
        const finish = () => {
            if (resolved) return;
            resolved = true;
            webContents.off("did-finish-load", finish);
            webContents.off("did-fail-load", finish);
            applyInteractiveViewZoom();
            resolve();
        };

        webContents.once("did-finish-load", finish);
        webContents.once("did-fail-load", finish);
        webContents.loadURL(url);
        setTimeout(finish, 8000);
    });
}

function hideInteractiveView() {
    if (!mainWindow || !interactiveView) return;
    if (mainWindow.getBrowserViews().includes(interactiveView)) {
        mainWindow.removeBrowserView(interactiveView);
    }
}

function suspendInteractiveView() {
    if (!mainWindow || !interactiveView) return;
    if (mainWindow.getBrowserViews().includes(interactiveView)) {
        mainWindow.removeBrowserView(interactiveView);
    }
}

function applyInteractiveViewZoom() {
    if (!interactiveView || interactiveView.webContents.isDestroyed()) return;
    interactiveView.webContents.setZoomFactor(1);
}

function applyInteractiveViewFitZoom() {
    if (!interactiveView || interactiveView.webContents.isDestroyed()) return;
    setTimeout(() => {
        if (!interactiveView || interactiveView.webContents.isDestroyed()) return;
        interactiveView.webContents.setZoomFactor(interactiveViewScale);
    }, 700);
}

function startPreviewWatcher(event, previewPath) {
    let lastMtime = 0;

    return setInterval(async () => {
        try {
            const stat = await fs.stat(previewPath);
            if (stat.mtimeMs <= lastMtime) return;

            lastMtime = stat.mtimeMs;
            const image = await fs.readFile(previewPath);
            event.sender.send("browser-preview", `data:image/png;base64,${image.toString("base64")}`);
        } catch {
            // The first screenshot is created after Playwright opens the app page.
        }
    }, 700);
}

function stopPreviewWatcher() {
    if (!previewWatcher) return;
    clearInterval(previewWatcher);
    previewWatcher = null;
}
