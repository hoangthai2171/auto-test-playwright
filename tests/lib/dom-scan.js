const {getSelectorContract}=require("./selectors");

function createScopedDomScanner(page) {
  let fallbackUsed = false;
  let lastMetrics = null;

  async function scan({
    contractName = "contentContainer",
    candidateSelector = "[id]",
    headingSelector = "h1,h2,h3,h4,[role='heading'],[data-row-title],[class*='heading'],[class*='title']",
    includeHeadings = false,
    attributeNames = [],
    includeText = true,
    includePoster = false,
    includeBackgroundImage = false,
    geometry = {},
    headingGeometry = {},
    excludeIdPrefixes = [],
  } = {}) {
    const contract = getSelectorContract(contractName);
    const rootSelectors = contract.roots || contract.selectors || [];
    const allowFallback = !fallbackUsed;

    if (!allowFallback) {
      lastMetrics = {
        rootFound: false,
        usedFallback: false,
        fallbackBlocked: true,
        rootSelector: "",
        rootCount: 0,
        candidateCount: 0,
        headingCount: 0,
      };
      return {records: [], headings: [], metrics: lastMetrics};
    }

    const result = await page.evaluate((config) => {
      const rootNodes = [];
      let rootSelector = "";

      for (const selector of config.rootSelectors) {
        let matches = [];
        try {
          matches = Array.from(document.querySelectorAll(selector));
        } catch {
          matches = [];
        }
        if (matches.length) {
          rootNodes.push(...matches);
          rootSelector = selector;
          break;
        }
      }

      const rootFound = rootNodes.length > 0;
      const usedFallback = !rootFound && config.allowFallback;
      const scopes = rootFound ? rootNodes : usedFallback ? [document] : [];
      function collect(selector) {
        const elements = [];
        const seen = new Set();
        for (const scope of scopes) {
          let matches = [];
          try {
            matches = Array.from(scope.querySelectorAll(selector));
          } catch {
            matches = [];
          }
          try {
            if (scope.matches?.(selector)) matches.unshift(scope);
          } catch {
            // Invalid selectors are already handled by querySelectorAll above.
          }
          for (const element of matches) {
            if (seen.has(element)) continue;
            seen.add(element);
            elements.push(element);
          }
        }
        return elements;
      }

      function readRecord(element, geometry) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const attrs = {};
        for (const name of config.attributeNames) {
          attrs[name] = element.getAttribute(name) || "";
        }

        let poster = "";
        if (config.includePoster) {
          const image = element.querySelector("img");
          poster = image?.currentSrc || image?.src || "";
        }

        let backgroundImage = "";
        if (config.includeBackgroundImage) {
          backgroundImage = style.backgroundImage || "";
        }

        return {
          id: element.id || "",
          text: config.includeText ? (element.textContent || "").replace(/\s+/g, " ").trim() : "",
          attrs,
          poster,
          backgroundImage,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          visible:
            rect.width >= (geometry.minWidth ?? 0) &&
            rect.height >= (geometry.minHeight ?? 0) &&
            rect.width <= (geometry.maxWidth ?? Number.MAX_SAFE_INTEGER) &&
            rect.height <= (geometry.maxHeight ?? Number.MAX_SAFE_INTEGER) &&
            rect.x >= (geometry.minX ?? 0) &&
            rect.y >= (geometry.minY ?? 0) &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            !config.excludeIdPrefixes.some((prefix) => (element.id || "").startsWith(prefix)),
        };
      }

      const records = collect(config.candidateSelector).map((element) => readRecord(element, config.geometry));
      const headings = config.includeHeadings
        ? collect(config.headingSelector)
            .map((element) => readRecord(element, config.headingGeometry))
            .filter((item) => item.visible && item.text && item.text.length <= 80)
        : [];

      return {
        records,
        headings,
        metrics: {
          rootFound,
          usedFallback,
          fallbackBlocked: false,
          rootSelector,
          rootCount: rootNodes.length,
          candidateCount: records.length,
          headingCount: headings.length,
        },
      };
    }, {
      rootSelectors,
      candidateSelector,
      headingSelector,
      includeHeadings,
      attributeNames,
      includeText,
      includePoster,
      includeBackgroundImage,
      geometry,
      headingGeometry,
      excludeIdPrefixes,
      allowFallback,
    });

    if (result.metrics.usedFallback) fallbackUsed = true;
    lastMetrics = result.metrics;
    return result;
  }

  return {
    scan,
    getLastMetrics: () => lastMetrics,
  };
}

module.exports = {createScopedDomScanner};
