"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");

const {
    MAX_CONCURRENT_BROWSER_CASES,
    assertConcurrency,
    createBrowserBatchRunner,
} = require("../../app/browser-batch-runner");

function tick() {
    return new Promise((resolve) => setImmediate(resolve));
}

function createChild(id) {
    const child = new EventEmitter();
    child.id = id;
    child.pid = 1000 + Number(id.replace(/\D/g, "") || 0);
    child.exitCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.finish = (code = 0, signal = null) => {
        if (child.exitCode !== null) return;
        child.exitCode = code === null ? 143 : code;
        child.emit("exit", code, signal);
    };
    child.kill = (signal) => child.finish(null, signal);
    return child;
}

test("accepts only the configured simultaneous-device values", () => {
    assert.equal(MAX_CONCURRENT_BROWSER_CASES, 6);
    assert.equal(assertConcurrency(undefined), 6);
    assert.equal(assertConcurrency("1"), 1);
    assert.equal(assertConcurrency(2), 2);
    assert.equal(assertConcurrency("4"), 4);
    assert.equal(assertConcurrency(6), 6);
    for (const value of [0, 3, 5, 7, 1.5, "invalid"]) {
        assert.throws(() => assertConcurrency(value), {code: "BROWSER_BATCH_INVALID_CONCURRENCY"});
    }
});

test("runs the configured number of cases, refills a freed slot, and preserves result order", async () => {
    const children = new Map();
    const launches = [];
    const events = [];
    const runner = createBrowserBatchRunner({
        createBatchId: () => "batch-1",
        onEvent: (event) => events.push(event),
        launchCase: ({caseId, slotId, settings}) => {
            const child = createChild(caseId);
            children.set(caseId, child);
            launches.push({caseId, slotId, settings});
            return child;
        },
        readCaseResult: async ({caseId}) => ({testCaseId: caseId, status: "passed"}),
    });

    const completion = runner.start({
        caseIds: ["case-1", "case-2", "case-3", "case-4"],
        concurrency: 2,
        settings: {TEST_RESOLUTION: "1280x720", SIMULTANEOUS_DEVICES: "2"},
    });
    await tick();
    assert.deepEqual(launches.map(({caseId, slotId}) => [caseId, slotId]), [["case-1", 1], ["case-2", 2]]);
    assert.equal(runner.isRunning(), true);

    children.get("case-2").finish(0);
    await tick();
    assert.deepEqual(launches.map(({caseId, slotId}) => [caseId, slotId]), [["case-1", 1], ["case-2", 2], ["case-3", 2]]);

    children.get("case-1").finish(0);
    await tick();
    children.get("case-3").finish(0);
    await tick();
    children.get("case-4").finish(0);

    const result = await completion;
    assert.equal(runner.isRunning(), false);
    assert.deepEqual(result.caseRuns.map(({caseId, passed}) => [caseId, passed]), [
        ["case-1", true],
        ["case-2", true],
        ["case-3", true],
        ["case-4", true],
    ]);
    assert.equal(events.filter(({type}) => type === "case-started").length, 4);
    assert.equal(events.find(({type}) => type === "case-assigned" && type.caseId === "case-3"), undefined);
    assert.deepEqual(events.filter(({type}) => type === "case-assigned").map(({caseId, slotId}) => [caseId, slotId]), [
        ["case-1", 1],
        ["case-2", 2],
        ["case-3", 2],
        ["case-4", 1],
    ]);
});

test("supports limits 1, 4, and 6 without exceeding the selected value", async () => {
    for (const concurrency of [1, 4, 6]) {
        const children = [];
        const runner = createBrowserBatchRunner({
            launchCase: ({caseId}) => {
                const child = createChild(caseId);
                children.push(child);
                return child;
            },
        });
        const completion = runner.start({
            caseIds: Array.from({length: concurrency + 1}, (_value, index) => `case-${index + 1}`),
            concurrency,
        });
        await tick();
        assert.equal(children.length, concurrency);
        children.forEach((child) => child.finish(0));
        await tick();
        assert.equal(children.length, concurrency + 1);
        children.at(-1).finish(0);
        const result = await completion;
        assert.equal(Math.max(...result.caseRuns.map(({slotId}) => slotId || 0)), concurrency);
    }
});

