---
type: "query"
date: "2026-08-05T03:33:35.134020+00:00"
question: "Why does the test status/result update request omit X-FlowTest-Service-Token?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["requestJson()", "submitFlowCaseResults()", "flow-case-api.js", "main.js", "renderer.js"]
---

# Q: Why does the test status/result update request omit X-FlowTest-Service-Token?

## Answer

The PATCH implementation is wired to send X-FlowTest-Service-Token, but only when the renderer passes a non-empty API_AUTHORIZATION value. The value comes from Settings > API Authorize, not from the test case login credentials. The default is empty; currentSettings() reads the live password input and converts an empty value to empty, then handleSubmit() copies it into FLOW_CASE_RESULT_CONTEXT, main IPC forwards it to submitFlowCaseResults(), and requestJson() omits the header when the trimmed value is empty. The UI request log redacts sensitive values, and the actual PATCH runs in Electron main-process fetch, so inspect the main-process apiLog/backend rather than BrowserView network logs. API-SPEC says PATCH by-folder requires the service token.

## Outcome

- Signal: useful

## Source Nodes

- requestJson()
- submitFlowCaseResults()
- flow-case-api.js
- main.js
- renderer.js