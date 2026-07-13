const {expect}=require("playwright/test");
const {getSelectorContract}=require("./selectors");

const FOCUS_SELECTOR = `.${getSelectorContract("focus").alternatives[0].classPatterns[0]}`;

function normalizeVietnameseText(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/\s+/g," ").trim().toLowerCase();}

async function remotePress(page, key, delay = 250) {
  await page.keyboard.press(key);
  await page.waitForTimeout(delay);
}
async function expectFocusedText(page, text) {
  await expect.poll(() => getFocusedState(page).then((state) => state.text)).toMatch(text);
}

async function expectFocusedElementToLookOrange(page) {
  const orangeScore = await page.evaluate((focusSelector) => {
    const focused = document.querySelector(focusSelector);
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
  }, FOCUS_SELECTOR);

  expect(orangeScore).toBe(1);
}
async function enterWithVirtualKeyboard(page, value) {
  for (const char of value) {
    await remoteFocusByVirtualKey(page, char);
    await remotePress(page, "Enter", 250);
  }
}

async function remoteFocusByVirtualKey(page, char) {
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
      await remoteFocusById(page, keyId);
      return;
    }
  }

  await remoteFocusByKeyText(page, char);
}

function virtualKeyIds(char) {
  const keyMap = {
    ".": "key-dot-v2",
    " ": ["space", "key-space-v2"],
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

async function remoteFocusById(page, id, maxMoves = 50) {
  await remoteFocus(page, {
    maxMoves,
    isTarget: (state) => {
      if (state.id === id) return true;
      // When the target is a container element (e.g. id="space" wrapping the
      // spacebar + Xoá + Tìm kiếm row), the `.focused` class lands on a CHILD
      // rather than the container itself.  Accept focus if the focused element
      // is contained within the target element.
      return page.evaluate(
        ({ focusedId, targetId, focusSelector }) => {
          const target = document.getElementById(targetId);
          if (!target) return false;
          const focusedEl = focusedId
            ? document.getElementById(focusedId)
            : document.querySelector(focusSelector);
          if (!focusedEl) return false;
          // Accept focus when:
          //   1. focused element is a descendant of the target (e.g. focus on img child of #space)
          //   2. target element is a descendant of the focused element (e.g. focus on #space container
          //      while target is the #key-space-v2 img child inside it)
          return target.contains(focusedEl) || focusedEl.contains(target);
        },
        { focusedId: state.id, targetId: id, focusSelector: FOCUS_SELECTOR }
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

async function remoteFocus(page, { isTarget, getTargetRect, maxMoves }) {
  const targetRect = await getTargetRect();
  expect(targetRect).toBeTruthy();

  for (let attempt = 0; attempt < maxMoves; attempt++) {
    const state = await getFocusedState(page);
    if (await Promise.resolve(isTarget(state))) return;

    const key = chooseDirection(state.rect, targetRect);
    const before = state.id || state.text;
    await remotePress(page, key, 160);
    const after = await getFocusedState(page);

    if ((after.id || after.text) === before) {
      await remotePress(page, fallbackDirection(key), 160);
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
  return page.evaluate((focusSelector) => {
    const focused = Array.from(document.querySelectorAll(focusSelector)).find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });

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
  }, FOCUS_SELECTOR);
}

module.exports={remotePress,enterWithVirtualKeyboard,remoteFocusByVirtualKey,virtualKeyIds,searchKeyboardInput,remoteFocusByText,remoteFocusByKeyText,remoteFocusById,remoteFocus,getFocusedState,expectFocusedText,expectFocusedElementToLookOrange,__internal:{chooseDirection,rangesOverlap,fallbackDirection,center}};
