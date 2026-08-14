"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {applyAppEnvironment} = require("../lib/app-environment");

function createPage({evaluateResult = Promise.resolve()} = {}) {
    const calls = [];
    return {
        calls,
        waitForNavigation(options) {
            calls.push(["waitForNavigation", options]);
            return Promise.resolve();
        },
        evaluate(callback, value) {
            calls.push(["evaluate", callback.toString(), value]);
            return evaluateResult;
        },
    };
}

test("leaves ONLINE unchanged without evaluating page mode code", async () => {
    const page = createPage();

    const result = await applyAppEnvironment(page, "online");

    assert.deepEqual(result, {environment: "online", reloaded: false});
    assert.deepEqual(page.calls, []);
});

test("applies the fixed PILOT operation before waiting for index.html", async () => {
    const page = createPage();

    const result = await applyAppEnvironment(page, "pilot");

    assert.deepEqual(result, {environment: "pilot", reloaded: true});
    assert.equal(page.calls[0][0], "waitForNavigation");
    assert.equal(page.calls[1][0], "evaluate");
    assert.equal(page.calls[1][2], "pilot");
    assert.ok(page.calls[1][1].includes('gServerAAALink.setDomainAuthenUpdate("https://aaapilot1.mytv.vn/authen-ctl-v3", "https://aaapilot2.mytv.vn/authen-ctl-v3")'));
    assert.ok(page.calls[1][1].includes("gServerAAALink.setDevMode(APP_MODE.UPDATE)"));
    assert.match(page.calls[1][1], /window.location = 'index\.html'/);
});

test("applies STAGE without changing authentication domains", async () => {
    const page = createPage();

    await applyAppEnvironment(page, "stage");

    const script = page.calls[1][1];
    assert.equal(page.calls[1][2], "stage");
    assert.ok(script.includes("gServerAAALink.setDevMode(APP_MODE.ONLINE56)"));
    assert.doesNotMatch(script, /selectedEnvironment === "stage"[\s\S]*?setDomainAuthenUpdate/);
});

test("reports page bootstrap failures without accepting arbitrary code", async () => {
    const page = createPage({evaluateResult: Promise.reject(new Error("globals missing"))});

    await assert.rejects(
        () => applyAppEnvironment(page, "pilot"),
        /Failed to apply PILOT app environment: globals missing/,
    );

    const source = fs.readFileSync(path.join(__dirname, "../lib/app-environment.js"), "utf8");
    assert.doesNotMatch(source, /eval\s*\(|new Function/);
    assert.match(source, /window\.location = 'index\.html'/);
});
