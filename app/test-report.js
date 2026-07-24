function collectFailedItems(caseResult) {
  const items = [];
  const seen = new Set();

  for (const step of caseResult?.steps || []) {
    collect(step?.result);
    collect(step?.details);
  }

  return items;

  function collect(value) {
    if (!value) return;
    if (Array.isArray(value.results)) {
      value.results.filter((item) => item?.status === "failed").forEach(add);
      return;
    }
    if (value.status === "failed") add(value);
  }

  function add(item) {
    const normalized = {
      name: String(item.name || item.title || "Unknown item"),
      poster: String(item.poster || ""),
      screenshot: String(item.screenshotDataUrl || ""),
    };
    const key = normalized.name + "|" + normalized.poster + "|" + normalized.screenshot;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(normalized);
  }
}

function buildTestReportEntry({testCaseId, testCaseName, exitCode, caseResult, errorMessage = ""}) {
  const status = exitCode === 0 && caseResult?.status !== "failed" ? "passed" : "failed";
  const failedStepMessage = (caseResult?.steps || [])
    .find((step) => step?.status === "failed" && step.message)
    ?.message || "";
  return {
    id: String(caseResult?.testCaseId || testCaseId),
    name: String(caseResult?.name || testCaseName || "Test case " + testCaseId),
    status,
    expectedResult: String(caseResult?.expectedResult || ""),
    completionScreenshot: String(caseResult?.completionScreenshotDataUrl || ""),
    failedItems: collectFailedItems(caseResult),
    error: status === "failed"
      ? String(errorMessage || failedStepMessage || (!caseResult ? "Test failed" : ""))
      : "",
  };
}

function createEmptyReport() {
  return {
    generatedAt: new Date().toISOString(),
    tests: [],
  };
}

function upsertTestReport(report, entry) {
  const current = report && typeof report === "object" ? report : createEmptyReport();
  const tests = Array.isArray(current.tests) ? current.tests.slice() : [];
  const index = tests.findIndex((item) => String(item.id) === String(entry.id));
  if (index >= 0) tests[index] = entry;
  else tests.push(entry);
  return {
    generatedAt: new Date().toISOString(),
    tests,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeImageSource(value) {
  const source = String(value || "");
  if (/^https?:\/\//iu.test(source) || /^data:image\//iu.test(source)) return source;
  return "";
}

function renderImage(source, alt, className) {
  const safeSource = safeImageSource(source);
  if (!safeSource) return "—";
  return '<img class="' + className + '" src="' + escapeHtml(safeSource) + '" alt="' + escapeHtml(alt) + '">';
}

function renderUserReport(report) {
  const tests = Array.isArray(report?.tests) ? report.tests : [];
  const body = tests.map((entry, index) => {
    const detailId = "test-details-" + index;
    const detailsButton = '<button type="button" class="details-button" data-details-target="' + detailId + '">Details</button>';
    const detailsRow = '<tr id="' + detailId + '" class="details-row hidden"><td colspan="4">' + renderTestDetails(entry) + "</td></tr>";

    return "<tr><td>" + escapeHtml(entry.id) + "</td><td>" + escapeHtml(entry.name) + '</td><td class="status-' + entry.status + '">' + escapeHtml(entry.status) + "</td><td>" + detailsButton + "</td></tr>" + detailsRow;
  }).join("");

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>MyTV Test Report</title><style>",
    "body{margin:0;padding:32px;background:#101114;color:#f2f4f8;font:14px system-ui,sans-serif}",
    "main{max-width:1100px;margin:auto}h1{margin:0 0 8px}.muted{color:#9aa3b2;margin:0 0 24px}",
    "table{width:100%;border-collapse:collapse;background:#17191f}th,td{padding:12px;border:1px solid #303541;text-align:left;vertical-align:middle}",
    "th{background:#222631;color:#cbd1dc}.status-passed{color:#46d083;font-weight:700;text-transform:capitalize}.status-failed{color:#ff7a7a;font-weight:700;text-transform:capitalize}",
    ".details-button{padding:6px 12px;border:1px solid #596579;border-radius:4px;background:#2a3140;color:#fff;cursor:pointer}",
    ".hidden{display:none}.details-row td{background:#0f1117;padding:18px}.detail-section+.detail-section{margin-top:18px}.detail-section h2{font-size:14px;margin:0 0 8px}.expected-result{margin:0;white-space:pre-wrap;word-break:break-word}.failure-table{background:#14161b}.failure-table th,.failure-table td{padding:10px}",
    ".poster{max-width:100px;max-height:120px;object-fit:contain}.screenshot{max-width:360px;max-height:220px;object-fit:contain;background:#050608}.completion-screenshot{max-width:560px;max-height:315px;object-fit:contain;background:#050608}.empty{color:#9aa3b2}",
    "</style></head><body><main><h1>MyTV Test Report</h1>",
    '<p class="muted">Generated ' + escapeHtml(report?.generatedAt || "") + "</p>",
    "<table><thead><tr><th>Test ID</th><th>Test Name</th><th>Status</th><th></th></tr></thead>",
    '<tbody>' + (body || '<tr><td colspan="4" class="empty">No tests have been run.</td></tr>') + "</tbody></table>",
    "<script>",
    'document.querySelectorAll("[data-details-target]").forEach(function(button){button.addEventListener("click",function(){var row=document.getElementById(button.dataset.detailsTarget);var hidden=row.classList.toggle("hidden");button.textContent=hidden?"Details":"Hide";});});',
    "</script></main></body></html>",
  ].join("");
}

function renderTestDetails(entry) {
  const expectedResult = '<section class="detail-section"><h2>Expected Result</h2><p class="expected-result">' +
    escapeHtml(entry.expectedResult || "Not provided") +
    "</p></section>";

  if (entry.status !== "passed") {
    return expectedResult + '<section class="detail-section"><h2>Failure Details</h2>' +
      renderFailedItems(entry) +
      "</section>" + renderCompletionScreenshot(entry, "Player Check Screenshot");
  }

  return expectedResult + renderCompletionScreenshot(entry, "Completion Screenshot");
}

function renderCompletionScreenshot(entry, heading) {
  if (!entry.completionScreenshot) return "";
  const alt = entry.status === "passed"
    ? "Screenshot after " + entry.name + " passed"
    : "Player-check screenshot after " + entry.name;
  return '<section class="detail-section"><h2>' + heading + "</h2>" +
    renderImage(
      entry.completionScreenshot,
      alt,
      "completion-screenshot"
    ) +
    "</section>";
}

function renderFailedItems(entry) {
  const items = Array.isArray(entry.failedItems) ? entry.failedItems : [];
  if (!items.length) {
    return '<div class="empty">' + escapeHtml(entry.error || "No failed item details were recorded.") + "</div>";
  }

  const rows = items.map((item) => (
    "<tr><td>" + escapeHtml(item.name) +
    "</td><td>" + renderImage(item.poster, "Poster for " + item.name, "poster") +
    "</td><td>" + renderImage(item.screenshot, "Screenshot for " + item.name, "screenshot") +
    "</td></tr>"
  )).join("");
  return '<table class="failure-table"><thead><tr><th>Failed Item Name</th><th>Poster</th><th>Screenshot</th></tr></thead><tbody>' + rows + "</tbody></table>";
}

module.exports = {
  createEmptyReport,
  buildTestReportEntry,
  upsertTestReport,
  renderUserReport,
  collectFailedItems,
};
