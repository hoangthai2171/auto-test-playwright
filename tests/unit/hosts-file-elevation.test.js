const test = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");
const {createMacOsScript, createWindowsCommand, createElevatedHostsFileWriter} = require("../../app/hosts-file-elevation");

test("builds a macOS administrator prompt without embedding raw host content", () => {
    const script = createMacOsScript("/etc/hosts", "127.0.0.1 localhost\n");
    assert.match(script, /with administrator privileges/);
    assert.match(script, /base64 -D/);
    assert.doesNotMatch(script, /127\.0\.0\.1 localhost/);
});

test("builds a Windows UAC command with encoded file content", () => {
    const command = createWindowsCommand("C:\\Windows\\System32\\drivers\\etc\\hosts", "127.0.0.1 localhost\n");
    assert.match(command, /Verb RunAs/);
    assert.match(command, /EncodedCommand/);
    assert.doesNotMatch(command, /127\.0\.0\.1 localhost/);
});

test("reports whether the native elevation prompt was accepted", async () => {
    const calls = [];
    const writer = createElevatedHostsFileWriter({
        platform: "darwin",
        spawn(command, args) {
            calls.push({command, args});
            const child = new EventEmitter();
            queueMicrotask(() => child.emit("exit", 0));
            return child;
        },
    });
    assert.equal(await writer("/etc/hosts", "entry\n"), true);
    assert.equal(calls[0].command, "/usr/bin/osascript");

    const deniedWriter = createElevatedHostsFileWriter({
        platform: "darwin",
        spawn() {
            const child = new EventEmitter();
            queueMicrotask(() => child.emit("exit", 1));
            return child;
        },
    });
    assert.equal(await deniedWriter("/etc/hosts", "entry\n"), false);
});
