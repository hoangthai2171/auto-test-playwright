const {getSelectorContract, FOCUS_SELECTORS} = require("./selectors");
const {normalizeVietnameseText} = require("./text-utils");
const {safeArtifactName} = require("./artifacts");

const DEFAULT_MATCH_OPTIONS = Object.freeze({
  threshold: 70,
  margin: 10,
  maxAttempts: 2,
});

async function collectSelectorDiagnostics(page, {contractName, expectedId = "", expectedLabel = ""} = {}) {
  const contract = getSelectorContract(contractName);
  const focused = await getFocusedState(page);
  const candidate = await page.evaluate(
    ({contract: selectorContract, targetId, targetLabel}) => {
      const candidates = Array.from(document.querySelectorAll("[id]"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0;
          const labelParts = [
            element.textContent || "",
            ...(selectorContract.attributes || []).map((name) => element.getAttribute(name) || ""),
          ];
          const label = labelParts.join(" ").replace(/\s+/g, " ").trim();
          const normalizedLabel = normalizeText(label);
          const score = scoreLabel(normalizedLabel, normalizeText(targetLabel));
          const matchesContract = (selectorContract.alternatives || []).some((alternative) =>
            matchesAlternative(element, alternative, selectorContract)
          );

          return {
            element,
            id: element.id || "",
            label,
            normalizedLabel,
            score: targetId && element.id === targetId ? 100 : score,
            visible,
            matchesContract,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        })
        .filter((item) => item.visible && item.matchesContract && item.label)
        .sort((a, b) => b.score - a.score || a.rect.width * a.rect.height - b.rect.width * b.rect.height);

      const top = candidates[0];
      if (!top) return null;

      return {
        id: top.id,
        label: top.label,
        normalizedLabel: top.normalizedLabel,
        score: top.score,
        secondScore: candidates[1]?.score || 0,
        scoreMargin: top.score - (candidates[1]?.score || 0),
        rect: top.rect,
        visible: top.visible,
        candidateCount: candidates.length,
      };

      function matchesAlternative(element, alternative, parentContract) {
        if (alternative.requiresId && !element.id) return false;
        if (alternative.idPrefixes?.length && !alternative.idPrefixes.some((prefix) => element.id.startsWith(prefix))) {
          return false;
        }
        if (alternative.idIncludes?.length && !alternative.idIncludes.some((part) => element.id.includes(part))) {
          return false;
        }
        if (alternative.attributes?.length && !alternative.attributes.some((name) => element.hasAttribute(name))) {
          return false;
        }
        if (alternative.classPatterns?.length && !alternative.classPatterns.some((name) => element.classList.contains(name))) {
          return false;
        }
        if (alternative.selectors?.length && !alternative.selectors.some((selector) => element.matches(selector))) {
          return false;
        }

        const geometry = parentContract.geometry;
        if (!geometry) return true;
        const {width, height, x, y} = element.getBoundingClientRect();
        return (
          width >= (geometry.minWidth || 0) &&
          height >= (geometry.minHeight || 0) &&
          width <= (geometry.maxWidth || Number.MAX_SAFE_INTEGER) &&
          height <= (geometry.maxHeight || Number.MAX_SAFE_INTEGER) &&
          x >= (geometry.minX || 0) &&
          y >= (geometry.minY || 0)
        );
      }

      function normalizeText(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function scoreLabel(label, target) {
        if (!target) return 1;
        if (label === target) return 100;
        if (label.includes(target)) return 90;

        const labelTokens = tokenize(label);
        const targetTokens = tokenize(target);
        if (!labelTokens.length || !targetTokens.length) return 0;
        const matched = targetTokens.filter((token) =>
          labelTokens.some((labelToken) => labelToken === token || labelToken.includes(token) || token.includes(labelToken))
        );
        const coverage = matched.length / targetTokens.length;
        return coverage === 1 ? 80 : Math.round(coverage * 70);
      }

      function tokenize(value) {
        return value.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
      }
    },
    {contract, targetId: expectedId, targetLabel: expectedLabel}
  );

  return {
    contractName,
    focused,
    candidate,
    expectedId,
    expectedLabel: normalizeVietnameseText(expectedLabel),
  };
}

async function verifyFocusedTarget(page, options = {}) {
  const {contractName, expectedId = "", expectedLabel = ""} = options;
  const matchOptions = {...DEFAULT_MATCH_OPTIONS, ...options};
  const diagnostics = await collectSelectorDiagnostics(page, {contractName, expectedId, expectedLabel});
  const focused = diagnostics.focused;
  const candidate = diagnostics.candidate;
  const focusedLabel = normalizeVietnameseText([focused.text, focused.label].filter(Boolean).join(" "));
  const targetLabel = normalizeVietnameseText(expectedLabel);
  const hasTargetIdentity = Boolean(expectedId || expectedLabel);
  const focusedContainsCandidate = Boolean(candidate?.id) && await page.evaluate(({targetId, focusSelectors}) => {
    const target = document.getElementById(targetId);
    const focused = findFocusedElement(focusSelectors);
    if (!target || !focused) return false;
    if (target === focused || target.contains(focused) || focused.contains(target)) return true;

    // The TV app can place the focus marker and its label on sibling nodes
    // under the same menu control. Treat that shared control as the focused
    // target while keeping the relation bounded to direct/common ancestors.
    if (target.parentElement && target.parentElement === focused.parentElement) return true;
    let ancestor = target.parentElement;
    for (let depth = 0; ancestor && depth < 3; depth += 1, ancestor = ancestor.parentElement) {
      if (ancestor.contains(focused) && (ancestor.id || ancestor.hasAttribute("menu_name") || ancestor.hasAttribute("service_name"))) {
        return true;
      }
    }
    return false;

    function findFocusedElement(selectors) {
      for (const selector of selectors) {
        const candidate = Array.from(document.querySelectorAll(selector)).find(isVisible);
        if (candidate) return candidate;
      }
      return null;
    }

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  }, {targetId: candidate?.id, focusSelectors: FOCUS_SELECTORS});
  const idMatches = !expectedId || focused.id === expectedId || focused.id.includes(expectedId) || focusedContainsCandidate;
  const labelMatches = !targetLabel || fuzzyLabelMatch(focusedLabel, targetLabel) ||
    (focusedContainsCandidate && fuzzyLabelMatch(candidate?.normalizedLabel || "", targetLabel));
  const candidateIsClear = !hasTargetIdentity || !candidate || candidate.score >= matchOptions.threshold;
  const relatedLabelNode = focusedContainsCandidate && candidate?.id && candidate.id !== focused.id;
  const candidateIsUnambiguous = !hasTargetIdentity || !candidate || relatedLabelNode || candidate.candidateCount <= 1 || candidate.scoreMargin >= matchOptions.margin;
  const valid = Boolean(focused.id || focused.text) && idMatches && labelMatches && candidateIsClear && candidateIsUnambiguous;

  return {
    valid,
    diagnostics,
    reason: valid ? "verified" : describeVerificationFailure({focused, candidate, expectedId, expectedLabel, matchOptions}),
  };
}

async function assertFocusedTarget(page, options = {}) {
  const result = await verifyFocusedTarget(page, options);
  if (!result.valid) {
    const error = new Error(`Selector verification failed: ${result.reason}`);
    error.selectorDiagnostics = result.diagnostics;
    throw error;
  }

  return result;
}

async function captureActivationDiagnostics(page, testInfo, name, diagnostics) {
  if (!testInfo?.attach) return;
  const artifactName = safeArtifactName(name || "selector-activation");
  await testInfo.attach(`${artifactName}.json`, {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach(`${artifactName}.png`, {
    body: await page.screenshot({fullPage: false}),
    contentType: "image/png",
  });
}

async function activateVerifiedTarget(page, {
  testInfo,
  name = "selector-activation",
  contractName = "menuItem",
  expectedId = "",
  expectedLabel = "",
  delay = 250,
  reselect,
  ...options
} = {}) {
  const maxAttempts = Number(options.maxAttempts || DEFAULT_MATCH_OPTIONS.maxAttempts);
  let lastResult;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastResult = await verifyFocusedTarget(page, {
      contractName,
      expectedId,
      expectedLabel,
      ...options,
    });
    await captureActivationDiagnostics(page, testInfo, `${name}-attempt-${attempt + 1}`, lastResult.diagnostics);

    if (lastResult.valid) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(delay);
      return lastResult;
    }

    if (typeof reselect === "function" && attempt + 1 < maxAttempts) {
      await reselect(attempt + 1, lastResult);
    }
  }

  throw new Error(`Unable to activate verified selector after ${maxAttempts} attempt(s): ${lastResult?.reason || "no match"}`);
}

async function runSelectorHealthCheck(page, {testInfo, contractNames} = {}) {
  const names = contractNames || ["focus", "leftMenu", "contentContainer", "contentItem"];
  const results = [];

  for (const contractName of names) {
    const contract = getSelectorContract(contractName);
    const matchedAlternative = await page.evaluate(({selectorContract}) => {
      const elements = Array.from(document.querySelectorAll("body *"));
      return (selectorContract.alternatives || []).find((alternative) =>
        elements.some((element) => matchesAlternative(element, alternative, selectorContract))
      )?.name || "";

      function matchesAlternative(element, alternative, parentContract) {
        if (alternative.requiresId && !element.id) return false;
        if (alternative.idPrefixes?.length && !alternative.idPrefixes.some((prefix) => element.id.startsWith(prefix))) return false;
        if (alternative.idIncludes?.length && !alternative.idIncludes.some((part) => element.id.includes(part))) return false;
        if (alternative.attributes?.length && !alternative.attributes.some((name) => element.hasAttribute(name))) return false;
        if (alternative.classPatterns?.length && !alternative.classPatterns.some((name) => element.classList.contains(name))) return false;
        if (alternative.selectors?.length && !alternative.selectors.some((selector) => element.matches(selector))) return false;

        const geometry = parentContract.geometry;
        if (!geometry) return true;
        const rect = element.getBoundingClientRect();
        return rect.width >= (geometry.minWidth || 0) && rect.height >= (geometry.minHeight || 0) &&
          rect.width <= (geometry.maxWidth || Number.MAX_SAFE_INTEGER) && rect.height <= (geometry.maxHeight || Number.MAX_SAFE_INTEGER) &&
          rect.x >= (geometry.minX || 0) && rect.y >= (geometry.minY || 0);
      }
    }, {selectorContract: contract});

    const status = matchedAlternative ? "pass" : contract.severity === "required" ? "fail" : "warning";
    results.push({
      contract: contractName,
      severity: contract.severity || "optional",
      status,
      matchedAlternative,
      reason: matchedAlternative ? `Matched ${matchedAlternative}` : `No declared alternative matched for ${contractName}`,
    });
  }

  const summary = {
    status: results.some((item) => item.status === "fail") ? "fail" : results.some((item) => item.status === "warning") ? "warning" : "pass",
    results,
  };
  if (testInfo?.attach) {
    await testInfo.attach("selector-health.json", {
      body: JSON.stringify(summary, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("selector-health.png", {
      body: await page.screenshot({fullPage: false}),
      contentType: "image/png",
    });
  }

  return summary;
}

async function assertSelectorHealth(page, options = {}) {
  const summary = await runSelectorHealthCheck(page, options);
  const failures = summary.results.filter((item) => item.status === "fail");
  if (failures.length) {
    throw new Error(`Selector health check failed: ${failures.map((item) => item.reason).join("; ")}`);
  }

  return summary;
}

async function getFocusedState(page) {
  return page.evaluate((focusSelectors) => {
    const focused = findFocusedElement(focusSelectors);
    if (!focused) return {id: "", text: "", label: "", rect: {x: 0, y: 0, width: 0, height: 0}};
    const rect = focused.getBoundingClientRect();
    const text = (focused.textContent || "").replace(/\s+/g, " ").trim();
    const parentText = (focused.parentElement?.textContent || "").replace(/\s+/g, " ").trim();
    return {
      id: focused.id || "",
      text,
      label: [text, parentText].filter(Boolean).join(" "),
      rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
    };
    function findFocusedElement(selectors) {
      for (const selector of selectors) {
        const candidate = Array.from(document.querySelectorAll(selector)).find(isVisible);
        if (candidate) return candidate;
      }
      return null;
    }

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  }, FOCUS_SELECTORS);
}

function fuzzyLabelMatch(value, target) {
  if (!value || !target) return false;
  if (value === target || value.includes(target)) return true;
  const valueTokens = value.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  const targetTokens = target.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  return targetTokens.length > 0 && targetTokens.every((token) =>
    valueTokens.some((valueToken) => valueToken === token || valueToken.includes(token) || token.includes(valueToken))
  );
}

function getContractLocator(page, contractName, options = {}) {
  const contract = getSelectorContract(contractName);
  const selectors = contract.locatorRoots || [];
  if (!selectors.length) {
    const error = new Error(`No stable Locator roots declared for selector contract "${contractName}"`);
    error.code = "LOCATOR_CONTRACT_MISS";
    error.contractName = contractName;
    throw error;
  }

  const locator = page.locator(selectors.join(", "));
  return options.hasText === undefined ? locator : locator.filter({hasText: options.hasText});
}

async function resolveContractLocatorId(page, {
  contractName,
  hasText,
  fallback,
} = {}) {
  const locator = getContractLocator(page, contractName, {hasText});
  const candidateCount = await locator.count().catch(() => 0);

  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const id = await candidate.getAttribute("id").catch(() => "");
    if (id) {
      return {
        id,
        source: "locator",
        contractName,
        candidateCount,
        contractMiss: false,
      };
    }
  }

  const fallbackId = typeof fallback === "function" ? await fallback() : "";
  const diagnostics = {
    contractName,
    candidateCount,
    fallbackUsed: true,
    fallbackId: fallbackId || "",
  };
  if (!fallbackId) {
    const error = new Error(`Locator contract "${contractName}" did not resolve a visible target`);
    error.code = "LOCATOR_CONTRACT_MISS";
    error.contractName = contractName;
    error.diagnostics = diagnostics;
    throw error;
  }

  return {
    id: fallbackId,
    source: "evaluate-fallback",
    contractName,
    candidateCount,
    contractMiss: true,
    diagnostics,
  };
}

function describeVerificationFailure({focused, candidate, expectedId, expectedLabel, matchOptions}) {
  return JSON.stringify({
    expectedId,
    expectedLabel,
    focused,
    candidate,
    threshold: matchOptions.threshold,
    margin: matchOptions.margin,
  });
}

module.exports = {
  DEFAULT_MATCH_OPTIONS,
  collectSelectorDiagnostics,
  verifyFocusedTarget,
  assertFocusedTarget,
  captureActivationDiagnostics,
  activateVerifiedTarget,
  runSelectorHealthCheck,
  assertSelectorHealth,
  getFocusedState,
  fuzzyLabelMatch,
  getContractLocator,
  resolveContractLocatorId,
};
