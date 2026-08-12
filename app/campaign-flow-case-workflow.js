function normalizeCaseId(testCase, label) {
  const id = String(testCase?.id ?? "").trim();
  if (!id) throw new Error(`${label} requires a testcase id.`);
  return id;
}

function assertUniqueCaseIds(testCases, label) {
  if (!Array.isArray(testCases)) throw new Error(`${label} must be an array.`);
  const seen = new Set();
  testCases.forEach((testCase, index) => {
    const id = normalizeCaseId(testCase, `${label}[${index}]`);
    if (seen.has(id)) throw new Error(`${label} contains duplicate testcase id ${id}.`);
    seen.add(id);
  });
  return seen;
}

function intersectCampaignCasesById(campaignCases, folderCases) {
  const campaignIds = assertUniqueCaseIds(campaignCases, "campaignCases");
  const folderIds = assertUniqueCaseIds(folderCases, "folderCases");
  if (campaignIds.size === 0 || folderIds.size === 0) return [];
  return campaignCases.filter((testCase) => folderIds.has(String(testCase.id).trim()));
}

function safeSubmissionFailure(errorOrResult) {
  const value = errorOrResult && typeof errorOrResult === "object" ? errorOrResult : {};
  const message = String(value.message ?? "Result submission failed.").trim() || "Result submission failed.";
  return {
    message,
    timeout: Boolean(value.timeout),
    unknown: Boolean(value.timeout),
  };
}

async function submitCampaignResultsOrdered({testcases, submitOne} = {}) {
  if (!Array.isArray(testcases) || testcases.length === 0) {
    throw new Error("Campaign result submission requires at least one testcase.");
  }
  if (typeof submitOne !== "function") throw new Error("A campaign result submitter is required.");

  const submittedTestcaseIds = [];
  const failedTestcaseIds = [];
  const unknownTestcaseIds = [];
  const failures = [];

  for (const [index, testCase] of testcases.entries()) {
    const id = normalizeCaseId(testCase, `testcases[${index}]`);
    try {
      const response = await submitOne(testCase);
      if (response?.ok !== true) {
        const failure = safeSubmissionFailure(response);
        if (failure.unknown) unknownTestcaseIds.push(id);
        else failedTestcaseIds.push(id);
        failures.push({id, ...failure});
        continue;
      }
      submittedTestcaseIds.push(id);
    } catch (error) {
      const failure = safeSubmissionFailure(error);
      if (failure.unknown) unknownTestcaseIds.push(id);
      else failedTestcaseIds.push(id);
      failures.push({id, ...failure});
    }
  }

  return {
    ok: failures.length === 0,
    submittedTestcaseIds,
    failedTestcaseIds,
    unknownTestcaseIds,
    retryTestcaseIds: [...failedTestcaseIds, ...unknownTestcaseIds],
    failures,
  };
}

module.exports = {
  intersectCampaignCasesById,
  submitCampaignResultsOrdered,
};
