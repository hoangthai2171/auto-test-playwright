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
    "app-url-input",
    "selected-test-case-id",
    "test-case-list",
    "test-case-details",
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
    onFinished: () => {},
  };

  return {
    document,
    elements,
    runner,
    storage: {
      getItem: () => null,
      setItem: () => {},
    },
    windowRef: { addEventListener: () => {} },
  };
}

test("renderer entry is available to lightweight UI tests", () => {
  assert.equal(loadError, undefined, loadError?.message);
  assert.equal(typeof renderer.createRendererController, "function");
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

test("submits only the generic test-run payload", async () => {
  assert.equal(loadError, undefined, loadError?.message);
  const fixture = createRendererFixture();
  let submittedValues;
  fixture.runner.runTest = async (values) => {
    submittedValues = values;
    return { ok: true };
  };
  const controller = renderer.createRendererController(fixture);
  fixture.elements["app-url-input"].value = "  https://example.test/  ";
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

test("masks action passwords while keeping usernames visible and source data intact", () => {
  assert.equal(loadError, undefined, loadError?.message);
  const action = { action: "login", username: "visible-user", password: "secret" };

  const displayAction = renderer.maskActionForDisplay(action);

  assert.equal(displayAction.username, "visible-user");
  assert.equal(displayAction.password, "••••••");
  assert.equal(action.password, "secret");
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
  assert.match(html, /id="test-case-details"/);
  assert.match(html, /id="selected-test-case-id"/);
  assert.match(html, /id="settings-message"/);
  assert.doesNotMatch(html, /username-input|password-input|mode-select|test-description-input/);
});
