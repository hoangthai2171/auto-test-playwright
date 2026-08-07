const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let renderer;
let loadError;

try {
    renderer = require("../../app/renderer/renderer.js");
} catch (error) {
    loadError = error;
}

class FakeClassList {
    constructor(element) {
        this.element = element;
        this.values = new Set();
    }

    add(...names) {
        names.forEach((name) => this.values.add(name));
    }

    remove(...names) {
        names.forEach((name) => this.values.delete(name));
    }

    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.values.has(name) : force;
        if (shouldAdd) this.values.add(name);
        else this.values.delete(name);
        return shouldAdd;
    }

    contains(name) {
        return this.values.has(name);
    }
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.attributes = new Map();
        this.dataset = {};
        this.listeners = new Map();
        this.classList = new FakeClassList(this);
        this._textContent = "";
        this.value = "";
        this.checked = false;
        this.disabled = false;
        this.src = "";
    }

    set textContent(value) {
        this._textContent = String(value ?? "");
        this.children = [];
    }

    get textContent() {
        return this._textContent + this.children.map((child) => child.textContent).join("");
    }

    set className(value) {
        this.classList.values = new Set(
            String(value || "")
                .split(/\s+/)
                .filter(Boolean),
        );
    }

    get className() {
        return [...this.classList.values].join(" ");
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === "id") this.id = String(value);
        if (name.startsWith("data-")) {
            this.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(value);
        }
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    append(...elements) {
        elements.forEach((element) => {
            element.parentElement = this;
            this.children.push(element);
        });
    }

    prepend(...elements) {
        elements.reverse().forEach((element) => {
            element.parentElement = this;
            this.children.unshift(element);
        });
    }

    replaceChildren(...elements) {
        this.children = [];
        this.append(...elements);
    }

    addEventListener(type, callback) {
        this.listeners.set(type, callback);
    }

    dispatchEvent(type, event = {}) {
        this.listeners.get(type)?.(event);
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const selectors = selector.split(",").map((item) => item.trim());
        const matches = [];

        const visit = (element) => {
            if (selectors.some((item) => matchesSelector(element, item))) matches.push(element);
            element.children.forEach(visit);
        };

        this.children.forEach(visit);
        return matches;
    }

    getBoundingClientRect() {
        return {x: 0, y: 0, width: 640, height: 480};
    }
}

function matchesSelector(element, selector) {
    const idMatch = selector.match(/^#([\w-]+)$/);
    if (idMatch) return element.id === idMatch[1];

    const dataMatch = selector.match(/^\[data-([\w-]+)\]$/);
    if (dataMatch) {
        const key = dataMatch[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        return Object.prototype.hasOwnProperty.call(element.dataset, key);
    }

    const dataValueMatch = selector.match(/^\[data-([\w-]+)="([^"]+)"\]$/);
    if (dataValueMatch) {
        const key = dataValueMatch[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        return element.dataset[key] === dataValueMatch[2];
    }

    const nameValueMatch = selector.match(/^\[name="([^"]+)"\]\[value="([^"]+)"\]$/);
    if (nameValueMatch) {
        return element.getAttribute("name") === nameValueMatch[1] && element.value === nameValueMatch[2];
    }

    const nameMatch = selector.match(/^\[name="([^"]+)"\]$/);
    if (nameMatch) return element.getAttribute("name") === nameMatch[1];

    const classMatch = selector.match(/^\.([\w-]+)$/);
    if (classMatch) return element.classList.contains(classMatch[1]);

    return element.tagName.toLowerCase() === selector.toLowerCase();
}

function createRendererFixture() {
    const elements = {};
    const document = {
        createElement: (tagName) => new FakeElement(tagName),
        getElementById: (id) => elements[id] || null,
        querySelector(selector) {
            const idMatch = selector.match(/^#([\w-]+)$/);
            if (idMatch) return elements[idMatch[1]] || null;
            return root.querySelector(selector);
        },
        querySelectorAll(selector) {
            return root.querySelectorAll(selector);
        },
    };
    const root = new FakeElement("body");

    const ids = [
        "test-form",
        "campaign-select",
        "folder-select",
        "refresh-campaigns-button",
        "refresh-folders-button",
        "get-test-cases-button",
        "api-loading-overlay",
        "api-domain-input",
        "api-authorization-input",
        "project-id-input",
        "environment-select",
        "api-timeout-input",
        "player-check-timeout-input",
        "test-case-max-time-input",
        "dns-host-add-button",
        "dns-host-remove-button",
        "dns-host-status",
        "run-target-browser",
        "run-target-webos",
        "lg-device-panel",
        "tv-device-select",
        "tv-device-status",
        "tv-device-connection-status",
        "tv-device-connection-dot",
        "tv-device-check-connection-button",
        "tv-device-add-button",
        "tv-device-edit-button",
        "lg-run-availability",
        "configure-lg-sdk-button",
        "tv-device-dialog",
        "tv-device-dialog-title",
        "tv-device-dialog-status",
        "tv-device-name-input",
        "tv-device-host-input",
        "tv-device-passphrase-input",
        "tv-device-passphrase-toggle",
        "tv-device-dialog-cancel-button",
        "tv-device-dialog-submit-button",
        "tv-toolchain-status",
        "sdk-auto-configure-button",
        "sdk-install-confirm-button",
        "sdk-use-managed-button",
        "sdk-managed-toolchain-status",
        "sdk-component-list",
        "sdk-compatibility-catalog-status",
        "sdk-compatibility-catalog-refresh-button",
        "sdk-compatibility-check-button",
        "lg-compatibility-product-gate-status",
        "lg-compatibility-product-gate-username-input",
        "lg-compatibility-product-gate-password-input",
        "lg-compatibility-product-gate-save-button",
        "lg-compatibility-dialog",
        "lg-compatibility-dialog-status",
        "lg-compatibility-name-input",
        "lg-compatibility-host-input",
        "lg-compatibility-passphrase-input",
        "lg-compatibility-inspection-review-button",
        "lg-compatibility-inspection-confirm-button",
        "lg-compatibility-validation-review-button",
        "lg-compatibility-validation-confirm-button",
        "lg-compatibility-close-button",
        "sdk-install-review",
        "sdk-install-progress",
        "sdk-install-progress-text",
        "sdk-install-progress-steps",
        "browser-component-list",
        "browser-auto-configure-button",
        "browser-install-confirm-button",
        "browser-install-review",
        "browser-install-progress",
        "browser-install-progress-text",
        "browser-install-progress-steps",
        "browser-toolchain-run-status",
        "configure-browser-button",
        "tv-toolchain-sdk-home-input",
        "tv-toolchain-appium-home-input",
        "tv-toolchain-appium-bin-input",
        "tv-toolchain-chromedriver-input",
        "tv-toolchain-save-button",
        "sdk-choose-lg-cli-button",
        "tv-device-register-button",
        "tv-help-button",
        "tv-help-modal",
        "tv-help-close-button",
        "selected-test-case-id",
        "test-case-list",
        "test-case-list-body",
        "test-case-search-input",
        "select-all-test-cases",
        "selected-test-case-count",
        "workspace-selected-count",
        "test-case-details",
        "test-case-details-modal",
        "test-case-details-close-button",
        "run-button",
        "stop-button",
        "retry-sync-button",
        "open-report-button",
        "show-report-button",
        "settings-button",
        "logs-button",
        "settings-modal",
        "logs-modal",
        "settings-close-button",
        "logs-close-button",
        "gui-settings-save-button",
        "test-configuration-save-button",
        "app-toast",
        "preview-target-status",
        "form-message",
        "status-dot",
        "status-text",
        "log-output",
        "browser-mute-button",
        "browser-preview-empty",
        "browser-preview-image",
        "lg-preview-empty",
        "lg-preview-image",
        "interactive-browser",
        "lg-run-confirmation-dialog",
        "lg-run-confirmation-count",
        "lg-run-confirm-button",
        "lg-run-cancel-button",
        "lg-run-state",
        "lg-recovery-dialog",
        "lg-recovery-retry-button",
        "lg-recovery-stop-button",
    ];

    ids.forEach((id) => {
        const element = new FakeElement(id === "test-form" ? "form" : "div");
        element.id = id;
        element.setAttribute("id", id);
        elements[id] = element;
        root.append(element);
    });

    elements["test-case-list"].tagName = "TABLE";
    elements["test-case-list-body"].tagName = "TBODY";
    elements["test-case-list"].append(elements["test-case-list-body"]);

    elements["test-case-details-modal"].className = "modal hidden";
    elements["settings-modal"].className = "modal hidden";
    elements["tv-help-modal"].className = "modal hidden";
    elements["tv-device-dialog"].className = "modal hidden";
    elements["lg-compatibility-dialog"].className = "modal hidden";
    elements["lg-run-confirmation-dialog"].className = "modal hidden";
    elements["lg-recovery-dialog"].className = "modal hidden";
    elements["tv-device-passphrase-input"].setAttribute("type", "password");
    elements["api-loading-overlay"].className = "api-loading-overlay";
    elements["app-toast"].className = "app-toast hidden";

    const stage = new FakeElement("div");
    stage.className = "browser-preview-stage";
    root.append(stage);

    const settingsClose = new FakeElement("div");
    settingsClose.setAttribute("data-close-settings", "");
    elements["settings-modal"].append(settingsClose);

    const tvHelpClose = new FakeElement("div");
    tvHelpClose.setAttribute("data-close-tv-help", "");
    elements["tv-help-modal"].append(tvHelpClose);

    const compatibilityClose = new FakeElement("div");
    compatibilityClose.setAttribute("data-close-lg-compatibility-dialog", "");
    elements["lg-compatibility-dialog"].append(compatibilityClose);

    const logsClose = new FakeElement("div");
    logsClose.setAttribute("data-close-logs", "");
    elements["logs-modal"].append(logsClose);

    const guiNav = new FakeElement("button");
    guiNav.setAttribute("data-settings-panel", "gui");
    root.append(guiNav);

    const guiPanel = new FakeElement("section");
    guiPanel.setAttribute("data-settings-content", "gui");
    root.append(guiPanel);

    const testConfigurationNav = new FakeElement("button");
    testConfigurationNav.setAttribute("data-settings-panel", "test-configuration");
    elements["test-configuration-nav"] = testConfigurationNav;
    root.append(testConfigurationNav);

    const testConfigurationPanel = new FakeElement("section");
    testConfigurationPanel.setAttribute("data-settings-content", "test-configuration");
    testConfigurationPanel.className = "hidden";
    root.append(testConfigurationPanel);

    const sdkNav = new FakeElement("button");
    sdkNav.setAttribute("data-settings-panel", "sdk");
    elements["sdk-settings-nav"] = sdkNav;
    root.append(sdkNav);

    const sdkPanel = new FakeElement("section");
    sdkPanel.setAttribute("data-settings-content", "sdk");
    sdkPanel.className = "hidden";
    root.append(sdkPanel);

    ["none", "live", "interactive"].forEach((value) => {
        const input = new FakeElement("input");
        input.setAttribute("name", "preview-type");
        input.value = value;
        root.append(input);
    });

    ["browser", "webos"].forEach((value) => {
        const input = elements[`run-target-${value}`];
        input.tagName = "INPUT";
        input.setAttribute("name", "run-target");
        input.value = value;
        input.checked = value === "browser";
    });

    const runner = {
        loadTestCases: async () => ({ok: true, cases: []}),
        clearTestCaseCache: async () => ({ok: true}),
        loadFlowCaseCampaigns: async () => ({ok: true, campaigns: []}),
        loadFlowCaseFolders: async () => ({ok: true, folders: []}),
        loadFlowCases: async () => ({ok: true, folder: null, cases: []}),
        setTestConfiguration: async (configuration) => ({ok: true, ...configuration}),
        listTvDevices: async () => ({
            ok: true,
            devices: [
                {
                    id: "lab-lg",
                    label: "Lab LG",
                    platform: "webos",
                    appId: "com.mytvb2c.app",
                    backendEnvironment: "production",
                    model: "55QNED80SRA",
                    hasLastKnownHost: true,
                },
            ],
        }),
        validateAndSaveTvDevice: async () => ({ok: false, status: "VALIDATION_UNAVAILABLE"}),
        getTvToolchainConfiguration: async () => ({ok: true, configured: false, platform: "webos", components: []}),
        saveTvToolchainConfiguration: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        inspectTvToolchain: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        getLgToolchainStatus: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        getLgRunAvailability: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        runLgBatchCalls: [],
        async runLgBatch(request) {
            this.runLgBatchCalls.push(request);
            return {ok: true, caseRuns: [], stopped: false};
        },
        async resolveLgRunRecovery() {
            return {ok: true};
        },
        onLgRunStatus: () => () => {},
        onLgRunPreview: () => () => {},
        planLgToolchainSetup: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        installLgToolchain: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        onLgToolchainInstallProgress: () => () => {},
        getBrowserToolchainStatus: async () => ({ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready"}}),
        getHostEntryStatus: async () => ({ok: true, exists: false}),
        addHostEntry: async () => ({ok: true, exists: true}),
        removeHostEntry: async () => ({ok: true, exists: false}),
        planBrowserToolchainSetup: async () => ({ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready"}}),
        installBrowserToolchain: async () => ({ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready"}}),
        onBrowserToolchainInstallProgress: () => () => {},
        activateManagedLgToolchain: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        inspectLgCompatibilityDevice: async () => ({ok: false, status: "INSPECTION_FAILED"}),
        runLgCompatibilityValidation: async () => ({ok: false, status: "VALIDATION_FAILED"}),
        discardLgCompatibilityAttempt: async () => ({ok: true}),
        registerWebOsTarget: async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"}),
        submitFlowCaseResults: async () => ({ok: true}),
        runTest: async () => ({ok: true}),
        stopTest: async () => ({ok: true}),
        openReport: () => {},
        showReportFolder: () => {},
        showInteractiveBrowser: async () => {},
        hideInteractiveBrowser: async () => {},
        suspendInteractiveBrowser: async () => {},
        resumeInteractiveBrowser: async () => {},
        setInteractiveBrowserMuted: async () => {},
        onStarted: () => {},
        logCallback: null,
        onLog(callback) {
            this.logCallback = callback;
        },
        onPreview: () => {},
        stopRequestedCallback: null,
        onStopRequested(callback) {
            this.stopRequestedCallback = callback;
        },
        finishedCallback: null,
        onFinished(callback) {
            this.finishedCallback = callback;
        },
    };

    const timers = new Map();
    let nextTimerId = 0;
    const windowRef = {
        addEventListener: () => {},
        alert: () => {},
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, {callback, delay});
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
    };

    return {
        document,
        elements,
        runner,
        storage: {
            getItem: () => null,
            setItem: () => {},
        },
        windowRef,
        timers,
    };
}

async function flushRendererPromises() {
    await new Promise((resolve) => setImmediate(resolve));
}

test("renderer entry is available to lightweight UI tests", () => {
    assert.equal(loadError, undefined, loadError?.message);
    assert.equal(typeof renderer.createRendererController, "function");
});

test("opens the compatibility dialog without calling live-TV IPC", () => {
    const fixture = createRendererFixture();
    let inspections = 0;
    fixture.runner.inspectLgCompatibilityDevice = async () => {
        inspections += 1;
    };
    const controller = renderer.createRendererController(fixture);

    controller.openLgCompatibilityDialog();

    assert.equal(inspections, 0);
    assert.equal(fixture.elements["lg-compatibility-dialog"].classList.contains("hidden"), false);
});

test("requires inspection and validation confirmations, then clears transient values on close", async () => {
    const fixture = createRendererFixture();
    const inspections = [];
    const validations = [];
    const discards = [];
    fixture.runner.inspectLgCompatibilityDevice = async (request) => {
        inspections.push(request);
        return {ok: true, status: "COMPATIBILITY_VERIFIED", attemptId: "attempt-a1", model: "model-a", firmware: "firmware-a"};
    };
    fixture.runner.runLgCompatibilityValidation = async (request) => {
        validations.push(request);
        return {ok: true, status: "VALIDATION_PASSED"};
    };
    fixture.runner.discardLgCompatibilityAttempt = async (request) => {
        discards.push(request);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([{id: "case-1", name: "Product gate", actions: [{action: "open_home"}]}]);
    const checkbox = fixture.elements["test-case-list-body"].querySelector("input");
    checkbox.checked = true;
    checkbox.dispatchEvent("change", {target: checkbox});

    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();
    assert.deepEqual(inspections, []);
    await controller.confirmLgCompatibilityInspection();
    assert.deepEqual(inspections, [{confirmed: true, label: "Lab", host: "192.0.2.10", passphrase: "runtime-only"}]);
    assert.equal(fixture.elements["lg-compatibility-host-input"].value, "");
    assert.equal(fixture.elements["lg-compatibility-passphrase-input"].value, "");

    controller.reviewLgCompatibilityValidation();
    assert.deepEqual(validations, []);
    await controller.confirmLgCompatibilityValidation();
    assert.deepEqual(validations, [{confirmed: true, attemptId: "attempt-a1"}]);
    assert.doesNotMatch(fixture.elements["lg-compatibility-dialog-status"].textContent, /192\.0\.2\.10|runtime-only|attempt-a1/i);

    await controller.closeLgCompatibilityDialog();
    assert.deepEqual(discards, [{attemptId: "attempt-a1"}]);
    assert.equal(fixture.elements["lg-compatibility-name-input"].value, "");
    assert.equal(fixture.elements["lg-compatibility-dialog"].classList.contains("hidden"), true);
});

test("uses fixed redacted compatibility status copy for hostile IPC results", async () => {
    const fixture = createRendererFixture();
    fixture.runner.inspectLgCompatibilityDevice = async () => ({
        ok: false,
        status: "COMPATIBILITY_PROFILE_UNVERIFIED",
        host: "192.0.2.10",
        passphrase: "runtime-only",
        archivePath: "/tmp/private",
    });
    const controller = renderer.createRendererController(fixture);
    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();

    await controller.confirmLgCompatibilityInspection();

    assert.match(fixture.elements["lg-compatibility-dialog-status"].textContent, /does not have a verified compatibility profile/i);
    assert.doesNotMatch(fixture.elements["lg-compatibility-dialog-status"].textContent, /192\.0\.2\.10|runtime-only|\/tmp\/private/i);
});

test("explains when a selected case is outside the LG compatibility gate", async () => {
    const fixture = createRendererFixture();
    fixture.runner.inspectLgCompatibilityDevice = async () => ({
        ok: true,
        status: "COMPATIBILITY_VERIFIED",
        attemptId: "attempt-a1",
        model: "model-a",
        firmware: "firmware-a",
    });
    fixture.runner.runLgCompatibilityValidation = async () => ({
        ok: false,
        status: "LG_COMPATIBILITY_CASE_UNSUPPORTED",
    });
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([{id: "case-1", name: "Product gate", actions: [{action: "focus_row"}]}]);
    const checkbox = fixture.elements["test-case-list-body"].querySelector("input");
    checkbox.checked = true;
    checkbox.dispatchEvent("change", {target: checkbox});

    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();
    await controller.confirmLgCompatibilityInspection();
    controller.reviewLgCompatibilityValidation();
    await controller.confirmLgCompatibilityValidation();

    const status = fixture.elements["lg-compatibility-dialog-status"].textContent;
    assert.match(status, /built-in LG compatibility case is not supported/i);
    assert.doesNotMatch(status, /unavailable/i);
    assert.doesNotMatch(status, /192\.0\.2\.10|runtime-only|attempt-a1/i);
});

test("groups runner log chunks into one complete expandable entry", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    fixture.runner.logCallback("first output chunk\n");
    fixture.runner.logCallback("final output chunk\n");

    const entries = fixture.elements["log-output"].children;
    assert.equal(entries.length, 1);
    assert.match(entries[0].querySelector(".log-entry-label").textContent, /Playwright runner output/);
    assert.equal(entries[0].querySelector(".log-entry-content").textContent, "first output chunk\nfinal output chunk\n");
    assert.equal(typeof controller.loadCases, "function");
});

test("renders test cases as selectable table rows with a disabled empty batch action", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    controller.renderCaseList([
        {id: "case-1", name: "First case", platform: "tv", actions: []},
        {id: "case-2", name: "Second case", platform: "web", actions: []},
    ]);

    const rows = fixture.elements["test-case-list-body"].querySelectorAll("tr");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].querySelector("input").checked, false);
    assert.match(rows[0].textContent, /case-1/);
    assert.match(rows[0].textContent, /First case/);
    assert.equal(rows[0].querySelectorAll("button").length, 1);
    assert.equal(fixture.elements["selected-test-case-count"].textContent, "0 selected");
    assert.equal(fixture.elements["run-button"].textContent, "Run Selected (0)");
    assert.equal(fixture.elements["run-button"].disabled, true);
});

test("requires Browser configuration before a selected case can run without managed Chromium", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.getBrowserToolchainStatus = async () => ({
        ok: true,
        state: "missing",
        component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "missing"},
    });
    const controller = renderer.createRendererController(fixture);

    await controller.loadBrowserToolchainStatus();
    controller.renderCaseList([{id: "case-1", name: "First case", actions: []}]);
    const checkbox = fixture.elements["test-case-list-body"].querySelector("input");
    checkbox.checked = true;
    checkbox.dispatchEvent("change", {target: checkbox});

    assert.equal(fixture.elements["run-button"].disabled, true);
    assert.match(fixture.elements["browser-toolchain-run-status"].textContent, /Configure Browser/);
    assert.equal(fixture.elements["configure-browser-button"].classList.contains("hidden"), false);

    fixture.elements["configure-browser-button"].dispatchEvent("click");
    await Promise.resolve();
    assert.equal(fixture.elements["settings-modal"].classList.contains("hidden"), false);
    assert.equal(fixture.elements["sdk-settings-nav"].classList.contains("active"), true);
});

test("renders only fixed redacted progress for a confirmed Browser installation", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const requests = [];
    let onProgress;
    fixture.runner.onBrowserToolchainInstallProgress = (callback) => {
        onProgress = callback;
        return () => {};
    };
    fixture.runner.installBrowserToolchain = async (request) => {
        requests.push(request);
        onProgress({code: "downloading-chromium", path: "/private-browser-cache", output: "private"});
        return {
            ok: true,
            state: "ready",
            component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready"},
        };
    };
    const controller = renderer.createRendererController(fixture);

    await controller.installBrowserToolchain();

    assert.deepEqual(requests, [{confirmed: true}]);
    assert.match(fixture.elements["browser-install-progress-steps"].textContent, /Downloading reviewed Chromium/i);
    assert.doesNotMatch(fixture.elements["browser-install-progress-steps"].textContent, /private-browser-cache|private/i);
    assert.match(fixture.elements["browser-component-list"].textContent, /Ready/i);
});

test("select-all and per-row checkboxes update the selected count in table order", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "case-1", name: "First case", actions: []},
        {id: "case-2", name: "Second case", actions: []},
    ]);

    const header = fixture.elements["select-all-test-cases"];
    header.checked = true;
    header.dispatchEvent("change", {target: header});

    const rows = fixture.elements["test-case-list-body"].querySelectorAll("tr");
    assert.equal(rows[0].querySelector("input").checked, true);
    assert.equal(rows[1].querySelector("input").checked, true);
    assert.equal(fixture.elements["selected-test-case-count"].textContent, "2 selected");
    assert.equal(fixture.elements["run-button"].disabled, false);

    const secondRowCheckbox = rows[1].querySelector("input");
    secondRowCheckbox.checked = false;
    secondRowCheckbox.dispatchEvent("change", {target: secondRowCheckbox});

    assert.equal(fixture.elements["select-all-test-cases"].checked, false);
    assert.equal(fixture.elements["selected-test-case-count"].textContent, "1 selected");
    assert.deepEqual(controller.getSelectedCaseIds(), ["case-1"]);
});

