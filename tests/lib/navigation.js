const {expect}=require("playwright/test");
const {FOCUS_SELECTORS}=require("./selectors");

const DEFAULT_REMOTE_PRESS_DELAY = 100;
const VIRTUAL_KEYBOARD_ROWS = [
  ["a", "b", "c", "d", "e", "f", "1", "2", "3"],
  ["g", "h", "i", "j", "k", "l", "4", "5", "6"],
  ["m", "n", "o", "p", "q", "r", "7", "8", "9"],
  ["s", "t", "u", "v", "w", "x", "y", "z", "0"],
];

function normalizeVietnameseText(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/\s+/g," ").trim().toLowerCase();}

async function remotePress(page, key, delay = DEFAULT_REMOTE_PRESS_DELAY, options = {}) {
  await page.keyboard.press(key);
  options.snapshotCache?.invalidate();
  await page.waitForTimeout(delay);
}
async function expectFocusedText(page, text) {
  await expect.poll(() => getFocusedState(page).then((state) => state.text)).toMatch(text);
}

async function expectFocusedElementToLookOrange(page) {
  const orangeScore = await page.evaluate((focusSelectors) => {
    const focused = findFocusedElement(focusSelectors);
    if (!focused) return 0;
    const style = getComputedStyle(focused);
    const colors = [style.backgroundColor, style.borderColor, style.boxShadow, style.color].join(" ");
    const matches = [...colors.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)];
    return matches.some(([, r, g, b]) => {
      const red = Number(r);
      const green = Number(g);
      const blue = Number(b);
      return red >= 200 && green >= 80 && green <= 180 && blue <= 80;
    })
      ? 1
      : 0;
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

  expect(orangeScore).toBe(1);
}
async function enterWithVirtualKeyboard(page, value) {
  for (const char of value) {
    await remoteFocusByVirtualKey(page, char);
    // Let the app finish updating the query/suggestion layer before the next
    // remote-navigation lookup.  The keyboard is rerendered after the third
    // character on staging, so the default key delay is too short here.
    await remotePress(page, "Enter", 250);
  }
}

async function remoteFocusByVirtualKey(page, char) {
  const focused = await getFocusedState(page);
  if (isVirtualKeyboardActionFocus(focused) && /^[a-z0-9]$/i.test(char)) {
    const focusedFromKeyboardOrigin = await focusVirtualKeyFromKeyboardOrigin(page, char);
    if (focusedFromKeyboardOrigin) return;
  }

  for (const keyId of virtualKeyIds(char)) {
    const hasKeyId = await page
      .evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        // Must be actually rendered and within viewport to be a real keyboard key.
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || 1080) &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0
        );
      }, keyId)
      .catch(() => false);

    if (hasKeyId) {
      const focused = await getFocusedState(page);
      const fromActionRow = ["space", "clearAll", "callSearch", "key-space-v2"].includes(focused.id);
      const preferredDirection = fromActionRow && /^[a-z]$/i.test(char) ? "ArrowUp" : undefined;
      await remoteFocusById(page, keyId, 50, {preferredDirection});
      return;
    }
  }

  await remoteFocusByKeyText(page, char);
}

async function focusVirtualKeyFromKeyboardOrigin(page, char) {
  const normalizedChar = char.toLowerCase();
  const rowIndex = VIRTUAL_KEYBOARD_ROWS.findIndex((row) => row.includes(normalizedChar));
  if (rowIndex < 0) return false;
  const columnIndex = VIRTUAL_KEYBOARD_ROWS[rowIndex].indexOf(normalizedChar);

  // ArrowUp from the action row enters the keyboard at its middle column. Keep
  // moving until the first key is reached, then use the stable row/column grid
  // to reach the requested key without crossing the overlapping action row.
  for (let attempt = 0; attempt < 8; attempt++) {
    if ((await getFocusedState(page)).id === "key-a-v2") break;
    await remotePress(page, "ArrowUp", 160);
  }

  if ((await getFocusedState(page)).id !== "key-a-v2") return false;

  for (let row = 0; row < rowIndex; row++) await remotePress(page, "ArrowDown", 160);
  for (let column = 0; column < columnIndex; column++) await remotePress(page, "ArrowRight", 160);

  const finalState = await getFocusedState(page);
  return finalState.id === `key-${normalizedChar}-v2`;
}

