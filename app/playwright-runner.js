function buildPlaywrightTestArgs({playwrightCli, testResultsDir, tsconfigPath}) {
  return [
    playwrightCli,
    "test",
    "tests/run-test-case-mytv.spec.js",
    "--project=chromium",
    "--output",
    testResultsDir,
    "--tsconfig",
    tsconfigPath,
  ];
}

module.exports = {buildPlaywrightTestArgs};