test("filters rows instantly by ID substring and normalized name", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "12066", name: "Phim truyện", actions: []},
        {id: "22000", name: "Trang chủ", actions: []},
    ]);
    const rows = fixture.elements["test-case-list-body"].querySelectorAll("tr");
    const search = fixture.elements["test-case-search-input"];

    search.value = "1206";
    search.dispatchEvent("input", {target: search});
    assert.equal(rows[0].classList.contains("hidden"), false);
    assert.equal(rows[1].classList.contains("hidden"), true);

    search.value = "12065";
    search.dispatchEvent("input", {target: search});
    assert.equal(rows[0].classList.contains("hidden"), true);

    search.value = "phim truyen";
    search.dispatchEvent("input", {target: search});
    assert.equal(rows[0].classList.contains("hidden"), false);
    assert.equal(rows[1].classList.contains("hidden"), true);
});

test("visible-row select-all preserves selections outside the active filter", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "case-1", name: "First case", actions: []},
        {id: "case-2", name: "Second case", actions: []},
    ]);
    const rows = fixture.elements["test-case-list-body"].querySelectorAll("tr");
    const firstCheckbox = rows[0].querySelector("input");
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent("change", {target: firstCheckbox});

    const search = fixture.elements["test-case-search-input"];
    search.value = "Second";
    search.dispatchEvent("input", {target: search});
    const header = fixture.elements["select-all-test-cases"];
    header.checked = true;
    header.dispatchEvent("change", {target: header});

    assert.deepEqual(controller.getSelectedCaseIds(), ["case-1", "case-2"]);
    header.checked = false;
    header.dispatchEvent("change", {target: header});
    assert.deepEqual(controller.getSelectedCaseIds(), ["case-1"]);
});

test("opens a detail modal with execution fields and masked normalized actions", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {
            id: "case-1",
            name: "Login case",
            preCondition: "Signed out",
            qaDescription: "Login with the test account",
            expectedResult: "Home is visible",
            platform: "tv",
            environment: "staging",
            metadata: {category: "smoke", owner: "qa"},
            actions: [{action: "login", username: "visible-user", password: "secret"}],
        },
    ]);

    fixture.elements["test-case-list-body"].querySelector("button").dispatchEvent("click");

    assert.equal(fixture.elements["test-case-details-modal"].classList.contains("hidden"), false);
    const details = fixture.elements["test-case-details"].textContent;
    assert.match(details, /Login case/);
    assert.match(details, /Signed out/);
    assert.match(details, /Login with the test account/);
    assert.match(details, /Home is visible/);
    assert.match(details, /staging/);
    assert.match(details, /smoke/);
    assert.match(details, /login/);
    assert.match(details, /••••••/);
    assert.doesNotMatch(details, /secret/);
});