test("redacts split log chunks and routes previews by batch, case, and slot", async () => {
    const children = [];
    const events = [];
    const cleanups = [];
    const runner = createBrowserBatchRunner({
        createBatchId: () => "batch-preview",
        onEvent: (event) => events.push(event),
        launchCase: ({caseId}) => {
            const child = createChild(caseId);
            children.push(child);
            return child;
        },
        createPreviewWatcher: async ({caseId, slotId, onFrame, onClear}) => {
            onFrame(`data:image/png;base64,${caseId}`);
            onClear();
            const cleanup = () => { cleanups.push(`${caseId}:${slotId}`); };
            return cleanup;
        },
    });

    const completion = runner.start({caseIds: ["case-1"], concurrency: 1});
    await tick();
    children[0].stdout.emit("data", "password: secret");
    children[0].stdout.emit("data", "\nready\n");
    children[0].finish(0);
    await completion;

    const log = events.filter(({type}) => type === "case-log").map(({text}) => text).join("");
    assert.doesNotMatch(log, /secret/);
    assert.match(log, /password: ••••••/);
    assert.ok(events.some(({type, batchId, caseId, slotId, dataUrl}) => type === "preview-frame" && batchId === "batch-preview" && caseId === "case-1" && slotId === 1 && dataUrl.includes("case-1")));
    assert.ok(events.some(({type, batchId, caseId, slotId}) => type === "preview-clear" && batchId === "batch-preview" && caseId === "case-1" && slotId === 1));
    assert.deepEqual(cleanups, ["case-1:1"]);
});

test("isolates a failed case and continues the queue", async () => {
    const children = new Map();
    const runner = createBrowserBatchRunner({
        launchCase: ({caseId}) => {
            const child = createChild(caseId);
            children.set(caseId, child);
            return child;
        },
    });

    const completion = runner.start({caseIds: ["case-1", "case-2", "case-3"], concurrency: 2});
    await tick();
    children.get("case-1").finish(1);
    await tick();
    assert.ok(children.has("case-3"));
    children.get("case-2").finish(0);
    await tick();
    children.get("case-3").finish(0);
    const result = await completion;
    assert.deepEqual(result.caseRuns.map(({caseId, passed}) => [caseId, passed]), [["case-1", false], ["case-2", true], ["case-3", true]]);
});

test("stops active children once, skips queued cases, and can start a fresh batch", async () => {
    const children = [];
    const runner = createBrowserBatchRunner({
        launchCase: ({caseId}) => {
            const child = createChild(caseId);
            children.push(child);
            return child;
        },
        wait: async () => {},
    });

    const first = runner.start({caseIds: ["case-1", "case-2", "case-3"], concurrency: 2});
    await tick();
    await runner.requestStop();
    const stopped = await first;
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.caseRuns.filter(({stopped: value}) => value).length, 2);
    assert.equal(stopped.caseRuns.find(({caseId}) => caseId === "case-3").skipped, true);
    assert.equal(children.filter(({exitCode}) => exitCode !== null).length, 2);
    assert.deepEqual(await runner.requestStop(), {ok: true, stopped: false});

    const freshChild = createChild("fresh");
    const freshRunner = createBrowserBatchRunner({launchCase: () => freshChild});
    const fresh = freshRunner.start({caseIds: ["fresh"], concurrency: 1});
    await tick();
    freshChild.finish(0);
    assert.equal((await fresh).caseRuns[0].passed, true);
});

test("rejects a concurrent batch start", async () => {
    const child = createChild("case-1");
    const runner = createBrowserBatchRunner({launchCase: () => child});
    const first = runner.start({caseIds: ["case-1"], concurrency: 1});
    await tick();
    await assert.rejects(() => runner.start({caseIds: ["case-2"], concurrency: 1}), {code: "BROWSER_BATCH_ACTIVE"});
    child.finish(0);
    await first;
});
