const test = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");
const {DEFAULT_HOST_ENTRY, resolveHostsFilePath, createHostsFileService} = require("../../app/hosts-file");

function createMemoryFs(initial = "") {
    let content = initial;
    return {
        async readFile() { return content; },
        async writeFile(_path, next) { content = next; },
        read() { return content; },
    };
}

test("resolves the hosts path for macOS and Windows", () => {
    assert.equal(resolveHostsFilePath({platform: "darwin"}), "/etc/hosts");
    assert.equal(resolveHostsFilePath({platform: "win32", env: {SystemRoot: "C:\\Windows"}}), "C:\\Windows\\System32\\drivers\\etc\\hosts");
});

test("adds and removes a normalized DNS host entry without changing other lines", async () => {
    const memoryFs = createMemoryFs("127.0.0.1 localhost\n");
    const service = createHostsFileService({fs: memoryFs, hostsFilePath: "/tmp/hosts"});

    assert.equal((await service.getStatus(DEFAULT_HOST_ENTRY)).exists, false);
    const added = await service.add("  172.16.240.254   html5stage.mytv.vn ");
    assert.equal(added.ok, true);
    assert.equal(added.exists, true);
    assert.match(memoryFs.read(), /127\.0\.0\.1 localhost/);
    assert.match(memoryFs.read(), /172\.16\.240\.254 html5stage\.mytv\.vn/);
    assert.equal((await service.add(DEFAULT_HOST_ENTRY)).status, "ALREADY_PRESENT");

    const removed = await service.remove(DEFAULT_HOST_ENTRY);
    assert.equal(removed.ok, true);
    assert.equal(removed.exists, false);
    assert.equal(memoryFs.read(), "127.0.0.1 localhost\n");
    assert.equal((await service.remove(DEFAULT_HOST_ENTRY)).status, "NOT_PRESENT");
});

test("rejects unsafe or malformed host entries", async () => {
    const service = createHostsFileService({fs: createMemoryFs(), hostsFilePath: "/tmp/hosts"});
    const response = await service.add("172.16.240.254 html5stage.mytv.vn\nmalicious");
    assert.equal(response.ok, false);
    assert.equal(response.status, "INVALID_ENTRY");
});

test("reports permission failures from the operating system", async () => {
    const fs = {
        async readFile() { return ""; },
        async writeFile() { const error = new Error("denied"); error.code = "EACCES"; throw error; },
    };
    const service = createHostsFileService({
        fs,
        hostsFilePath: "/etc/hosts",
        spawn() {
            const child = new EventEmitter();
            queueMicrotask(() => child.emit("exit", 1));
            return child;
        },
    });
    const response = await service.add(DEFAULT_HOST_ENTRY);
    assert.equal(response.ok, false);
    assert.equal(response.status, "PERMISSION_DENIED");
});