function isVirtualKeyboardActionFocus(state) {
  return ["space", "clearAll", "callSearch", "key-space-v2"].includes(state.id);
}

function virtualKeyIds(char) {
  const keyMap = {
    ".": "key-dot-v2",
    // Prefer the actual spacebar key.  On some app layouts `#space` is a
    // wrapper for the whole action row, so its rectangle overlaps the letter
    // keys and spatial navigation can bounce between them indefinitely.
    " ": ["key-space-v2", "space"],
    "-": "key-dash-v2",
    _: "key-underline-v2",
    "!": "key-exclamation-v2",
    "@": "key-atsign-v2",
    "#": "key-hash-v2",
    $: "key-dollar-v2",
    "%": "key-percent-v2",
    "^": "key-caret-v2",
    "&": "key-and-v2",
    "*": "key-asterisk-v2",
  };

  const keyIds = keyMap[char] ?? `key-${char.toLowerCase()}-v2`;
  return Array.isArray(keyIds) ? keyIds : [keyIds];
}

function searchKeyboardInput(value) {
  return normalizeVietnameseText(value);
}

function cssEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function remoteFocusByText(page, text, maxMoves = 40) {
  await remoteFocus(page, {
    maxMoves,
    isTarget: (state) => text.test(state.text) || text.test(state.label),
    getTargetRect: async () =>
      page.evaluate((source) => {
        const pattern = new RegExp(source, "i");
        const candidates = Array.from(document.querySelectorAll("body *"));
        const target = candidates
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const text = (element.textContent || "").replace(/\s+/g, " ").trim();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              pattern.test(text)
            );
          })
          .sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            return aRect.width * aRect.height - bRect.width * bRect.height;
          })[0];
        return target ? rectOf(target) : null;

        function rectOf(element) {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }
      }, text.source),
  });
}

