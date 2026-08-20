const test = require("node:test");
const assert = require("node:assert/strict");

const {normalizeResultScreenshots} = require("../../app/test-result-screenshot");

test("keeps a canonical base64 WebP screenshot string", () => {
    assert.equal(normalizeResultScreenshots("V0VCUFJJRkY="), "V0VCUFJJRkY=");
    assert.equal(normalizeResultScreenshots("  V0VCUA==  "), "V0VCUA==");
});

test("strips a WebP data-url prefix before submitting the screenshot", () => {
    assert.equal(normalizeResultScreenshots("data:image/webp;base64,V0VCUA=="), "V0VCUA==");
    assert.equal(normalizeResultScreenshots("DATA:IMAGE/WEBP;BASE64,V0VCUA=="), "V0VCUA==");
});

test("drops screenshot values that are not base64 WebP", () => {
    assert.equal(normalizeResultScreenshots("data:image/png;base64,UE5H"), "");
    assert.equal(normalizeResultScreenshots("not base64!"), "");
    assert.equal(normalizeResultScreenshots("V0VCUA="), "");
    assert.equal(normalizeResultScreenshots(""), "");
    assert.equal(normalizeResultScreenshots(undefined), "");
    assert.equal(normalizeResultScreenshots(null), "");
    assert.equal(normalizeResultScreenshots(12345678), "");
});