test("opening another case detail does not change the checked selection", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "case-1", name: "First case", actions: []},
        {id: "case-2", name: "Second case", actions: []},
    ]);

    const rows = fixture.elements["test-case-list-body"].querySelectorAll("tr");
    const firstCheckbox = rows[0].querySelector("input");
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent("change", {target: firstCheckbox});
    rows[1].querySelector("button").dispatchEvent("click");

    assert.deepEqual(controller.getSelectedCaseIds(), ["case-1"]);
    assert.equal(rows[0].querySelector("input").checked, true);
    assert.equal(rows[1].querySelector("input").checked, false);
});

test("selecting a case updates the hidden id and rendered details", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);
    const cases = [
        {
            id: "case-1",
            name: "First case",
            platform: "tv",
            actions: [{action: "open_home"}],
        },
        {
            id: "case-2",
            name: "Second case",
            platform: "tv",
            qaDescription: "Open the service",
            actions: [{action: "login", username: "ts1", password: "secret"}],
        },
    ];

    controller.renderCaseList(cases);
    controller.selectCase("case-2");

    assert.equal(fixture.elements["selected-test-case-id"].value, "case-2");
    assert.match(fixture.elements["test-case-details"].textContent, /Second case/);
    assert.match(fixture.elements["test-case-details"].textContent, /login/);
    assert.match(fixture.elements["test-case-details"].textContent, /••••••/);
    assert.equal(fixture.elements["test-case-list"].querySelector('[data-test-case-id="case-2"]').getAttribute("aria-selected"), "true");
});

test("loads cases through IPC and renders the returned list", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const cases = [
        {id: "local-1", name: "Local case", actions: []},
        {id: "local-2", name: "Another case", actions: []},
    ];
    fixture.runner.loadTestCases = async () => ({ok: true, cases});
    const controller = renderer.createRendererController(fixture);

    const response = await controller.loadCases();

    assert.deepEqual(response, {ok: true, cases});
    assert.equal(fixture.elements["test-case-list"].querySelectorAll("button").length, 2);
    assert.match(fixture.elements["test-case-list"].textContent, /Local case/);
});

test("bootstraps from browser globals and restores cached cases without an injected document", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.loadTestCases = async () => ({
        ok: true,
        source: "cache",
        cacheKey: "30",
        folder: {id: "30", name: "Cached folder", fullPath: "/Cached"},
        cases: [{id: "cached-1", name: "Cached startup case", actions: []}],
    });
    fixture.windowRef.mytvRunner = fixture.runner;
    fixture.windowRef.localStorage = fixture.storage;

    const previousDocument = global.document;
    const previousWindow = global.window;
    global.document = fixture.document;
    global.window = fixture.windowRef;
    try {
        renderer.bootstrapRenderer();
        await flushRendererPromises();
    } finally {
        if (previousDocument === undefined) delete global.document;
        else global.document = previousDocument;
        if (previousWindow === undefined) delete global.window;
        else global.window = previousWindow;
    }

    assert.match(fixture.elements["test-case-list"].textContent, /Cached startup case/);
});

test("restores the active folder when startup loads cached API cases", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.loadTestCases = async () => ({
        ok: true,
        source: "cache",
        folder: {id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"},
        cases: [{id: "cached-1", name: "Cached case", actions: []}],
    });
    const controller = renderer.createRendererController(fixture);

    await controller.loadCases();

    assert.equal(controller.getActiveFolderId(), "12");
    assert.match(fixture.elements["test-case-list"].textContent, /Cached case/);
});

test("restores the active campaign and cache key when startup loads campaign cases", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.loadTestCases = async () => ({
        ok: true,
        source: "cache",
        cacheKey: "campaign:12",
        campaign: {id: "12", name: "Regression tháng 8"},
        folder: {id: "folder-1", name: "Campaign folder", fullPath: "/Campaign"},
        cases: [{id: "cached-campaign-1", name: "Cached campaign case", actions: []}],
    });
    const controller = renderer.createRendererController(fixture);

    await controller.loadCases();

    assert.equal(controller.getActiveCampaignId(), "12");
    assert.equal(controller.getActiveCacheKey(), "campaign:12");
    assert.equal(controller.getActiveFolderId(), "folder-1");
    assert.match(fixture.elements["test-case-list"].textContent, /Cached campaign case/);
});

test("loads and renders folders by name with fullPath values", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.loadFlowCaseFolders = async () => ({ok: true, folders: [{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]});
    const controller = renderer.createRendererController(fixture);

    await controller.loadFolders();

    const option = fixture.elements["folder-select"].querySelectorAll("option")[1];
    assert.equal(option.textContent, "Play kênh");
    assert.equal(option.value, "/Root/Play kênh");
    assert.equal(option.dataset.folderId, "12");
});

test("loads and renders running campaigns in the campaign selector", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const folderRequests = [];
    fixture.runner.loadFlowCaseFolders = async (values) => {
        folderRequests.push(values);
        return {ok: true, folders: [{id: "folder-1", name: "Campaign folder", fullPath: "/Campaign"}]};
    };
    fixture.runner.loadFlowCaseCampaigns = async () => ({ok: true, campaigns: [{campaign: {id: "12", name: "Regression tháng 8"}, run: {status: "running"}}]});
    const controller = renderer.createRendererController(fixture);

    await controller.loadCampaigns();

    const option = fixture.elements["campaign-select"].querySelectorAll("option")[1];
    assert.equal(option.textContent, "Regression tháng 8");
    assert.equal(option.value, "12");
    assert.equal(option.dataset.campaignId, "12");
    fixture.elements["campaign-select"].value = "12";
    fixture.elements["campaign-select"].dispatchEvent("change", {target: fixture.elements["campaign-select"]});
    await flushRendererPromises();
    assert.equal(folderRequests.length, 1);
    assert.equal(folderRequests[0].CAMPAIGN_ID, "12");
    fixture.elements["folder-select"].value = "/Campaign";
    fixture.elements["folder-select"].dispatchEvent("change", {target: fixture.elements["folder-select"]});
    assert.equal(fixture.elements["get-test-cases-button"].disabled, false);
});

test("loads campaign copies by campaign ID and carries the campaign cache key into Browser results", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let loadRequest;
    let runRequest;
    const submissions = [];
    fixture.runner.loadFlowCases = async (values) => {
        loadRequest = values;
        return {
            ok: true,
            campaign: {id: "12", name: "Regression tháng 8"},
            folder: {id: "folder-1", name: "Campaign folder", fullPath: "/Campaign"},
            cacheKey: "campaign:12",
            cases: [{id: "1842", name: "Campaign copy", actions: []}],
        };
    };
    fixture.runner.runTest = async (values) => {
        runRequest = values;
        queueMicrotask(() => fixture.runner.finishedCallback({code: 0}));
        return {ok: true};
    };
    fixture.runner.submitFlowCaseResults = async (payload) => {
        submissions.push(payload);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCampaigns([{campaign: {id: "12", name: "Regression tháng 8"}, run: {status: "running"}}]);
    controller.renderFolders([{id: "folder-1", name: "Campaign folder", fullPath: "/Campaign"}]);
    fixture.elements["campaign-select"].value = "12";
    fixture.elements["folder-select"].value = "/Campaign";

    await controller.loadCasesFromFolder();
    assert.equal(loadRequest.CAMPAIGN_ID, "12");
    assert.equal(loadRequest.CAMPAIGN_NAME, "Regression tháng 8");
    assert.equal(loadRequest.FOLDER_ID, "folder-1");
    assert.equal(loadRequest.FOLDER_NAME, "/Campaign");
    assert.equal(controller.getActiveCampaignId(), "12");
    assert.equal(controller.getActiveCacheKey(), "campaign:12");
    controller.selectCase("1842");
    await fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});

    assert.equal(runRequest.TEST_CASE_CACHE_KEY, "campaign:12");
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].testcases[0].id, "1842");
    assert.equal(submissions[0].testcases[0].campaignId, "12");
});

test("clearing the campaign refreshes the folder list without a campaign filter", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const folderRequests = [];
    fixture.runner.loadFlowCaseFolders = async (values) => {
        folderRequests.push(values);
        return {ok: true, folders: [{id: "folder-1", name: "Folder", fullPath: "/Folder"}]};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCampaigns([{campaign: {id: "12", name: "Regression tháng 8"}, run: {status: "running"}}]);

    fixture.elements["campaign-select"].value = "12";
    fixture.elements["campaign-select"].dispatchEvent("change", {target: fixture.elements["campaign-select"]});
    await flushRendererPromises();
    assert.equal(folderRequests.at(-1).CAMPAIGN_ID, "12");

    controller.renderCaseList([{id: "stale", name: "Stale case", actions: []}]);
    fixture.elements["campaign-select"].value = "";
    fixture.elements["campaign-select"].dispatchEvent("change", {target: fixture.elements["campaign-select"]});
    await flushRendererPromises();

    assert.equal(folderRequests.at(-1).CAMPAIGN_ID, undefined);
    assert.equal(fixture.elements["test-case-list-body"].children.length, 0);
    assert.equal(controller.getActiveCacheKey(), "");
});

test("clears loaded cases and the persisted cache after a successful folder refresh", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let clearCalls = 0;
    fixture.runner.clearTestCaseCache = async () => {
        clearCalls += 1;
        return {ok: true};
    };
    fixture.runner.loadFlowCaseFolders = async () => ({ok: true, folders: [{id: "folder-1", name: "Folder", fullPath: "/Folder"}]});
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([{id: "stale", name: "Stale case", actions: []}]);

    await controller.loadFolders();

    assert.equal(clearCalls, 1);
    assert.equal(fixture.elements["test-case-list-body"].children.length, 0);
    assert.equal(controller.getActiveCacheKey(), "");
});

test("clears loaded cases and the persisted cache after a successful campaign refresh", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let clearCalls = 0;
    fixture.runner.clearTestCaseCache = async () => {
        clearCalls += 1;
        return {ok: true};
    };
    fixture.runner.loadFlowCaseCampaigns = async () => ({ok: true, campaigns: []});
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([{id: "stale", name: "Stale case", actions: []}]);

    await controller.loadCampaigns();

    assert.equal(clearCalls, 1);
    assert.equal(fixture.elements["test-case-list-body"].children.length, 0);
    assert.equal(controller.getActiveCacheKey(), "");
});

test("folder-only case loading omits campaign context", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let loadRequest;
    fixture.runner.loadFlowCases = async (values) => {
        loadRequest = values;
        return {ok: true, folder: {id: "folder-1", name: "Folder", fullPath: "/Folder"}, cases: [{id: "case-1", name: "Folder case", actions: []}]};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "folder-1", name: "Folder", fullPath: "/Folder"}]);
    fixture.elements["folder-select"].value = "/Folder";

    await controller.loadCasesFromFolder();

    assert.equal(loadRequest.CAMPAIGN_ID, undefined);
    assert.equal(loadRequest.CAMPAIGN_NAME, undefined);
    assert.equal(loadRequest.FOLDER_NAME, "/Folder");
});

test("logs API request and redacted response details while loading folders", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const createElement = fixture.document.createElement;
    fixture.document.createElement = (tagName) => {
        const element = createElement(tagName);
        if (tagName === "pre") {
            element.scrollHeight = 0;
            element.clientHeight = 0;
        }
        return element;
    };
    fixture.runner.loadFlowCaseFolders = async () => ({
        ok: true,
        folders: [],
        apiLog: {
            request: {method: "GET", url: "http://api.test/folders"},
            response: {status: 200, body: {password: "private", folders: []}},
        },
    });
    const controller = renderer.createRendererController(fixture);

    await controller.loadFolders();

    assert.match(fixture.elements["log-output"].textContent, /Load flow-case folders request/);
    assert.match(fixture.elements["log-output"].textContent, /http:\/\/api\.test\/folders/);
    assert.match(fixture.elements["log-output"].textContent, /••••••/);
    assert.doesNotMatch(fixture.elements["log-output"].textContent, /private/);
    const [responseEntry, requestEntry] = fixture.elements["log-output"].children;
    fixture.elements["log-output"].querySelectorAll(".log-entry-content").forEach((content) => {
        content.scrollHeight = 300;
        content.clientHeight = 220;
    });
    fixture.elements["logs-button"].dispatchEvent("click");
    await Promise.resolve();
    assert.match(requestEntry.querySelector("time").textContent, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.match(requestEntry.querySelector(".log-entry-label").textContent, /Load flow-case folders request/);
    assert.equal(requestEntry.classList.contains("is-collapsible"), true);
    requestEntry.dispatchEvent("click");
    assert.equal(requestEntry.classList.contains("is-expanded"), true);
    assert.equal(requestEntry.getAttribute("aria-expanded"), "true");
    assert.match(responseEntry.querySelector(".log-entry-label").textContent, /Load flow-case folders response/);
});

test("downloads selected-folder cases and tracks the folder ID", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.loadFlowCases = async (values) => ({
        ok: true,
        folder: {
            id: values.FOLDER_ID,
            name: "Play kênh",
            fullPath: values.FOLDER_NAME,
        },
        cases: [{id: "case-1", name: "Remote case", actions: []}],
    });
    const controller = renderer.createRendererController(fixture);

    controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
    fixture.elements["folder-select"].value = "/Root/Play kênh";
    await controller.loadCasesFromFolder();

    assert.match(fixture.elements["test-case-list"].textContent, /Remote case/);
    assert.equal(controller.getActiveFolderId(), "12");
});

test("shows timeout alerts and always removes the loading overlay", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.loadFlowCaseFolders = async () => ({ok: false, timeout: true, message: "timed out"});
    const alerts = [];
    fixture.windowRef.alert = (message) => alerts.push(message);
    const controller = renderer.createRendererController(fixture);

    await controller.loadFolders();

    assert.equal(fixture.elements["api-loading-overlay"].classList.contains("hidden"), true);
    assert.match(alerts[0], /timed out/i);
});

