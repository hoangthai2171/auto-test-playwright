const path = require("node:path");
const fs = require("node:fs/promises");
const {spawn} = require("node:child_process");
const {randomUUID} = require("node:crypto");
const {app, BrowserView, BrowserWindow, dialog, ipcMain, safeStorage, shell} = require("electron");
const {loadLocalTestCases, loadCachedTestCases, findTestCaseById} = require("../tests/lib/test-case-source");
const {validateTestCaseList} = require("../tests/lib/test-case-schema");
const {redactSensitiveText, createLogRedactor} = require("./credential-redaction");
const {fetchFlowCaseFolders, fetchFlowCases, fetchRunningFlowCaseCampaigns, submitFlowCaseResults, fetchDeviceCompatibilityCatalog, normalizeTimeoutMs} = require("./flow-case-api");
const {replaceFolderCacheEntry, replaceCampaignCacheEntry, readMostRecentFolderCacheEntry} = require("./test-case-cache");
const {createEmptyReport, buildTestReportEntry, upsertTestReport, renderUserReport} = require("./test-report");
const {buildPlaywrightTestArgs} = require("./playwright-runner");
const {createRunCloseGuard} = require("./run-close-guard");
const {createManagedWindowCloseController} = require("./window-close-controller");
const {createDeviceRegistry} = require("./device-registry");
const {createDeviceSecretFileStore} = require("./device-secret-file-store");
const {createDeviceSecretStore} = require("./device-secret-store");
const {createDeviceProfileService} = require("./device-profile-service");
const {registerTvDeviceIpc} = require("./tv-device-ipc");
const {createTvToolchainInspector} = require("./tv-toolchain");
const {createTvToolchainConfig} = require("./tv-toolchain-config");
const {createDeviceDiscovery} = require("./device-discovery");
const {createConfiguredWebOsReadOnlyAdapter} = require("./webos-read-only-adapter");
const {createLgDeviceConnectionChecker} = require("./lg-device-connection-check");
const {createLgCliArchiveImporter} = require("./lg-cli-archive-importer");
const {createLgCliImportOperations} = require("./lg-cli-import-operations");
const {createLgToolchainDetector} = require("./lg-toolchain-detector");
const {createLgToolchainInstaller} = require("./lg-toolchain-installer");
const {createLgManagedInstallDependencies} = require("./lg-managed-install-dependencies");
const {createLgManagedInstallOperations} = require("./lg-managed-install-operations");
const {createBrowserToolchain} = require("./browser-toolchain");
const {createBrowserToolchainInstaller} = require("./browser-toolchain-installer");
const {createBrowserRunLauncher} = require("./browser-run-launcher");
const {registerBrowserToolchainIpc} = require("./browser-toolchain-ipc");
const {trustedLgToolchainManifest} = require("./lg-toolchain-manifest");
const bundledLgCompatibilityCatalog = require("../DEVICE-COMPATIBILITY.json");
const {createLgCompatibilityCatalogStore} = require("./lg-compatibility-catalog-store");
const {createLgCompatibilityCatalogService} = require("./lg-compatibility-catalog-service");
const {createLgTemporaryWebOsTarget} = require("./lg-temporary-webos-target");
const {createLgCompatibilityAttemptService} = require("./lg-compatibility-attempt-service");
const {createLgCompatibilityValidation} = require("./lg-compatibility-validation");
const {registerLgCompatibilityIpc} = require("./lg-compatibility-ipc");
const {createLgCompatibilityCredentials, createLgCompatibilityProductGateCase} = require("./lg-compatibility-product-gate");
const {createLgDesktopRunPreflight} = require("./lg-desktop-run-preflight");
const {createLgDesktopBatchRunner} = require("./lg-desktop-batch-runner");
const {registerLgRunIpc} = require("./lg-run-ipc");
const {createDeviceLock} = require("./device-lock");
const {createAppiumServerManager} = require("./appium-server-manager");
const {createLoopbackAppiumClient} = require("./loopback-appium-client");
const {createTvRunner} = require("./tv-runner");
const {createWebOsSessionFactory} = require("../tests/lib/tv-session/webos-appium-session");
const {revealWindowOnFirstPaint} = require("./window-startup");
const {createHostsFileService} = require("./hosts-file");
const {
    DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
    DEFAULT_TEST_CASE_MAX_TIME_MINUTES,
    normalizePlayerCheckTimeoutSeconds,
    normalizeTestCaseMaxTimeMinutes,
} = require("./test-configuration");

