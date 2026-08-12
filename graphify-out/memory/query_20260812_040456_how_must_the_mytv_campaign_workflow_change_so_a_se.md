---
type: "query"
date: "2026-08-12T04:04:56.689992+00:00"
question: "How must the MyTV campaign workflow change so a selected campaign can load cases without a folder while retaining optional folder filtering?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Campaign-scoped folder and testcase flow", "fetchFlowCases()", "loadCampaignCases()", "renderer.js", "test-case-cache.js", "requestJson()", "submitFlowCaseResults()"]
---

# Q: How must the MyTV campaign workflow change so a selected campaign can load cases without a folder while retaining optional folder filtering?

## Answer

Expanded from the original planning question via graph vocabulary: [campaign, testcase, folder, fetch, cache, renderer, ipc, batch, result, submission, main, api]. Verified that renderer.js currently requires a folder, main.js loads campaigns through fetchFlowCases with campaignId, test-case-cache.js already permits a folderless campaign entry, and flow-case-api.js centralizes the service-token header. The approval-ready design adds a dedicated campaign testcase GET, exact campaign/folder copy-ID intersection when a folder is selected, campaign-key caching with an optional folder, and per-case result PATCH with failed-only retry for folderless campaign runs.

## Outcome

- Signal: useful

## Source Nodes

- Campaign-scoped folder and testcase flow
- fetchFlowCases()
- loadCampaignCases()
- renderer.js
- test-case-cache.js
- requestJson()
- submitFlowCaseResults()