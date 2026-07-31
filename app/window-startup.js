"use strict";

function revealWindowOnFirstPaint(window) {
    window.once("ready-to-show", () => {
        if (!window.isDestroyed()) window.show();
    });
}

module.exports = {revealWindowOnFirstPaint};
