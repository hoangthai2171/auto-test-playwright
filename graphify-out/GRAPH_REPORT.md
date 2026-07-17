# Graph Report - auto-test-playwright  (2026-07-12)

## Corpus Check
- 25 files · ~26,925 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 468 nodes · 743 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- mytv-helpers.js
- AGENTS.md
- renderer.js
- mytv-session-fixture.js
- main.js
- MyTV Auto Test - Session Handoff Notes
- Playwright Interactive Skill
- run-headed.js
- package.json
- build
- MyTV Auto Test
- playAllItemsInFirstRow
- openSettings
- setSettingsMessage
- preparePreview
- install-playwright-browsers.js
- run-electron-app.js
- playwright.config.js
- syncModeFields
- graphify.js
- ai-row-selection.spec.js
- preload.js

## God Nodes (most connected - your core abstractions)
1. `remotePress()` - 27 edges
2. `MyTV Auto Test - Session Handoff Notes` - 18 edges
3. `playAllItemsInFirstRow()` - 16 edges
4. `Playwright Interactive Skill` - 15 edges
5. `remoteFocusById()` - 14 edges
6. `promptTtyValues()` - 12 edges
7. `openAppAndEnterLoginPage()` - 12 edges
8. `build` - 10 edges
9. `searchAndOpenBestContent()` - 10 edges
10. `getFocusedState()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `runAiPlan()` --calls--> `playAllItemsInFirstRow()`  [EXTRACTED]
  tests/lib/ai-plan-runner.js → tests/lib/mytv-helpers.js
- `runAiPlan()` --calls--> `openServiceFromLeftMenuOrAllServices()`  [EXTRACTED]
  tests/lib/ai-plan-runner.js → tests/lib/mytv-helpers.js
- `runAiPlan()` --calls--> `runStep()`  [EXTRACTED]
  tests/lib/ai-plan-runner.js → tests/lib/mytv-helpers.js

## Import Cycles
- None detected.

## Communities (23 total, 3 thin omitted)

### Community 0 - "mytv-helpers.js"
Cohesion: 0.06
Nodes (88): assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), attachFailureArtifacts(), attachMovieSearchFailureArtifacts(), attachSearchNoResultArtifacts(), center() (+80 more)

### Community 1 - "AGENTS.md"
Cohesion: 0.05
Nodes (42): 1. TV Remote Navigation, 2. Fuzzy Vietnamese Text Matching, 3. Element Location Strategy, 4. Content Row Detection, 5. Playback Verification, 6. Shared Browser Session, 7. Live Preview Stream, 8. Interactive Browser Mode (+34 more)

### Community 2 - "renderer.js"
Cohesion: 0.05
Nodes (35): AI_PROVIDER_OPTIONS, aiApiKeyInput, aiCustomModelInput, aiEndpointInput, aiModelSelect, aiProviderSelect, browserMuteButton, browserPreviewEmpty (+27 more)

### Community 3 - "mytv-session-fixture.js"
Cohesion: 0.08
Nodes (32): applyViewportScale(), base, {chromium}, fs, {getTestOptions}, isInteractiveBrowserPage(), isLivePreviewMode(), path (+24 more)

### Community 4 - "main.js"
Cohesion: 0.10
Nodes (25): {app, BrowserView, BrowserWindow, ipcMain, shell}, applyInteractiveViewZoom(), cleanQuotedValue(), createAiPlan(), createAiScopeError(), createLocalPlan(), createPlanWithAi(), createPlanWithGemini() (+17 more)

### Community 5 - "MyTV Auto Test - Session Handoff Notes"
Cohesion: 0.06
Nodes (31): `#advertise-popup` click fail do pointer intercepted, Advertise popup đặc biệt, AI manual mode, Các test hiện có, Cách chạy thường dùng, Cấu trúc chính, GUI Electron, Helper quan trọng (+23 more)

### Community 6 - "Playwright Interactive Skill"
Cohesion: 0.07
Nodes (27): Bootstrap (Run Once), Checklists, Choose Session Mode, Cleanup, Common Failure Modes, Core Workflow, Desktop Web Context, Dev Server (+19 more)

### Community 7 - "run-headed.js"
Cohesion: 0.13
Nodes (26): baseDefaults(), channelPlayModeQuestion, defaults, fs, main(), moviePlayModeQuestion, parseChannelPlayMode(), parseMoviePlayMode() (+18 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (25): electron, electron-builder, author, dependencies, playwright, description, devDependencies, electron (+17 more)

### Community 9 - "build"
Cohesion: 0.10
Nodes (19): build, appId, asar, directories, electronDist, extraResources, files, mac (+11 more)

### Community 10 - "MyTV Auto Test"
Cohesion: 0.11
Nodes (18): A.I Manual Mode, Browser Bundle Notes, Build Desktop App, Common Issues, DMG build fails, Electron binary failed to install, macOS, macOS blocks the app (+10 more)

### Community 11 - "playAllItemsInFirstRow"
Cohesion: 0.24
Nodes (13): attachFirstRowPlaybackReport(), contentItemSignature(), escapeHtml(), expectFocusedContent(), getFocusedContentMetadata(), imageDataUrl(), isFocusedContentItem(), isFocusedNearRow() (+5 more)

### Community 12 - "openSettings"
Cohesion: 0.25
Nodes (9): defaultAiSettings(), getSavedAiSettings(), loadSettingsIntoForm(), openLogs(), openSettings(), selectSettingsPanel(), suspendInteractiveBrowserForModal(), syncCustomModelField() (+1 more)

### Community 13 - "setSettingsMessage"
Cohesion: 0.33
Nodes (7): closeLogs(), closeSettings(), readSettingsForm(), resumeInteractiveBrowserAfterModal(), saveSettings(), setSettingsMessage(), testConnection()

### Community 14 - "preparePreview"
Cohesion: 0.29
Nodes (7): interactiveUrl(), preparePreview(), resetBrowserPreview(), setBrowserMuted(), showInteractiveBrowser(), showInteractiveBrowserBounds(), toggleBrowserMute()

### Community 15 - "install-playwright-browsers.js"
Cohesion: 0.33
Nodes (5): browsersPath, child, path, playwrightCli, { spawn }

### Community 16 - "run-electron-app.js"
Cohesion: 0.40
Nodes (4): child, electronPath, env, { spawn }

### Community 17 - "playwright.config.js"
Cohesion: 0.50
Nodes (3): { defineConfig, devices }, VIEWPORT, WINDOW_SIZE

### Community 18 - "syncModeFields"
Cohesion: 0.67
Nodes (3): setFormMessage(), syncModeFields(), toggleField()

## Knowledge Gaps
- **215 isolated node(s):** `path`, `fs`, `{spawn}`, `{app, BrowserView, BrowserWindow, ipcMain, shell}`, `testModes` (+210 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build` connect `build` to `package.json`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `IMPORTANT: keep the reminder string free of backticks and $(...) constructs.`, `path`, `fs` to the rest of the system?**
  _216 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mytv-helpers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05518394648829431 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `renderer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `mytv-session-fixture.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._