"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createLgCompatibilityCredentials,
  createLgCompatibilityProductGateCase,
} = require("../../app/lg-compatibility-product-gate");

test("builds the fixed local LG compatibility case from private credentials", () => {
  const testCase = createLgCompatibilityProductGateCase({username: "account", password: "secret"});

  assert.deepEqual(testCase, {
    id: "lg-compatibility-product-gate",
    name: "LG compatibility product gate",
    actions: [
      {action: "login", username: "account", password: "secret"},
      {action: "open_home"},
      {action: "open_search"},
      {action: "search_content", name: "VTV1 HD", type: "channel"},
      {action: "play_search_result", type: "channel"},
    ],
  });
});

test("rejects an incomplete local compatibility account", () => {
  assert.throws(() => createLgCompatibilityProductGateCase({username: "account"}), /credentials/i);
});

test("stores compatibility credentials only through the encrypted secret store", async () => {
  const stored = new Map();
  const secrets = {
    async getSecret(scope, name) { return stored.get(`${scope}:${name}`); },
    async setSecret(scope, name, value) { stored.set(`${scope}:${name}`, value); },
  };
  const credentials = createLgCompatibilityCredentials({secrets});

  assert.deepEqual(await credentials.status(), {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"});
  assert.deepEqual(await credentials.save({username: "account", password: "secret"}), {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"});
  assert.deepEqual(await credentials.status(), {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"});
  assert.deepEqual(await credentials.load(), {username: "account", password: "secret"});
});
