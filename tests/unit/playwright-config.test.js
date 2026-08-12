"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function loadConfig(resolution) {
    const previous = process.env.MYTV_TEST_RESOLUTION;
    if (resolution === undefined) delete process.env.MYTV_TEST_RESOLUTION;
    else process.env.MYTV_TEST_RESOLUTION = resolution;
    try {
        const configPath = require.resolve("../../playwright.config.js");
        delete require.cache[configPath];
        return require(configPath);
    } finally {
        if (previous === undefined) delete process.env.MYTV_TEST_RESOLUTION;
        else process.env.MYTV_TEST_RESOLUTION = previous;
    }
}

test("Playwright defaults to the supported 1280x720 Browser resolution", () => {
    const config = loadConfig();
    assert.deepEqual(config.use.viewport, {width: 1280, height: 720});
    assert.deepEqual(config.projects[0].use.viewport, {width: 1280, height: 720});
    assert.match(config.projects[0].use.launchOptions.args[0], /1280,720/);
    assert.equal(config.workers, 1);
});

test("Playwright accepts only the supported 1920x1080 Browser resolution", () => {
    const config = loadConfig("1920x1080");
    assert.deepEqual(config.use.viewport, {width: 1920, height: 1080});
    assert.deepEqual(config.projects[0].use.viewport, {width: 1920, height: 1080});
    assert.match(config.projects[0].use.launchOptions.args[0], /1920,1080/);
});

test("Playwright rejects unsupported resolution values through the shared fallback", () => {
    const config = loadConfig("2560x1440");
    assert.deepEqual(config.use.viewport, {width: 1280, height: 720});
    assert.deepEqual(config.projects[0].use.viewport, {width: 1280, height: 720});
});
