const test = require("node:test");
const assert = require("node:assert/strict");

const {activateVerifiedTarget} = require("../lib/selector-validation");

test("accepts an exact focused poster ID when its label candidate is stale", async () => {
  let evaluateCalls = 0;
  const pressed = [];
  const page = {
    evaluate: async () => {
      evaluateCalls += 1;
      if (evaluateCalls === 1) {
        return {
          id: "homePage2_0_2",
          text: "",
          label: "",
          rect: {x: 460, y: 64, width: 292, height: 164},
        };
      }
      if (evaluateCalls === 2) {
        return {
          id: "homePage2_2_0",
          label: "791 Khánh Hòa",
          normalizedLabel: "791 khanh hoa",
          score: 0,
          secondScore: 0,
          scoreMargin: 0,
          rect: {x: 83, y: 468, width: 233, height: 131},
          visible: true,
          candidateCount: 67,
        };
      }
      return false;
    },
    keyboard: {
      press: async (key) => pressed.push(key),
    },
    waitForTimeout: async () => {},
  };

  await activateVerifiedTarget(page, {
    contractName: "contentItem",
    expectedId: "homePage2_0_2",
    expectedLabel: "Khom Lưng",
  });

  assert.deepEqual(pressed, ["Enter"]);
});
