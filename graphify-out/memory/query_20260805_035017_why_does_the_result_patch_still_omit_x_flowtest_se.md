---
type: "query"
date: "2026-08-05T03:50:17.200076+00:00"
question: "Why does the result PATCH still omit X-FlowTest-Service-Token after API_AUTHORIZATION is configured?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["pendingResultSubmission", "setPendingResultSubmission()", "retryResultSync()", "buildFlowCaseResultSubmission()", "requestJson()", "submitFlowCaseResults()"]
---

# Q: Why does the result PATCH still omit X-FlowTest-Service-Token after API_AUTHORIZATION is configured?

## Answer

Live GUI logs show the initial Send flow-case results PATCH and subsequent Retry flow-case results requests contain only Accept and Content-Type, while later folder/case GETs contain the masked X-FlowTest-Service-Token. The result path captures API_AUTHORIZATION in FLOW_CASE_RESULT_CONTEXT at run start; after failure setPendingResultSubmission clones/freezes that payload, and retryResultSync submits the frozen pending payload without rereading current settings. Therefore configuring the token afterward fixes new GETs but not the already queued result retry. A fresh run after configuring the token should use the header; the durable fix is to refresh the token in the retry payload from current settings.

## Outcome

- Signal: useful

## Source Nodes

- pendingResultSubmission
- setPendingResultSubmission()
- retryResultSync()
- buildFlowCaseResultSubmission()
- requestJson()
- submitFlowCaseResults()