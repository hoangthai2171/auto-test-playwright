"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {trustedLgToolchainNpmClosure} = require("../../app/lg-toolchain-npm-closure");

test("returns a cloned exact official npm closure for Appium and the LG driver", () => {
  const closure = trustedLgToolchainNpmClosure();
  closure.packages[""].dependencies.appium = "mutated";

  const trusted = trustedLgToolchainNpmClosure();
  assert.equal(trusted.lockfileVersion, 3);
  assert.deepEqual(trusted.packages[""].dependencies, {
    appium: "2.19.0",
    "appium-lg-webos-driver": "0.5.0",
  });
  const records = Object.entries(trusted.packages).filter(([name]) => name);
  assert.equal(records.length, 463);
  for (const [, record] of records) {
    assert.match(record.resolved, /^https:\/\/registry\.npmjs\.org\//);
    assert.match(record.integrity, /^sha512-[A-Za-z0-9+/=]+$/);
  }
});