test("loads and saves connection and network settings", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let stored;
    fixture.storage.getItem = () =>
        JSON.stringify({
            APP_URL: "https://saved.test/",
            DNS_HOST: "198.51.100.10 saved.example.test",
            API_DOMAIN: "http://saved-api.test",
            API_AUTHORIZATION: "Bearer saved-token",
            PROJECT_ID: "7",
            ENVIRONMENT: "API",
            API_TIMEOUT_SECONDS: "45",
            PLAYER_CHECK_TIMEOUT_SECONDS: "12",
            TEST_CASE_MAX_TIME_MINUTES: "45",
            PREVIEW_TYPE: "none",
        });
    fixture.storage.setItem = (_key, value) => {
        stored = JSON.parse(value);
    };
    renderer.createRendererController(fixture);

    assert.equal(fixture.elements["settings-app-url-input"], undefined);
    assert.equal(fixture.elements["dns-host-input"], undefined);
    assert.equal(fixture.elements["api-domain-input"].value, "http://saved-api.test");
    assert.equal(fixture.elements["api-authorization-input"].value, "Bearer saved-token");
    assert.equal(fixture.elements["project-id-input"].value, "7");
    assert.equal(fixture.elements["environment-select"].value, "API");
    assert.equal(fixture.elements["api-timeout-input"].value, "45");
    assert.equal(fixture.elements["player-check-timeout-input"].value, "12");
    assert.equal(fixture.elements["test-case-max-time-input"].value, "45");
    fixture.elements["gui-settings-save-button"].dispatchEvent("click");
    assert.equal(stored.API_TIMEOUT_SECONDS, "45");
    assert.equal(stored.PLAYER_CHECK_TIMEOUT_SECONDS, "12");
    assert.equal(stored.TEST_CASE_MAX_TIME_MINUTES, "45");
    assert.equal(stored.API_AUTHORIZATION, "Bearer saved-token");
    assert.equal(stored.ENVIRONMENT, "API");
    assert.equal(stored.APP_URL, undefined);
    assert.equal(stored.DNS_HOST, undefined);
});

test("saves and sanitizes Test configuration timeouts with an auto-hide success toast", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let stored;
    fixture.storage.setItem = (_key, value) => {
        stored = JSON.parse(value);
    };
    renderer.createRendererController(fixture);

    fixture.elements["player-check-timeout-input"].value = "15e2";
    fixture.elements["player-check-timeout-input"].dispatchEvent("input");
    assert.equal(fixture.elements["player-check-timeout-input"].value, "152");
    fixture.elements["test-case-max-time-input"].value = "4e1";
    fixture.elements["test-case-max-time-input"].dispatchEvent("input");
    assert.equal(fixture.elements["test-case-max-time-input"].value, "41");

    fixture.elements["player-check-timeout-input"].value = "0";
    fixture.elements["test-configuration-save-button"].dispatchEvent("click");
    await flushRendererPromises();

    assert.equal(fixture.elements["player-check-timeout-input"].value, "6");
    assert.equal(stored.PLAYER_CHECK_TIMEOUT_SECONDS, "6");
    assert.equal(fixture.elements["test-case-max-time-input"].value, "41");
    assert.equal(stored.TEST_CASE_MAX_TIME_MINUTES, "41");
    assert.equal(fixture.elements["app-toast"].textContent, "Test configuration saved successfully.");
    assert.equal(fixture.elements["app-toast"].className, "app-toast ok");
    assert.deepEqual(
        [...fixture.timers.values()].map(({delay}) => delay),
        [3000],
    );
    [...fixture.timers.values()][0].callback();
    assert.equal(fixture.elements["app-toast"].textContent, "");
    assert.equal(fixture.elements["app-toast"].className, "app-toast hidden");
    assert.equal(fixture.elements["test-configuration-nav"].dataset.settingsPanel, "test-configuration");
});

test("shows an error toast when test configuration synchronization fails", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.setTestConfiguration = async () => ({ok: false});
    renderer.createRendererController(fixture);

    fixture.elements["player-check-timeout-input"].value = "9";
    fixture.elements["test-configuration-save-button"].dispatchEvent("click");
    await flushRendererPromises();

    assert.equal(fixture.elements["app-toast"].textContent, "Could not save test configuration.");
    assert.equal(fixture.elements["app-toast"].className, "app-toast error");
});

test("replaces the previous save toast timer when saving again", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    renderer.createRendererController(fixture);

    fixture.elements["test-configuration-save-button"].dispatchEvent("click");
    await flushRendererPromises();
    const firstTimerId = [...fixture.timers.keys()][0];

    fixture.elements["player-check-timeout-input"].value = "11";
    fixture.elements["test-configuration-save-button"].dispatchEvent("click");
    await flushRendererPromises();

    assert.equal(fixture.timers.has(firstTimerId), false);
    assert.equal(fixture.timers.size, 1);
    assert.equal(fixture.elements["app-toast"].className, "app-toast ok");
});

test("does not fetch workspace lists during startup; each Refresh remains manual", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let folderRequests = 0;
    let campaignRequests = 0;
    fixture.runner.loadFlowCaseFolders = async () => {
        folderRequests += 1;
        return {ok: true, folders: []};
    };
    fixture.runner.loadFlowCaseCampaigns = async () => {
        campaignRequests += 1;
        return {ok: true, campaigns: []};
    };
    renderer.bootstrapRenderer(fixture);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(folderRequests, 0);

    fixture.elements["refresh-folders-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(folderRequests, 1);
    assert.equal(campaignRequests, 0);

    fixture.elements["refresh-campaigns-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(folderRequests, 1);
    assert.equal(campaignRequests, 1);
});

test("enables DNS host actions from hosts-file presence", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let exists = false;
    const updates = [];
    fixture.runner.getHostEntryStatus = async (...args) => {
        updates.push(["status", ...args]);
        return {ok: true, exists};
    };
    fixture.runner.addHostEntry = async (...args) => {
        updates.push(["add", ...args]);
        exists = true;
        return {ok: true, exists: true};
    };
    fixture.runner.removeHostEntry = async (...args) => {
        updates.push(["remove", ...args]);
        exists = false;
        return {ok: true, exists: false};
    };
    const controller = renderer.createRendererController(fixture);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(fixture.elements["dns-host-input"], undefined);
    assert.equal(fixture.elements["dns-host-add-button"].disabled, false);
    assert.equal(fixture.elements["dns-host-remove-button"].disabled, true);
    fixture.elements["dns-host-add-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(updates, [["status"], ["add"], ["status"]]);
    assert.equal(fixture.elements["dns-host-add-button"].disabled, true);
    assert.equal(fixture.elements["dns-host-remove-button"].disabled, false);
    assert.equal(typeof controller.validateRunValues, "function");
});

test("includes the active folder ID when running downloaded cases", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let submittedValues;
    fixture.runner.loadFlowCases = async () => ({
        ok: true,
        folder: {
            id: "12",
            name: "Play kênh",
            fullPath: "/Root/Play kênh",
        },
        cases: [{id: "case-1", name: "Remote case", actions: []}],
    });
    fixture.runner.runTest = async (values) => {
        submittedValues = values;
        queueMicrotask(() => fixture.runner.finishedCallback({code: 0}));
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
    fixture.elements["folder-select"].value = "/Root/Play kênh";
    await controller.loadCasesFromFolder();
    controller.selectCase("case-1");
    await fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});

    assert.equal(submittedValues.TEST_CASE_FOLDER_ID, "12");
});

test("submits all downloaded test results only after the selected batch finishes", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const submittedResults = [];
    fixture.runner.loadFlowCases = async () => ({
        ok: true,
        folder: {
            id: "12",
            name: "Play kênh",
            fullPath: "/Root/Play kênh",
        },
        cases: [
            {id: "case-1", name: "First remote case", actions: []},
            {id: "case-2", name: "Second remote case", actions: []},
        ],
    });
    fixture.runner.runTest = async () => ({ok: true});
    fixture.runner.submitFlowCaseResults = async (payload) => {
        submittedResults.push(payload);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
    fixture.elements["folder-select"].value = "/Root/Play kênh";
    await controller.loadCasesFromFolder();
    fixture.elements["select-all-test-cases"].checked = true;
    fixture.elements["select-all-test-cases"].dispatchEvent("change", {target: fixture.elements["select-all-test-cases"]});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    fixture.runner.finishedCallback({
        code: 1,
        caseResult: {steps: [{status: "failed", message: "Playback did not start"}]},
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(submittedResults.length, 0);

    fixture.runner.finishedCallback({code: 0});
    await runPromise;

    assert.equal(submittedResults.length, 1);
    assert.equal(submittedResults[0].FOLDER_PATH, "/Root/Play kênh");
    assert.deepEqual(
        submittedResults[0].testcases.map(({id, status, testResult}) => ({
            id,
            status,
            testStatus: testResult.status,
            message: testResult.message,
            passed: testResult.passed,
            failed: testResult.failed,
        })),
        [
            {id: "case-1", status: "tested", testStatus: "failed", message: "Playback did not start", passed: 0, failed: 1},
            {id: "case-2", status: "tested", testStatus: "success", message: "Testcase chạy thành công.", passed: 1, failed: 0},
        ],
    );
    assert.match(submittedResults[0].testcases[0].testResult.finishedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("does not submit partial downloaded results after a batch is stopped", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let submissionCount = 0;
    fixture.runner.loadFlowCases = async () => ({
        ok: true,
        folder: {
            id: "12",
            name: "Play kênh",
            fullPath: "/Root/Play kênh",
        },
        cases: [
            {id: "case-1", name: "First remote case", actions: []},
            {id: "case-2", name: "Second remote case", actions: []},
        ],
    });
    fixture.runner.runTest = async () => ({ok: true});
    fixture.runner.submitFlowCaseResults = async () => {
        submissionCount += 1;
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
    fixture.elements["folder-select"].value = "/Root/Play kênh";
    await controller.loadCasesFromFolder();
    fixture.elements["select-all-test-cases"].checked = true;
    fixture.elements["select-all-test-cases"].dispatchEvent("change", {target: fixture.elements["select-all-test-cases"]});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    await fixture.elements["stop-button"].listeners.get("click")();
    await runPromise;

    assert.equal(submissionCount, 0);
});

test("does not echo a main stop event and allows a fresh run afterward", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let runCalls = 0;
    let stopCalls = 0;
    let emitStopEvent = true;
    fixture.runner.loadFlowCases = async () => ({
        ok: true,
        folder: {
            id: "12",
            name: "Play kênh",
            fullPath: "/Root/Play kênh",
        },
        cases: [{id: "case-1", name: "Remote case", actions: []}],
    });
    fixture.runner.runTest = async () => {
        runCalls += 1;
        if (runCalls === 2) queueMicrotask(() => fixture.runner.finishedCallback({code: 0}));
        return {ok: true};
    };
    fixture.runner.stopTest = async () => {
        stopCalls += 1;
        if (emitStopEvent) {
            emitStopEvent = false;
            queueMicrotask(() => fixture.runner.stopRequestedCallback?.());
        }
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
    fixture.elements["folder-select"].value = "/Root/Play kênh";
    await controller.loadCasesFromFolder();
    controller.selectCase("case-1");

    const stoppedRun = controller.runSelectedCases();
    await new Promise((resolve) => setImmediate(resolve));
    await fixture.elements["stop-button"].listeners.get("click")();
    const stoppedResult = await stoppedRun;

    assert.equal(stoppedResult.stopped, true);
    assert.equal(stopCalls, 1);

    const restartedResult = await controller.runSelectedCases();
    assert.equal(runCalls, 2);
    assert.equal(restartedResult.completed, 1);
    assert.equal(restartedResult.skipped, 0);
    assert.equal(restartedResult.stopped, false);
});

test("submits only fully completed downloaded cases after a manual stop", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const submittedResults = [];
    fixture.runner.loadFlowCases = async () => ({
        ok: true,
        folder: {
            id: "12",
            name: "Play kênh",
            fullPath: "/Root/Play kênh",
        },
        cases: [
            {id: "case-1", name: "Completed remote case", actions: []},
            {id: "case-2", name: "Interrupted remote case", actions: []},
            {id: "case-3", name: "Unstarted remote case", actions: []},
        ],
    });
    fixture.runner.runTest = async () => ({ok: true});
    fixture.runner.submitFlowCaseResults = async (payload) => {
        submittedResults.push(payload);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
    fixture.elements["folder-select"].value = "/Root/Play kênh";
    await controller.loadCasesFromFolder();
    fixture.elements["select-all-test-cases"].checked = true;
    fixture.elements["select-all-test-cases"].dispatchEvent("change", {target: fixture.elements["select-all-test-cases"]});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    fixture.runner.finishedCallback({code: 0});
    await new Promise((resolve) => setImmediate(resolve));
    await fixture.elements["stop-button"].listeners.get("click")();
    await runPromise;

    assert.equal(submittedResults.length, 1);
    assert.deepEqual(
        submittedResults[0].testcases.map((item) => item.id),
        ["case-1"],
    );
});

test("refreshes API authorization before retrying an immutable failed result submission", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const submissions = [];
    fixture.runner.loadFlowCases = async () => ({ok: true, folder: {id: "12", name: "Folder", fullPath: "/Root/Folder"}, cases: [{id: "case-1", name: "Remote case", actions: []}]});
    fixture.runner.runTest = async () => ({ok: true});
    fixture.runner.submitFlowCaseResults = async (payload) => {
        submissions.push(payload);
        return {ok: submissions.length > 1};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderFolders([{id: "12", name: "Folder", fullPath: "/Root/Folder"}]);
    fixture.elements["folder-select"].value = "/Root/Folder";
    await controller.loadCasesFromFolder();
    fixture.elements["select-all-test-cases"].checked = true;
    fixture.elements["select-all-test-cases"].dispatchEvent("change", {target: fixture.elements["select-all-test-cases"]});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    fixture.runner.finishedCallback({code: 0});
    await runPromise;
    assert.equal(fixture.elements["retry-sync-button"].disabled, false);
    assert.equal(submissions[0].API_AUTHORIZATION, "");
    fixture.elements["api-authorization-input"].value = "service-token";
    const retry = await controller.retryResultSync();

    assert.equal(retry.ok, true);
    assert.equal(submissions.length, 2);
    assert.equal(submissions[1].API_AUTHORIZATION, "service-token");
    assert.deepEqual(submissions[1].testcases, submissions[0].testcases);
    assert.equal(submissions[0].API_AUTHORIZATION, "");
    assert.equal(fixture.elements["retry-sync-button"].disabled, true);
    assert.equal((await controller.retryResultSync()).ok, false);
});

test("submits only the generic test-run payload", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let submittedValues;
    fixture.runner.runTest = async (values) => {
        submittedValues = values;
        queueMicrotask(() => fixture.runner.finishedCallback({code: 0}));
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    fixture.elements["player-check-timeout-input"].value = "14";
    controller.renderCaseList([{id: "case-1", name: "Case", actions: []}]);
    controller.selectCase("case-1");

    const submit = fixture.elements["test-form"].listeners.get("submit");
    await submit({preventDefault() {}});

    assert.deepEqual(submittedValues, {
        TEST_CASE_ID: "case-1",
        PREVIEW_TYPE: "live",
        PLAYER_CHECK_TIMEOUT_SECONDS: "14",
        TEST_CASE_MAX_TIME_MINUTES: "30",
    });
});

test("runs selected cases sequentially and preserves the generic IPC payload", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.runTest = async (values) => {
        calls.push(values);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "case-1", name: "First case", actions: []},
        {id: "case-2", name: "Second case", actions: []},
    ]);
    const header = fixture.elements["select-all-test-cases"];
    header.checked = true;
    header.dispatchEvent("change", {target: header});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
        TEST_CASE_ID: "case-1",
        PREVIEW_TYPE: "live",
        PLAYER_CHECK_TIMEOUT_SECONDS: "6",
        TEST_CASE_MAX_TIME_MINUTES: "30",
    });
    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-1"]').textContent, "Running");

    fixture.runner.finishedCallback({code: 0});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 2);
    assert.equal(calls[1].TEST_CASE_ID, "case-2");
    fixture.runner.finishedCallback({code: 0});
    await runPromise;

    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-1"]').textContent, "Passed");
    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-2"]').textContent, "Passed");
    assert.match(fixture.elements["form-message"].textContent, /Completed: 2, Failed: 0, Skipped: 0/);
});

