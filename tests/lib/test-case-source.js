const fs = require("node:fs/promises");

const { validateTestCaseList } = require("./test-case-schema");

async function loadLocalTestCases(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return validateTestCaseList(JSON.parse(contents), filePath);
  } catch (error) {
    throw new Error(
      `Could not load test cases from ${filePath}: ${error.message}`,
      { cause: error }
    );
  }
}

async function loadCachedTestCases(cachePath, folderId) {
  let cache;
  try {
    cache = JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not load test-case cache from ${cachePath}: ${error.message}`,
      {cause: error}
    );
  }

  const entry = cache?.[String(folderId)];
  if (!entry || !Array.isArray(entry.cases)) {
    throw new Error(`Test case cache entry for folder "${String(folderId)}" not found`);
  }

  return validateTestCaseList(entry.cases, `${cachePath}#${String(folderId)}`);
}

function findTestCaseById(testCases, id) {
  const requestedId = String(id);
  const testCase = testCases.find(
    (candidate) => String(candidate.id) === requestedId
  );

  if (!testCase) {
    throw new Error(`Test case with id "${requestedId}" not found`);
  }

  return testCase;
}

module.exports = {loadLocalTestCases, loadCachedTestCases, findTestCaseById};
