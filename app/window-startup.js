"use strict";

const DEFAULT_RENDERER_READY_TIMEOUT_MS = 5000;

function revealWindowOnFirstPaint(window, {
    rendererReadyTimeoutMs = DEFAULT_RENDERER_READY_TIMEOUT_MS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
} = {}) {
    let firstPaintReady = false;
    let rendererReady = false;
    let fallbackReady = false;
    let revealed = false;
    let fallbackTimer;

    const reveal = () => {
        if (revealed || !firstPaintReady || (!rendererReady && !fallbackReady) || window.isDestroyed()) return;
        revealed = true;
        if (fallbackTimer !== undefined) clearTimeoutFn(fallbackTimer);
        window.show();
    };

    window.once("ready-to-show", () => {
        firstPaintReady = true;
        reveal();
    });

    fallbackTimer = setTimeoutFn(() => {
        fallbackReady = true;
        reveal();
    }, rendererReadyTimeoutMs);
    fallbackTimer?.unref?.();

    window.once("closed", () => {
        if (fallbackTimer !== undefined) clearTimeoutFn(fallbackTimer);
    });

    return () => {
        rendererReady = true;
        reveal();
    };
}

module.exports = {DEFAULT_RENDERER_READY_TIMEOUT_MS, revealWindowOnFirstPaint};
