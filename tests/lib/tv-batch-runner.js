"use strict";

const {TV_FAILURE_KIND, classifyTvFailure} = require("./tv-failure-classification");

const STOPPED_BY_USER = "stopped_by_user";
const PAIRING_REQUIRED = "PAIRING_REQUIRED";

function assertCases(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new TypeError("A non-empty TV case batch is required.");
  return cases;
}

function stoppedCase(testCase) {
  return Object.freeze({id: String(testCase?.id ?? ""), status: STOPPED_BY_USER});
}

function completedCase(testCase, result, failure) {
  return Object.freeze({
    id: String(testCase?.id ?? ""),
    status: failure ? "failed" : "passed",
    result: result || errorResult(testCase, failure),
    ...(failure ? {failure} : {}),
  });
}

function errorResult(testCase, failure) {
  return Object.freeze({
    testCaseId: String(testCase?.id ?? ""),
    name: String(testCase?.name ?? ""),
    status: "failed",
    steps: [],
    failure,
  });
}

function requireMethod(value, name) {
  if (typeof value !== "function") throw new TypeError(`TV batch ${name}() is required.`);
  return value;
}

async function requestOperatorDecision(requestDecision, details) {
  const decision = await requireMethod(requestDecision, "requestDecision")(details);
  if (decision === "keep_retrying" || decision === "stop") return decision;
  throw new Error("TV recovery requires an explicit keep_retrying or stop decision.");
}

async function runTvCaseBatch({cases, executeCase, recover = async () => {}, requestDecision} = {}) {
  const selectedCases = assertCases(cases);
  const runCase = requireMethod(executeCase, "executeCase");
  const recoverCase = requireMethod(recover, "recover");
  const completed = [];

  for (let index = 0; index < selectedCases.length; index += 1) {
    const testCase = selectedCases[index];
    let attemptsInCycle = 0;

    while (true) {
      try {
        const result = await runCase(testCase, {caseIndex: index, attempt: attemptsInCycle + 1});
        completed.push(completedCase(testCase, result));
        break;
      } catch (error) {
        const failure = classifyTvFailure(error);
        const result = error?.testCaseResult || errorResult(testCase, failure);
        if (failure.kind === TV_FAILURE_KIND.business) {
          completed.push(completedCase(testCase, result, failure));
          break;
        }

        if (failure.code === PAIRING_REQUIRED) {
          const decision = await requestOperatorDecision(requestDecision, {
            reason: "pairing_required",
            caseId: String(testCase?.id ?? ""),
            code: failure.code,
            error,
          });
          if (decision === "keep_retrying") continue;
          return Object.freeze({
            status: STOPPED_BY_USER,
            completed: Object.freeze(completed),
            stopped: Object.freeze(selectedCases.slice(index).map(stoppedCase)),
          });
        }

        attemptsInCycle += 1;
        if (attemptsInCycle < 3) {
          await recoverCase({caseId: String(testCase?.id ?? ""), caseIndex: index, attempt: attemptsInCycle, code: failure.code, error});
          continue;
        }

        const decision = await requestOperatorDecision(requestDecision, {
          reason: "technical_recovery_exhausted",
          caseId: String(testCase?.id ?? ""),
          caseIndex: index,
          attempt: attemptsInCycle,
          code: failure.code,
          error,
        });
        if (decision === "keep_retrying") {
          attemptsInCycle = 0;
          continue;
        }
        return Object.freeze({
          status: STOPPED_BY_USER,
          completed: Object.freeze(completed),
          stopped: Object.freeze(selectedCases.slice(index).map(stoppedCase)),
        });
      }
    }
  }

  return Object.freeze({status: "completed", completed: Object.freeze(completed), stopped: Object.freeze([])});
}

module.exports = {PAIRING_REQUIRED, STOPPED_BY_USER, runTvCaseBatch};
