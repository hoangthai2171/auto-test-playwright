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
    this.classList.values = new Set(String(value || "").split(/\s+/).filter(Boolean));
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
    return { x: 0, y: 0, width: 640, height: 480 };
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

  const classMatch = selector.match(/^\.([\w-]+)$/);
  if (classMatch) return element.classList.contains(classMatch[1]);

  return element.tagName.toLowerCase() === selector.toLowerCase();
}

function createRendererFixture() {
  const elements = {};
  const document = {
    createElement: (tagName) => new FakeElement(tagName),
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
    "folder-select",
    "refresh-folders-button",
    "get-test-cases-button",
    "api-loading-overlay",
    "settings-app-url-input",
    "api-domain-input",
    "project-id-input",
    "environment-select",
    "api-timeout-input",
    "selected-test-case-id",
    "test-case-list",
    "test-case-list-body",
    "test-case-search-input",
    "select-all-test-cases",
    "selected-test-case-count",
    "test-case-details",
    "test-case-details-modal",
    "test-case-details-close-button",
    "run-button",
    "stop-button",
    "open-report-button",
    "show-report-button",
    "settings-button",
    "logs-button",
    "settings-modal",
    "logs-modal",
    "settings-close-button",
    "logs-close-button",
    "gui-settings-save-button",
    "settings-message",
    "form-message",
    "status-dot",
    "status-text",
    "log-output",
    "browser-mute-button",
    "browser-preview-empty",
    "browser-preview-image",
    "interactive-browser",
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
  elements["api-loading-overlay"].className = "api-loading-overlay hidden";

  const stage = new FakeElement("div");
  stage.className = "browser-preview-stage";
  root.append(stage);

  const settingsClose = new FakeElement("div");
  settingsClose.setAttribute("data-close-settings", "");
  elements["settings-modal"].append(settingsClose);

  const logsClose = new FakeElement("div");
  logsClose.setAttribute("data-close-logs", "");
  elements["logs-modal"].append(logsClose);

  const guiNav = new FakeElement("button");
  guiNav.setAttribute("data-settings-panel", "gui");
  root.append(guiNav);

  const guiPanel = new FakeElement("section");
  guiPanel.setAttribute("data-settings-content", "gui");
  root.append(guiPanel);

  ["none", "live", "interactive"].forEach((value) => {
    const input = new FakeElement("input");
    input.setAttribute("name", "preview-type");
    input.value = value;
    root.append(input);
  });

  const runner = {
    loadTestCases: async () => ({ ok: true, cases: [] }),
    loadFlowCaseFolders: async () => ({ok: true, folders: []}),
    loadFlowCases: async () => ({ok: true, folder: null, cases: []}),
    runTest: async () => ({ ok: true }),
    stopTest: async () => ({ ok: true }),
    openReport: () => {},
    showReportFolder: () => {},
    showInteractiveBrowser: async () => {},
    hideInteractiveBrowser: async () => {},
    suspendInteractiveBrowser: async () => {},
    resumeInteractiveBrowser: async () => {},
    setInteractiveBrowserMuted: async () => {},
    onStarted: () => {},
    onLog: () => {},
    onPreview: () => {},
    finishedCallback: null,
    onFinished(callback) {
      this.finishedCallback = callback;
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
    windowRef: { addEventListener: () => {}, alert: () => {} },
  };
}

test("renderer entry is available to lightweight UI tests", () => {
  assert.equal(loadError, undefined, loadError?.message);
  assert.equal(typeof renderer.createRendererController, "function");
});

test("renders test cases as selectable table rows with a disabled empty batch action", () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  const controller = renderer.createRendererController(fixture);

  controller.renderCaseList([
    { id: "case-1", name: "First case", platform: "tv", actions: [] },
    { id: "case-2", name: "Second case", platform: "web", actions: [] },
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

test("select-all and per-row checkboxes update the selected count in table order", () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  const controller = renderer.createRendererController(fixture);
  controller.renderCaseList([
    { id: "case-1", name: "First case", actions: [] },
    { id: "case-2", name: "Second case", actions: [] },
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
      actions: [{ action: "open_home" }],
    },
    {
      id: "case-2",
      name: "Second case",
      platform: "tv",
      qaDescription: "Open the service",
      actions: [{ action: "login", username: "ts1", password: "secret" }],
    },
  ];

  controller.renderCaseList(cases);
  controller.selectCase("case-2");

  assert.equal(fixture.elements["selected-test-case-id"].value, "case-2");
  assert.match(fixture.elements["test-case-details"].textContent, /Second case/);
  assert.match(fixture.elements["test-case-details"].textContent, /login/);
  assert.match(fixture.elements["test-case-details"].textContent, /••••••/);
  assert.equal(
    fixture.elements["test-case-list"].querySelector('[data-test-case-id="case-2"]').getAttribute("aria-selected"),
    "true"
  );
});

test("loads cases through IPC and renders the returned list", async () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  const cases = [
    { id: "local-1", name: "Local case", actions: [] },
    { id: "local-2", name: "Another case", actions: [] },
  ];
  fixture.runner.loadTestCases = async () => ({ ok: true, cases });
  const controller = renderer.createRendererController(fixture);

  const response = await controller.loadCases();

  assert.deepEqual(response, { ok: true, cases });
  assert.equal(fixture.elements["test-case-list"].querySelectorAll("button").length, 2);
  assert.match(fixture.elements["test-case-list"].textContent, /Local case/);
});

test("loads and renders folders by name with fullPath values", async () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  fixture.runner.loadFlowCaseFolders = async () => ({ok: true, folders: [
    {id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"},
  ]});
  const controller = renderer.createRendererController(fixture);

  await controller.loadFolders();

  const option = fixture.elements["folder-select"].querySelectorAll("option")[1];
  assert.equal(option.textContent, "Play kênh");
  assert.equal(option.value, "/Root/Play kênh");
  assert.equal(option.dataset.folderId, "12");
});

test("downloads selected-folder cases and tracks the folder ID", async () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  fixture.runner.loadFlowCases = async (values) => ({ok: true, folder: {
    id: values.FOLDER_ID, name: "Play kênh", fullPath: values.FOLDER_NAME,
  }, cases: [{id: "case-1", name: "Remote case", actions: []}]});
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
  fixture.storage.getItem = () => JSON.stringify({
    APP_URL: "https://saved.test/",
    API_DOMAIN: "http://saved-api.test",
    PROJECT_ID: "7",
    ENVIRONMENT: "API",
    API_TIMEOUT_SECONDS: "45",
    PREVIEW_TYPE: "none",
  });
  fixture.storage.setItem = (_key, value) => {
    stored = JSON.parse(value);
  };
  renderer.createRendererController(fixture);

  assert.equal(fixture.elements["settings-app-url-input"].value, "https://saved.test/");
  assert.equal(fixture.elements["api-domain-input"].value, "http://saved-api.test");
  assert.equal(fixture.elements["project-id-input"].value, "7");
  assert.equal(fixture.elements["environment-select"].value, "API");
  assert.equal(fixture.elements["api-timeout-input"].value, "45");
  fixture.elements["gui-settings-save-button"].dispatchEvent("click");
  assert.equal(stored.API_TIMEOUT_SECONDS, "45");
  assert.equal(stored.ENVIRONMENT, "API");
});

test("includes the active folder ID when running downloaded cases", async () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  let submittedValues;
  fixture.runner.loadFlowCases = async () => ({ok: true, folder: {
    id: "12", name: "Play kênh", fullPath: "/Root/Play kênh",
  }, cases: [{id: "case-1", name: "Remote case", actions: []}]});
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

test("submits only the generic test-run payload", async () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  let submittedValues;
  fixture.runner.runTest = async (values) => {
    submittedValues = values;
    queueMicrotask(() => fixture.runner.finishedCallback({code: 0}));
    return { ok: true };
  };
  const controller = renderer.createRendererController(fixture);
  fixture.elements["settings-app-url-input"].value = "  https://example.test/  ";
  controller.renderCaseList([{ id: "case-1", name: "Case", actions: [] }]);
  controller.selectCase("case-1");

  const submit = fixture.elements["test-form"].listeners.get("submit");
  await submit({ preventDefault() {} });

  assert.deepEqual(submittedValues, {
    APP_URL: "https://example.test/",
    TEST_CASE_ID: "case-1",
    PREVIEW_TYPE: "live",
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
  fixture.elements["settings-app-url-input"].value = "  https://example.test/  ";
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
    APP_URL: "https://example.test/",
    TEST_CASE_ID: "case-1",
    PREVIEW_TYPE: "live",
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
  const action = { action: "login", username: "visible-user", password: "secret" };

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
});

test("refuses to run until a test case id is selected", () => {
  assert.equal(loadError, undefined, loadError?.message);

  assert.match(renderer.validateRunValues({ APP_URL: "https://example.test/" }), /test case/i);
  assert.equal(
    renderer.validateRunValues({ TEST_CASE_ID: "case-1" }),
    ""
  );
});

test("index markup contains the case browser and no API-key or mode controls", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "../../app/renderer/index.html"),
    "utf8"
  );

  assert.match(html, /id="test-case-list"/);
  assert.match(html, /<table[^>]+id="test-case-list"/);
  assert.match(html, /id="test-case-search-input"/);
  assert.match(html, /id="select-all-test-cases"/);
  assert.match(html, /id="test-case-list-body"/);
  assert.match(html, /id="test-case-details-modal"/);
  assert.match(html, /id="test-case-details"/);
  assert.match(html, /id="selected-test-case-id"/);
  assert.match(html, /id="settings-message"/);
  [
    "folder-select", "refresh-folders-button", "get-test-cases-button",
    "settings-app-url-input", "api-domain-input", "project-id-input",
    "environment-select", "api-timeout-input", "api-loading-overlay",
  ].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  assert.doesNotMatch(html, /id="app-url-input"/);
  const retiredAiControls = new RegExp(
    [
      ["ai", "api-key-input"].join("-"),
      ["ai", "provider-select"].join("-"),
      ["ai", "model-select"].join("-"),
      ["ai", "endpoint-input"].join("-"),
      ["AI", "API key"].join(" "),
      ["AI", "TEST_DESCRIPTION"].join("_"),
      ["API", "key", "settings", "panel"].join("[ -]"),
    ].join("|")
  );
  assert.doesNotMatch(html, retiredAiControls);
  assert.doesNotMatch(html, /username-input|password-input|mode-select|test-description-input/);
});

test("keeps the test-case table at 35vh and scrolls overflowing rows", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "../../app/renderer/styles.css"),
    "utf8"
  );

  assert.match(css, /\.test-case-table-wrap\s*\{[^}]*height:\s*35vh;[^}]*overflow:\s*auto;/s);
});
