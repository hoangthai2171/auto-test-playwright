"use strict";

const COMPATIBILITY_SCOPE = "lg-compatibility-product-gate";
const USERNAME_SECRET = "username";
const PASSWORD_SECRET = "password";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createLgCompatibilityProductGateCase({username, password} = {}) {
  const account = text(username);
  const secret = typeof password === "string" ? password : "";
  if (!account || !secret) throw new Error("LG compatibility credentials are required.");
  return Object.freeze({
    id: "lg-compatibility-product-gate",
    name: "LG compatibility product gate",
    actions: Object.freeze([
      Object.freeze({action: "login", username: account, password: secret}),
      Object.freeze({action: "open_home"}),
      Object.freeze({action: "open_search"}),
      Object.freeze({action: "search_content", name: "VTV1 HD", type: "channel"}),
      Object.freeze({action: "play_search_result", type: "channel"}),
    ]),
  });
}

function createLgCompatibilityCredentials({secrets} = {}) {
  if (!secrets || typeof secrets.getSecret !== "function" || typeof secrets.setSecret !== "function") {
    throw new Error("An encrypted LG compatibility secret store is required.");
  }

  async function values() {
    const username = text(await secrets.getSecret(COMPATIBILITY_SCOPE, USERNAME_SECRET));
    const password = String(await secrets.getSecret(COMPATIBILITY_SCOPE, PASSWORD_SECRET) || "");
    return {username, password};
  }

  return Object.freeze({
    async status() {
      try {
        const {username, password} = await values();
        return username && password
          ? {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}
          : {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"};
      } catch {
        return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
      }
    },
    async save({username, password} = {}) {
      const account = text(username);
      const secret = typeof password === "string" ? password : "";
      if (!account || !secret) return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_INVALID"};
      try {
        await secrets.setSecret(COMPATIBILITY_SCOPE, USERNAME_SECRET, account);
        await secrets.setSecret(COMPATIBILITY_SCOPE, PASSWORD_SECRET, secret);
        return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"};
      } catch {
        return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
      }
    },
    async load() {
      const credentials = await values();
      return credentials.username && credentials.password ? credentials : undefined;
    },
  });
}

module.exports = {createLgCompatibilityCredentials, createLgCompatibilityProductGateCase};
