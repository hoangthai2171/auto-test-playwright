const test = require("node:test");
const assert = require("node:assert/strict");

const navigation = require("../lib/navigation");

test("refreshes target geometry while remote focus follows a reflowing row", async () => {
  let focused = {
    id: "source",
    text: "",
    label: "",
    rect: {x: 100, y: 0, width: 100, height: 80},
  };
  let targetRect = {x: 100, y: 500, width: 100, height: 80};
  const presses = [];

  const page = {
    evaluate: async () => focused,
    keyboard: {
      press: async (key) => {
        presses.push(key);
        if (key === "ArrowDown") {
          focused = {
            ...focused,
            id: "middle",
            rect: {x: 100, y: 200, width: 100, height: 80},
          };
          targetRect = {x: 100, y: 50, width: 100, height: 80};
        } else if (key === "ArrowUp") {
          focused = {
            ...focused,
            id: "target",
            rect: targetRect,
          };
        }
      },
    },
    waitForTimeout: async () => {},
  };

  await navigation.remoteFocus(page, {
    maxMoves: 3,
    isTarget: (state) => state.id === "target",
    getTargetRect: async () => targetRect,
  });

  assert.deepEqual(presses, ["ArrowDown", "ArrowUp"]);
});
