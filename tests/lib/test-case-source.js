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

module.exports = { loadLocalTestCases, findTestCaseById };
