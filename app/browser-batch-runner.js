"use strict";

const {createLogRedactor} = require("./credential-redaction");
const {
    DEFAULT_SIMULTANEOUS_DEVICES,
    SIMULTANEOUS_DEVICE_OPTIONS,
    normalizeSimultaneousDevices,
} = require("./test-configuration");

const MAX_CONCURRENT_BROWSER_CASES = 6;

function defaultBatchId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCaseIds(caseIds) {
    const seen = new Set();
    const normalized = [];
    for (const value of Array.isArray(caseIds) ? caseIds : []) {
        const id = String(value ?? "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }
    return normalized;
}

function assertConcurrency(value) {
    if (value === undefined || value === null || value === "") {
        return DEFAULT_SIMULTANEOUS_DEVICES;
    }
    const candidate = typeof value === "string" ? Number(value.trim()) : value;
    if (!Number.isSafeInteger(candidate) || !SIMULTANEOUS_DEVICE_OPTIONS.includes(candidate) || candidate > MAX_CONCURRENT_BROWSER_CASES) {
        const error = new Error("Simultaneous devices must be one of 1, 2, 4, or 6.");
        error.code = "BROWSER_BATCH_INVALID_CONCURRENCY";
        throw error;
    }
    return candidate;
}

function safeEvent(onEvent, event) {
    try {
        onEvent(event);
    } catch {
        // Event delivery must never change the child lifecycle.
    }
}

function attachStream(stream, redactor) {
    stream?.on?.("data", (chunk) => redactor.push(chunk));
}

function onceExit(child, onExit) {
    let done = false;
    const finish = (result) => {
        if (done) return;
        done = true;
        onExit(result);
    };
    child?.once?.("error", (error) => finish({code: 1, signal: null, error}));
    child?.once?.("exit", (code, signal) => finish({code: code ?? 1, signal: signal || null}));
    if (child && child.exitCode !== null && child.exitCode !== undefined) {
        queueMicrotask(() => finish({code: child.exitCode ?? 1, signal: null}));
    }
    return finish;
}

async function defaultTerminateChild(child, {wait, graceMs = 250} = {}) {
    if (!child || typeof child.kill !== "function") return;
    try {
        child.kill("SIGTERM");
    } catch {
        return;
    }
    await wait(graceMs);
    if (child.exitCode !== null && child.exitCode !== undefined) return;
    try {
        child.kill("SIGKILL");
    } catch {
        // The child may have exited between the two signals.
    }
}

function createBrowserBatchRunner({
    launchCase,
    readCaseResult = async () => null,
    createPreviewWatcher,
    onEvent = () => {},
    createBatchId = defaultBatchId,
    createRedactor = createLogRedactor,
    terminateChild = defaultTerminateChild,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    stopGraceMs = 250,
} = {}) {
    if (typeof launchCase !== "function") throw new Error("An injected launchCase function is required.");
    if (typeof readCaseResult !== "function") throw new Error("An injected readCaseResult function is required.");

    let activeBatch = null;

    function emit(event) {
        safeEvent(onEvent, event);
    }

    async function runCase(context, state) {
        const {batchId, caseId, slotId} = context;
        let launched;
        let previewCleanup = null;
        let child = null;
        let stopChild = null;
        let stopped = false;
        let finished = false;
        let finishExit;

        const sendLog = (value) => {
            const text = String(value ?? "");
            if (!text) return;
            emit({type: "case-log", batchId, caseId, slotId, text});
        };
        const stdoutRedactor = createRedactor(sendLog);
        const stderrRedactor = createRedactor(sendLog);

        const finish = async (exit = {code: 1, signal: null, error: null}) => {
            if (finished) return state.caseRuns.get(caseId);
            finished = true;
            // Capture the stop decision when the child exits, before preview
            // cleanup or sidecar reads yield to another stop request. A case
            // that already exited before Stop was clicked remains eligible as
            // a completed result.
            const wasStopped = stopped || state.stopRequested;
            stdoutRedactor.flush();
            stderrRedactor.flush();
            if (typeof previewCleanup === "function") {
                try {
                    await previewCleanup();
                } catch {
                    // Preview cleanup is best-effort and cannot change test status.
                }
            }

            let caseResult = null;
            try {
                caseResult = await readCaseResult({...context, launched, child, exit});
            } catch (error) {
                exit = {...exit, error: exit.error || error};
            }

            const code = wasStopped ? null : Number(exit.code ?? 1);
            const passed = !wasStopped && code === 0 && !exit.error;
            const result = {
                id: caseId,
                caseId,
                slotId,
                started: Boolean(launched),
                passed,
                stopped: wasStopped,
                skipped: false,
                code,
                signal: exit.signal || null,
                caseResult,
                message: String(exit.error?.message || exit.message || ""),
            };
            state.caseRuns.set(caseId, result);
            state.active.delete(caseId);
            emit({
                type: "case-finished",
                batchId,
                caseId,
                slotId,
                status: wasStopped ? "stopped" : passed ? "passed" : "failed",
                code,
                signal: result.signal,
                started: result.started,
                message: result.message,
                caseResult,
            });
            return result;
        };

        try {
            launched = await launchCase(context);
            child = launched?.child || launched;
            stopChild = typeof launched?.stop === "function"
                ? launched.stop
                : () => terminateChild(child, {wait, graceMs: stopGraceMs});
            if (!child || typeof child.once !== "function") {
                throw new Error("Browser case launch did not return an owned child process.");
            }

            if (state.stopRequested) {
                stopped = true;
                await Promise.resolve(stopChild());
            }

            state.active.set(caseId, {
                caseId,
                slotId,
                child,
                stop: async () => {
                    if (stopped) return;
                    stopped = true;
                    await Promise.resolve(stopChild());
                },
            });
            attachStream(child.stdout, stdoutRedactor);
            attachStream(child.stderr, stderrRedactor);
            if (typeof createPreviewWatcher === "function") {
                previewCleanup = await createPreviewWatcher({
                    ...context,
                    child,
                    onFrame: (dataUrl) => emit({type: "preview-frame", batchId, caseId, slotId, dataUrl}),
                    onClear: () => emit({type: "preview-clear", batchId, caseId, slotId}),
                });
            }

            const exitPromise = new Promise((resolve) => {
                finishExit = (exit) => {
                    void finish(exit).then(resolve);
                };
                onceExit(child, finishExit);
            });
            return await exitPromise;
        } catch (error) {
            if (child && typeof stopChild === "function" && !finished) {
                try {
                    await Promise.resolve(stopChild());
                } catch {
                    // The original setup error remains authoritative.
                }
            }
            return finish({code: 1, signal: null, error});
        }
    }

    async function start({caseIds, concurrency, batchId = createBatchId(), settings = {}} = {}) {
        if (activeBatch) {
            const error = new Error("A Browser batch is already in progress.");
            error.code = "BROWSER_BATCH_ACTIVE";
            throw error;
        }

        const ids = normalizeCaseIds(caseIds);
        const limit = assertConcurrency(concurrency);
        const state = {
            batchId: String(batchId),
            ids,
            concurrency: limit,
            settings: {...settings},
            nextIndex: 0,
            stopRequested: false,
            active: new Map(),
            caseRuns: new Map(),
            slotAssignments: new Map(),
        };
        activeBatch = state;

        emit({type: "batch-started", batchId: state.batchId, concurrency: limit, settings: state.settings, caseIds: ids.slice()});
        ids.forEach((caseId) => emit({type: "case-queued", batchId: state.batchId, caseId}));

        const run = async () => {
            const runSlot = async (slotId) => {
                while (!state.stopRequested && state.nextIndex < ids.length) {
                    const caseId = ids[state.nextIndex++];
                    state.slotAssignments.set(slotId, caseId);
                    emit({type: "case-assigned", batchId: state.batchId, caseId, slotId, concurrency: limit, settings: state.settings});
                    emit({type: "case-started", batchId: state.batchId, caseId, slotId});
                    await runCase({batchId: state.batchId, caseId, slotId, settings: state.settings, concurrency: limit}, state);
                    state.slotAssignments.delete(slotId);
                }
            };

            await Promise.all(Array.from({length: limit}, (_value, index) => runSlot(index + 1)));
            for (const caseId of ids) {
                if (state.caseRuns.has(caseId)) continue;
                const result = {
                    id: caseId,
                    caseId,
                    slotId: null,
                    started: false,
                    passed: false,
                    stopped: false,
                    skipped: true,
                    code: null,
                    signal: null,
                    caseResult: null,
                    message: state.stopRequested ? "Skipped after stop was requested." : "Skipped.",
                };
                state.caseRuns.set(caseId, result);
                emit({type: "case-skipped", batchId: state.batchId, caseId, status: "skipped", message: result.message});
            }

            const caseRuns = ids.map((caseId) => state.caseRuns.get(caseId));
            const result = {
                ok: true,
                batchId: state.batchId,
                concurrency: limit,
                settings: state.settings,
                caseRuns,
                stopped: state.stopRequested,
            };
            emit({type: "batch-finished", batchId: state.batchId, concurrency: limit, settings: state.settings, stopped: state.stopRequested, caseRuns});
            if (activeBatch === state) activeBatch = null;
            return result;
        };

        state.promise = run().catch((error) => {
            if (activeBatch === state) activeBatch = null;
            emit({type: "batch-failed", batchId: state.batchId, message: error.message});
            throw error;
        });
        return state.promise;
    }

    async function requestStop() {
        const state = activeBatch;
        if (!state) return {ok: true, stopped: false};
        if (!state.stopRequested) {
            state.stopRequested = true;
            emit({type: "stop-requested", batchId: state.batchId});
        }
        await Promise.all([...state.active.values()].map((entry) => entry.stop()));
        await state.promise;
        return {ok: true, stopped: true, batchId: state.batchId};
    }

    return {
        start,
        requestStop,
        isRunning: () => Boolean(activeBatch),
        getActiveBatch: () => activeBatch,
    };
}

module.exports = {
    MAX_CONCURRENT_BROWSER_CASES,
    normalizeCaseIds,
    assertConcurrency,
    createBrowserBatchRunner,
};
