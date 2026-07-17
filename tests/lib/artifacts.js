const {test}=require("playwright/test");

const dependencies={getFocusedState:async()=>null,collectMovieSearchCandidates:async()=>[],collectSearchResultCandidates:async()=>[]};
function configureArtifacts(next={}){Object.assign(dependencies,next);return module.exports;}
function getFocusedState(...args){return dependencies.getFocusedState(...args);}
function collectMovieSearchCandidates(...args){return dependencies.collectMovieSearchCandidates(...args);}
function collectSearchResultCandidates(...args){return dependencies.collectSearchResultCandidates(...args);}
function safeArtifactName(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"artifact";}
async function runStep(page, testInfo, title, action) {
  await test.step(title, async () => {
    try {
      await action();
    } catch (error) {
      await attachFailureArtifacts(page, testInfo, title, error);
      throw error;
    }
  });
}

async function attachCurrentAppScreenshot(page, testInfo, name) {
  await testInfo.attach(`${safeArtifactName(name)}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

async function attachMovieSearchFailureArtifacts(page, testInfo, movieName, error) {
  const artifactPrefix = safeArtifactName(`movie-search-${movieName}`);
  const candidates = await collectMovieSearchCandidates(page);

  await testInfo.attach(`${artifactPrefix}-not-found.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  await testInfo.attach(`${artifactPrefix}-not-found.json`, {
    body: JSON.stringify(
      {
        searchedMovieName: movieName,
        normalizedSearchedMovieName: normalizeVietnameseText(movieName),
        url: page.url(),
        focused: await getFocusedState(page).catch(() => null),
        error: {
          message: error?.message || String(error),
          stack: error?.stack || "",
        },
        visibleCandidates: candidates,
      },
      null,
      2
    ),
    contentType: "application/json",
  });
}

async function attachSearchNoResultArtifacts(page, testInfo, keyword) {
  const artifactPrefix = safeArtifactName(`search-${keyword}-no-result`);
  const candidates = await collectSearchResultCandidates(page, keyword);

  await testInfo.attach(`${artifactPrefix}.txt`, {
    body: `Không tìm thấy kết quả phù hợp cho từ khoá: ${keyword}`,
    contentType: "text/plain",
  });

  await testInfo.attach(`${artifactPrefix}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  await testInfo.attach(`${artifactPrefix}.json`, {
    body: JSON.stringify(
      {
        keyword,
        normalizedKeyword: normalizeVietnameseText(keyword),
        url: page.url(),
        focused: await getFocusedState(page).catch(() => null),
        visibleMatchedCandidates: candidates,
      },
      null,
      2
    ),
    contentType: "application/json",
  });
}

async function attachFailureArtifacts(page, testInfo, title, error) {
  const safeTitle = safeArtifactName(title);

  await testInfo.attach(`${safeTitle}-failure.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  await testInfo.attach(`${safeTitle}-failure-context.json`, {
    body: JSON.stringify(
      {
        step: title,
        url: page.url(),
        focused: await getFocusedState(page).catch(() => null),
        error: {
          message: error?.message || String(error),
          stack: error?.stack || "",
        },
      },
      null,
      2
    ),
    contentType: "application/json",
  });
}

async function attachFirstRowPlaybackReport(testInfo, results) {
  await testInfo.attach("first-row-playback-results.json", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  await testInfo.attach("first-row-playback-results.html", {
    body: renderPlaybackResultsHtml(results),
    contentType: "text/html",
  });
}

function renderPlaybackResultsHtml(results) {
  const rows = results
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(String(item.index))}</td>
          <td>${item.poster ? `<img class="poster" src="${escapeHtml(item.poster)}" alt="" />` : ""}</td>
          <td>${escapeHtml(item.title)}</td>
          <td class="${item.status === "playable" ? "ok" : "failed"}">${escapeHtml(item.status)}</td>
          <td>${renderPlaybackErrorCell(item)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { background: #f3f5f8; text-align: left; }
    .poster { width: 96px; max-height: 140px; object-fit: cover; }
    .error-cell { display: grid; gap: 8px; }
    .error-text { white-space: pre-wrap; word-break: break-word; }
    .error-screenshot { width: 320px; max-width: 100%; max-height: 220px; object-fit: contain; border: 1px solid #ddd; background: #111; }
    .error-screenshot-caption { color: #667085; font-size: 12px; }
    .ok { color: #087f3f; font-weight: 700; }
    .failed { color: #c62828; font-weight: 700; }
  </style>
</head>
<body>
  <h1>First-row playback results</h1>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Poster</th>
        <th>Tên nội dung</th>
        <th>Trạng thái</th>
        <th>Lỗi</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function renderPlaybackErrorCell(item) {
  const errorText = item.errorPopup || "";
  const screenshot = item.screenshotDataUrl || "";
  const screenshotName = item.screenshot || "";

  if (!errorText && !screenshot && !screenshotName) return "";

  return `
    <div class="error-cell">
      ${errorText ? `<div class="error-text">${escapeHtml(errorText)}</div>` : ""}
      ${
        screenshot
          ? `<img class="error-screenshot" src="${escapeHtml(screenshot)}" alt="${escapeHtml(`Screenshot lỗi ${item.title}`)}" />`
          : ""
      }
      ${screenshotName ? `<div class="error-screenshot-caption">${escapeHtml(screenshotName)}</div>` : ""}
    </div>`;
}

function imageDataUrl(buffer) {
  return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


module.exports={configureArtifacts,runStep,attachCurrentAppScreenshot,attachMovieSearchFailureArtifacts,attachSearchNoResultArtifacts,attachFailureArtifacts,attachFirstRowPlaybackReport,renderPlaybackResultsHtml,renderPlaybackErrorCell,imageDataUrl,escapeHtml,safeArtifactName};
