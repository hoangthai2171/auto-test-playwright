const path = require("node:path");
const fs = require("node:fs/promises");
const {spawn} = require("node:child_process");
const {app, BrowserView, BrowserWindow, ipcMain, shell} = require("electron");

const INTERACTIVE_BROWSER_DEBUG_PORT =
    Number(process.env.MYTV_INTERACTIVE_BROWSER_DEBUG_PORT) ||
    43000 + Math.floor(Math.random() * 1000);

app.commandLine.appendSwitch("remote-debugging-port", String(INTERACTIVE_BROWSER_DEBUG_PORT));

const testModes = {
    channel: {
        specs: ["tests/login-mytv.spec.js", "tests/play-channel-mytv.spec.js"],
    },
    movie: {
        specs: ["tests/login-mytv.spec.js", "tests/play-movie-mytv.spec.js"],
    },
    search: {
        specs: ["tests/login-mytv.spec.js", "tests/search-content-mytv.spec.js"],
    },
    setting: {
        specs: ["tests/login-mytv.spec.js", "tests/open-setting-mytv.spec.js"],
    },
    "ai-manual": {
        specs: ["tests/login-mytv.spec.js", "tests/run-ai-plan-mytv.spec.js"],
    },
};

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

ipcMain.handle("run-test", async (event, values) => {
    if (runningProcess) {
        return {ok: false, message: "A test run is already in progress."};
    }

    const projectRoot = app.getAppPath();
    const outputRoot = app.getPath("userData");
    const reportDir = path.join(outputRoot, "playwright-report");
    const testResultsDir = path.join(outputRoot, "test-results");
    const mode = testModes[values.PLAYBACK_MODE] || testModes.channel;
    let aiPlan = null;
    let aiPlanPath = "";
    if (values.PLAYBACK_MODE === "ai-manual") {
        try {
            aiPlan = await createAiPlan(values);
        } catch (error) {
            if (isAiScopeError(error)) {
                return {
                    ok: false,
                    message: error.message,
                    uiMessage: error.uiMessage || error.message,
                    errorCode: error.code || "AI_SCOPE_REQUIRES_API_KEY",
                    settingsPanel: "api-key",
                };
            }
            throw error;
        }
        aiPlanPath = path.join(outputRoot, "ai-plans", "latest-plan.json");
        await fs.mkdir(path.dirname(aiPlanPath), {recursive: true});
        await fs.writeFile(aiPlanPath, JSON.stringify(aiPlan, null, 2));
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
    const args = [playwrightCli, "test", ...mode.specs, "--project=chromium", "--output", testResultsDir];

    const env = {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath(projectRoot),
        PLAYWRIGHT_HTML_REPORT: reportDir,
        APP_URL: values.APP_URL,
        USERNAME: values.USERNAME,
        PASSWORD: values.PASSWORD,
        CHANNEL_NAME: values.CHANNEL_NAME,
        CHANNEL_PLAY_MODE: values.CHANNEL_PLAY_MODE,
        CHANNEL_CATE_NAME: values.CHANNEL_CATE_NAME,
        CHANNEL_CATE_LIMIT: values.CHANNEL_CATE_LIMIT,
        MOVIE_PLAY_MODE: values.MOVIE_PLAY_MODE,
        MOVIE_NAME: values.MOVIE_NAME,
        MOVIE_CATE_NAME: values.MOVIE_CATE_NAME,
        MOVIE_CATE_LIMIT: values.MOVIE_CATE_LIMIT,
        SEARCH_KEYWORD: values.SEARCH_KEYWORD,
        AI_PLAN_PATH: aiPlanPath,
        MYTV_PREVIEW_PATH: previewType === "live" ? previewPath : "",
        MYTV_INTERACTIVE_CDP_URL: interactiveCdpUrl,
        MYTV_INTERACTIVE_VIEW_SCALE: interactiveCdpUrl ? String(interactiveViewScale) : "",
    };

    if (usesElectronAsNode) {
        env.ELECTRON_RUN_AS_NODE = "1";
    } else {
        delete env.ELECTRON_RUN_AS_NODE;
    }

    const initialLog = [`Runner: ${runnerBinary}`, `Cwd: ${projectRoot}`, `Specs: ${mode.specs.join(", ")}`, `Browsers: ${env.PLAYWRIGHT_BROWSERS_PATH}`, `Report: ${reportDir}`, `Preview type: ${previewType}`, previewType === "live" ? `Preview: ${previewPath}` : "", interactiveCdpUrl ? `Interactive CDP: ${interactiveCdpUrl}` : "", aiPlan ? `AI plan: ${aiPlanPath}` : "", aiPlan ? JSON.stringify(aiPlan, null, 2) : "", ""].filter(Boolean).join("\n");

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
        event.sender.send("test-log", chunk.toString());
    });

    runningProcess.stderr.on("data", (chunk) => {
        event.sender.send("test-log", chunk.toString());
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

ipcMain.handle("test-ai-connection", async (_event, values) => {
    try {
        await testAiConnection(values);
        return {ok: true, message: "Connection OK"};
    } catch (error) {
        return {ok: false, message: error.message};
    }
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

async function createAiPlan(values) {
    const description = (values.AI_TEST_DESCRIPTION || "").trim();
    if (!description) {
        throw new Error("Vui lòng nhập mô tả test cho chế độ A.I.");
    }

    if (values.AI_API_KEY) {
        return createPlanWithAi(values);
    }

    return createLocalPlan(description);
}

async function createPlanWithAi(values) {
    const description = values.AI_TEST_DESCRIPTION.trim();
    const provider = values.AI_PROVIDER || "openai";
    const endpoint = values.AI_ENDPOINT || defaultAiEndpoint(provider);
    const model = values.AI_MODEL || "gpt-4.1-mini";

    if (provider === "gemini") {
        return createPlanWithGemini({endpoint, model, apiKey: values.AI_API_KEY, description});
    }

    return createPlanWithOpenAiCompatible({
        endpoint,
        model,
        apiKey: values.AI_API_KEY,
        description,
        provider,
    });
}

async function createPlanWithOpenAiCompatible({endpoint, model, apiKey, description, provider}) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: [
                        "You convert Vietnamese TV webapp test requests into strict JSON.",
                        "Return JSON only, no markdown.",
                        "Allowed actions: open_service, play_all_items_in_first_row.",
                        "Use remote-control navigation only.",
                        "Use the requested serviceName exactly when the user names a service, e.g. Danet. For generic movie service use serviceName='Phim truyện'.",
                        "Plan schema: { name, source, steps, report }.",
                        "open_service step: { action:'open_service', serviceName }.",
                        "play_all_items_in_first_row step: { action:'play_all_items_in_first_row', waitSeconds, backPresses, rowName?, rowIndex?, rowPosition?, itemLimit? }.",
                        "If the user names a cate/row/hang such as 'Phim song song', set rowName to that text.",
                        "If the user says first row/hàng đầu tiên use rowIndex:0, second row/hàng thứ 2 use rowIndex:1, third row use rowIndex:2. If the user says last row/hàng cuối cùng use rowPosition:'last'. Do not set rowName for positional rows.",
                        "If the user requests only 2 or 3 contents, set itemLimit to that number. If the user asks for all contents, omit itemLimit.",
                    ].join(" "),
                },
                {
                    role: "user",
                    content: description,
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`AI planner failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const plan = JSON.parse(content);
    return validateAiPlan({
        ...plan,
        source: {
            type: provider || "ai",
            model,
            endpoint,
            description,
        },
    });
}

async function createPlanWithGemini({endpoint, model, apiKey, description}) {
    const url = `${endpoint.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            generationConfig: {
                temperature: 0,
            },
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: [
                                "Convert this Vietnamese TV webapp test request into strict JSON only.",
                                "Allowed actions: open_service, play_all_items_in_first_row.",
                                "Use schema: { name, source, steps, report }.",
                                "open_service step: { action:'open_service', serviceName }.",
                                "Use the requested serviceName exactly when the user names a service, e.g. Danet. For generic movie service use serviceName='Phim truyện'.",
                                "play_all_items_in_first_row step: { action:'play_all_items_in_first_row', waitSeconds, backPresses, rowName?, rowIndex?, rowPosition?, itemLimit? }.",
                                "If the request names a cate/row/hang title, set rowName to the requested row title.",
                                "If the request says first row/hàng đầu tiên use rowIndex:0, second row/hàng thứ 2 use rowIndex:1, third row use rowIndex:2. If the request says last row/hàng cuối cùng use rowPosition:'last'. Do not set rowName for positional rows.",
                                "If the request asks for only a number of contents, set itemLimit to that number. Omit itemLimit for all contents.",
                                "",
                                description,
                            ].join("\n"),
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini planner failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const plan = JSON.parse(stripJsonFence(content));
    return validateAiPlan({
        ...plan,
        source: {
            type: "gemini",
            model,
            endpoint,
            description,
        },
    });
}

async function testAiConnection(values) {
    const provider = values.AI_PROVIDER || "openai";
    const apiKey = values.AI_API_KEY || "";
    const model = values.AI_MODEL || "";
    const endpoint = values.AI_ENDPOINT || defaultAiEndpoint(provider);

    if (!apiKey) {
        throw new Error("API key is required.");
    }

    if (!model) {
        throw new Error("Model name is required.");
    }

    if (provider === "gemini") {
        const url = `${endpoint.replace(/\/$/, "")}/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Gemini connection failed: ${response.status} ${await response.text()}`);
        }
        return;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 8,
            messages: [{role: "user", content: "Reply with OK"}],
        }),
    });

    if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${await response.text()}`);
    }
}

function defaultAiEndpoint(provider) {
    if (provider === "gemini") {
        return "https://generativelanguage.googleapis.com/v1beta";
    }

    return "https://api.openai.com/v1/chat/completions";
}

function stripJsonFence(value) {
    return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function createLocalPlan(description) {
    const normalized = normalizeVietnameseText(description);
    const serviceName = extractRequestedServiceName(description) || "Phim truyện";
    const rowName = extractRequestedRowName(description);
    const rowPosition = extractRequestedRowPosition(description);
    const itemLimit = extractRequestedItemLimit(description);

    if (
        normalized.includes("hang dau") ||
        normalized.includes("hang thu") ||
        normalized.includes("hang cuoi") ||
        normalized.includes("hang noi dung dau tien") ||
        normalized.includes("toan bo") ||
        rowName ||
        rowPosition
    ) {
        return validateAiPlan({
            name: rowName ? `Play row contents: ${rowName}` : `Play row contents in ${serviceName}`,
            source: {
                type: "local",
                description,
            },
            steps: [
                {
                    action: "open_service",
                    serviceName,
                },
                {
                    action: "play_all_items_in_first_row",
                    waitSeconds: 6,
                    backPresses: 2,
                    rowName,
                    rowIndex: rowPosition?.rowIndex,
                    rowPosition: rowPosition?.rowPosition,
                    itemLimit,
                },
            ],
            report: {
                include: ["title", "poster", "playbackStatus", "errorPopup", "screenshot"],
            },
        });
    }

    throw createAiScopeError(
        "Planner nội bộ hiện hỗ trợ yêu cầu dạng: mở dịch vụ phim truyện và play hàng đầu tiên, hoặc play hàng/cate cụ thể như \"Phim song song\". Hãy nhập AI API key để phân tích yêu cầu linh hoạt hơn.",
        "Yêu cầu này đang vượt ngoài phạm vi planner nội bộ. Vui lòng mở Settings > API key, nhập AI API key và model để hệ thống phân tích yêu cầu linh hoạt hơn."
    );
}

function validateAiPlan(plan) {
    const allowedActions = new Set(["open_service", "play_all_items_in_first_row"]);
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        throw new Error("AI plan không hợp lệ: thiếu steps.");
    }

    plan.steps.forEach((step) => {
        if (!allowedActions.has(step.action)) {
            throw new Error(`AI plan không hỗ trợ action: ${step.action}`);
        }
    });

    return {
        name: plan.name || "AI generated MyTV test",
        source: plan.source || {type: "unknown"},
        steps: plan.steps.map((step) => normalizeAiStep(step)),
        report: plan.report || {
            include: ["title", "poster", "playbackStatus", "errorPopup", "screenshot"],
        },
    };
}

function normalizeAiStep(step) {
    if (step.action === "open_service") {
        return {
            ...step,
            serviceName: cleanQuotedValue(step.serviceName),
        };
    }

    if (step.action !== "play_all_items_in_first_row") {
        return step;
    }

    const normalized = {...step};
    if (normalized.rowName === "") {
        delete normalized.rowName;
    }

    if (normalized.rowIndex !== undefined && normalized.rowIndex !== null && normalized.rowIndex !== "") {
        const rowIndex = Number(normalized.rowIndex);
        if (Number.isInteger(rowIndex) && rowIndex >= 0) {
            normalized.rowIndex = rowIndex;
        } else {
            delete normalized.rowIndex;
        }
    }

    if (normalized.rowPosition !== "last") {
        delete normalized.rowPosition;
    }

    if (normalized.itemLimit !== undefined && normalized.itemLimit !== null && normalized.itemLimit !== "") {
        const itemLimit = Number(normalized.itemLimit);
        if (Number.isFinite(itemLimit) && itemLimit >= 0) {
            normalized.itemLimit = Math.floor(itemLimit);
        } else {
            delete normalized.itemLimit;
        }
    }

    return normalized;
}

function extractRequestedServiceName(description) {
    const match = description.match(
        /(?:mở|mo|vào|vao|truy cập|truy cap)\s+(?:dịch vụ|dich vu|service)\s+(.+?)(?:\s+(?:và|va|rồi|roi|để|de|play|phát|phat|xem|mở|mo)\b|$)/i
    );
    return cleanQuotedValue(match?.[1] || "");
}

function extractRequestedRowName(description) {
    if (extractRequestedRowPosition(description)) {
        return "";
    }

    const quoted = description.match(/(?:cate|category|hàng|hang|row)[^"'“”]{0,40}["'“”]([^"'“”]+)["'“”]/i);
    if (quoted?.[1]) {
        return cleanQuotedValue(quoted[1]);
    }

    const afterKeyword = description.match(/(?:cate|category|hàng|hang|row)\s+(.+?)(?:\s+(?:và|va|rồi|roi|để|de|play|phát|phat)\b|$)/i);
    if (afterKeyword?.[1]) {
        return cleanQuotedValue(afterKeyword[1].replace(/^(nội dung|noi dung|của|cua)\s+/i, ""));
    }

    return "";
}

function cleanQuotedValue(value) {
    return String(value || "")
        .trim()
        .replace(/^[\s"'“”‘’]+|[\s"'“”‘’.,;:]+$/g, "");
}

function extractRequestedRowPosition(description) {
    const normalized = normalizeVietnameseText(description);
    const firstPatterns = [
        /\bhang(?:\s+cate|\s+noi dung)?\s+(?:dau tien|dau|so 1|thu nhat|1)\b/,
        /\bcate\s+(?:dau tien|dau|so 1|thu nhat|1)\b/,
    ];
    if (firstPatterns.some((pattern) => pattern.test(normalized))) {
        return {rowIndex: 0};
    }

    if (/\bhang(?:\s+cate|\s+noi dung)?\s+(?:cuoi cung|cuoi)\b/.test(normalized)) {
        return {rowPosition: "last"};
    }

    const digitMatch = normalized.match(/\bhang(?:\s+cate|\s+noi dung)?\s+(?:thu|so)\s*(\d{1,2})\b/);
    if (digitMatch?.[1]) {
        const value = Number(digitMatch[1]);
        if (value > 0) return {rowIndex: value - 1};
    }

    const wordNumbers = [
        ["nhat", 1],
        ["mot", 1],
        ["hai", 2],
        ["ba", 3],
        ["bon", 4],
        ["nam", 5],
        ["sau", 6],
        ["bay", 7],
        ["tam", 8],
        ["chin", 9],
        ["muoi", 10],
    ];
    for (const [word, value] of wordNumbers) {
        if (new RegExp(`\\bhang(?:\\s+cate|\\s+noi dung)?\\s+thu\\s+${word}\\b`).test(normalized)) {
            return {rowIndex: value - 1};
        }
    }

    return null;
}

function extractRequestedItemLimit(description) {
    const normalized = normalizeVietnameseText(description);
    const digitMatch = normalized.match(/\b(?:play|phat|thu|xem|kiem tra)?\s*(\d{1,2})\s*(?:noi dung|item|phim|tap)\b/);
    if (digitMatch?.[1]) {
        return Number(digitMatch[1]);
    }

    const wordNumbers = [
        ["mot", 1],
        ["hai", 2],
        ["ba", 3],
        ["bon", 4],
        ["nam", 5],
    ];
    for (const [word, value] of wordNumbers) {
        if (new RegExp(`\\b${word}\\s+(?:noi dung|item|phim|tap)\\b`).test(normalized)) {
            return value;
        }
    }

    return undefined;
}

function normalizeVietnameseText(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function createAiScopeError(message, uiMessage) {
    const error = new Error(message);
    error.code = "AI_SCOPE_REQUIRES_API_KEY";
    error.uiMessage = uiMessage;
    return error;
}

function isAiScopeError(error) {
    return error?.code === "AI_SCOPE_REQUIRES_API_KEY";
}
