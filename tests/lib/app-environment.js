"use strict";

const {normalizeAppEnvironment} = require("../../app/test-configuration");

const PILOT_AUTHEN_PRIMARY = "https://aaapilot1.mytv.vn/authen-ctl-v3";
const PILOT_AUTHEN_SECONDARY = "https://aaapilot2.mytv.vn/authen-ctl-v3";

async function applyAppEnvironment(page, value) {
    const environment = normalizeAppEnvironment(value);
    if (environment === "online") {
        return {environment, reloaded: false};
    }

    const navigation = page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 90000,
    });

    try {
        await Promise.all([
            navigation,
            page.evaluate((selectedEnvironment) => {
                if (typeof gServerAAALink === "undefined" || typeof APP_MODE === "undefined") {
                    throw new Error("The MyTV app environment globals are not available.");
                }

                if (selectedEnvironment === "pilot") {
                    gServerAAALink.setDomainAuthenUpdate("https://aaapilot1.mytv.vn/authen-ctl-v3", "https://aaapilot2.mytv.vn/authen-ctl-v3");
                    gServerAAALink.setDevMode(APP_MODE.UPDATE);
                } else if (selectedEnvironment === "stage") {
                    gServerAAALink.setDevMode(APP_MODE.ONLINE56);
                } else {
                    throw new Error(`Unsupported app environment: ${selectedEnvironment}`);
                }

                window.location = 'index.html';
            }, environment),
        ]);
    } catch (error) {
        throw new Error(`Failed to apply ${environment.toUpperCase()} app environment: ${error?.message || String(error)}`);
    }

    return {environment, reloaded: true};
}

module.exports = {
    PILOT_AUTHEN_PRIMARY,
    PILOT_AUTHEN_SECONDARY,
    applyAppEnvironment,
};
