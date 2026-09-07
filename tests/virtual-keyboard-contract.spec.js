// Contract spec for typing through the app's on-screen keyboard. It drives the
// real `enterWithVirtualKeyboard` against a simulated keyboard that answers the
// remote the way the app does - arrows move focus between keys, Enter activates
// the focused key, and `#key-uppercase-v2` is a shift-lock that switches every
// letter key's label - so mixed-case entry is covered without a live app.
const {test, expect} = require("playwright/test");
const {
  enterWithVirtualKeyboard,
  readVirtualKeyboardUppercase,
  setVirtualKeyboardUppercase,
} = require("./lib/navigation");

const KEYBOARD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"],
  ["o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"],
  [".", "-", "_", "!", "@", "#", "$", "%", "^", "&", "*", "del", "uppercase"],
];

const KEY_IDS = {
  ".": "key-dot-v2",
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
  del: "key-del-v2",
  uppercase: "key-uppercase-v2",
};

async function createKeyboardPage(page, {uppercase = false, lockUppercase = false} = {}) {
  await page.setViewportSize({width: 1280, height: 720});
  await page.setContent(`
    <style>
      body { margin: 0; width: 1280px; height: 720px; background: #101114; color: #fff; font: 20px system-ui; }
      #typed { position: absolute; left: 420px; top: 200px; width: 440px; height: 44px; border: 1px solid #fff; text-align: center; line-height: 44px; }
      .kb-row { position: absolute; height: 46px; }
      .item-char { position: absolute; width: 46px; height: 46px; background: #2a2a2a; text-align: center; line-height: 46px; }
      .item-char.focused { background: #fff; color: #000; }
    </style>
    <div id="typed"></div>
    <div id="keyboard_v2"></div>
  `);

  await page.evaluate(({rows, keyIds, startUppercase, locked}) => {
    const board = document.getElementById("keyboard_v2");
    window.__kb = {uppercase: startUppercase, locked, presses: [], grid: []};

    rows.forEach((keys, rowIndex) => {
      const row = document.createElement("div");
      row.className = "kb-row";
      row.style.top = `${290 + rowIndex * 58}px`;
      // The app centers every keyboard row, and the rows have different
      // lengths, so centering is what makes diagonal remote navigation between
      // rows resolve the way it does on screen.
      row.style.left = `${Math.round((1280 - keys.length * 58) / 2)}px`;
      board.appendChild(row);
      const built = keys.map((key, columnIndex) => {
        const element = document.createElement("div");
        element.id = keyIds[key] || `key-${key}-v2`;
        element.className = "item-char";
        element.style.left = `${columnIndex * 58}px`;
        element.dataset.key = key;
        row.appendChild(element);
        return element;
      });
      window.__kb.grid.push(built);
    });

    render();
    focusKey(0, 0);

    document.addEventListener("keydown", (event) => {
      const position = focusedPosition();
      if (!position) return;
      const [rowIndex, columnIndex] = position;

      if (event.key === "ArrowRight") return focusKey(rowIndex, columnIndex + 1);
      if (event.key === "ArrowLeft") return focusKey(rowIndex, columnIndex - 1);
      if (event.key === "ArrowDown") return focusNearest(rowIndex + 1, columnIndex);
      if (event.key === "ArrowUp") return focusNearest(rowIndex - 1, columnIndex);
      if (event.key === "Enter") return activate(window.__kb.grid[rowIndex][columnIndex]);
      return undefined;
    });

    function activate(element) {
      const key = element.dataset.key;
      window.__kb.presses.push(key);
      const typed = document.getElementById("typed");

      if (key === "uppercase") {
        // `locked` simulates a keyboard whose shift key does not answer, so the
        // caller's failure path can be covered.
        if (!window.__kb.locked) window.__kb.uppercase = !window.__kb.uppercase;
        render();
        return;
      }
      if (key === "del") {
        typed.textContent = typed.textContent.slice(0, -1);
        return;
      }
      typed.textContent += /^[a-z]$/u.test(key) && window.__kb.uppercase ? key.toUpperCase() : key;
    }

    function render() {
      for (const row of window.__kb.grid) {
        for (const element of row) {
          const key = element.dataset.key;
          if (!/^[a-z]$/u.test(key)) continue;
          element.textContent = window.__kb.uppercase ? key.toUpperCase() : key;
        }
      }
    }

    function focusedPosition() {
      for (let rowIndex = 0; rowIndex < window.__kb.grid.length; rowIndex += 1) {
        const columnIndex = window.__kb.grid[rowIndex].findIndex((element) =>
          element.classList.contains("focused")
        );
        if (columnIndex >= 0) return [rowIndex, columnIndex];
      }
      return null;
    }

    function focusKey(rowIndex, columnIndex) {
      const row = window.__kb.grid[rowIndex];
      if (!row || !row[columnIndex]) return;
      document.querySelectorAll(".item-char.focused").forEach((element) => element.classList.remove("focused"));
      row[columnIndex].classList.add("focused");
    }

    function focusNearest(rowIndex, columnIndex) {
      const row = window.__kb.grid[rowIndex];
      if (!row) return;
      const source = window.__kb.grid.flat().find((element) => element.classList.contains("focused"));
      const sourceCenter = source.getBoundingClientRect().x + source.getBoundingClientRect().width / 2;
      let nearest = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      row.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.x + rect.width / 2 - sourceCenter);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearest = index;
        }
      });
      focusKey(rowIndex, nearest);
    }
  }, {rows: KEYBOARD_ROWS, keyIds: KEY_IDS, startUppercase: uppercase, locked: lockUppercase});
}

