"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {createOrderedTestReportStore} = require("../../app/test-report-store");

async function createTempReportPaths() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mytv-report-store-"));
    return {
        directory,
        jsonPath: path.join(directory, "report.json"),
        htmlPath: path.join(directory, "report.html"),
    };
}

function completion(id, passed) {
    return {
        testCaseId: id,
        testCaseName: `Case ${id}`,
        exitCode: passed ? 0 : 1,
        caseResult: {
            testCaseId: id,
            name: `Case ${id}`,
            status: passed ? "passed" : "failed",
            steps: passed ? [] : [{status: "failed", message: `Failure ${id}`}],
        },
    };
}

test("serializes out-of-order completions and preserves selected order", async (t) => {
    const paths = await createTempReportPaths();
    t.after(() => fs.rm(paths.directory, {recursive: true, force: true}));
    const store = createOrderedTestReportStore({
        selectedCaseIds: ["case-1", "case-2", "case-3"],
        reportJsonPath: paths.jsonPath,
        reportHtmlPath: paths.htmlPath,
    });

    await store.initialize();
    await Promise.all([
        store.recordCaseCompletion(completion("case-3", true)),
        store.recordCaseCompletion(completion("case-1", true)),
        store.recordCaseCompletion(completion("case-2", false)),
    ]);
    const report = await store.flush();
    assert.deepEqual(report.tests.map(({id, status}) => [id, status]), [
        ["case-1", "passed"],
        ["case-2", "failed"],
        ["case-3", "passed"],
    ]);

    const persisted = JSON.parse(await fs.readFile(paths.jsonPath, "utf8"));
    assert.deepEqual(persisted.tests.map(({id}) => id), ["case-1", "case-2", "case-3"]);
    const html = await fs.readFile(paths.htmlPath, "utf8");
    assert.equal((html.match(/<tr><td>case-/g) || []).length, 3);
});

test("upserts a repeated completion without duplicating a case", async (t) => {
    const paths = await createTempReportPaths();
    t.after(() => fs.rm(paths.directory, {recursive: true, force: true}));
    const store = createOrderedTestReportStore({
        selectedCaseIds: ["case-1"],
        reportJsonPath: paths.jsonPath,
        reportHtmlPath: paths.htmlPath,
    });

    await store.initialize();
    await store.recordCaseCompletion(completion("case-1", false));
    await store.recordCaseCompletion(completion("case-1", true));
    const report = store.getReport();
    assert.equal(report.tests.length, 1);
    assert.equal(report.tests[0].status, "passed");
});

test("retains the previous in-memory report when an atomic write fails", async (t) => {
    const paths = await createTempReportPaths();
    t.after(() => fs.rm(paths.directory, {recursive: true, force: true}));
    let writes = 0;
    const fsImpl = {
        mkdir: fs.mkdir,
        writeFile: async (...args) => {
            writes += 1;
            if (writes === 3) throw new Error("disk full");
            return fs.writeFile(...args);
        },
        rename: fs.rename,
        unlink: fs.unlink,
    };
    const store = createOrderedTestReportStore({
        selectedCaseIds: ["case-1", "case-2"],
        reportJsonPath: paths.jsonPath,
        reportHtmlPath: paths.htmlPath,
        fsImpl,
    });

    await store.initialize();
    await assert.rejects(() => store.recordCaseCompletion(completion("case-1", true)), /disk full/);
    assert.deepEqual(store.getReport().tests, []);
});

