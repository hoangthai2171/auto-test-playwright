function redactSensitiveText(value) {
    return String(value ?? "")
        .replace(/((?:tài khoản|tai khoan|username|user)\s*[=:]?\s*[^\/\s,;:]+)\s*\/\s*([^\s]+)/gi, "$1/••••••")
        .replace(/((?:mật khẩu|mat khau|password)\s*[=:]?\s*)([^\s]+)/gi, "$1••••••")
        .replace(/(\"password\"\s*:\s*\")[^\"]*(\")/gi, "$1••••••$2");
}

function createLogRedactor(send) {
    let pending = "";
    return {
        push(chunk) {
            pending += String(chunk ?? "");
            const emitLength = pending.lastIndexOf("\n") + 1;
            if (emitLength === 0) return;
            send(redactSensitiveText(pending.slice(0, emitLength)));
            pending = pending.slice(emitLength);
        },
        flush() {
            if (!pending) return;
            send(redactSensitiveText(pending));
            pending = "";
        },
    };
}

module.exports = {redactSensitiveText, createLogRedactor};
