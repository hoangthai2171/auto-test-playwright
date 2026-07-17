const base = require("playwright/test");
const {chromium} = require("playwright");
const path = require("node:path");
const fs = require("node:fs/promises");
const {getTestOptions} = require("../lib/mytv-helpers");

const VIEWPORT = {width: 1920, height: 1080};
const VIEWPORT_SCALE = 0.5;
const WINDOW_VIEWPORT = {
    width: Math.round(VIEWPORT.width * VIEWPORT_SCALE),
    height: Math.round(VIEWPORT.height * VIEWPORT_SCALE),
};

const test = base.test.extend({
    sharedContext: [
        async ({browser}, use) => {
            if (process.env.MYTV_INTERACTIVE_CDP_URL) {
                const cdpBrowser = await chromium.connectOverCDP(process.env.MYTV_INTERACTIVE_CDP_URL);
                const page = await waitForInteractivePage(cdpBrowser);
                await use(page.context());
                return;
            }

            const context = await browser.newContext({
                viewport: isLivePreviewMode() ? VIEWPORT : WINDOW_VIEWPORT,
            });

            await use(context);
            await context.close().catch(() => {});
        },
        {scope: "worker"},
    ],

    page: async ({sharedContext}, use) => {
        const page = process.env.MYTV_INTERACTIVE_CDP_URL
            ? await waitForPageInContext(sharedContext)
            : sharedContext.pages()[0] || (await sharedContext.newPage());
        await applyViewportScale(page);
        const stopPreview = await startPreviewStream(page);
        await use(page);
        stopPreview();
    },

    options: [
        async ({}, use) => {
            await use(getTestOptions());
        },
        {scope: "worker"},
    ],
});

async function applyViewportScale(page) {
    const scale = isLivePreviewMode()
        ? 1
        : Number(process.env.MYTV_INTERACTIVE_VIEW_SCALE || VIEWPORT_SCALE);
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setDeviceMetricsOverride", {
        ...VIEWPORT,
        deviceScaleFactor: 1,
        mobile: false,
        scale,
    });
}

function isLivePreviewMode() {
    return Boolean(process.env.MYTV_PREVIEW_PATH) && !process.env.MYTV_INTERACTIVE_CDP_URL;
}

async function startPreviewStream(page) {
    const previewPath = process.env.MYTV_PREVIEW_PATH;
    if (!previewPath) {
        return () => {};
    }

    await fs.mkdir(path.dirname(previewPath), {recursive: true});

    let busy = false;
    let stopped = false;
    const capture = async () => {
        if (busy || stopped || page.isClosed()) return;

        busy = true;
        try {
            const image = await page.screenshot({
                fullPage: false,
                timeout: 3000,
            });
            const tempPath = `${previewPath}.tmp`;
            await fs.writeFile(tempPath, image);
            await fs.rename(tempPath, previewPath);
        } catch {
            // The preview is best-effort and must never fail the test.
        } finally {
            busy = false;
        }
    };

    const timer = setInterval(capture, 1000);
    capture();

    return () => {
        stopped = true;
        clearInterval(timer);
    };
}

async function waitForInteractivePage(browser) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const page = browser
            .contexts()
            .flatMap((context) => context.pages())
            .find(isInteractiveBrowserPage);

        if (page) {
            return page;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Could not find Electron interactive browser page over CDP.");
}

async function waitForPageInContext(context) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const page = context
            .pages()
            .find(isInteractiveBrowserPage);

        if (page) {
            return page;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Could not find page in interactive context.");
}

function isInteractiveBrowserPage(page) {
    if (page.isClosed()) return false;

    const url = page.url();
    if (url.startsWith("devtools://") || url.startsWith("file://")) return false;

    const appUrl = process.env.APP_URL || "";
    if (appUrl) {
        try {
            return url.startsWith(new URL(appUrl).origin);
        } catch {
            return /^https?:\/\//.test(url);
        }
    }

    return /^https?:\/\//.test(url);
}

module.exports = {
    test,
    expect: base.expect,
};