test("continues the batch after a failed case and reports isolated statuses", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.runTest = async (values) => {
        calls.push(values.TEST_CASE_ID);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "case-1", name: "First case", actions: []},
        {id: "case-2", name: "Second case", actions: []},
    ]);
    fixture.elements["select-all-test-cases"].checked = true;
    fixture.elements["select-all-test-cases"].dispatchEvent("change", {target: fixture.elements["select-all-test-cases"]});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    fixture.runner.finishedCallback({code: 1, message: "failed"});
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, ["case-1", "case-2"]);
    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-1"]').textContent, "Failed");
    fixture.runner.finishedCallback({code: 0});
    await runPromise;

    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-2"]').textContent, "Passed");
    assert.match(fixture.elements["form-message"].textContent, /Completed: 1, Failed: 1, Skipped: 0/);
});

test("stopping a batch prevents queued cases from starting and counts them as skipped", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    let stopCalls = 0;
    fixture.runner.runTest = async (values) => {
        calls.push(values.TEST_CASE_ID);
        return {ok: true};
    };
    fixture.runner.stopTest = async () => {
        stopCalls += 1;
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([
        {id: "case-1", name: "First case", actions: []},
        {id: "case-2", name: "Second case", actions: []},
    ]);
    fixture.elements["select-all-test-cases"].checked = true;
    fixture.elements["select-all-test-cases"].dispatchEvent("change", {target: fixture.elements["select-all-test-cases"]});

    const runPromise = fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});
    await Promise.resolve();
    await fixture.elements["stop-button"].listeners.get("click")();
    await runPromise;

    assert.deepEqual(calls, ["case-1"]);
    assert.equal(stopCalls, 1);
    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-1"]').textContent, "Failed");
    assert.equal(fixture.elements["test-case-list-body"].querySelector('[data-test-case-status="case-2"]').textContent, "Skipped");
    assert.match(fixture.elements["form-message"].textContent, /Completed: 0, Failed: 1, Skipped: 1/);
});

test("rejects an empty batch before calling run-test IPC", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let runCalls = 0;
    fixture.runner.runTest = async () => {
        runCalls += 1;
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCaseList([{id: "case-1", name: "First case", actions: []}]);

    await fixture.elements["test-form"].listeners.get("submit")({preventDefault() {}});

    assert.equal(runCalls, 0);
    assert.match(fixture.elements["form-message"].textContent, /test case/i);
});

test("masks action passwords while keeping usernames visible and source data intact", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const action = {action: "login", username: "visible-user", password: "secret"};

    const displayAction = renderer.maskActionForDisplay(action);

    assert.equal(displayAction.username, "visible-user");
    assert.equal(displayAction.password, "••••••");
    assert.equal(action.password, "secret");
});

test("redacts credential-shaped descriptions and log text", () => {
    assert.equal(loadError, undefined, loadError?.message);

    const text = "Đăng nhập với tài khoản ts1/111222, password=secret";
    const redacted = renderer.redactSensitiveText(text);

    assert.equal(redacted, "Đăng nhập với tài khoản ts1/•••••• password=••••••");
    assert.doesNotMatch(redacted, /111222|secret/);

    const unicodeRedacted = renderer.redactSensitiveText("username=User_Đ/PaSS123.");
    assert.equal(unicodeRedacted, "username=User_Đ/••••••");

    const punctuationRedacted = renderer.redactSensitiveText("password=p.a$$-word");
    assert.equal(punctuationRedacted, "password=••••••");
    const serviceTokenRedacted = renderer.redactSensitiveText('{"X-FlowTest-Service-Token":"private-service-token"}');
    assert.equal(serviceTokenRedacted, '{"X-FlowTest-Service-Token":"••••••"}');
});

test("refuses to run until a test case id is selected", () => {
    assert.equal(loadError, undefined, loadError?.message);

    assert.match(renderer.validateRunValues({}), /test case/i);
    assert.equal(renderer.validateRunValues({TEST_CASE_ID: "case-1"}), "");
    assert.equal(renderer.validateRunValues({TEST_CASE_ID: "case-1", target: "webos"}), "");
});

test("loads saved LG status but keeps Run disabled for an unvalidated target", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    controller.renderCaseList([{id: "case-1", name: "Case 1"}]);
    controller.selectCase("case-1");
    assert.equal(fixture.elements["run-button"].disabled, false);

    await controller.selectRunTarget("webos");

    assert.equal(fixture.elements["run-button"].disabled, true);
    assert.equal(fixture.elements["tv-device-select"].children[0].textContent, "Lab LG");
    assert.match(fixture.elements["tv-device-status"].textContent, /readiness review/i);
});

test("restores the persisted LG target and its saved device list on startup", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.storage.getItem = () => JSON.stringify({RUN_TARGET: "webos"});

    renderer.createRendererController(fixture);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(fixture.elements["run-target-webos"].checked, true);
    assert.equal(fixture.elements["run-target-browser"].checked, false);
    assert.equal(fixture.elements["tv-device-select"].children[0].textContent, "Lab LG");
    assert.doesNotMatch(fixture.elements["tv-device-status"].textContent, /Browser runner is selected/i);
});

test("checks a selected saved LG device only after the operator clicks Check connection", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const checks = [];
    fixture.runner.checkTvDeviceConnection = async (deviceId) => {
        checks.push(deviceId);
        return {ok: true, status: "CONNECTED"};
    };
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");

    assert.match(fixture.elements["tv-device-connection-status"].textContent, /Connection not checked/i);
    assert.match(fixture.elements["tv-device-connection-dot"].className, /not-checked/);
    assert.equal(fixture.elements["tv-device-check-connection-button"].disabled, false);
    fixture.elements["tv-device-check-connection-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(checks, ["lab-lg"]);
    assert.match(fixture.elements["tv-device-connection-status"].textContent, /Connected/i);
    assert.match(fixture.elements["tv-device-connection-dot"].className, /connected/);
});

test("resets a locally displayed device connection state when the selection changes", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.listTvDevices = async () => ({
        ok: true,
        devices: [
            {id: "lab-lg", label: "Lab LG", platform: "webos"},
            {id: "living-room", label: "Living room", platform: "webos"},
        ],
    });
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");
    fixture.elements["tv-device-connection-status"].textContent = "Connected";
    fixture.elements["tv-device-connection-dot"].className = "tv-device-connection-dot connected";
    fixture.elements["tv-device-check-connection-button"].disabled = false;
    fixture.elements["tv-device-select"].value = "living-room";
    fixture.elements["tv-device-select"].dispatchEvent("change");

    assert.match(fixture.elements["tv-device-connection-status"].textContent, /Connection not checked/i);
    assert.match(fixture.elements["tv-device-connection-dot"].className, /not-checked/);
    assert.equal(fixture.elements["tv-device-check-connection-button"].disabled, true);
});

test("persists each selected run target immediately", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const updates = [];
    fixture.storage.setItem = (key, value) => updates.push([key, JSON.parse(value)]);
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");
    await controller.selectRunTarget("browser");

    assert.deepEqual(
        updates.map(([key, settings]) => [key, settings.RUN_TARGET]),
        [
            ["mytv-auto-test-settings", "webos"],
            ["mytv-auto-test-settings", "browser"],
        ],
    );
});

test("shows LG device controls only for the LG target", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("browser");

    assert.equal(fixture.elements["lg-device-panel"].classList.contains("hidden"), true);

    await controller.selectRunTarget("webos");

    assert.equal(fixture.elements["lg-device-panel"].classList.contains("hidden"), false);
});

test("selecting LG removes a Browser preview and shows the LG preview state", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.elements["browser-preview-image"].setAttribute("src", "data:image/png;base64,preview");
    fixture.elements["browser-preview-image"].className = "browser-preview-image";
    fixture.elements["interactive-browser"].className = "interactive-browser";
    fixture.elements["browser-mute-button"].className = "preview-control";
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");

    assert.equal(fixture.elements["browser-preview-image"].getAttribute("src"), null);
    assert.match(fixture.elements["browser-preview-image"].className, /hidden/);
    assert.match(fixture.elements["interactive-browser"].className, /hidden/);
    assert.match(fixture.elements["browser-mute-button"].className, /hidden/);
    assert.match(fixture.elements["browser-preview-empty"].className, /hidden/);
    assert.doesNotMatch(fixture.elements["lg-preview-empty"].className, /hidden/);
});

test("selecting LG disables Browser-only preview settings and explains why", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const previewInputs = fixture.document.querySelectorAll('[name="preview-type"]');
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");

    assert.ok(previewInputs.every((input) => input.disabled));
    assert.match(fixture.elements["preview-target-status"].textContent, /Browser runner only/i);

    await controller.selectRunTarget("browser");

    assert.ok(previewInputs.every((input) => !input.disabled));
    assert.match(fixture.elements["preview-target-status"].className, /hidden/);
});

test("does not expose a direct LG device validation action outside the dialog", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");

    assert.equal(controller.validateSelectedTvDevice, undefined);
    assert.equal(fixture.elements["run-button"].disabled, true);
    assert.match(fixture.elements["tv-device-status"].textContent, /readiness review/i);
});

test("shows a local LG toolchain report only after the operator requests it", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let inspections = 0;
    fixture.runner.inspectTvToolchain = async () => {
        inspections += 1;
        return {
            ok: true,
            platform: "webos",
            tools: [
                {id: "webos-cli", label: "webOS CLI", status: "ready"},
                {id: "appium", label: "Appium", status: "ready", version: "2.19.0"},
                {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "ready", version: "0.5.0"},
            ],
        };
    };
    const controller = renderer.createRendererController(fixture);

    assert.equal(inspections, 0);
    await controller.inspectTvToolchain();

    assert.equal(inspections, 1);
    assert.match(fixture.elements["tv-toolchain-status"].textContent, /webOS CLI: ready/i);
    assert.match(fixture.elements["tv-toolchain-status"].textContent, /Appium: ready \(2\.19\.0\)/i);
    assert.match(fixture.elements["tv-toolchain-status"].textContent, /LG webOS driver: ready \(0\.5\.0\)/i);
    assert.doesNotMatch(fixture.elements["tv-toolchain-status"].textContent, /host|device|pairing/i);
});

