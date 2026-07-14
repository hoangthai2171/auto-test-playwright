const {getSelectorContract}=require("./selectors");

function createDomSnapshotCache() {
  const entries = new Map();

  function get(key, identity) {
    const entry = entries.get(key);
    if (!entry || !sameIdentity(entry.identity, identity)) return null;
    return clone(entry.value);
  }

  function set(key, identity, value) {
    if (!identity?.route || !identity?.container) {
      throw new Error("DOM snapshot identity requires both route and container");
    }
    const frozenValue = deepFreeze(clone(value));
    entries.set(key, {identity: clone(identity), value: frozenValue});
    return clone(frozenValue);
  }

  function invalidate(key) {
    if (key) entries.delete(key);
    else entries.clear();
  }

  return {
    get,
    set,
    invalidate,
    clear: () => entries.clear(),
    size: () => entries.size,
  };
}

async function getDomSnapshotIdentity(page, contractName = "contentContainer") {
  const contract = getSelectorContract(contractName);
  const selectors = contract.roots || contract.selectors || [];
  return page.evaluate((rootSelectors) => {
    let rootSelector = "";
    let nodes = [];
    for (const selector of rootSelectors) {
      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch {
        nodes = [];
      }
      if (nodes.length) {
        rootSelector = selector;
        break;
      }
    }

    const route = `${location.pathname}${location.search}${location.hash}`;
    const container = nodes.length
      ? [rootSelector, ...nodes.map((node) => node.id || String(node.className || "")).sort()].join("|")
      : "none";
    return {route, container};
  }, selectors);
}

function sameIdentity(left, right) {
  return Boolean(left?.route && right?.route && left.route === right.route && left.container === right.container);
}

function clone(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

module.exports={createDomSnapshotCache,getDomSnapshotIdentity};
