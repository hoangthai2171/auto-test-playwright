const test = require("node:test");
const assert = require("node:assert/strict");

const {createScopedDomScanner} = require("../lib/dom-scan");

// The scanner runs its collection inside page.evaluate, so the fake page below
// executes that callback against a minimal DOM built from plain descriptors.
function createFakePage(elements) {
  const nodes = elements.map((element) => ({
    ...element,
    id: element.id || "",
    className: element.className || "",
    matchesSelectors: element.matches || [],
    children: [],
  }));

  for (const node of nodes) {
    node.getBoundingClientRect = () => node.rect;
    node.getAttribute = (name) => node.attributes?.[name] ?? null;
    node.querySelector = () => null;
    node.textContent = node.text || "";
    node.closest = (selector) => {
      let current = node;
      while (current) {
        if (current.matchesSelectors.includes(selector)) return current;
        current = nodes.find((candidate) => candidate.id === current.parentId);
      }
      return null;
    };
    node.matches = (selector) => node.matchesSelectors.includes(selector);
  }

  const document = {
    querySelectorAll: (selector) => nodes.filter((node) => node.matchesSelectors.includes(selector)),
  };

  return {
    evaluate: async (callback, config) => {
      const previous = {
        document: globalThis.document,
        window: globalThis.window,
        getComputedStyle: globalThis.getComputedStyle,
      };
      globalThis.document = document;
      globalThis.window = {innerWidth: 1280, innerHeight: 720};
      globalThis.getComputedStyle = () => ({display: "block", visibility: "visible", opacity: "1", backgroundImage: ""});
      try {
        return await callback(config);
      } finally {
        Object.assign(globalThis, previous);
      }
    },
  };
}

const HEADING_SELECTOR = "row-heading";
const CARD_SELECTOR = ".cate_content_item";

function scanFixture() {
  return createFakePage([
    {
      id: "root",
      matches: ["#content-root"],
      rect: {x: 0, y: 0, width: 1280, height: 720, right: 1280, bottom: 720, left: 0, top: 0},
    },
    {
      id: "row0_title",
      matches: [HEADING_SELECTOR],
      text: "Phim mới nhất",
      rect: {x: 100, y: 640, width: 1027, height: 30, right: 1127, bottom: 670, left: 100, top: 640},
    },
    {
      id: "card",
      matches: [CARD_SELECTOR],
      rect: {x: 100, y: 417, width: 279, height: 157, right: 379, bottom: 574, left: 100, top: 417},
    },
    {
      id: "card_status",
      parentId: "card",
      matches: [HEADING_SELECTOR],
      text: "Còn 05 : 17 : 40",
      rect: {x: 100, y: 537, width: 279, height: 36, right: 379, bottom: 573, left: 100, top: 537},
    },
  ]);
}

test("keeps a poster status label out of the row heading candidates", async () => {
  const scanner = createScopedDomScanner(scanFixture());

  const scan = await scanner.scan({
    contractName: "contentContainer",
    candidateSelector: "#content-root",
    headingSelector: HEADING_SELECTOR,
    includeHeadings: true,
    headingExcludeAncestorSelector: CARD_SELECTOR,
  });

  assert.deepEqual(scan.headings.map((heading) => heading.text), ["Phim mới nhất"]);
});

test("keeps every heading when no exclusion ancestor is configured", async () => {
  const scanner = createScopedDomScanner(scanFixture());

  const scan = await scanner.scan({
    contractName: "contentContainer",
    candidateSelector: "#content-root",
    headingSelector: HEADING_SELECTOR,
    includeHeadings: true,
  });

  assert.deepEqual(scan.headings.map((heading) => heading.text).sort(), [
    "Còn 05 : 17 : 40",
    "Phim mới nhất",
  ]);
});