test("Auto configure requests only a redacted local review without inspection, import, registration, validation, or a test run", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.planLgToolchainSetup = async () => {
        calls.push("plan");
        return {
            ok: true,
            source: "managed",
            state: "missing",
            components: [
                {id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"},
                {id: "webos-cli", label: "webOS CLI", status: "missing", version: "1.12.4"},
            ],
        };
    };
    fixture.runner.inspectTvToolchain = async () => {
        throw new Error("must not inspect");
    };
    fixture.runner.chooseLgCliArchive = async () => {
        throw new Error("must not import");
    };
    fixture.runner.registerWebOsTarget = async () => {
        throw new Error("must not register");
    };
    fixture.runner.validateTvDevice = async () => {
        throw new Error("must not validate");
    };
    fixture.runner.runTest = async () => {
        throw new Error("must not run");
    };
    const controller = renderer.createRendererController(fixture);

    const result = await controller.planLgToolchainSetup();

    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["plan"]);
    assert.match(fixture.elements["sdk-component-list"].textContent, /Node\.js and npm.*24\.18\.0.*Missing.*Included in reviewed installation/i);
    assert.match(fixture.elements["sdk-component-list"].textContent, /webOS CLI.*1\.12\.4.*Missing.*Download from LG, then choose the original archive/i);
    assert.match(fixture.elements["sdk-install-review"].textContent, /Review complete.*Nothing is installed until you confirm/i);
    assert.equal(fixture.elements["sdk-install-review"].classList.contains("hidden"), false);
    assert.doesNotMatch(`${fixture.elements["sdk-component-list"].textContent} ${fixture.elements["sdk-install-review"].textContent}`, /\/Users\/|https?:\/\//);
});

test("requires a separate Settings confirmation before installing a reviewed LG bundle", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.planLgToolchainSetup = async () => {
        calls.push("plan");
        return {
            ok: true,
            state: "missing",
            components: [{id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"}],
        };
    };
    fixture.runner.installLgToolchain = async (request) => {
        calls.push(["install", request]);
        return {
            ok: true,
            state: "installable",
            components: [{id: "node", label: "Node.js and npm", status: "ready", version: "24.18.0"}],
        };
    };
    fixture.runner.inspectTvToolchain = async () => {
        throw new Error("must not inspect");
    };
    fixture.runner.chooseLgCliArchive = async () => {
        throw new Error("must not import");
    };
    fixture.runner.registerWebOsTarget = async () => {
        throw new Error("must not register");
    };
    fixture.runner.validateTvDevice = async () => {
        throw new Error("must not validate");
    };
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");
    assert.equal(fixture.elements["sdk-install-confirm-button"].disabled, true);
    await controller.planLgToolchainSetup();
    assert.deepEqual(calls, ["plan"]);
    assert.equal(fixture.elements["sdk-install-confirm-button"].disabled, false);
    await controller.installLgToolchain();

    assert.deepEqual(calls, ["plan", ["install", {confirmed: true, deviceId: "lab-lg"}]]);
    assert.equal(fixture.elements["sdk-install-confirm-button"].disabled, true);
    assert.match(fixture.elements["sdk-component-list"].textContent, /Node\.js and npm.*24\.18\.0.*Ready.*Verified locally/i);
    assert.doesNotMatch(fixture.elements["sdk-component-list"].textContent, /\/Users\/|https?:\/\//);
});

test("renders only fixed safe milestones for a confirmed LG installation", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let progressListener;
    let resolveInstall;
    fixture.runner.onLgToolchainInstallProgress = (callback) => {
        progressListener = callback;
        return () => {};
    };
    fixture.runner.installLgToolchain = async () =>
        new Promise((resolve) => {
            resolveInstall = resolve;
        });
    const controller = renderer.createRendererController(fixture);

    const pending = controller.installLgToolchain();
    progressListener({code: "installing-appium", path: "/private/managed"});

    assert.equal(fixture.elements["sdk-install-progress"].classList.contains("hidden"), false);
    assert.match(fixture.elements["sdk-install-progress-text"].textContent, /Installing reviewed Appium and the LG driver/i);
    assert.match(fixture.elements["sdk-install-progress-steps"].textContent, /Preparing the managed installation/i);
    assert.doesNotMatch(fixture.elements["sdk-install-progress"].textContent, /\/private\/managed|\/private/i);

    progressListener({code: "failed", status: "VERIFICATION_FAILED", detail: "raw command output"});
    assert.match(fixture.elements["sdk-install-progress-text"].textContent, /Installation stopped/i);
    assert.match(fixture.elements["sdk-install-progress"].className, /attention/);
    assert.match(fixture.elements["sdk-install-progress-steps"].querySelector(".current").textContent, /Installing reviewed Appium and the LG driver/i);
    assert.doesNotMatch(fixture.elements["sdk-install-progress"].textContent, /raw command/i);

    resolveInstall({ok: false, status: "VERIFICATION_FAILED", verification: "LG_DRIVER_UNVERIFIED"});
    await pending;
});

test("marks completed LG installation progress as complete", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let progressListener;
    fixture.runner.onLgToolchainInstallProgress = (callback) => {
        progressListener = callback;
        return () => {};
    };
    renderer.createRendererController(fixture);

    progressListener({code: "complete"});

    assert.match(fixture.elements["sdk-install-progress"].className, /complete/);
    assert.doesNotMatch(fixture.elements["sdk-install-progress"].className, /attention/);
    assert.match(fixture.elements["sdk-install-progress-text"].textContent, /Installation complete/i);
});

test("clears transient LG installation progress when Settings closes", () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let progressListener;
    fixture.runner.onLgToolchainInstallProgress = (callback) => {
        progressListener = callback;
        return () => {};
    };
    renderer.createRendererController(fixture);
    progressListener({code: "installing-appium"});

    fixture.elements["settings-close-button"].dispatchEvent("click");

    assert.equal(fixture.elements["sdk-install-progress"].classList.contains("hidden"), true);
    assert.equal(fixture.elements["sdk-install-progress-text"].textContent, "");
    assert.equal(fixture.elements["sdk-install-progress-steps"].children.length, 0);
});