function typedText(page) {
  return page.locator("#typed").innerText();
}

function shiftPresses(page) {
  return page.evaluate(() => window.__kb.presses.filter((key) => key === "uppercase").length);
}

test("reads the keyboard case from the letter keys, not from the shift key", async ({page}) => {
  await createKeyboardPage(page);
  expect(await readVirtualKeyboardUppercase(page)).toBe(false);

  await setVirtualKeyboardUppercase(page, true);
  expect(await readVirtualKeyboardUppercase(page)).toBe(true);
});

test("presses the shift-lock only when the case has to change", async ({page}) => {
  await createKeyboardPage(page);

  expect(await setVirtualKeyboardUppercase(page, false)).toBe(true);
  expect(await shiftPresses(page)).toBe(0);

  expect(await setVirtualKeyboardUppercase(page, true)).toBe(true);
  expect(await setVirtualKeyboardUppercase(page, true)).toBe(true);
  expect(await shiftPresses(page)).toBe(1);
});

test("types an upper-case letter in the middle of a value", async ({page}) => {
  await createKeyboardPage(page);

  await enterWithVirtualKeyboard(page, "tS1");

  expect(await typedText(page)).toBe("tS1");
  // One press to switch on for "S"; a digit needs no case, so it stays on.
  expect(await shiftPresses(page)).toBe(1);
});

test("switches back to lower case after an upper-case run", async ({page}) => {
  await createKeyboardPage(page);

  await enterWithVirtualKeyboard(page, "ABc");

  expect(await typedText(page)).toBe("ABc");
  // On for "AB", off again for "c" - not once per letter.
  expect(await shiftPresses(page)).toBe(2);
});

test("types digits and symbols unchanged around a case switch", async ({page}) => {
  await createKeyboardPage(page);

  await enterWithVirtualKeyboard(page, "MyTV-Test_2026");

  expect(await typedText(page)).toBe("MyTV-Test_2026");
});

test("a lower-case value needs no case handling at all", async ({page}) => {
  await createKeyboardPage(page);

  await enterWithVirtualKeyboard(page, "ts1");

  expect(await typedText(page)).toBe("ts1");
  expect(await shiftPresses(page)).toBe(0);
});

test("a value typed while the keyboard opened in upper case still lands as written", async ({page}) => {
  await createKeyboardPage(page, {uppercase: true});

  await enterWithVirtualKeyboard(page, "ts1");

  expect(await typedText(page)).toBe("ts1");
  expect(await shiftPresses(page)).toBe(1);
});

test("a shift key that does not answer fails instead of typing the wrong case", async ({page}) => {
  await createKeyboardPage(page, {lockUppercase: true});

  await expect(enterWithVirtualKeyboard(page, "tS1"))
    .rejects.toThrow(/không chuyển được bàn phím ảo sang chế độ chữ in hoa/iu);
});

test("a keyboard with no case control still types a lower-case value", async ({page}) => {
  await createKeyboardPage(page);
  await page.evaluate(() => document.getElementById("key-a-v2").remove());

  await enterWithVirtualKeyboard(page, "ts1");

  expect(await typedText(page)).toBe("ts1");
  expect(await shiftPresses(page)).toBe(0);
});