const INTERACTIVE_BROWSER_DEBUG_PORT = Number(process.env.MYTV_INTERACTIVE_BROWSER_DEBUG_PORT) || 43000 + Math.floor(Math.random() * 1000);

app.commandLine.appendSwitch("remote-debugging-port", String(INTERACTIVE_BROWSER_DEBUG_PORT));

let mainWindow;
let runningProcess;
let previewWatcher;
let interactiveView;
let interactiveViewScale = 1;
let interactiveAudioMuted = true;
let rendererRunActive = false;
let hasUnsyncedResultSubmission = false;
let activeLgBatchRunner;
let playerCheckTimeoutSeconds = DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS;
let testCaseMaxTimeMinutes = DEFAULT_TEST_CASE_MAX_TIME_MINUTES;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1240,
        height: 900,
        minWidth: 920,
        minHeight: 760,
        title: "MyTV Auto Test",
        show: false,
        backgroundColor: "#101318",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
        },
    });

    revealWindowOnFirstPaint(mainWindow);
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
    createManagedWindowCloseController({
        window: mainWindow,
        guard: createRunCloseGuard({
            isRunning: () => Boolean(runningProcess) || rendererRunActive,
            hasUnsyncedResults: () => hasUnsyncedResultSubmission,
            stopRun: stopActiveTest,
            discardUnsyncedResults: discardUnsyncedResultSubmission,
        }),
        confirm: confirmWindowClose,
        onError: (error) => {
            console.warn(`Could not resolve the requested app close: ${error.message}`);
        },
    });
}

async function confirmWindowClose(reason) {
    const running = reason === "running" || reason === "running_and_unsynced_results";
    const result = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        buttons: [
            running ? "Stop run and close" : "Close and discard unsynced retry",
            "Keep open",
        ],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        message: running
            ? "A test run is active. Stop it before closing?"
            : "Completed test results are waiting to sync. Discard the in-memory retry before closing?",
    });
    if (result.response !== 0) return "keep_open";
    return running ? "stop_run_and_close" : "close_and_discard_unsynced_retry";
}

async function stopActiveTest() {
    activeLgBatchRunner?.requestStop();
    if (runningProcess) {
        runningProcess.kill();
        runningProcess = null;
    }
    stopPreviewWatcher();
    applyInteractiveViewFitZoom();
    mainWindow?.webContents.send("request-stop-run");
}

function discardUnsyncedResultSubmission() {
    hasUnsyncedResultSubmission = false;
    mainWindow?.webContents.send("discard-unsynced-result-submission");
}

function testCasesCachePath() {
    return path.join(app.getPath("userData"), "testcases-cache.json");
}

function tvDevicesPath() {
    return path.join(app.getPath("userData"), "devices.json");
}

function tvDeviceSecretsPath() {
    return path.join(app.getPath("userData"), "device-secrets.json");
}

function tvToolchainPath() {
    return path.join(app.getPath("userData"), "tv-toolchain.json");
}

function lgCliManagedRoot() {
    return path.join(lgToolchainManagedRoot(), "webos-cli");
}

function lgToolchainManagedRoot() {
    return path.join(app.getPath("userData"), "lg-toolchain");
}

function managedBrowserRoot() {
    return path.join(app.getPath("userData"), "playwright-browsers");
}

function lgCompatibilityCatalogPath() {
    return path.join(app.getPath("userData"), "lg-compatibility-catalog.json");
}