test("keeps the reviewed component status after a confirmed LG installation fails", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    fixture.runner.planLgToolchainSetup = async () => ({
        ok: true,
        state: "missing",
        components: [{id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"}],
    });
    fixture.runner.installLgToolchain = async () => ({ok: false, status: "DOWNLOAD_FAILED"});
    const controller = renderer.createRendererController(fixture);

    await controller.planLgToolchainSetup();
    await controller.installLgToolchain();

    assert.match(fixture.elements["sdk-component-list"].textContent, /Node\.js and npm.*24\.18\.0.*Missing.*Included in reviewed installation/i);
    assert.match(fixture.elements["sdk-install-review"].textContent, /reviewed Node download could not complete.*Nothing was changed/i);
    assert.doesNotMatch(`${fixture.elements["sdk-component-list"].textContent} ${fixture.elements["sdk-install-review"].textContent}`, /network unavailable|\/Users\/|https?:\/\//i);
});

test("explains which reviewed component did not verify", async () => {
    const fixture = createRendererFixture();
    fixture.runner.installLgToolchain = async () => ({
        ok: false,
        status: "VERIFICATION_FAILED",
        verification: "LG_DRIVER_UNVERIFIED",
    });
    const controller = renderer.createRendererController(fixture);

    await controller.installLgToolchain();

    assert.match(fixture.elements["sdk-install-review"].textContent, /LG webOS driver did not verify.*Nothing was changed/i);
    assert.doesNotMatch(fixture.elements["sdk-install-review"].textContent, /\/Users\/|https?:\/\//);
});

test("selects a complete managed source without installation or a TV operation", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.getLgToolchainStatus = async () => {
        calls.push("status");
        return {
            ok: true,
            source: "managed",
            state: "ready",
            components: [{id: "node", label: "Node.js and npm", status: "ready", version: "24.18.0"}],
        };
    };
    fixture.runner.activateManagedLgToolchain = async () => {
        calls.push("activate");
        return {
            ok: true,
            configured: true,
            source: "managed",
            platform: "webos",
            components: [{id: "appium-home", label: "Appium home", status: "ready"}],
        };
    };
    fixture.runner.installLgToolchain = async () => {
        throw new Error("must not install");
    };
    fixture.runner.inspectTvToolchain = async () => {
        throw new Error("must not inspect");
    };
    fixture.runner.registerWebOsTarget = async () => {
        throw new Error("must not register");
    };
    fixture.runner.validateTvDevice = async () => {
        throw new Error("must not validate");
    };
    const controller = renderer.createRendererController(fixture);

    assert.equal(fixture.elements["sdk-use-managed-button"].disabled, true);
    await controller.loadLgToolchainStatus();
    assert.deepEqual(calls, ["status"]);
    assert.equal(fixture.elements["sdk-use-managed-button"].disabled, false);
    await controller.activateManagedLgToolchain();

    assert.deepEqual(calls, ["status", "activate"]);
    assert.equal(fixture.elements["sdk-use-managed-button"].disabled, true);
    assert.match(fixture.elements["tv-toolchain-status"].textContent, /Selected source: Managed/i);
});

test("a confirmed legacy CLI import refreshes only redacted managed availability", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.chooseLgCliArchive = async () => {
        calls.push("choose");
        return {ok: true, status: "CLI_IMPORTED"};
    };
    fixture.runner.getLgToolchainStatus = async () => {
        calls.push("managed-status");
        return {
            ok: true,
            source: "managed",
            state: "missing",
            components: [{id: "webos-cli", label: "webOS CLI", status: "ready", version: "1.12.4"}],
        };
    };
    fixture.runner.planLgToolchainSetup = async () => {
        throw new Error("must not plan");
    };
    fixture.runner.inspectTvToolchain = async () => {
        throw new Error("must not inspect");
    };
    fixture.runner.registerWebOsTarget = async () => {
        throw new Error("must not register");
    };
    fixture.runner.validateTvDevice = async () => {
        throw new Error("must not validate");
    };
    renderer.createRendererController(fixture);

    fixture.elements["sdk-choose-lg-cli-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(calls, ["choose", "managed-status"]);
    assert.match(fixture.elements["sdk-component-list"].textContent, /webOS CLI.*1\.12\.4.*Ready.*Verified locally/i);
    assert.doesNotMatch(fixture.elements["sdk-component-list"].textContent, /\/Users\/|https?:\/\//);
});

test("selecting SDK configuration separates the selected source from redacted managed availability", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.getTvToolchainConfiguration = async () => {
        calls.push("configuration");
        return {
            ok: true,
            configured: true,
            source: "advanced",
            platform: "webos",
            components: [{id: "webos-sdk", label: "webOS SDK", status: "ready"}],
        };
    };
    fixture.runner.getLgToolchainStatus = async () => {
        calls.push("managed-status");
        return {
            ok: true,
            source: "managed",
            state: "missing",
            components: [{id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"}],
        };
    };
    fixture.runner.planLgToolchainSetup = async () => {
        throw new Error("must not plan");
    };
    fixture.runner.inspectTvToolchain = async () => {
        throw new Error("must not inspect");
    };
    fixture.runner.validateTvDevice = async () => {
        throw new Error("must not validate");
    };
    const controller = renderer.createRendererController(fixture);

    await controller.loadSdkToolchainStatus();

    assert.deepEqual(calls, ["configuration", "managed-status"]);
    assert.match(fixture.elements["tv-toolchain-status"].textContent, /Selected source: Advanced paths/i);
    assert.match(fixture.elements["tv-toolchain-status"].textContent, /webOS SDK: ready/i);
    assert.match(fixture.elements["sdk-component-list"].textContent, /Node\.js and npm.*24\.18\.0.*Missing.*Included in reviewed installation/i);
    assert.doesNotMatch(`${fixture.elements["tv-toolchain-status"].textContent} ${fixture.elements["sdk-component-list"].textContent}`, /\/Users\/|https?:\/\//);
});

test("renders compatibility catalog status and refreshes only after the operator clicks", async () => {
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.getLgCompatibilityCatalogStatus = async () => {
        calls.push("status");
        return {ok: true, state: "available", source: "bundled", refreshedAt: null, profileCount: 1};
    };
    fixture.runner.refreshLgCompatibilityCatalog = async (request) => {
        calls.push(["refresh", request]);
        return {ok: true, state: "available", source: "cached", refreshedAt: "2026-07-30T00:00:00.000Z", profileCount: 1};
    };
    const controller = renderer.createRendererController(fixture);

    await controller.loadSdkToolchainStatus();
    assert.match(fixture.elements["sdk-compatibility-catalog-status"].textContent, /Compatibility catalog available.*1 profile/i);
    assert.deepEqual(calls, ["status"]);

    await controller.refreshLgCompatibilityCatalog();
    assert.equal(calls.length, 2);
    assert.doesNotMatch(fixture.elements["sdk-compatibility-catalog-status"].textContent, /private|https?:/i);
});

test("saves the local compatibility account without rendering its credentials", async () => {
    const fixture = createRendererFixture();
    const requests = [];
    fixture.runner.getLgCompatibilityProductGateStatus = async () => ({ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"});
    fixture.runner.saveLgCompatibilityProductGateCredentials = async (request) => {
        requests.push(request);
        return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"};
    };
    const controller = renderer.createRendererController(fixture);
    fixture.elements["lg-compatibility-product-gate-username-input"].value = "account";
    fixture.elements["lg-compatibility-product-gate-password-input"].value = "secret";

    await controller.saveLgCompatibilityProductGateCredentials();

    assert.deepEqual(requests, [{username: "account", password: "secret"}]);
    assert.match(fixture.elements["lg-compatibility-product-gate-status"].textContent, /saved locally/i);
    assert.equal(fixture.elements["lg-compatibility-product-gate-username-input"].value, "");
    assert.equal(fixture.elements["lg-compatibility-product-gate-password-input"].value, "");
    assert.doesNotMatch(fixture.elements["lg-compatibility-product-gate-status"].textContent, /secret/i);
});

test("runs the fixed compatibility case without selecting a normal test case", async () => {
    const fixture = createRendererFixture();
    const validations = [];
    fixture.runner.inspectLgCompatibilityDevice = async () => ({
        ok: true,
        status: "COMPATIBILITY_VERIFIED",
        attemptId: "attempt-a1",
        model: "model-a",
        firmware: "firmware-a",
    });
    fixture.runner.runLgCompatibilityValidation = async (request) => {
        validations.push(request);
        return {ok: true, status: "VALIDATION_PASSED"};
    };
    const controller = renderer.createRendererController(fixture);

    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();
    await controller.confirmLgCompatibilityInspection();

    assert.equal(controller.reviewLgCompatibilityValidation(), true);
    await controller.confirmLgCompatibilityValidation();
    assert.deepEqual(validations, [{confirmed: true, attemptId: "attempt-a1"}]);
});

test("renders the failed compatibility action when validation reports one", async () => {
    const fixture = createRendererFixture();
    fixture.runner.inspectLgCompatibilityDevice = async () => ({
        ok: true,
        status: "COMPATIBILITY_VERIFIED",
        attemptId: "attempt-a1",
        model: "model-a",
        firmware: "firmware-a",
    });
    fixture.runner.runLgCompatibilityValidation = async () => ({ok: false, status: "VALIDATION_FAILED", failedAction: "search_content"});
    const controller = renderer.createRendererController(fixture);

    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();
    await controller.confirmLgCompatibilityInspection();

    assert.equal(controller.reviewLgCompatibilityValidation(), true);
    await controller.confirmLgCompatibilityValidation();
    assert.match(fixture.elements["lg-compatibility-dialog-status"].textContent, /search step did not pass/i);
});

test("renders the failed compatibility stage when validation fails before any action step is reported", async () => {
    const fixture = createRendererFixture();
    fixture.runner.inspectLgCompatibilityDevice = async () => ({
        ok: true,
        status: "COMPATIBILITY_VERIFIED",
        attemptId: "attempt-a1",
        model: "model-a",
        firmware: "firmware-a",
    });
    fixture.runner.runLgCompatibilityValidation = async () => ({ok: false, status: "VALIDATION_FAILED", failureCode: "SESSION_UNAVAILABLE", appiumFailureCode: "APPIUM_CAPABILITY_AUTOMATION_NAME", failureStage: "session-creating"});
    const controller = renderer.createRendererController(fixture);

    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();
    await controller.confirmLgCompatibilityInspection();

    assert.equal(controller.reviewLgCompatibilityValidation(), true);
    await controller.confirmLgCompatibilityValidation();
    assert.match(fixture.elements["lg-compatibility-dialog-status"].textContent, /rejected the LG automationName capability/i);
});

test("renders the failed compatibility preparation stage before the product-gate case starts", async () => {
    const fixture = createRendererFixture();
    fixture.runner.inspectLgCompatibilityDevice = async () => ({
        ok: true,
        status: "COMPATIBILITY_VERIFIED",
        attemptId: "attempt-a1",
        model: "model-a",
        firmware: "firmware-a",
    });
    fixture.runner.runLgCompatibilityValidation = async () => ({ok: false, status: "VALIDATION_FAILED", failureStage: "chromedriver-download"});
    const controller = renderer.createRendererController(fixture);

    controller.openLgCompatibilityDialog();
    fixture.elements["lg-compatibility-name-input"].value = "Lab";
    fixture.elements["lg-compatibility-host-input"].value = "192.0.2.10";
    fixture.elements["lg-compatibility-passphrase-input"].value = "runtime-only";
    controller.reviewLgCompatibilityInspection();
    await controller.confirmLgCompatibilityInspection();

    assert.equal(controller.reviewLgCompatibilityValidation(), true);
    await controller.confirmLgCompatibilityValidation();
    assert.match(fixture.elements["lg-compatibility-dialog-status"].textContent, /download the verified temporary ChromeDriver/i);
});

test("opens LG help without invoking inspection, validation, or a test run", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    let inspections = 0;
    let validations = 0;
    let runs = 0;
    fixture.runner.inspectTvToolchain = async () => {
        inspections += 1;
        return {ok: true};
    };
    fixture.runner.validateTvDevice = async () => {
        validations += 1;
        return {ok: true};
    };
    fixture.runner.runTest = async () => {
        runs += 1;
        return {ok: true};
    };
    renderer.createRendererController(fixture);

    fixture.elements["tv-help-button"].dispatchEvent("click");
    await Promise.resolve();

    assert.doesNotMatch(fixture.elements["tv-help-modal"].className, /hidden/);
    assert.equal(inspections, 0);
    assert.equal(validations, 0);
    assert.equal(runs, 0);
});

test("keeps LG device editing closed until the user opens the Add dialog", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");
    assert.match(fixture.elements["tv-device-dialog"].className, /hidden/);

    controller.openTvDeviceDialog("add");

    assert.doesNotMatch(fixture.elements["tv-device-dialog"].className, /hidden/);
    assert.equal(fixture.elements["tv-device-name-input"].value, "");
    assert.equal(fixture.elements["tv-device-host-input"].value, "");
    assert.equal(fixture.elements["tv-device-passphrase-input"].value, "");
    assert.equal(fixture.elements["tv-device-id-input"], undefined);
    assert.equal(fixture.elements["tv-device-model-input"], undefined);
});

test("saves local toolchain configuration without validation, registration, or a test run", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.saveTvToolchainConfiguration = async (input) => {
        calls.push(input);
        return {
            ok: true,
            configured: true,
            platform: "webos",
            components: [{id: "webos-sdk", label: "webOS SDK", status: "ready"}],
        };
    };
    fixture.runner.validateTvDevice = async () => {
        throw new Error("must not validate");
    };
    fixture.runner.registerWebOsTarget = async () => {
        throw new Error("must not register");
    };
    fixture.runner.runTest = async () => {
        throw new Error("must not run");
    };
    fixture.elements["tv-toolchain-sdk-home-input"].value = "/toolchain/webos-sdk";
    fixture.elements["tv-toolchain-appium-home-input"].value = "/toolchain/appium-home";
    fixture.elements["tv-toolchain-appium-bin-input"].value = "/toolchain/appium/bin/appium";
    fixture.elements["tv-toolchain-chromedriver-input"].value = "/toolchain/chromedriver";
    const controller = renderer.createRendererController(fixture);

    const result = await controller.saveTvToolchainConfiguration();

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
        {
            webosSdkHome: "/toolchain/webos-sdk",
            appiumHome: "/toolchain/appium-home",
            appiumBin: "/toolchain/appium/bin/appium",
            chromedriverPath: "/toolchain/chromedriver",
        },
    ]);
    assert.equal(fixture.elements["tv-toolchain-sdk-home-input"].value, "");
    assert.equal(fixture.elements["tv-toolchain-appium-home-input"].value, "");
    assert.equal(fixture.elements["tv-toolchain-appium-bin-input"].value, "");
    assert.equal(fixture.elements["tv-toolchain-chromedriver-input"].value, "");
    assert.doesNotMatch(fixture.elements["tv-toolchain-status"].textContent, /\/toolchain\//);
    assert.equal(fixture.elements["run-button"].disabled, true);
});

test("opens Edit without returning a saved connection value to the renderer", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const controller = renderer.createRendererController(fixture);

    await controller.selectRunTarget("webos");
    controller.openTvDeviceDialog("edit");

    assert.equal(fixture.elements["tv-device-name-input"].value, "Lab LG");
    assert.equal(fixture.elements["tv-device-host-input"].value, "");
    assert.equal(fixture.elements["tv-device-passphrase-input"].value, "");
});

test("keeps a deferred validation candidate in the dialog without calling a TV operation", async () => {
    assert.equal(loadError, undefined, loadError?.message);
    const fixture = createRendererFixture();
    const candidates = [];
    fixture.runner.validateAndSaveTvDevice = async (candidate) => {
        candidates.push(candidate);
        return {ok: false, status: "VALIDATION_UNAVAILABLE"};
    };
    const controller = renderer.createRendererController(fixture);

    controller.openTvDeviceDialog("add");
    fixture.elements["tv-device-name-input"].value = "Living room";
    fixture.elements["tv-device-host-input"].value = "candidate-host";
    fixture.elements["tv-device-passphrase-input"].value = "candidate-passphrase";
    await controller.submitTvDeviceDialog();

    assert.deepEqual(candidates, [{label: "Living room", host: "candidate-host", passphrase: "candidate-passphrase"}]);
    assert.doesNotMatch(fixture.elements["tv-device-dialog"].className, /hidden/);
    assert.match(fixture.elements["tv-device-dialog-status"].textContent, /not available/i);
    assert.doesNotMatch(fixture.elements["tv-device-status"].textContent, /candidate-host|candidate-passphrase/);
});

test("LG Run Selected remains disabled until the main-process readiness review is READY", async () => {
    const fixture = createRendererFixture();
    fixture.runner.loadTestCases = async () => ({ok: true, cases: [{id: "42", name: "LG case", actions: [{action: "assert_screen", text: "Ready"}]}]});
    fixture.runner.getLgRunAvailability = async () => ({ok: false, status: "TOOLCHAIN_UNAVAILABLE"});
    const controller = renderer.createRendererController(fixture);
    await controller.loadCases();
    controller.selectCase("42");
    await controller.selectRunTarget("webos");

    assert.equal(fixture.elements["run-button"].disabled, true);
    assert.match(fixture.elements["lg-run-availability"].textContent, /Configure SDK/i);

    fixture.runner.getLgRunAvailability = async () => ({ok: true, status: "READY"});
    await controller.refreshLgRunAvailability();
    assert.equal(fixture.elements["run-button"].disabled, false);

    await controller.selectRunTarget("browser");
    assert.equal(fixture.runner.runLgBatchCalls.length, 0);
});

test("LG readiness includes the active cache folder for selected API cases", async () => {
    const fixture = createRendererFixture();
    const requests = [];
    fixture.runner.loadTestCases = async () => ({ok: true, source: "cache", folder: {id: "folder-1"}, cases: [{id: "42", name: "LG case", actions: [{action: "assert_screen", text: "Ready"}]}]});
    fixture.runner.getLgRunAvailability = async (request) => {
        requests.push(request);
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
    };
    const controller = renderer.createRendererController(fixture);
    await controller.loadCases();
    controller.selectCase("42");
    await controller.selectRunTarget("webos");

    assert.deepEqual(requests.at(-1), {deviceId: "lab-lg", selectedCaseIds: ["42"], folderId: "folder-1"});
});

test("LG campaign runs use the campaign cache key and submit campaignId", async () => {
    const fixture = createRendererFixture();
    const availabilityRequests = [];
    const runRequests = [];
    const submissions = [];
    fixture.runner.loadFlowCases = async () => ({
        ok: true,
        campaign: {id: "12", name: "Regression tháng 8"},
        folder: {id: "folder-1", name: "Campaign folder", fullPath: "/Campaign"},
        cacheKey: "campaign:12",
        cases: [{id: "1842", name: "Campaign LG copy", actions: [{action: "assert_screen", text: "Ready"}]}],
    });
    fixture.runner.getLgRunAvailability = async (request) => {
        availabilityRequests.push(request);
        return {ok: true, status: "READY"};
    };
    fixture.runner.runLgBatch = async (request) => {
        runRequests.push(request);
        return {ok: true, caseRuns: [{id: "1842", result: {passed: true, started: true, stopped: false, executionResult: {status: "passed"}}}], stopped: false};
    };
    fixture.runner.submitFlowCaseResults = async (payload) => {
        submissions.push(payload);
        return {ok: true};
    };
    const controller = renderer.createRendererController(fixture);
    controller.renderCampaigns([{campaign: {id: "12", name: "Regression tháng 8"}, run: {status: "running"}}]);
    controller.renderFolders([{id: "folder-1", name: "Campaign folder", fullPath: "/Campaign"}]);
    fixture.elements["campaign-select"].value = "12";
    fixture.elements["folder-select"].value = "/Campaign";
    await controller.loadCasesFromFolder();
    controller.selectCase("1842");
    await controller.selectRunTarget("webos");

    assert.equal(availabilityRequests.at(-1).cacheKey, "campaign:12");
    await controller.runSelectedCases({
        target: "webos",
        TEST_CASE_CACHE_KEY: "campaign:12",
        FLOW_CASE_RESULT_CONTEXT: {
            API_DOMAIN: "https://api.example",
            API_AUTHORIZATION: "authorization-value",
            PROJECT_ID: "1",
            API_TIMEOUT_SECONDS: "30",
            FOLDER_PATH: "/Campaign",
            CAMPAIGN_ID: "12",
        },
    });
    fixture.elements["lg-run-confirm-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(runRequests[0], {deviceId: "lab-lg", selectedCaseIds: ["1842"], cacheKey: "campaign:12", confirmed: true});
    assert.equal(submissions[0].testcases[0].campaignId, "12");
});

test("LG Run Selected requires confirmation and renders only safe status and PNG preview events", async () => {
    const fixture = createRendererFixture();
    fixture.runner.loadTestCases = async () => ({ok: true, source: "cache", folder: {id: "folder-1"}, cases: [{id: "42", name: "LG case", actions: [{action: "assert_screen", text: "Ready"}]}]});
    fixture.runner.getLgRunAvailability = async () => ({ok: true, status: "READY"});
    fixture.runner.runLgBatch = async (request) => {
        fixture.runner.runLgBatchCalls.push(request);
        return {ok: true, caseRuns: [{id: "42", result: {passed: true, started: true, stopped: false, executionResult: {status: "passed"}}}], stopped: false};
    };
    const submissions = [];
    fixture.runner.submitFlowCaseResults = async (payload) => {
        submissions.push(payload);
        return {ok: true};
    };
    let statusListener;
    let previewListener;
    fixture.runner.onLgRunStatus = (callback) => {
        statusListener = callback;
        return () => {};
    };
    fixture.runner.onLgRunPreview = (callback) => {
        previewListener = callback;
        return () => {};
    };
    const controller = renderer.createRendererController(fixture);
    await controller.loadCases();
    controller.selectCase("42");
    await controller.selectRunTarget("webos");
    await controller.refreshLgRunAvailability();

    await controller.runSelectedCases({
        target: "webos",
        TEST_CASE_FOLDER_ID: "folder-1",
        FLOW_CASE_RESULT_CONTEXT: {
            API_DOMAIN: "https://api.example",
            API_AUTHORIZATION: "authorization-value",
            PROJECT_ID: "1",
            API_TIMEOUT_SECONDS: "30",
            FOLDER_PATH: "/folder",
        },
    });
    assert.doesNotMatch(fixture.elements["lg-run-confirmation-dialog"].className, /hidden/);
    assert.equal(fixture.runner.runLgBatchCalls.length, 0);

    fixture.elements["lg-run-confirm-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(fixture.runner.runLgBatchCalls[0], {
        deviceId: "lab-lg",
        selectedCaseIds: ["42"],
        folderId: "folder-1",
        confirmed: true,
    });
    assert.doesNotMatch(JSON.stringify(fixture.runner.runLgBatchCalls[0]), /APP_URL|AUTHORIZATION|host|passphrase|path|actions/i);
    assert.deepEqual(
        submissions.map((payload) => payload.testcases.map((testCase) => [testCase.id, testCase.testResult.status])),
        [[["42", "success"]]],
    );

    statusListener({code: "case-started", caseId: "42", attempt: 1});
    previewListener("data:image/png;base64,ZmFrZQ==");
    previewListener("/private/frame.png");
    assert.match(fixture.elements["lg-run-state"].textContent, /Starting selected case/i);
    assert.equal(fixture.elements["lg-preview-image"].src, "data:image/png;base64,ZmFrZQ==");
});

test("LG recovery controls forward only an explicit retry or stop choice", async () => {
    const fixture = createRendererFixture();
    const calls = [];
    fixture.runner.resolveLgRunRecovery = async (request) => {
        calls.push(request);
        return {ok: true};
    };
    let statusListener;
    fixture.runner.onLgRunStatus = (callback) => {
        statusListener = callback;
        return () => {};
    };
    const controller = renderer.createRendererController(fixture);

    statusListener({code: "recovery-required", caseId: "42", attempt: 3, reason: "technical"});
    assert.doesNotMatch(fixture.elements["lg-recovery-dialog"].className, /hidden/);
    fixture.elements["lg-recovery-retry-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));
    fixture.elements["lg-recovery-stop-button"].dispatchEvent("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, [{action: "retry"}, {action: "stop"}]);
    assert.equal(typeof controller.openLgBatchConfirmation, "function");
});

test("index markup contains the case browser and no API-key or mode controls", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../app/renderer/index.html"), "utf8");

    assert.match(html, /id="test-case-list"/);
    assert.match(html, /<table[^>]+id="test-case-list"/);
    assert.match(html, /id="test-case-search-input"/);
    assert.match(html, /id="select-all-test-cases"/);
    assert.match(html, /id="test-case-list-body"/);
    assert.match(html, /id="test-case-details-modal"/);
    assert.match(html, /id="test-case-details"/);
    assert.match(html, /id="selected-test-case-id"/);
    assert.match(html, /<label for="campaign-select">Chiến dịch<\/label>/);
    assert.match(html, /id="refresh-campaigns-button"/);
    assert.ok(html.indexOf('id="campaign-select"') < html.indexOf('id="folder-select"'));
    assert.doesNotMatch(html, /id="settings-message"/);
    assert.match(html, /id="app-toast"/);
    assert.doesNotMatch(html, /APP_URL/);
    assert.match(html, /<h4>DNS Host<\/h4>/);
    assert.doesNotMatch(html, /id="settings-app-url-input"/);
    assert.doesNotMatch(html, /id="dns-host-input"/);
    assert.match(html, /id="dns-host-add-button"/);
    assert.match(html, /id="dns-host-remove-button"/);
    assert.match(html, /id="dns-host-status"/);
    assert.match(html, /data-settings-panel="test-configuration"/);
    assert.match(html, /Test configuration/);
    assert.match(html, /Test case maximum time \(minutes\)/);
    assert.match(html, /Thời gian tối đa cho phép 1 test case được chạy/);
    assert.match(html, /Player check timeout \(second\)/);
    assert.match(html, /Thời gian chờ trước khi check trạng thái player/);
    [
        "campaign-select",
        "folder-select",
        "refresh-campaigns-button",
        "refresh-folders-button",
        "get-test-cases-button",
        "api-domain-input",
        "api-authorization-input",
        "project-id-input",
        "environment-select",
        "api-timeout-input",
        "player-check-timeout-input",
        "test-case-max-time-input",
        "test-configuration-save-button",
        "app-toast",
        "dns-host-add-button",
        "dns-host-remove-button",
        "dns-host-status",
        "api-loading-overlay",
        "retry-sync-button",
        "run-target-browser",
        "run-target-webos",
        "tv-device-select",
        "tv-device-status",
        "tv-device-connection-status",
        "tv-device-connection-dot",
        "tv-device-check-connection-button",
        "tv-device-add-button",
        "tv-device-edit-button",
        "tv-device-dialog",
        "tv-device-name-input",
        "tv-device-host-input",
        "tv-device-passphrase-input",
        "tv-device-passphrase-toggle",
        "tv-device-dialog-submit-button",
        "sdk-managed-toolchain-status",
        "sdk-component-list",
        "sdk-install-review",
        "sdk-install-progress",
        "sdk-install-progress-text",
        "sdk-install-progress-steps",
        "tv-toolchain-sdk-home-input",
        "tv-toolchain-appium-home-input",
        "tv-toolchain-appium-bin-input",
        "tv-toolchain-chromedriver-input",
        "tv-toolchain-save-button",
        "lg-run-availability",
        "configure-lg-sdk-button",
        "lg-run-confirmation-dialog",
        "lg-run-confirm-button",
        "lg-run-cancel-button",
        "lg-run-state",
        "lg-preview-image",
        "lg-preview-empty",
        "lg-recovery-dialog",
        "lg-recovery-retry-button",
        "lg-recovery-stop-button",
    ].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
    assert.doesNotMatch(html, /id="tv-device-validate-button"/);
    assert.doesNotMatch(html, /id="tv-device-id-input"/);
    assert.doesNotMatch(html, /id="tv-device-model-input"/);
    assert.doesNotMatch(html, /id="tv-device-register-button"/);
    assert.doesNotMatch(html, /id="tv-toolchain-check-button"/);
    assert.doesNotMatch(html, /id="app-url-input"/);
    const retiredAiControls = new RegExp(
        [["ai", "api-key-input"].join("-"), ["ai", "provider-select"].join("-"), ["ai", "model-select"].join("-"), ["ai", "endpoint-input"].join("-"), ["AI", "API key"].join(" "), ["AI", "TEST_DESCRIPTION"].join("_"), ["API", "key", "settings", "panel"].join("[ -]")].join("|"),
    );
    assert.doesNotMatch(html, retiredAiControls);
    assert.doesNotMatch(html, /id="(?:username-input|password-input|mode-select|test-description-input)"/);
});

test("keeps the app brand in the header and settings controls on the right", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../app/renderer/index.html"), "utf8");

    const header = html.match(/<header class="toolbar">([\s\S]*?)<\/header>/)?.[1] || "";
    const sidebar = html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/)?.[1] || "";

    assert.match(header, /class="app-brand"/);
    assert.match(header, /MyTV Auto Test/);
    assert.match(header, /Chạy Playwright test bằng giao diện desktop\./);
    assert.match(header, /id="settings-button"/);
    assert.match(header, /id="logs-button"/);
    assert.doesNotMatch(sidebar, /MyTV Auto Test|Chạy Playwright test bằng giao diện desktop\.|app-brand/);
});

test("places labelled icon actions beside the workspace status", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../app/renderer/index.html"), "utf8");
    const statusBar = html.match(/<div class="status-bar">([\s\S]*?)<\/div>\s*<section class="browser-preview">/)?.[1] || "";

    assert.match(statusBar, /id="status-text"/);
    assert.match(statusBar, /id="workspace-selected-count"[^>]*>0 selected/);
    for (const [id, label] of [
        ["run-button", "Run Selected (0)"],
        ["stop-button", "Stop"],
        ["retry-sync-button", "Retry sync"],
        ["open-report-button", "Open Test Report"],
        ["show-report-button", "Show Folder"],
    ]) {
        const button = statusBar.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] || "";
        assert.ok(button.includes(`aria-label="${label}"`));
        const tooltipStart = statusBar.indexOf(`class="workspace-action-tooltip" data-tooltip="${label}"`);
        assert.ok(tooltipStart >= 0);
        assert.ok(statusBar.indexOf(`id="${id}"`, tooltipStart) > tooltipStart);
    }
    assert.doesNotMatch(html.match(/<form id="test-form"[\s\S]*?<\/form>/)?.[0] || "", /id="(?:run-button|stop-button|retry-sync-button|open-report-button|show-report-button)"/);
});

