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

test("focuses a selector target through remote navigation without reading its label", async () => {
  let focused = {
    id: "experience",
    text: "Trải nghiệm ngay",
    label: "Trải nghiệm ngay",
    rect: {x: 100, y: 220, width: 180, height: 60},
  };
  let targetFocused = false;
  const targetRect = {x: 100, y: 100, width: 180, height: 60};
  const presses = [];

  const page = {
    evaluate: async (callback, argument) => {
      const source = String(callback);
      if (source.includes("classList.contains")) return targetFocused;
      if (typeof argument === "string") return targetRect;
      return focused;
    },
    keyboard: {
      press: async (key) => {
        presses.push(key);
        if (key === "ArrowUp") {
          targetFocused = true;
          focused = {
            id: "",
            text: "Đăng nhập",
            label: "Đăng nhập",
            rect: targetRect,
          };
        }
      },
    },
    waitForTimeout: async () => {},
  };

  await navigation.remoteFocusBySelector(page, '#welcome-button [data-btn-type="1"]', 2);

  assert.deepEqual(presses, ["ArrowUp"]);
});

test("waits for a target that is still rendering instead of failing on the first look", async () => {
  const targetRect = {x: 100, y: 100, width: 180, height: 60};
  const waits = [];
  let looks = 0;

  const page = {
    evaluate: async () => ({id: "target", text: "", label: "", rect: targetRect}),
    keyboard: {press: async () => {}},
    waitForTimeout: async (ms) => waits.push(ms),
  };

  await navigation.remoteFocus(page, {
    maxMoves: 3,
    isTarget: (state) => state.id === "target",
    // The row is still being built: the poster only has geometry on the third look.
    getTargetRect: async () => (++looks < 3 ? null : targetRect),
  });

  assert.equal(looks, 3);
  assert.deepEqual(waits, [200, 200]);
});

test("stops waiting for a target that never renders and names it in the error", async () => {
  const waits = [];
  const page = {
    // A string argument is the target-rect lookup, an object argument is the
    // focus containment check; neither ever finds the poster.
    evaluate: async (_callback, argument) => {
      if (typeof argument === "string") return null;
      if (argument && typeof argument === "object") return false;
      return {id: "elsewhere", text: "", label: "", rect: {x: 0, y: 0, width: 10, height: 10}};
    },
    keyboard: {press: async () => {}},
    waitForTimeout: async (ms) => waits.push(ms),
  };

  await assert.rejects(
    navigation.remoteFocusById(page, "specialModuleID_2_3", 5, {targetWaitMs: 1000}),
    /Không tìm thấy mục "specialModuleID_2_3" trên màn hình để đưa con trỏ tới sau 1 giây chờ/u
  );

  assert.deepEqual(waits, [200, 200, 200, 200]);
});

test("keeps a single look when a probe caller opts out of the wait", async () => {
  const waits = [];
  const page = {
    evaluate: async (_callback, argument) => {
      if (typeof argument === "string") return null;
      if (argument && typeof argument === "object") return false;
      return {id: "elsewhere", text: "", label: "", rect: {x: 0, y: 0, width: 10, height: 10}};
    },
    keyboard: {press: async () => {}},
    waitForTimeout: async (ms) => waits.push(ms),
  };

  await assert.rejects(
    navigation.remoteFocusById(page, "optional_button", 5, {targetWaitMs: 0}),
    /Không tìm thấy mục "optional_button" trên màn hình để đưa con trỏ tới \(/u
  );

  assert.deepEqual(waits, []);
});
