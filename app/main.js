const path = require("node:path");
const fs = require("node:fs/promises");
const {spawn} = require("node:child_process");
const {app, BrowserView, BrowserWindow, ipcMain, shell} = require("electron");
const {loadLocalTestCases, findTestCaseById} = require("../tests/lib/test-case-source");

const INTERACTIVE_BROWSER_DEBUG_PORT =
    Number(process.env.MYTV_INTERACTIVE_BROWSER_DEBUG_PORT) ||
    43000 + Math.floor(Math.random() * 1000);

app.commandLine.appendSwitch("remote-debugging-port", String(INTERACTIVE_BROWSER_DEBUG_PORT));

let mainWindow;
let runningProcess;
let previewWatcher;
let interactiveView;
let interactiveViewScale = 1;
let interactiveAudioMuted = true;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1040,
        height: 760,
        minWidth: 920,
        minHeight: 680,
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
    const fixturePath = path.join(app.getAppPath(), "testcased.json");
    const cases = await loadLocalTestCases(fixturePath);
    return {ok: true, source: "local", cases: cases.map(sanitizeCaseForUi)};
});

function sanitizeCaseForUi(testCase) {
    return cloneForUi(testCase);
}

function redactSensitiveText(value) {
    return String(value ?? "")
        .replace(/((?:tài khoản|tai khoan|username|user)\s*[=:]?\s*[\w.+-]+)\s*\/\s*([^\s,.;)\]}]+)/gi, "$1/••••••")
        .replace(/((?:mật khẩu|mat khau|password)\s*[=:]?\s*)([^\s,.;)\]}]+)/gi, "$1••••••")
        .replace(/("password"\s*:\s*")[^"]*(")/gi, "$1••••••$2");
}

function cloneForUi(value) {
    if (Array.isArray(value)) {
        return value.map(cloneForUi);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
            key,
            value.action === "login" && key === "password" ? "••••••" : cloneForUi(nestedValue),
        ])
    );
}

ipcMain.handle("run-test", async (event, values = {}) => {
    if (runningProcess) {
        return {ok: false, message: "A test run is already in progress."};
    }

    const projectRoot = app.getAppPath();
    const fixturePath = path.join(projectRoot, "testcased.json");
    const outputRoot = app.getPath("userData");
    const reportDir = path.join(outputRoot, "playwright-report");
    const testResultsDir = path.join(outputRoot, "test-results");
    let testCase;

    try {
        const cases = await loadLocalTestCases(fixturePath);
        testCase = findTestCaseById(cases, values.TEST_CASE_ID);
    } catch (error) {
        return {ok: false, message: error.message};
    }

    const playwrightCli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
    const runnerBinary = testRunnerBinary();
    const usesElectronAsNode = runnerBinary === process.execPath;
    const previewPath = path.join(outputRoot, "browser-preview", "current.png");
    const previewType = values.PREVIEW_TYPE || "live";
    const interactiveCdpUrl =
        previewType === "interactive"
            ? `http://127.0.0.1:${INTERACTIVE_BROWSER_DEBUG_PORT}`
            : "";
    const args = [
        playwrightCli,
        "test",
        "tests/run-test-case-mytv.spec.js",
        "--project=chromium",
        "--output",
        testResultsDir,
    ];

    const env = {
        ...process.env,
        TEST_CASE_PATH: fixturePath,
        TEST_CASE_ID: String(testCase.id),
        APP_URL: values.APP_URL,
        PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath(projectRoot),
        PLAYWRIGHT_HTML_REPORT: reportDir,
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
        `Report: ${reportDir}`,
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

    runningProcess.stdout.on("data", (chunk) => {
        event.sender.send("test-log", redactSensitiveText(chunk.toString()));
    });

    runningProcess.stderr.on("data", (chunk) => {
        event.sender.send("test-log", redactSensitiveText(chunk.toString()));
    });

    runningProcess.on("error", (error) => {
        stopPreviewWatcher();
        applyInteractiveViewFitZoom();
        event.sender.send("test-finished", {
            code: 1,
            message: error.message,
            reportPath: reportPath(),
        });
        runningProcess = null;
    });

    runningProcess.on("exit", (code, signal) => {
        stopPreviewWatcher();
        applyInteractiveViewFitZoom();
        event.sender.send("test-finished", {
            code: code ?? 1,
            signal,
            reportPath: reportPath(),
        });
        runningProcess = null;
    });

    return {ok: true, initialLog};
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
    return path.join(app.getPath("userData"), "playwright-report", "index.html");
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
