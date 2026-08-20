const test = require("node:test");
const assert = require("node:assert/strict");

const {buildCurlCommand, buildCurlCommands} = require("../../app/api-curl");

test("builds a cURL command for a GET API request", () => {
    const command = buildCurlCommand({
        method: "GET",
        url: "http://172.16.240.254:30100/api/v1/projects/1/flow-case-folders?campaignId=12",
        headers: {Accept: "application/json", "X-FlowTest-Service-Token": "real-service-token"},
        timeoutMs: 30000,
    });

    assert.equal(
        command,
        'curl -X GET "http://172.16.240.254:30100/api/v1/projects/1/flow-case-folders?campaignId=12" \\\n'
        + '  -H "Accept: application/json" \\\n'
        + '  -H "X-FlowTest-Service-Token: real-service-token"',
    );
    assert.doesNotMatch(command, /--max-time/);
});

test("builds a cURL command with the JSON body of a PATCH result submission", () => {
    const command = buildCurlCommand({
        method: "patch",
        url: "http://api.test/api/v1/projects/1/flow-cases/by-folder",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: {folderPath: "/Thai-test", testcases: [{id: "2786", testResult: {status: "success"}}]},
    });

    assert.match(command, /^curl -X PATCH "http:\/\/api\.test\/api\/v1\/projects\/1\/flow-cases\/by-folder" \\\n/);
    assert.match(command, /--data-binary '\{"folderPath":"\/Thai-test","testcases":\[\{"id":"2786","testResult":\{"status":"success"\}\}\]\}'$/);
    assert.doesNotMatch(command, /--max-time/);
});

test("escapes shell metacharacters in the URL, headers, and body", () => {
    const command = buildCurlCommand({
        method: "POST",
        url: 'http://api.test/q?name="a b"&cost=$5',
        headers: {"X-Note": 'say "hi" `now`'},
        body: {message: "Testcase's kết quả"},
    });

    assert.match(command, /curl -X POST "http:\/\/api\.test\/q\?name=\\"a b\\"&cost=\\\$5"/);
    assert.match(command, /-H "X-Note: say \\"hi\\" \\`now\\`"/);
    assert.match(command, /--data-binary '\{"message":"Testcase'\\''s kết quả"\}'/);
});

test("keeps a raw string body unchanged", () => {
    const command = buildCurlCommand({method: "POST", url: "http://api.test/raw", body: "id=2786&status=tested"});

    assert.match(command, /--data-binary 'id=2786&status=tested'$/);
});

test("collects every request of an ordered per-case submission", () => {
    const command = buildCurlCommands([
        {id: "2786", request: {method: "PATCH", url: "http://api.test/flow-cases/2786", body: {status: "tested"}}},
        {id: "2787", request: {method: "PATCH", url: "http://api.test/flow-cases/2787", body: {status: "tested"}}},
    ]);

    assert.equal(command.split("\n\n").length, 2);
    assert.match(command, /flow-cases\/2786/);
    assert.match(command, /flow-cases\/2787/);
});

test("returns an empty command when no HTTP request details exist", () => {
    assert.equal(buildCurlCommand(null), "");
    assert.equal(buildCurlCommand({method: "GET"}), "");
    assert.equal(buildCurlCommands([]), "");
    assert.equal(buildCurlCommands(undefined), "");
    assert.equal(buildCurlCommands([{request: null}, {}]), "");
    assert.equal(buildCurlCommands({request: {method: "GET", url: "http://api.test/one"}}), 'curl -X GET "http://api.test/one"');
});
