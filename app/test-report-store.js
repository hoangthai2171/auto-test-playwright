"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const {
    createEmptyReport,
    buildTestReportEntry,
    upsertTestReport,
    renderUserReport,
} = require("./test-report");

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createOrderedTestReportStore({
    selectedCaseIds = [],
    reportJsonPath = "",
    reportHtmlPath = "",
    fsImpl = fs,
    createReport = createEmptyReport,
    buildEntry = buildTestReportEntry,
    upsert = upsertTestReport,
    render = renderUserReport,
    tempToken = () => `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
} = {}) {
    const order = new Map();
    for (const [index, id] of selectedCaseIds.map((value) => String(value ?? "").trim()).filter(Boolean).entries()) {
        if (!order.has(id)) order.set(id, index);
    }

    let report = createReport();
    let writeChain = Promise.resolve();

    function sortedReport(value) {
        const current = value && typeof value === "object" ? value : createReport();
        const tests = Array.isArray(current.tests) ? current.tests.slice() : [];
        tests.sort((left, right) => {
            const leftOrder = order.has(String(left?.id)) ? order.get(String(left.id)) : Number.MAX_SAFE_INTEGER;
            const rightOrder = order.has(String(right?.id)) ? order.get(String(right.id)) : Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder;
        });
        return {...current, tests};
    }

    async function writeAtomic(targetPath, content) {
        if (!targetPath) return;
        await fsImpl.mkdir(path.dirname(targetPath), {recursive: true});
        const temporaryPath = `${targetPath}.tmp-${tempToken()}`;
        try {
            await fsImpl.writeFile(temporaryPath, content, "utf8");
            await fsImpl.rename(temporaryPath, targetPath);
        } catch (error) {
            try {
                await fsImpl.unlink?.(temporaryPath);
            } catch {
                // The failed temporary write is not part of the report contract.
            }
            throw error;
        }
    }

    async function persist(nextReport) {
        const ordered = sortedReport(nextReport);
        const json = JSON.stringify(ordered, null, 2);
        const html = render(ordered);
        await writeAtomic(reportJsonPath, json);
        await writeAtomic(reportHtmlPath, html);
        report = ordered;
        return clone(report);
    }

    function enqueue(work) {
        const operation = writeChain.then(work);
        writeChain = operation.catch(() => {});
        return operation;
    }

    return {
        async reset({persist: shouldPersist = false} = {}) {
            return enqueue(async () => {
                const next = createReport();
                if (shouldPersist) return persist(next);
                report = sortedReport(next);
                return clone(report);
            });
        },

        async initialize() {
            return enqueue(async () => persist(createReport()));
        },

        async recordCaseCompletion({
            entry,
            testCaseId,
            testCaseName,
            exitCode,
            caseResult,
            errorMessage = "",
        } = {}) {
            return enqueue(async () => {
                const nextEntry = entry || buildEntry({testCaseId, testCaseName, exitCode, caseResult, errorMessage});
                const next = upsert(report, nextEntry);
                return persist(next);
            });
        },

        async flush() {
            await writeChain;
            return clone(report);
        },

        getReport() {
            return clone(report);
        },

        getOrder() {
            return [...order.entries()].sort((left, right) => left[1] - right[1]).map(([id]) => id);
        },
    };
}

module.exports = {createOrderedTestReportStore};
