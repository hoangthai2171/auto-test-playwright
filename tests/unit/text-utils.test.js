const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeVietnameseText,
  fuzzyMatch,
} = require("../lib/text-utils");

test("normalizes Vietnamese content names to lowercase ASCII search text", () => {
  assert.equal(
    normalizeVietnameseText("Căn phòng tử thần"),
    "can phong tu than"
  );
  assert.equal(
    normalizeVietnameseText("ĐƯỜNG phố — Áo Ấm"),
    "duong pho — ao am"
  );
});

test("fuzzy content matching accepts normalized Vietnamese input", () => {
  assert.equal(
    fuzzyMatch("Căn phòng tử thần", "can phong tu than"),
    true
  );
  assert.equal(
    fuzzyMatch("Căn phòng tử thần", "phong tu than"),
    true
  );
});