const toolchainConfig = createTvToolchainConfig({
    filePath: tvToolchainPath(),
    fs,
    platform: process.platform,
    managedRoot: lgToolchainManagedRoot(),
});
const lgCliImportOperations = createLgCliImportOperations({platform: process.platform});
const lgCliArchiveImporter = createLgCliArchiveImporter({
    platform: process.platform,
    managedRoot: lgCliManagedRoot(),
    fs,
    hashFile: lgCliImportOperations.hashFile,
    extract: lgCliImportOperations.extract,
});
const lgToolchainDetector = createLgToolchainDetector({
    platform: process.platform,
    managedRoot: lgToolchainManagedRoot(),
    fs,
});
const lgManagedInstallDependencies = createLgManagedInstallDependencies({platform: process.platform, fs});
const lgManagedInstallOperations = createLgManagedInstallOperations({
    platform: process.platform,
    managedRoot: lgToolchainManagedRoot(),
    fs,
    ...lgManagedInstallDependencies,
});
const lgToolchainInstaller = createLgToolchainInstaller({
    platform: process.platform,
    detector: lgToolchainDetector,
    installManagedBundle: lgManagedInstallOperations.install,
});
const browserRoot = managedBrowserRoot();
process.env.PLAYWRIGHT_BROWSERS_PATH = browserRoot;
const {chromium} = require("playwright");
const browserToolchain = createBrowserToolchain({
    fs,
    resolveExecutablePath: () => chromium.executablePath(),
    version: require("playwright/package.json").version,
});
const browserToolchainInstaller = createBrowserToolchainInstaller({
    browserToolchain,
    managedRoot: browserRoot,
    nodePath: testRunnerBinary(),
    playwrightCliPath: path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js"),
    spawn,
});
const browserRunLauncher = createBrowserRunLauncher({browserToolchain, managedRoot: browserRoot});
const hostsFileService = createHostsFileService({fs, platform: process.platform, spawn});
const deviceRegistry = createDeviceRegistry({filePath: tvDevicesPath(), fs});
const deviceSecrets = createDeviceSecretStore({
    safeStorage,
    store: createDeviceSecretFileStore({filePath: tvDeviceSecretsPath(), fs}),
});
const lgCompatibilityCredentials = createLgCompatibilityCredentials({secrets: deviceSecrets});
const deviceProfiles = createDeviceProfileService({
    registry: deviceRegistry,
    secrets: deviceSecrets,
    validator: {
        async validate() {
            return {ok: false, status: "VALIDATION_UNAVAILABLE"};
        },
    },
});
const webosReadOnlyAdapter = createConfiguredWebOsReadOnlyAdapter({toolchainConfig});
const connectionChecker = createLgDeviceConnectionChecker({
    registry: deviceRegistry,
    adapter: webosReadOnlyAdapter,
});
const lgCompatibilityCatalog = createLgCompatibilityCatalogService({
    bundledCatalog: bundledLgCompatibilityCatalog,
    store: createLgCompatibilityCatalogStore({filePath: lgCompatibilityCatalogPath(), fs}),
    fetchCatalog: fetchDeviceCompatibilityCatalog,
});
const lgCompatibilityManifest = trustedLgToolchainManifest(process.platform);
async function resolveLgCompatibilityProfile({deviceId} = {}) {
    const id = typeof deviceId === "string" ? deviceId.trim() : "";
    if (!id) return {status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
    const profiles = await deviceRegistry.list();
    const profile = Array.isArray(profiles)
        ? profiles.find((candidate) => candidate?.id === id && candidate?.platform === "webos")
        : undefined;
    if (!profile) return {status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
    return lgCompatibilityCatalog.select({
        model: profile.model,
        firmware: profile.firmwareVersion,
        platform: process.platform,
    });
}
registerTvDeviceIpc({
    ipcMain,
    deviceProfiles,
    connectionChecker,
    toolchain: createTvToolchainInspector({
        toolchainConfig,
    }),
    toolchainConfig,
    lgToolchainDetector,
    lgToolchainInstaller,
    lgCliArchiveImporter,
    lgCliPlatform: process.platform,
    resolveLgCompatibilityProfile,
    compatibilityCatalog: lgCompatibilityCatalog,
    dialog,
    shell,
    redact: redactSensitiveText,
});
registerBrowserToolchainIpc({ipcMain, browserToolchain, browserInstaller: browserToolchainInstaller});
const lgDeviceLock = createDeviceLock();
const lgAppiumServerManager = createAppiumServerManager({
    spawn,
    fetch,
    kill: process.kill.bind(process),
    redact: redactSensitiveText,
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
});
const lgWebOsSessionFactory = createWebOsSessionFactory({clientFactory: createLoopbackAppiumClient});
const lgRunPreflight = createLgDesktopRunPreflight({
    registry: deviceRegistry,
    secrets: deviceSecrets,
    toolchainConfig,
    adapter: webosReadOnlyAdapter,
    compatibilityCatalog: lgCompatibilityCatalog,
    detector: lgToolchainDetector,
    redact: redactSensitiveText,
});
const lgTvRunner = createTvRunner({
    registry: deviceRegistry,
    discovery: createDeviceDiscovery({webos: webosReadOnlyAdapter, redact: redactSensitiveText}),
    lock: lgDeviceLock,
    serverManager: lgAppiumServerManager,
    sessionFactory: lgWebOsSessionFactory,
    redact: redactSensitiveText,
});
const lgCompatibilityTemporaryTarget = Object.freeze({
    async acquire(connection) {
        try {
            const webosSdkHome = await toolchainConfig.resolveReadOnlyWebOsCli();
            return createLgTemporaryWebOsTarget({
                webosSdkHome,
                createTargetName: () => `lgcompat-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
            }).acquire(connection);
        } catch {
            return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
        }
    },
});
const lgCompatibilityAttempts = createLgCompatibilityAttemptService({
    temporaryTarget: lgCompatibilityTemporaryTarget,
    adapter: webosReadOnlyAdapter,
    compatibilityCatalog: lgCompatibilityCatalog,
    platform: process.platform,
    createId: randomUUID,
});
const lgCompatibilityValidation = createLgCompatibilityValidation({
    attempts: lgCompatibilityAttempts,
    temporaryTarget: lgCompatibilityTemporaryTarget,
    adapter: webosReadOnlyAdapter,
    downloadArtifact: async ({artifact, destination}) => {
        const approvedArtifact = lgCompatibilityManifest.withChromeDriver(artifact).components.chromedriver;
        return lgManagedInstallDependencies.downloadChromeDriver({artifact: approvedArtifact, destination});
    },
    verifyArchive: async ({archivePath, artifact}) => {
        const approvedArtifact = lgCompatibilityManifest.withChromeDriver(artifact).components.chromedriver;
        return String(await lgManagedInstallDependencies.hashFile(archivePath)).toLowerCase() === approvedArtifact.sha256;
    },
    extractChromeDriver: lgManagedInstallDependencies.extractChromeDriver,
    verifyChromeDriver: lgManagedInstallDependencies.verifyChromeDriver,
    runCase: runLgCompatibilityCase,
    createTempDir: () => fs.mkdtemp(path.join(app.getPath("temp"), "mytv-lgcompat-")),
    removeTempDir: (targetPath) => fs.rm(targetPath, {recursive: true, force: true}),
    platform: process.platform,
});
registerLgCompatibilityIpc({
    ipcMain,
    attempts: lgCompatibilityAttempts,
    validation: lgCompatibilityValidation,
    compatibilityCredentials: lgCompatibilityCredentials,
    createProductGateCase: createLgCompatibilityProductGateCase,
    redact: redactSensitiveText,
});
const lgDesktopBatchRunner = createLgDesktopBatchRunner({
    preflight: lgRunPreflight,
    tvRunner: lgTvRunner,
    loadCase: loadLgBatchCase,
    writeReportEntry: writeLgReportEntry,
    getPlayerCheckTimeoutSeconds: () => playerCheckTimeoutSeconds,
});
activeLgBatchRunner = lgDesktopBatchRunner;
registerLgRunIpc({ipcMain, batchRunner: lgDesktopBatchRunner, redact: redactSensitiveText});

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

ipcMain.handle("get-host-entry-status", async (_event, values = {}) => hostsFileService.getStatus(values.entry));
ipcMain.handle("add-host-entry", async (_event, values = {}) => hostsFileService.add(values.entry));
ipcMain.handle("remove-host-entry", async (_event, values = {}) => hostsFileService.remove(values.entry));

ipcMain.handle("load-flow-case-folders", async (_event, settings = {}) => {
    const result = await fetchFlowCaseFolders({
        apiDomain: settings.API_DOMAIN,
        authorization: settings.API_AUTHORIZATION,
        projectId: settings.PROJECT_ID,
        campaignId: settings.CAMPAIGN_ID,
        timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
    });
    return withApiLog(result);
});

ipcMain.handle("load-flow-case-campaigns", async (_event, settings = {}) => {
    const result = await fetchRunningFlowCaseCampaigns({
        apiDomain: settings.API_DOMAIN,
        authorization: settings.API_AUTHORIZATION,
        projectId: settings.PROJECT_ID,
        timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
    });
    if (!result.ok) return withApiLog(result);

    try {
        return {
            ok: true,
            campaigns: result.campaigns.map((entry, index) => summarizeRunningCampaign(entry, index)),
            apiLog: sanitizeApiLog({request: result.request, response: result.response}),
        };
    } catch (error) {
        return {
            ok: false,
            message: error.message,
            timeout: false,
            apiLog: sanitizeApiLog({request: result.request, response: result.response}),
        };
    }
});

ipcMain.handle("load-flow-cases", async (_event, settings = {}) => {
    const campaignId = String(settings.CAMPAIGN_ID ?? "").trim();
    if (campaignId) return loadCampaignCases(settings, campaignId);

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

async function loadCampaignCases(settings, campaignId) {
    const result = await fetchFlowCases({
        apiDomain: settings.API_DOMAIN,
        authorization: settings.API_AUTHORIZATION,
        projectId: settings.PROJECT_ID,
        campaignId,
        environment: settings.ENVIRONMENT,
        timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
    });
    if (!result.ok) return withApiLog(result);

    try {
        const cases = validateTestCaseList(result.cases, "running campaign API");
        const folder = resolveCampaignFolder(settings, null, cases);
        const campaign = {
            id: campaignId,
            ...(String(settings.CAMPAIGN_NAME ?? "").trim() ? {name: String(settings.CAMPAIGN_NAME).trim()} : {}),
        };
        await replaceCampaignCacheEntry({
            cachePath: testCasesCachePath(),
            campaignId,
            campaign,
            folder,
            cases,
        });

        return {
            ok: true,
            campaign,
            folder,
            cacheKey: `campaign:${campaignId}`,
            cases: cases.map(sanitizeCaseForUi),
            source: "api",
            apiLog: sanitizeApiLog(result),
        };
    } catch (error) {
        return {ok: false, message: error.message, timeout: false, apiLog: sanitizeApiLog(result)};
    }
}

function summarizeRunningCampaign(entry, index = 0) {
    const campaign = entry?.campaign || entry;
    if (!campaign || typeof campaign !== "object") {
        throw new Error(`running campaign ${index + 1} must contain a campaign object.`);
    }

    const id = String(campaign.id ?? "").trim();
    const name = String(campaign.name ?? "").trim();
    if (!id || !name) throw new Error(`running campaign ${index + 1} requires id and name.`);

    const testcases = Array.isArray(campaign.testcases)
        ? campaign.testcases.map((testCase, testCaseIndex) => {
            const testCaseId = String(testCase?.id ?? "").trim();
            if (!testCaseId) throw new Error(`running campaign ${id} testcase ${testCaseIndex + 1} is missing its copy id.`);
            return {
                id: testCaseId,
                ...(String(testCase?.name ?? "").trim() ? {name: String(testCase.name).trim()} : {}),
                ...(String(testCase?.status ?? "").trim() ? {status: String(testCase.status).trim()} : {}),
                ...(String(testCase?.platform ?? "").trim() ? {platform: String(testCase.platform).trim()} : {}),
            };
        })
        : [];

    const safeRun = entry?.run && typeof entry.run === "object"
        ? Object.fromEntries(["id", "testCampaignId", "status", "startedAt", "finishedAt"]
            .filter((key) => entry.run[key] !== undefined && entry.run[key] !== null)
            .map((key) => [key, entry.run[key]]))
        : {};

    return {
        campaign: {
            id,
            name,
            ...(String(campaign.status ?? "").trim() ? {status: String(campaign.status).trim()} : {}),
            testcases,
        },
        run: safeRun,
    };
}

function resolveCampaignFolder(settings, campaign, cases) {
    const configuredPath = String(settings.FOLDER_NAME ?? "").trim();
    if (configuredPath) {
        return {
            id: settings.FOLDER_ID,
            name: String(settings.FOLDER_NAME_LABEL ?? "").trim() || configuredPath.split("/").filter(Boolean).at(-1) || configuredPath,
            fullPath: configuredPath,
        };
    }

    const paths = new Set();
    const addPath = (value) => {
        const pathValue = String(value ?? "").trim();
        if (/^\/(?:[^/]+(?:\/[^/]+)*)?$/u.test(pathValue)) paths.add(pathValue);
    };
    const collectPath = (value) => {
        if (!value || typeof value !== "object") return;
        addPath(value.folderPath);
        addPath(value.folderName);
        addPath(value.fullPath);
        addPath(value.folder?.fullPath);
    };
    collectPath(campaign);
    (campaign?.testcases || []).forEach(collectPath);
    cases.forEach(collectPath);
    if (paths.size !== 1) return null;

    const fullPath = [...paths][0];
    return {
        name: fullPath.split("/").filter(Boolean).at(-1) || fullPath,
        fullPath,
    };
}

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

ipcMain.handle("set-run-active", async (_event, active) => {
    rendererRunActive = Boolean(active);
    return {ok: true};
});

ipcMain.handle("set-unsynced-result-submission", async (_event, pending) => {
    hasUnsyncedResultSubmission = Boolean(pending);
    return {ok: true};
});

ipcMain.handle("get-app-version", () => app.getVersion());

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

    const normalized = {id: testCase.id, status: "tested", testResult: normalizedResult};
    if (Object.prototype.hasOwnProperty.call(testCase, "campaignId")) {
        const campaignId = String(testCase.campaignId ?? "").trim();
        if (!campaignId) throw new Error(`${path}.campaignId must be a non-empty value when provided.`);
        normalized.campaignId = campaignId;
    }
    return normalized;
}

function withApiLog(result) {
    const {request, response, ...payload} = result;
    return {...payload, apiLog: sanitizeApiLog({request, response})};
}

function sanitizeApiLog(value) {
    return cloneApiLogValue(value);
}

function cloneApiLogValue(value, key = "") {
    if (/^(?:password|token|authorization|cookie|secret|x-flowtest-service-token)$/iu.test(key)) {
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

ipcMain.handle("set-test-configuration", async (_event, values = {}) => {
    const configuration = values && typeof values === "object" && !Array.isArray(values) ? values : {};
    playerCheckTimeoutSeconds = normalizePlayerCheckTimeoutSeconds(
        configuration.PLAYER_CHECK_TIMEOUT_SECONDS,
        playerCheckTimeoutSeconds,
    );
    testCaseMaxTimeMinutes = normalizeTestCaseMaxTimeMinutes(
        configuration.TEST_CASE_MAX_TIME_MINUTES,
        testCaseMaxTimeMinutes,
    );
    return {
        ok: true,
        PLAYER_CHECK_TIMEOUT_SECONDS: String(playerCheckTimeoutSeconds),
        TEST_CASE_MAX_TIME_MINUTES: String(testCaseMaxTimeMinutes),
    };
});

ipcMain.handle("run-test", async (event, values = {}) => {
    if (runningProcess) {
        return {ok: false, message: "A test run is already in progress."};
    }

    const browserRun = await browserRunLauncher.prepare();
    if (!browserRun.ok) {
        return {ok: false, status: browserRun.status, message: "Configure Browser in Settings before running browser tests."};
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
    playerCheckTimeoutSeconds = normalizePlayerCheckTimeoutSeconds(
        values.PLAYER_CHECK_TIMEOUT_SECONDS,
        playerCheckTimeoutSeconds,
    );
    testCaseMaxTimeMinutes = normalizeTestCaseMaxTimeMinutes(
        values.TEST_CASE_MAX_TIME_MINUTES,
        testCaseMaxTimeMinutes,
    );

    try {
        const cacheKey = String(values.TEST_CASE_CACHE_KEY || values.TEST_CASE_FOLDER_ID || "").trim();
        const cases = cacheKey ? await loadCachedTestCases(testCasesCachePath(), cacheKey) : await loadLocalTestCases(fixturePath);
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
    const args = buildPlaywrightTestArgs({
        playwrightCli,
        testResultsDir,
        tsconfigPath: path.join(projectRoot, "app", "playwright.tsconfig.json"),
    });

    const env = {
        ...process.env,
        TEST_CASE_PATH: fixturePath,
        TEST_CASE_ID: String(testCase.id),
        TEST_CASE_CACHE_PATH: values.TEST_CASE_CACHE_KEY || values.TEST_CASE_FOLDER_ID ? testCasesCachePath() : "",
        TEST_CASE_CACHE_KEY: values.TEST_CASE_CACHE_KEY ? String(values.TEST_CASE_CACHE_KEY) : "",
        TEST_CASE_FOLDER_ID: values.TEST_CASE_FOLDER_ID ? String(values.TEST_CASE_FOLDER_ID) : "",
        APP_URL: values.APP_URL,
        PLAYWRIGHT_BROWSERS_PATH: browserRun.browsersPath,
        PLAYWRIGHT_HTML_REPORT: reportDir,
        MYTV_CASE_RESULT_PATH: caseResultPath,
        MYTV_PREVIEW_PATH: previewType === "live" ? previewPath : "",
        MYTV_INTERACTIVE_CDP_URL: interactiveCdpUrl,
        MYTV_INTERACTIVE_VIEW_SCALE: interactiveCdpUrl ? String(interactiveViewScale) : "",
        MYTV_PLAYER_CHECK_TIMEOUT_SECONDS: String(playerCheckTimeoutSeconds),
        MYTV_TEST_CASE_MAX_TIME_MINUTES: String(testCaseMaxTimeMinutes),
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
        "Browser: managed Playwright Chromium",
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
    await stopActiveTest();
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

async function loadLgBatchCase(caseId, cacheKey) {
    const fixturePath = path.join(app.getAppPath(), "testcased.json");
    const cases = cacheKey
        ? await loadCachedTestCases(testCasesCachePath(), cacheKey)
        : await loadLocalTestCases(fixturePath);
    return findTestCaseById(cases, caseId);
}

async function runLgCompatibilityCase({testCase, connection, model, firmware}) {
    const toolchain = await toolchainConfig.resolveCompatibilityRuntime();
    const profile = Object.freeze({
        id: "transient-lg-compatibility",
        label: "Transient LG compatibility validation",
        platform: "webos",
        appId: "com.mytvb2c.app",
        model,
        firmwareVersion: firmware,
        vendorDeviceName: connection.deviceName,
    });
    const transientRunner = createTvRunner({
        registry: {async list() { return [profile]; }},
        discovery: createDeviceDiscovery({webos: webosReadOnlyAdapter, redact: redactSensitiveText}),
        lock: lgDeviceLock,
        serverManager: lgAppiumServerManager,
        sessionFactory: lgWebOsSessionFactory,
        redact: redactSensitiveText,
    });
    return transientRunner.run({
        profileId: profile.id,
        host: connection.deviceHost,
        sharedDeviceAcknowledged: true,
        secureWebsocket: true,
        allowSelfSignedTls: true,
        connection,
        appium: {
            port: 4727,
            appiumHome: toolchain.appiumHome,
            appiumBin: toolchain.appiumBin,
        },
        testCase,
    });
}

async function writeLgReportEntry({testCase, executionResult, result}) {
    const reportJson = userReportJsonPath();
    const reportHtml = userReportHtmlPath();
    let report;
    try {
        report = JSON.parse(await fs.readFile(reportJson, "utf8"));
    } catch {
        report = createEmptyReport();
    }
    const caseResult = executionResult?.caseResult || executionResult?.testCaseResult || null;
    const entry = buildTestReportEntry({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        exitCode: result?.passed ? 0 : 1,
        caseResult,
        errorMessage: result?.failure?.code || "",
    });
    const updated = upsertTestReport(report, entry);
    await fs.mkdir(path.dirname(reportJson), {recursive: true});
    await fs.writeFile(reportJson, JSON.stringify(updated, null, 2), "utf8");
    await fs.writeFile(reportHtml, renderUserReport(updated), "utf8");
}

function safeFileName(value) {
    return (
        String(value || "case")
            .replace(/[^a-z0-9_-]+/giu, "-")
            .replace(/^-+|-+$/g, "") || "case"
    );
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