async function remoteFocusByKeyText(page, char, maxMoves = 50) {
  await remoteFocus(page, {
    maxMoves,
    isTarget: (state) => state.text.toLowerCase() === char.toLowerCase(),
    getTargetRect: async () =>
      page.evaluate((targetChar) => {
        const normalizedTarget = targetChar.toLowerCase();
        const candidates = Array.from(document.querySelectorAll("body *"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const text = (element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            const hasChildText = Array.from(element.children || []).some((child) =>
              (child.textContent || "").trim()
            );

            return (
              text === normalizedTarget &&
              !hasChildText &&
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            const aArea = aRect.width * aRect.height;
            const bArea = bRect.width * bRect.height;
            return aArea - bArea;
          });

        const target = candidates[0];
        if (!target) return null;

        const rect = target.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }, char),
  });
}

async function remoteFocusById(page, id, maxMoves = 50, options = {}) {
  await remoteFocus(page, {
    maxMoves,
    preferredDirection: options.preferredDirection,
    snapshotCache: options.snapshotCache,
    isTarget: (state) => {
      if (state.id === id) return true;
      // When the target is a container element (e.g. id="space" wrapping the
      // spacebar + Xoá + Tìm kiếm row), the `.focused` class lands on a CHILD
      // rather than the container itself.  Accept focus if the focused element
      // is contained within the target element.
      return page.evaluate(
        ({ focusedId, targetId, focusSelectors }) => {
          const target = document.getElementById(targetId);
          if (!target) return false;
          const focusedEl = focusedId
            ? document.getElementById(focusedId)
            : findFocusedElement(focusSelectors);
          if (!focusedEl) return false;
          // Accept focus when:
          //   1. focused element is a descendant of the target (e.g. focus on img child of #space)
          //   2. target element is a descendant of the focused element (e.g. focus on #space container
          //      while target is the #key-space-v2 img child inside it)
          return target.contains(focusedEl) || focusedEl.contains(target);

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
        },
        { focusedId: state.id, targetId: id, focusSelectors: FOCUS_SELECTORS }
      );
    },
    getTargetRect: async () =>
      page.evaluate((targetId) => {
        const element = document.getElementById(targetId);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }, id),
  });
}

async function remoteFocus(page, { isTarget, getTargetRect, maxMoves, preferredDirection, snapshotCache }) {
  let targetRect = await getTargetRect();
  expect(targetRect).toBeTruthy();

  for (let attempt = 0; attempt < maxMoves; attempt++) {
    const state = await getFocusedState(page);
    if (await Promise.resolve(isTarget(state))) return;

    // Home rows can reflow while a remote key is being processed. Refresh the
    // target geometry before choosing the next direction so a stale first
    // rectangle cannot drive focus past the target into a later row.
    const refreshedTargetRect = await getTargetRect().catch(() => null);
    if (refreshedTargetRect) targetRect = refreshedTargetRect;

    const key = preferredDirection || chooseDirection(state.rect, targetRect);
    const before = state.id || state.text;
    await remotePress(page, key, 160, {snapshotCache});
    const after = await getFocusedState(page);

    if ((after.id || after.text) === before) {
      await remotePress(page, fallbackDirection(key), 160, {snapshotCache});
    }
  }

  // One final check: the last press may have landed on the target but the loop
  // ended before the next iteration could detect it.
  const finalState = await getFocusedState(page);
  if (await Promise.resolve(isTarget(finalState))) return;

  throw new Error(
    `Could not focus target with remote keys. Current focus: ${JSON.stringify(finalState)}`
  );
}

function chooseDirection(fromRect, toRect) {
  const from = center(fromRect);
  const to = center(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const isAbove = toRect.y + toRect.height <= fromRect.y;
  const isBelow = toRect.y >= fromRect.y + fromRect.height;
  const isLeft = toRect.x + toRect.width <= fromRect.x;
  const isRight = toRect.x >= fromRect.x + fromRect.width;
  const horizontalOverlap = rangesOverlap(fromRect.x, fromRect.x + fromRect.width, toRect.x, toRect.x + toRect.width);
  const verticalOverlap = rangesOverlap(fromRect.y, fromRect.y + fromRect.height, toRect.y, toRect.y + toRect.height);

  // A wide action key can overlap the last letter row on the staging layout.
  // Treat it as the next row when the current key is inside that rectangle;
  // otherwise left/right selection oscillates between the overlapping keys.
  if (horizontalOverlap && verticalOverlap && toRect.width >= fromRect.width * 2) {
    if (toRect.y >= fromRect.y) return "ArrowDown";
    if (toRect.y + toRect.height <= fromRect.y) return "ArrowUp";
  }

  if ((isAbove || isBelow) && horizontalOverlap) {
    return isBelow ? "ArrowDown" : "ArrowUp";
  }

  if ((isLeft || isRight) && verticalOverlap) {
    return isRight ? "ArrowRight" : "ArrowLeft";
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "ArrowRight" : "ArrowLeft";
  }

  return dy > 0 ? "ArrowDown" : "ArrowUp";
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function fallbackDirection(key) {
  return {
    ArrowRight: "ArrowDown",
    ArrowDown: "ArrowRight",
    ArrowLeft: "ArrowUp",
    ArrowUp: "ArrowLeft",
  }[key];
}

function center(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

async function getFocusedState(page) {
  return page.evaluate((focusSelectors) => {
    const focused = findFocusedElement(focusSelectors);

    if (!focused) {
      return {
        id: "",
        text: "",
        label: "",
        rect: { x: 0, y: 0, width: 0, height: 0 },
      };
    }

    const rect = focused.getBoundingClientRect();
    const text = (focused.textContent || "").replace(/\s+/g, " ").trim();
    const parentText = (focused.parentElement?.textContent || "").replace(/\s+/g, " ").trim();
    const siblingText = Array.from(focused.parentElement?.children || [])
      .map((element) => (element.textContent || "").replace(/\s+/g, " ").trim())
      .join(" ")
      .trim();

    return {
      id: focused.id || "",
      text,
      label: [text, parentText, siblingText].filter(Boolean).join(" "),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
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

module.exports={DEFAULT_REMOTE_PRESS_DELAY,remotePress,enterWithVirtualKeyboard,remoteFocusByVirtualKey,virtualKeyIds,searchKeyboardInput,remoteFocusByText,remoteFocusByKeyText,remoteFocusById,remoteFocus,getFocusedState,expectFocusedText,expectFocusedElementToLookOrange,__internal:{chooseDirection,rangesOverlap,fallbackDirection,center}};