test("keeps the run icon intact while updating its accessible action label", () => {
    const source = fs.readFileSync(path.join(__dirname, "../../app/renderer/renderer.js"), "utf8");

    assert.doesNotMatch(source, /runButton\.textContent\s*=/);
    assert.match(source, /runButton\.setAttribute\("aria-label", label\)/);
    assert.match(source, /workspace-action-tooltip"\)\?\.setAttribute\("data-tooltip", label\)/);
});

test("styles workspace action tooltips below the status bar", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.status-bar\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s);
    assert.match(css, /\.workspace-action-tooltip::after\s*\{[^}]*z-index:\s*2;[^}]*top:\s*calc\(100% \+ 8px\);/s);
});

test("uses the taller default Electron window size", () => {
    const mainSource = fs.readFileSync(path.join(__dirname, "../../app/main.js"), "utf8");

    assert.match(mainSource, /new BrowserWindow\(\{[\s\S]*?width:\s*1240,[\s\S]*?height:\s*900,[\s\S]*?minWidth:\s*920,[\s\S]*?minHeight:\s*760,/);
    assert.match(mainSource, /show:\s*false,/);
    assert.match(mainSource, /revealWindowOnFirstPaint\(mainWindow\)/);
});

test("ships the normal application shell under the first loading overlay", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../app/renderer/index.html"), "utf8");

    assert.match(html, /<main class="app-shell">/);
    assert.match(html, /<div id="api-loading-overlay" class="api-loading-overlay hidden"[^>]*aria-busy="false"[^>]*>/);
    assert.match(html, /Loading workspace\.\.\./);
});

test("keeps the test-case table at 35vh and scrolls overflowing rows", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.test-case-table-wrap\s*\{[^}]*height:\s*35vh;[^}]*overflow:\s*auto;/s);
});

test("makes the sidebar 100px wider", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.app-shell\s*\{[^}]*grid-template-columns:\s*460px 1fr;/s);
});

test("styles each test-case detail value as a readable block", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.test-case-detail-row span\s*\{[^}]*display:\s*block;[^}]*padding:\s*8px 10px;[^}]*border:\s*1px solid #2b313d;[^}]*border-radius:\s*6px;[^}]*background:\s*#1a1e27;[^}]*white-space:\s*pre-wrap;[^}]*word-break:\s*break-word;/s);
});

test("styles the action preview as a grouped readable block", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.action-preview\s*\{[^}]*display:\s*grid;[^}]*padding:\s*8px 10px 8px 32px;[^}]*border:\s*1px solid #2b313d;[^}]*border-radius:\s*6px;[^}]*background:\s*#1a1e27;/s);
});

test("keeps expanded log bodies scrollable within the Logs modal", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.log-entry\.is-expanded\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*34px minmax\(0, 1fr\);[^}]*height:\s*min\(520px, calc\(100vh - 190px\)\);/s);
    assert.match(css, /\.log-entry\.is-expanded \.log-entry-content\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*none;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
});

test("keeps normal log cards in document flow when another card expands", () => {
    const css = fs.readFileSync(path.join(__dirname, "../../app/renderer/styles.css"), "utf8");

    assert.match(css, /\.log-output\s*\{[^}]*overflow:\s*auto;[^}]*background:\s*#0c0e13;/s);
    assert.doesNotMatch(css, /\.log-output\s*\{[^}]*display:\s*grid;/s);
    assert.match(css, /\.log-entry\s*\{[^}]*margin-bottom:\s*12px;[^}]*overflow:\s*hidden;/s);
});
