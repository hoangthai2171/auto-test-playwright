# Graph Report - auto-test-playwright  (2026-08-14)

## Corpus Check
- 262 files · ~276,713 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3119 nodes · 4806 edges · 185 communities (175 shown, 10 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 467 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bef3d878`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- lastKnownHost
- findServiceIdInAllServices
- preparePreview
- install-playwright-browsers.js
- run-electron-app.js
- playwright.config.js
- dom-scanning-performance.spec.js
- graphify.js
- ai-row-selection.spec.js
- preload.js
- IDEA.md
- content-rows.js
- workflows.js
- Real-TV Appium Handoff Ledger
- lg-webos-poc.js
- waits.js
- Current Samsung macOS command harness
- tizen-poc.js
- tizen-poc-semantic.js
- tizen-poc-core.js
- playFocusedContent
- Server-Driven MyTV Test Case Runner
- FakeElement
- test-case-action-runner.js
- selector-validation.js
- window-close-controller.test.js
- lg-webos-case-runner-core.test.js
- Architecture
- artifacts.js
- mytv-helpers.legacy.js
- test-report.js
- navigation.js
- run-test-case-tv.spec.js
- remotePress
- tv-runner.test.js
- Phase 1 implementation and findings — 2026-07-24
- tv-runner.js
- lastKnownHost
- device-discovery.test.js
- tv-toolchain-config.js
- content-rows.test.js
- getFocusedState
- webos-mytv-automation.js
- lg-cli-archive-importer.js
- lg-cli-import-operations.js
- Server-Driven Test Case Runner Implementation Plan
- scripts
- tizen-poc-login.js
- run-test-case-mytv.spec.js
- test-case-compiler.js
- API Testcase
- openMovieContentByName
- test-case-cache.test.js
- tv-toolchain.test.js
- webos-read-only-adapter.js
- index.js
- File structure
- window-startup.test.js
- target-action-runner.js
- test-case-source.test.js
- dom-session.js
- flow-case-api.js
- lg-managed-install-operations.test.js
- tv-case-runner.js
- test-case-schema.js
- tv-session.test.js
- tv-batch-runner.test.js
- lg-toolchain-manifest.js
- Target selector and workspace behavior
- tv-device-ipc.test.js
- AGENTS.md
- service-access.spec.js
- lg-toolchain-installer.js
- webos-target-registration.js
- Internal TV-Lab Lease Service
- opencode.json
- openAppAndEnterLoginPage
- openLeftMenuFromHome
- lg-toolchain-detector.js
- Architecture and Contracts
- defaultPackageVersion
- Phased Delivery Plan
- GEMINI.md
- finishTestProcess
- tv-session.test.js
- createScopedDomScanner
- appium-server-manager.test.js
- test-case-action-runner.test.js
- app-cleanup.test.js
- required
- lg-toolchain-manifest.test.js
- createdAt
- readiness-pacing.spec.js
- lg-toolchain-manifest.test.js
- focusRequestedContentRow
- device-profile-service.js
- searchAndOpenBestContent
- redactSensitiveText
- device-secret-store.test.js
- device-profile.schema.json
- resolve
- play-movie-mytv.spec.js
- osVersion
- playAllItemsInFirstRow
- tv-batch-runner.test.js
- browser-toolchain-ipc.test.js
- lg-toolchain-installer.test.js
- tv-batch-runner.test.js
- Campaign refresh and service-token header follow-up
- tv-device-ipc.js
- target-action-context.js
- devices
- login-popups.js
- defaultPackagePath
- dom-snapshot.spec.js
- tizen-poc-semantic.test.js
- lastKnownHost
- test-configuration.js
- HANDOFF.md
- Campaign refresh and service-token header follow-up
- lg-compatibility-catalog-service.test.js
- Target selector and workspace behavior
- Target selector and workspace behavior
- files
- run-electron-app.js
- lg-toolchain-manifest.test.js
- appId
- enum
- playwright-runner.test.js
- HANDOFF.md
- Real-TV Appium Delivery Plan
- openMovieContentByName
- label
- navigation.test.js
- compilerOptions
- Device Compatibility Check
- defaultPackageVersion
- tv-batch-runner.js
- service-access.spec.js
- preload.test.js
- defaultPackageVersion
- createRendererController
- enum
- graphify.js
- playwright.config.js
- flow-case-api.test.js
- lg-webos-poc-core.js
- App-deployment decision supplied by the user
- browser-run-launcher.test.js
- appId
- enum
- .querySelectorAll
- model
- notes
- tv-batch-runner.test.js
- device-discovery.js
- service-access.spec.js
- graphify.js
- createWebOsAppiumSession
- preload.js
- App-deployment decision supplied by the user
- lg-cli-operator-guide.md
- createWebOsMyTvAutomation
- test-case-action-runner.test.js
- findServiceIdInAllServices
- openLeftMenuFromHome
- openFocusedContentForPlayback
- navigation.test.js
- createdAt
- defaultPackageVersion

## God Nodes (most connected - your core abstractions)
1. `Real-TV Appium Handoff Ledger` - 51 edges
2. `runPoc()` - 42 edges
3. `normalizeVietnameseText()` - 33 edges
4. `Current Samsung macOS command harness` - 31 edges
5. `remotePress()` - 27 edges
6. `runPoc()` - 26 edges
7. `resolve()` - 23 edges
8. `createContentRowsApi()` - 21 edges
9. `File Impact and Detailed Changes` - 21 edges
10. `Phase 1 implementation and findings — 2026-07-24` - 20 edges

## Surprising Connections (you probably didn't know these)
- `createBrowserToolchain()` --indirect_call--> `resolve()`  [INFERRED]
  app/browser-toolchain.js → tests/unit/tv-toolchain.test.js
- `createLgCliArchiveImporter()` --indirect_call--> `importArchive()`  [INFERRED]
  app/lg-cli-archive-importer.js → tests/unit/tv-device-ipc.test.js
- `createLgCompatibilityCatalogService()` --indirect_call--> `refresh()`  [INFERRED]
  app/lg-compatibility-catalog-service.js → tests/unit/tv-device-ipc.test.js
- `registerLgCompatibilityIpc()` --indirect_call--> `response()`  [INFERRED]
  app/lg-compatibility-ipc.js → tests/unit/loopback-appium-client.test.js
- `createRunCloseGuard()` --indirect_call--> `resolve()`  [INFERRED]
  app/run-close-guard.js → tests/unit/tv-toolchain.test.js

## Import Cycles
- None detected.

## Communities (185 total, 10 thin omitted)

### Community 0 - "mytv-helpers.js"
Cohesion: 0.02
Nodes (94): {app, BrowserView, BrowserWindow, dialog, ipcMain, safeStorage, shell}, applyInteractiveViewZoom(), browserRoot, browserRunLauncher, browserToolchain, browserToolchainInstaller, {buildPlaywrightTestArgs}, bundledLgCompatibilityCatalog (+86 more)

### Community 1 - "AGENTS.md"
Cohesion: 0.06
Nodes (43): {acceptDeviceLimitPopupIfVisible, acceptUserConsentPopupIfVisible}, {applyAppEnvironment}, artifacts, assertServiceOpened(), assertViewMoreOpened(), attachServiceOpenFailure(), chooseFirstProfileAndEnterHome(), closeAdvertisePopupIfVisible() (+35 more)

### Community 2 - "renderer.js"
Cohesion: 0.05
Nodes (47): assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), attachPlaybackTimeout(), attachPlayerFailureArtifacts(), closePlayerOrDetail(), {DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS} (+39 more)

### Community 3 - "mytv-session-fixture.js"
Cohesion: 0.10
Nodes (49): activateVerifiedTarget(), collectFirstRowPlayableItems(), collectVisibleContentRows(), collectVisibleHomePageRow(), configureContentRows(), CONTENT_ITEM_CONTRACT, contentItemSignature(), createContentRowsApi() (+41 more)

### Community 4 - "main.js"
Cohesion: 0.11
Nodes (15): caseRun(), createLgDesktopBatchRunner(), {DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS, normalizePlayerCheckTimeoutSeconds}, requireMethod(), SAFE_EVENT_CODES, safeExecutionResult(), text(), TV_CAPABILITIES (+7 more)

### Community 5 - "MyTV Auto Test - Session Handoff Notes"
Cohesion: 0.04
Nodes (49): Artifact decision supplied by the user, Batch-failure decision supplied by the user, Blocking questions — answer before phase 1, Browser configuration local contracts — 2026-07-29, Chosen architecture, Compatibility catalog maintainer workflow, Current LG device dialog, Current repository facts (+41 more)

### Community 6 - "Playwright Interactive Skill"
Cohesion: 0.13
Nodes (14): acceptDeviceLimitPopupIfVisible(), acceptUserConsentPopupIfVisible(), navigation, {POPUP_FOCUS_DIALOG_IDS}, waitForDeviceLimitPopupDismissed(), waitForDeviceLimitPopupOrProfile(), waitForUserConsentCheckboxChecked(), waitForUserConsentPopup() (+6 more)

### Community 7 - "run-headed.js"
Cohesion: 0.04
Nodes (44): Acceptance criteria, `ACTION-COMPILER.md`, `AGENTS.md`, `app/test-report.js`, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings, Desired outcome (+36 more)

### Community 8 - "package.json"
Cohesion: 0.05
Nodes (43): Acceptance criteria, `AGENTS.md`, `app/browser-batch-runner.js`, `app/main.js`, `app/preload.js`, `app/renderer/index.html`, `app/renderer/renderer.js`, `app/renderer/styles.css` (+35 more)

### Community 9 - "build"
Cohesion: 0.10
Nodes (42): appiumHome, appiumRequest(), commandVersion(), assertSafeLgAppId(), buildLgCapabilities(), buildLgPocEnvironment(), buildLgRuntimeRedactionSecrets(), captureGenuinePocEvidence() (+34 more)

### Community 10 - "MyTV Auto Test"
Cohesion: 0.06
Nodes (31): 2022 Samsung pilot authorized test-app installation — 2026-07-27, 2022 Samsung pilot default screenshot-gate attempt — 2026-07-27, 2022 Samsung pilot DOM-only partial attempt — 2026-07-27, 2022 Samsung pilot foreground-context check — 2026-07-27, 2022 Samsung pilot fresh-pairing recovery check — 2026-07-27, 2022 Samsung pilot one-key readiness diagnostic — 2026-07-27, 2022 Samsung pilot paired screenshot-gate retry — 2026-07-27, 2022 Samsung pilot read-only preflight — 2026-07-27 (+23 more)

### Community 11 - "playAllItemsInFirstRow"
Cohesion: 0.09
Nodes (35): activateVerifiedTarget(), assertFocusedTarget(), assertSelectorHealth(), captureActivationDiagnostics(), collectSelectorDiagnostics(), DEFAULT_MATCH_OPTIONS, describeVerificationFailure(), fuzzyLabelMatch() (+27 more)

### Community 12 - "lastKnownHost"
Cohesion: 0.11
Nodes (39): appiumEnvironment(), appiumHome, appiumRequest(), captureEvidence(), commandVersion(), capturePocEvidence(), doctor(), evidenceRoot (+31 more)

### Community 13 - "findServiceIdInAllServices"
Cohesion: 0.12
Nodes (31): applyInteractiveViewFitZoom(), finishTestProcess(), reportPath(), stopActiveTest(), stopPreviewWatcher(), userReportHtmlPath(), userReportJsonPath(), writeLgReportEntry() (+23 more)

### Community 14 - "preparePreview"
Cohesion: 0.06
Nodes (33): Chuyển đổi xác định, Credential đăng nhập, Danh sách action cho phép và validate, Grammar nguồn được hỗ trợ, Hướng dẫn biên dịch action, Hợp đồng bắt buộc, Phân công và lỗi, Quy tắc runtime cần giữ (+25 more)

### Community 15 - "install-playwright-browsers.js"
Cohesion: 0.06
Nodes (34): Acceptance criteria, `AGENTS.md`, `app/campaign-flow-case-workflow.js`, `app/flow-case-api.js`, `app/main.js`, `app/renderer/renderer.js`, Assumptions, Constraints, and Dependencies, Campaign testcase loading with an optional folder (+26 more)

### Community 16 - "run-electron-app.js"
Cohesion: 0.09
Nodes (19): assessPlayback(), CONTENT_TYPES, { createRemotePage }, createSemanticDriver(), leavePlayerAfterAssessment(), navigation, normalizeText(), parseSemanticRequest() (+11 more)

### Community 17 - "playwright.config.js"
Cohesion: 0.06
Nodes (32): Acceptance criteria, API-SPEC.md, app/flow-case-api.js, app/lg-run-ipc.js and app/lg-desktop-batch-runner.js, app/main.js, app/preload.js, app/renderer/index.html, app/renderer/renderer.js (+24 more)

### Community 18 - "dom-scanning-performance.spec.js"
Cohesion: 0.06
Nodes (32): Acceptance criteria, `ACTION-COMPILER.md`, `AGENTS.md`, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings, Desired outcome, Deviations and Plan Updates (+24 more)

### Community 19 - "graphify.js"
Cohesion: 0.06
Nodes (31): Acceptance criteria, `AGENTS.md`, `app/hosts-file.js`, `app/main.js`, `app/preload.js`, `app/renderer/index.html`, `app/renderer/renderer.js`, Assumptions, Constraints, and Dependencies (+23 more)

### Community 20 - "ai-row-selection.spec.js"
Cohesion: 0.12
Nodes (30): actionName(), assertPlayerReadyAfterWait(), assertVisibleScreenText(), attachJson(), { captureCurrentAppScreenshot }, capturePlayerCheckScreenshot(), classifyExpectedResult(), cleanupAfterFailedPlayerAction() (+22 more)

### Community 21 - "preload.js"
Cohesion: 0.06
Nodes (30): Acceptance criteria, `AGENTS.md`, `API-SPEC.md`, `app/flow-case-api.js`, `app/main.js`, `app/renderer/renderer.js`, Assumptions, Constraints, and Dependencies, Campaign-scoped folder and testcase flow (+22 more)

### Community 22 - "IDEA.md"
Cohesion: 0.06
Nodes (31): 2026-08-13 regression follow-up — cases 2287, 2288, 2290, and view-more, 2026-08-14 maximized-window preview overlap follow-up, Acceptance criteria, `AGENTS.md`, `app/renderer/styles.css`, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings (+23 more)

### Community 23 - "content-rows.js"
Cohesion: 0.12
Nodes (24): assertSafePackage(), assertSafeSamsungAppId(), assertSdbSerial(), buildTizenCapabilities(), buildTizenInstallArgs(), createCredentialSafeAppiumLogCapture(), createEvidenceWriter(), escapeRegExp() (+16 more)

### Community 24 - "workflows.js"
Cohesion: 0.10
Nodes (22): {
  DEFAULT_BATCH_MAX_ITEMS,
  DEFAULT_BATCH_RUNTIME_BUDGET_MS,
  normalizeBatchLimits,
  createBatchBudget,
}, fs, path, {test, expect}, createBatchBudget(), hasExplicitItemLimit(), normalizeBatchLimits(), artifacts (+14 more)

### Community 25 - "Real-TV Appium Handoff Ledger"
Cohesion: 0.08
Nodes (9): assert, createRendererFixture(), FakeClassList, FakeElement, flushRendererPromises(), fs, matchesSelector(), path (+1 more)

### Community 26 - "lg-webos-poc.js"
Cohesion: 0.10
Nodes (18): {createElevatedHostsFileWriter}, createHostsFileService(), createElevatedHostsFileWriter(), createMacOsScript(), createWindowsCommand(), encodePowerShellCommand(), runCommand(), net (+10 more)

### Community 27 - "waits.js"
Cohesion: 0.12
Nodes (19): APPIUM_FAILURE_CODES, CREDENTIAL_STATUSES, FAILED_ACTIONS, FAILED_CODES, FAILED_STAGES, INSPECTION_STATUSES, publicCredentialStatus(), publicInspection() (+11 more)

### Community 28 - "Current Samsung macOS command harness"
Cohesion: 0.07
Nodes (28): Acceptance criteria, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings, Desired outcome, Deviations and Plan Updates, `docs/tinyworkers/20260803_2287_play-row-return.md`, Execution Sequence (+20 more)

### Community 29 - "tizen-poc.js"
Cohesion: 0.07
Nodes (27): Bootstrap (Run Once), Checklists, Choose Session Mode, Cleanup, Common Failure Modes, Core Workflow, Desktop Web Context, Dev Server (+19 more)

### Community 30 - "tizen-poc-semantic.js"
Cohesion: 0.13
Nodes (21): buildRuntimeAppium(), buildRuntimeConnection(), createError(), {createLgMyTvCaseHelpers}, freezeValue(), {normalizePlayerCheckTimeoutSeconds}, path, redactedText() (+13 more)

### Community 31 - "tizen-poc-core.js"
Cohesion: 0.11
Nodes (24): readDeviceInfo(), {
  applyCompatibilityProfile,
  buildCandidateGateArgs,
  parseCompatibilityCandidate,
}, {createReadStream}, {createWebOsReadOnlyAdapter}, crypto, extractChromeDriver(), fs, listFiles() (+16 more)

### Community 32 - "playFocusedContent"
Cohesion: 0.07
Nodes (26): Acceptance criteria, `ACTION-COMPILER.md`, `AGENTS.md`, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings, Desired outcome, Deviations and Plan Updates (+18 more)

### Community 33 - "Server-Driven MyTV Test Case Runner"
Cohesion: 0.13
Nodes (26): baseDefaults(), channelPlayModeQuestion, defaults, fs, main(), moviePlayModeQuestion, parseChannelPlayMode(), parseMoviePlayMode() (+18 more)

### Community 34 - "FakeElement"
Cohesion: 0.19
Nodes (19): waitForContinueFocus(), center(), chooseDirection(), enterWithVirtualKeyboard(), {expect}, expectFocusedText(), fallbackDirection(), {FOCUS_SELECTORS} (+11 more)

### Community 35 - "test-case-action-runner.js"
Cohesion: 0.09
Nodes (12): createDeviceLock(), createWebOsSessionFactory(), assert, {createDeviceLock}, createFakeTvRunner(), {createTvRunner}, {createWebOsAppiumSession, createWebOsSessionFactory}, {runTvTestCase} (+4 more)

### Community 36 - "selector-validation.js"
Cohesion: 0.08
Nodes (14): approvedChromeDriverArtifact(), {createHash: defaultCreateHash}, createLgManagedInstallDependencies(), {createReadStream: defaultCreateReadStream}, {execFile}, fsPromises, path, {promisify} (+6 more)

### Community 37 - "window-close-controller.test.js"
Cohesion: 0.12
Nodes (19): CONTENT_TYPES, createLgProductGateCase(), createLgProductGateEvidenceWriter(), createLgProductGateManifest(), finalizeLgProductGateManifest(), fs, path, requestLoopbackAppium() (+11 more)

### Community 38 - "lg-webos-case-runner-core.test.js"
Cohesion: 0.12
Nodes (24): {acceptUserConsentPopupIfVisible}, assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), collectVisibleAllServiceLabels(), containsTextPattern(), DEFAULT_OPTIONS (+16 more)

### Community 39 - "Architecture"
Cohesion: 0.08
Nodes (22): Adding or Changing Tests, AgentMemory, Architecture, Content rows and playback, Credentials and Sensitive Data, Electron generic runner, Electron local case runner, Environment Variables (+14 more)

### Community 40 - "artifacts.js"
Cohesion: 0.13
Nodes (19): COMPATIBILITY_APPIUM_FAILURE_CODES, COMPATIBILITY_FAILED_ACTIONS, COMPATIBILITY_FAILED_CODES, COMPATIBILITY_FAILED_STAGES, COMPATIBILITY_GATE_ACTIONS, createLgCompatibilityValidation(), failedCompatibilityAction(), failedCompatibilityAppiumCode() (+11 more)

### Community 41 - "mytv-helpers.legacy.js"
Cohesion: 0.08
Nodes (23): Acceptance criteria, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings, Desired outcome, Deviations and Plan Updates, `docs/tinyworkers/20260804_mytv-user-guide-vi.md`, `docs/user-guide/assets/*.png` (+15 more)

### Community 42 - "test-report.js"
Cohesion: 0.08
Nodes (23): Acceptance criteria, `app/renderer/renderer.js`, Assumptions, Constraints, and Dependencies, Completed Verification, Current State and Findings, Desired outcome, Deviations and Plan Updates, `docs/tinyworkers/20260805_095932_stop-restart-run-state.md` (+15 more)

### Community 43 - "navigation.js"
Cohesion: 0.10
Nodes (19): {collectVisibleContentRows}, {createScopedDomScanner}, SCAN_OPTIONS, {test, expect}, createScopedDomScanner(), {getSelectorContract}, artifacts, batchBudget (+11 more)

### Community 44 - "run-test-case-tv.spec.js"
Cohesion: 0.11
Nodes (12): createRunCloseGuard(), requiredCheck(), createManagedWindowCloseController(), createWindowCloseController(), required(), assert, {createRunCloseGuard}, test (+4 more)

### Community 45 - "remotePress"
Cohesion: 0.16
Nodes (20): clearTestCaseCache(), fs, isUsableTestCaseCacheEntry(), path, readCampaignCacheEntry(), readFolderCacheEntry(), readMostRecentFolderCacheEntry(), readMostRecentTestCaseCacheEntry() (+12 more)

### Community 46 - "tv-runner.test.js"
Cohesion: 0.25
Nodes (21): buildCampaignTestCasesUrl(), buildDeviceCompatibilityUrl(), buildFlowCaseFoldersUrl(), buildFlowCaseResultsUrl(), buildFlowCaseResultUrl(), buildFlowCasesUrl(), buildRunningFlowCaseCampaignsUrl(), encodePathPart() (+13 more)

### Community 47 - "Phase 1 implementation and findings — 2026-07-24"
Cohesion: 0.16
Nodes (22): chooseFirstProfileAndEnterHome(), enterWithVirtualKeyboard(), findChannelIdByName(), findLeftMenuItemIdByFuzzyText(), findLeftMenuItemIdByText(), focusLeftMenuItem(), focusSearchMenuItem(), getSubpage() (+14 more)

### Community 48 - "tv-runner.js"
Cohesion: 0.10
Nodes (20): Action compiler guide, Action grammar and output, Back navigation, Compilation algorithm, Failure behavior, Focus a named control and press OK, Home and service navigation, Login (+12 more)

### Community 49 - "lastKnownHost"
Cohesion: 0.12
Nodes (11): assertConcurrency(), createBrowserBatchRunner(), {createLogRedactor}, {
    DEFAULT_SIMULTANEOUS_DEVICES,
    SIMULTANEOUS_DEVICE_OPTIONS,
    normalizeSimultaneousDevices,
}, safeEvent(), assert, {EventEmitter}, {
    MAX_CONCURRENT_BROWSER_CASES,
    assertConcurrency,
    createBrowserBatchRunner,
} (+3 more)

### Community 50 - "device-discovery.test.js"
Cohesion: 0.10
Nodes (19): 1.1. TV, 1.2. Phone, 1.3. Web, 1.4. CMS, 1. Phạm vi theo nền tảng, 2. Xác thực service-to-service, 3.1. Lấy cây thư mục, 3.2. Lấy testcase theo thư mục, ID hoặc chiến dịch (+11 more)

### Community 51 - "tv-toolchain-config.js"
Cohesion: 0.10
Nodes (20): 2022 Samsung pilot authorized test-app installation — 2026-07-27, 2022 Samsung pilot default screenshot-gate attempt — 2026-07-27, 2022 Samsung pilot DOM-only partial attempt — 2026-07-27, 2022 Samsung pilot paired screenshot-gate retry — 2026-07-27, 2022 Samsung pilot read-only preflight — 2026-07-27, 2022 Samsung pilot test-app Chromium discovery — 2026-07-27, Actual macOS setup evidence, Current home-TV connectivity check — 2026-07-26 (+12 more)

### Community 52 - "content-rows.test.js"
Cohesion: 0.08
Nodes (24): {__internal}, {test, expect}, base, {chromium}, fs, {getTestOptions}, isInteractiveBrowserPage(), path (+16 more)

### Community 53 - "getFocusedState"
Cohesion: 0.09
Nodes (18): logoutApp(), waitForServiceScreenImages(), {captureCurrentAppScreenshot}, capturePassedTestScreenshot(), fs, {loadLocalTestCases, loadCachedTestCases, findTestCaseById}, {logoutApp}, {
  normalizePlayerCheckTimeoutSeconds,
  normalizeTestCaseMaxTimeMinutes,
  normalizeAppEnvironment,
} (+10 more)

### Community 54 - "webos-mytv-automation.js"
Cohesion: 0.11
Nodes (6): bestSearchCandidate(), CONTENT_TYPES, FOCUS_SELECTORS, {normalizePlayerCheckTimeoutSeconds}, {normalizeVietnameseText}, scoreCandidate()

### Community 55 - "lg-cli-archive-importer.js"
Cohesion: 0.19
Nodes (16): approvedChromeDriverUrl(), clone(), freeze(), PLATFORM_KEYS, publicCatalogStatus(), requiredText(), selectChromeDriver(), createLgCompatibilityCatalogService() (+8 more)

### Community 56 - "lg-cli-import-operations.js"
Cohesion: 0.14
Nodes (13): classifiedError(), compatibilityFacts(), createLgDesktopRunPreflight(), matchingProfile(), requireDependency(), safeError(), text(), assert (+5 more)

### Community 57 - "Server-Driven Test Case Runner Implementation Plan"
Cohesion: 0.20
Nodes (7): confirmWindowClose(), createWindow(), discardUnsyncedResultSubmission(), revealWindowOnFirstPaint(), assert, {revealWindowOnFirstPaint}, test

### Community 58 - "scripts"
Cohesion: 0.12
Nodes (11): createTvRunner(), requiredDependency(), APPIUM, assert, CONNECTION, {createDeviceLock}, createHarness(), {createTvRunner} (+3 more)

### Community 59 - "tizen-poc-login.js"
Cohesion: 0.12
Nodes (6): createAppiumServerManager(), requireFunction(), assert, {createAppiumServerManager}, {EventEmitter}, test

### Community 60 - "run-test-case-mytv.spec.js"
Cohesion: 0.15
Nodes (15): classifiedError(), createTvToolchainConfig(), missingComponents(), normalizeConfiguration(), path, readyStatus(), REQUIRED_SDK_TOOLS, requireType() (+7 more)

### Community 61 - "test-case-compiler.js"
Cohesion: 0.11
Nodes (18): scripts, app:build, app:build:mac, app:build:mac:dmg, app:build:win, app:dev, browsers:install, test (+10 more)

### Community 62 - "API Testcase"
Cohesion: 0.17
Nodes (18): attachCurrentAppScreenshot(), attachFailureArtifacts(), attachMovieSearchFailureArtifacts(), attachSearchNoResultArtifacts(), collectMovieSearchCandidates(), collectSearchResultCandidates(), findBestSearchResult(), focusSearchResult() (+10 more)

### Community 63 - "openMovieContentByName"
Cohesion: 0.28
Nodes (7): containsTextPattern(), escapeRegExp(), fuzzyMatch(), getTestOptions(), assert, {
  normalizeVietnameseText,
  fuzzyMatch,
}, test

### Community 64 - "test-case-cache.test.js"
Cohesion: 0.14
Nodes (12): createLgCliArchiveImporter(), path, REQUIRED_CLI_COMMANDS, {trustedLgCliArchive}, archive, assert, CLI_COMMANDS, createHarness() (+4 more)

### Community 65 - "tv-toolchain.test.js"
Cohesion: 0.12
Nodes (12): {createHash: defaultCreateHash}, createLgCliImportOperations(), {createReadStream: defaultCreateReadStream}, {execFile}, {promisify}, runDefault, SUPPORTED_PLATFORMS, assert (+4 more)

### Community 66 - "webos-read-only-adapter.js"
Cohesion: 0.15
Nodes (15): parseLgCaseRunnerArgs(), {createAppiumServerManager}, {createDeviceLock}, {
  createLgProductGateCase,
  createLgProductGateEvidenceWriter,
  createLgProductGateManifest,
  parseLgCaseRunnerArgs,
  runLgProductGateWithEvidence,
  withoutLgProductGateCredentials,
}, {createLoopbackAppiumClient}, {createTvRunner}, {createWebOsSessionFactory}, {EXPECTED_LG_APP_ID, buildLgRuntimeRedactionSecrets} (+7 more)

### Community 67 - "index.js"
Cohesion: 0.21
Nodes (14): createRemotePage(), inputLabelContains(), loginWithDedicatedAccount(), logoutToLoginScreen(), navigation, prepareDedicatedLogin(), pressRemote(), REMOTE_KEY_CODES (+6 more)

### Community 68 - "File structure"
Cohesion: 0.11
Nodes (18): createTargetActionContext(), objectOrEmpty(), requireActionCapabilities(), TargetActionError, ACTION_CAPABILITIES, {compileTestCase}, {createTvMyTvActionHandlers}, notifyStep() (+10 more)

### Community 69 - "window-startup.test.js"
Cohesion: 0.12
Nodes (28): ambiguousStepError(), compileLine(), compileQaDescription(), compileTestCase(), getCaseId(), hasOwn(), hasTrailingCommand(), { normalizeVietnameseText } (+20 more)

### Community 70 - "target-action-runner.js"
Cohesion: 0.17
Nodes (14): createLogRedactor(), redactSensitiveText(), normalizeTimeoutMs(), buildSelectedFolder(), cloneApiLogValue(), cloneForUi(), loadCampaignCases(), sanitizeApiLog() (+6 more)

### Community 71 - "test-case-source.test.js"
Cohesion: 0.15
Nodes (12): createLgManagedInstallOperations(), FAILURE_STATUSES, path, PROGRESS_CODES, assert, bundle, createHarness(), {createLgManagedInstallOperations} (+4 more)

### Community 72 - "dom-session.js"
Cohesion: 0.16
Nodes (10): SAFE_INSTALL_FAILURES, SAFE_VERIFICATION_RESULTS, {trustedLgToolchainBundle, trustedLgToolchainManifest}, {trustedLgToolchainNpmClosure}, CLOSURE, {gunzipSync}, trustedLgToolchainNpmClosure(), assert (+2 more)

### Community 73 - "flow-case-api.js"
Cohesion: 0.22
Nodes (7): applyAppEnvironment(), {normalizeAppEnvironment}, {applyAppEnvironment}, assert, fs, path, test

### Community 74 - "lg-managed-install-operations.test.js"
Cohesion: 0.17
Nodes (14): bootstrapRenderer(), BROWSER_INSTALL_FAILURE_STATUSES, BROWSER_INSTALL_PROGRESS_STEPS, cloneFrozenSubmission(), createRendererController(), DEFAULT_SETTINGS, freezeSubmission(), LG_INSTALL_FAILURE_STATUSES (+6 more)

### Community 75 - "tv-case-runner.js"
Cohesion: 0.20
Nodes (14): applyCompatibilityProfile(), buildCandidateGateArgs(), compareProfiles(), {EXPECTED_LG_APP_ID}, parseCatalog(), parseCompatibilityCandidate(), requiredText(), {validateLgCompatibilityCatalog} (+6 more)

### Community 76 - "test-case-schema.js"
Cohesion: 0.16
Nodes (12): {classifyTvFailure}, {createDomSession}, {createTargetActionContext}, frameDataUrl(), PROGRESS_CODES, requireReset(), {runTargetActions}, runTvTestCase() (+4 more)

### Community 77 - "tv-session.test.js"
Cohesion: 0.12
Nodes (6): assert, createHarness(), profile, {redactSensitiveText}, {registerTvDeviceIpc}, test

### Community 78 - "tv-batch-runner.test.js"
Cohesion: 0.13
Nodes (22): bundledCatalog, cloned(), createLgToolchainManifest(), expectedCliArchiveName(), isHttpsUrl(), {selectChromeDriver, validateChromeDriverArtifact, validateLgCompatibilityCatalog}, SUPPORTED_PLATFORMS, TRUSTED_BASELINE_CATALOG (+14 more)

### Community 79 - "lg-toolchain-manifest.js"
Cohesion: 0.17
Nodes (10): classifiedError(), createConfiguredWebOsReadOnlyAdapter(), createWebOsReadOnlyAdapter(), path, readDeviceName(), {spawnSync: defaultSpawnSync}, createReadDeviceInfo(), assert (+2 more)

### Community 80 - "Target selector and workspace behavior"
Cohesion: 0.22
Nodes (6): api, fs, helpers, path, {test, expect}, workflows

### Community 81 - "tv-device-ipc.test.js"
Cohesion: 0.15
Nodes (8): createDomSession(), normalizedIncludes(), {normalizeVietnameseText}, requireMethod(), {TvSessionError}, assert, {createDomSession}, test

### Community 82 - "AGENTS.md"
Cohesion: 0.16
Nodes (12): assertApprovedProfile(), {createWebOsMyTvAutomation}, defaultWait(), factoryError(), normalizeConnection(), {normalizeDomState}, normalizeLoopbackBaseUrl(), {normalizeRemoteKey, TvSessionError} (+4 more)

### Community 83 - "service-access.spec.js"
Cohesion: 0.13
Nodes (13): assertInstalledAppId(), createWebOsAppiumSession(), endpointRedactionSecrets(), reset(), cleanup(), close(), APPROVED_PROFILE, assert (+5 more)

### Community 84 - "lg-toolchain-installer.js"
Cohesion: 0.16
Nodes (8): createDeviceProfileService(), {randomUUID}, text(), VERIFIED_FACT_FIELDS, verifiedFacts(), assert, {createDeviceProfileService}, test

### Community 85 - "webos-target-registration.js"
Cohesion: 0.16
Nodes (18): APP_ENVIRONMENT_OPTIONS, configuration, normalizeAppEnvironment(), normalizePlayerCheckTimeoutSeconds(), normalizeSimultaneousDevices(), normalizeTestCaseMaxTimeMinutes(), normalizeTestResolution(), resolveTestViewport() (+10 more)

### Community 86 - "Internal TV-Lab Lease Service"
Cohesion: 0.15
Nodes (7): createTvToolchainInspector(), fs, path, {spawnSync: defaultSpawnSync}, assert, {createTvToolchainInspector}, test

### Community 87 - "opencode.json"
Cohesion: 0.14
Nodes (13): Acceptance evidence, Completed verification, Evidence and decisions, Follow-up correction: case 2291 row mapping and failure summary, Milestone 1 — Diagnostic baseline (completed), Milestone 2 — First-item activation and viewport (completed), Milestone 3 — Exhaustive failure-tolerant row playback (completed), Milestone 4 — Evidence/reporting and verification (completed) (+5 more)

### Community 88 - "openAppAndEnterLoginPage"
Cohesion: 0.22
Nodes (6): assert, {createOrderedTestReportStore}, fs, os, path, test

### Community 89 - "openLeftMenuFromHome"
Cohesion: 0.20
Nodes (10): normalizeDomState(), redact(), normalizeRemoteKey(), REMOTE_KEYS, TV_CAPABILITIES, TvSessionError, assert, {normalizeDomState} (+2 more)

### Community 90 - "lg-toolchain-detector.js"
Cohesion: 0.17
Nodes (10): createLgCompatibilityCatalogStore(), path, {validateLgCompatibilityCatalog}, assert, catalog, {createLgCompatibilityCatalogStore}, fs, os (+2 more)

### Community 91 - "Architecture and Contracts"
Cohesion: 0.28
Nodes (10): caseIds(), registerLgRunIpc(), requestPayload(), SAFE_STATUS_CODES, safeResult(), text(), assert, createHarness() (+2 more)

### Community 92 - "defaultPackageVersion"
Cohesion: 0.21
Nodes (10): createLgTemporaryWebOsTarget(), net, path, {spawnSync: defaultSpawnSync}, targetEntries(), text(), assert, createHarness() (+2 more)

### Community 93 - "Phased Delivery Plan"
Cohesion: 0.15
Nodes (13): Action compatibility strategy, Architecture and Contracts, Batch continuation and failure classification, Current LG desktop product-gate boundary, Current LG device-dialog boundary, Device data and secrets, Existing boundary to preserve, Future MyTV QA bridge contract (+5 more)

### Community 94 - "GEMINI.md"
Cohesion: 0.18
Nodes (10): browsersPath, {buildBrowserInstallCommand}, child, {command, args}, path, { spawn }, buildBrowserInstallCommand(), assert (+2 more)

### Community 95 - "finishTestProcess"
Cohesion: 0.21
Nodes (9): ALLOWED_FIELDS, createDeviceRegistry(), invalidProfile(), normalizeProfile(), REQUIRED_FIELDS, assert, {createDeviceRegistry}, livingRoom (+1 more)

### Community 96 - "tv-session.test.js"
Cohesion: 0.21
Nodes (8): APPIUM_FAILURE_CODES, createLoopbackAppiumClient(), normalizeLoopbackBaseUrl(), assert, {createLoopbackAppiumClient}, fetchImpl(), response(), test

### Community 97 - "createScopedDomScanner"
Cohesion: 0.18
Nodes (7): createWebOsTargetRegistration(), net, path, {spawnSync: defaultSpawnSync}, assert, {createWebOsTargetRegistration}, test

### Community 98 - "appium-server-manager.test.js"
Cohesion: 0.17
Nodes (12): Acquire lease, API, Authentication and roles, Data model, Electron integration, Explicitly rejected alternatives, Future decision, Future feature — not in the first release (+4 more)

### Community 99 - "test-case-action-runner.test.js"
Cohesion: 0.17
Nodes (11): author, dependencies, playwright, description, keywords, license, main, name (+3 more)

### Community 100 - "app-cleanup.test.js"
Cohesion: 0.17
Nodes (12): build, appId, asar, directories, mac, productName, win, output (+4 more)

### Community 101 - "required"
Cohesion: 0.33
Nodes (7): closeAdvertisePopupIfVisible(), closeHomePopups(), closeHomePopupsAndVerifyHome(), expectFocusedText(), hasVisibleText(), openFocusedContentForPlayback(), remoteFocusByText()

### Community 102 - "lg-toolchain-manifest.test.js"
Cohesion: 0.22
Nodes (8): createBrowserToolchainInstaller(), deepFreeze(), assert, child(), {createBrowserToolchainInstaller}, {EventEmitter}, spawn(), test

### Community 103 - "createdAt"
Cohesion: 0.22
Nodes (7): FAILURE_STATUSES, PROGRESS_CODES, publicResult(), registerBrowserToolchainIpc(), assert, {registerBrowserToolchainIpc}, test

### Community 104 - "readiness-pacing.spec.js"
Cohesion: 0.22
Nodes (7): COMPONENTS, createLgToolchainDetector(), managedChecks(), path, assert, {createLgToolchainDetector}, test

### Community 105 - "lg-toolchain-manifest.test.js"
Cohesion: 0.33
Nodes (10): trustedLgCliArchive(), INSTALL_PROGRESS_CODES, INSTALL_PROGRESS_FAILURES, publicCompatibilityCatalogStatus(), publicInstallProgress(), publicLgToolchainInstallResult(), publicLgToolchainReview(), redactValue() (+2 more)

### Community 106 - "focusRequestedContentRow"
Cohesion: 0.18
Nodes (11): properties, maxLength, type, pattern, type, maxLength, minLength, type (+3 more)

### Community 107 - "device-profile-service.js"
Cohesion: 0.18
Nodes (11): Current LG-only increment — 2026-07-29, Current Phase 3 local-contract record — 2026-07-28, Current Samsung Phase 1 record — 2026-07-24, Phase 0 — Commit the test-lab contract, Phase 1 — Command-line hardware POC (no GUI changes), Phase 2 — Runner foundation and safe device registry, Phase 3 — Make server test cases truly target-neutral, Phase 4 — Device management IPC and target GUI (+3 more)

### Community 108 - "searchAndOpenBestContent"
Cohesion: 0.22
Nodes (7): {collectVisibleContentRows}, {createDomSnapshotCache, getDomSnapshotIdentity}, {remotePress}, {test, expect}, createDomSnapshotCache(), getDomSnapshotIdentity(), {getSelectorContract}

### Community 109 - "redactSensitiveText"
Cohesion: 0.14
Nodes (10): createDeviceDiscovery(), readIdentity(), readInstalledApp(), redactText(), requireReadOnlyAdapter(), runLgCompatibilityCase(), approvedProfile, assert (+2 more)

### Community 110 - "device-secret-store.test.js"
Cohesion: 0.17
Nodes (13): loadLgBatchCase(), testCasesCachePath(), findTestCaseById(), fs, loadCachedTestCases(), loadLocalTestCases(), { validateTestCaseList }, assert (+5 more)

### Community 111 - "device-profile.schema.json"
Cohesion: 0.33
Nodes (8): assertUniqueCaseIds(), intersectCampaignCasesById(), normalizeCaseId(), safeSubmissionFailure(), submitCampaignResultsOrdered(), assert, {
  intersectCampaignCasesById,
  submitCampaignResultsOrdered,
}, test

### Community 112 - "resolve"
Cohesion: 0.31
Nodes (7): createDeviceSecretFileStore(), decodeEnvelope(), invalidStore(), requireKey(), assert, {createDeviceSecretFileStore}, test

### Community 113 - "play-movie-mytv.spec.js"
Cohesion: 0.27
Nodes (6): createLgCompatibilityCredentials(), createLgCompatibilityProductGateCase(), text(), assert, {
  createLgCompatibilityCredentials,
  createLgCompatibilityProductGateCase,
}, test

### Community 114 - "osVersion"
Cohesion: 0.20
Nodes (10): $defs, device, additionalProperties, required, type, appId, backendEnvironment, id (+2 more)

### Community 115 - "playAllItemsInFirstRow"
Cohesion: 0.20
Nodes (9): Assumptions and constraints, Completed verification, Configurable player-check timeout, Files to edit, Goal, Runtime configuration and execution flow, Settings UI and persistence, Tests and documentation (+1 more)

### Community 116 - "tv-batch-runner.test.js"
Cohesion: 0.24
Nodes (10): collectFirstRowPlayableItems(), collectVisibleContentRows(), findBestContentRowMatch(), findContentRowByPosition(), findLastContentRow(), focusFirstRowStart(), focusRequestedContentRow(), isFocusedOnContentItem() (+2 more)

### Community 117 - "browser-toolchain-ipc.test.js"
Cohesion: 0.67
Nodes (3): maxLength, type, osVersion

### Community 118 - "lg-toolchain-installer.test.js"
Cohesion: 0.29
Nodes (7): createTargetActionHandlers(), createTvMyTvActionHandlers(), enterVirtualText(), requiredOperation(), assert, {createTvMyTvActionHandlers}, test

### Community 119 - "tv-batch-runner.test.js"
Cohesion: 0.25
Nodes (4): createDeviceSecretStore(), assert, {createDeviceSecretStore}, test

### Community 120 - "Campaign refresh and service-token header follow-up"
Cohesion: 0.22
Nodes (8): additionalProperties, $id, required, $schema, title, type, devices, version

### Community 121 - "tv-device-ipc.js"
Cohesion: 0.22
Nodes (8): Completed verification, Files to edit, Findings and decisions, Goal, Player configuration save toast, Tests and documentation, Toast and save flow, Verification

### Community 122 - "target-action-context.js"
Cohesion: 0.24
Nodes (13): attachFirstRowPlaybackReport(), contentItemSignature(), escapeHtml(), expectFocusedContent(), getFocusedContentMetadata(), imageDataUrl(), isFocusedContentItem(), isFocusedNearRow() (+5 more)

### Community 123 - "devices"
Cohesion: 0.67
Nodes (3): updatedAt, format, type

### Community 124 - "login-popups.js"
Cohesion: 0.24
Nodes (11): normalizeVietnameseText(), searchKeyboardInput(), collectSearchResultCandidates(), findBestSearchResult(), focusSearchResult(), focusSearchRowItemByPosition(), focusStableSearchResult(), isFocusedOnSearchResult() (+3 more)

### Community 125 - "defaultPackagePath"
Cohesion: 0.29
Nodes (4): createBrowserToolchain(), assert, {createBrowserToolchain}, test

### Community 126 - "dom-snapshot.spec.js"
Cohesion: 0.67
Nodes (3): vendorDeviceName, maxLength, type

### Community 127 - "tizen-poc-semantic.test.js"
Cohesion: 0.32
Nodes (5): createLgCompatibilityAttemptService(), assert, createHarness(), {createLgCompatibilityAttemptService}, test

### Community 128 - "lastKnownHost"
Cohesion: 0.32
Nodes (5): createLgDeviceConnectionChecker(), assert, createHarness(), {createLgDeviceConnectionChecker}, test

### Community 129 - "test-configuration.js"
Cohesion: 0.29
Nodes (5): createLgToolchainInstaller(), assert, createInstaller(), {createLgToolchainInstaller}, test

### Community 130 - "HANDOFF.md"
Cohesion: 0.25
Nodes (8): items, type, uniqueItems, $ref, properties, devices, version, const

### Community 131 - "Campaign refresh and service-token header follow-up"
Cohesion: 0.25
Nodes (7): Acceptance criteria, Campaign refresh and service-token header follow-up, Constraints, Deviations and handoff, Handoff, Scope, Verification

### Community 132 - "lg-compatibility-catalog-service.test.js"
Cohesion: 0.25
Nodes (7): files, app/**/*, DEVICE-COMPATIBILITY.json, node_modules/**/*, playwright.config.js, testcased.json, tests/**/*

### Community 133 - "Target selector and workspace behavior"
Cohesion: 0.25
Nodes (8): center(), chooseDirection(), fallbackDirection(), rangesOverlap(), remoteFocus(), remoteFocusByKeyText(), remoteFocusByVirtualKey(), virtualKeyIds()

### Community 134 - "Target selector and workspace behavior"
Cohesion: 0.29
Nodes (7): createWebOsMyTvAutomation(), openSearch(), logout(), assert, createAutomation(), {createWebOsMyTvAutomation}, test

### Community 135 - "files"
Cohesion: 0.29
Nodes (7): appium, electron, electron-builder, devDependencies, appium, electron, electron-builder

### Community 136 - "run-electron-app.js"
Cohesion: 0.05
Nodes (36): Acceptance criteria, `app/main.js`, `app/renderer/index.html`, `app/renderer/renderer.js`, `app/renderer/styles.css`, `app/test-configuration.js`, Assumptions, Constraints, and Dependencies, Browser App Environment Selector (+28 more)

### Community 137 - "lg-toolchain-manifest.test.js"
Cohesion: 0.12
Nodes (27): attachCurrentAppScreenshot(), attachFailureArtifacts(), attachFirstRowPlaybackReport(), attachMovieSearchFailureArtifacts(), attachPlaybackBatchReport(), attachSearchNoResultArtifacts(), captureCurrentAppScreenshot(), collectMovieSearchCandidates() (+19 more)

### Community 138 - "appId"
Cohesion: 0.40
Nodes (4): createBrowserRunLauncher(), assert, {createBrowserRunLauncher}, test

### Community 139 - "enum"
Cohesion: 0.40
Nodes (4): buildPlaywrightTestArgs(), assert, {buildPlaywrightTestArgs}, test

### Community 141 - "playwright-runner.test.js"
Cohesion: 0.33
Nodes (6): Current status, Decisions already made, Definition of success, Explicit non-goals for the first release, Goal, Real-TV Appium Delivery Plan

### Community 142 - "HANDOFF.md"
Cohesion: 0.33
Nodes (5): Configurable test-case maximum time, Decisions, Goal, Scope, Verification

### Community 143 - "Real-TV Appium Delivery Plan"
Cohesion: 0.33
Nodes (4): assert, catalog, {createLgCompatibilityCatalogService}, test

### Community 144 - "openMovieContentByName"
Cohesion: 0.33
Nodes (5): assert, fs, packageJson, path, test

### Community 145 - "label"
Cohesion: 0.19
Nodes (16): findBestContentRowMatch(), findServiceCategoryRow(), findServiceItemByName(), focusIndexedContentRow(), focusServiceCategoryItem(), focusStateSignature(), focusViewMorePosterInCurrentRow(), getFocusedState() (+8 more)

### Community 146 - "navigation.test.js"
Cohesion: 0.40
Nodes (5): enum, accessMode, private, shared-leased, shared-manual

### Community 147 - "compilerOptions"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does the test status/result update request omit X-FlowTest-Service-Token?, Source Nodes

### Community 148 - "Device Compatibility Check"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does the result PATCH still omit X-FlowTest-Service-Token after API_AUTHORIZATION is configured?, Source Nodes

### Community 149 - "defaultPackageVersion"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How must the MyTV campaign workflow change so a selected campaign can load cases without a folder while retaining optional folder filtering?, Source Nodes

### Community 150 - "tv-batch-runner.js"
Cohesion: 0.21
Nodes (15): assertCases(), completedCase(), errorResult(), requestOperatorDecision(), requireMethod(), runTvCaseBatch(), stoppedCase(), {TV_FAILURE_KIND, classifyTvFailure} (+7 more)

### Community 151 - "service-access.spec.js"
Cohesion: 0.40
Nodes (4): child, electronPath, env, { spawn }

### Community 152 - "preload.test.js"
Cohesion: 0.40
Nodes (3): assert, Module, test

### Community 153 - "defaultPackageVersion"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, appId

### Community 154 - "createRendererController"
Cohesion: 0.50
Nodes (4): enum, backendEnvironment, production, staging

### Community 155 - "enum"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, defaultPackagePath

### Community 156 - "graphify.js"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, label

### Community 157 - "playwright.config.js"
Cohesion: 0.50
Nodes (4): enum, platform, tizen, webos

### Community 158 - "flow-case-api.test.js"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

### Community 159 - "lg-webos-poc-core.js"
Cohesion: 0.50
Nodes (4): findMovieContentIdByName(), openFirstMovieContent(), openMovieContent(), openMovieContentByName()

### Community 163 - "enum"
Cohesion: 0.23
Nodes (13): getContractLocator(), resolveContractLocatorId(), attachLocatorContractMiss(), findLeftMenuItemIdByText(), focusLeftMenuItem(), focusSearchMenuItem(), isLeftMenuOpen(), openLeftMenuFromHome() (+5 more)

### Community 164 - ".querySelectorAll"
Cohesion: 0.17
Nodes (12): 1. Verify vendor connection first, 2. Prove Appium capabilities, 3. Prove the product flow, Failure classification, First desktop LG product-gate pilot (fresh approval required), LG compatibility catalog maintenance, Physical-TV Appium POC Runbook, POC evidence to retain outside git (+4 more)

### Community 165 - "model"
Cohesion: 0.67
Nodes (3): maxLength, type, model

### Community 166 - "notes"
Cohesion: 0.67
Nodes (3): maxLength, type, notes

### Community 167 - "tv-batch-runner.test.js"
Cohesion: 0.28
Nodes (6): assert, businessError(), executeCase(), {runTvCaseBatch}, technicalError(), test

### Community 168 - "device-discovery.js"
Cohesion: 0.29
Nodes (10): collectVisibleAllServiceLabelsScoped(), findLeftMenuItemIdByFuzzyText(), findServiceIdInAllServices(), findVisibleElementIdByFuzzyLabelScoped(), findVisibleServiceIdByTitleAttributeScoped(), getServiceSearchNames(), openServiceFromLeftMenuOrAllServices(), scopedScanRecords() (+2 more)

### Community 178 - "test-case-action-runner.test.js"
Cohesion: 0.20
Nodes (7): assert, {
  createActionRunner,
  createDefaultActionHandlers,
  runTestCase,
  assertVisibleScreenText,
}, createHandlerHelpers(), defaultHelpers, press(), test, workflows

### Community 179 - "findServiceIdInAllServices"
Cohesion: 0.29
Nodes (8): expectFocusedElementToLookOrange(), remoteFocusBySelector(), gotoApp(), isWelcomeScreen(), observeAppReadyState(), openAppAndEnterLoginPage(), prepareAppEnvironment(), waitForAppReady()

### Community 180 - "openLeftMenuFromHome"
Cohesion: 0.40
Nodes (5): Browser configuration, Deferred future feature: Manage Samsung signing / Repackage for this TV, Device discovery and direct IP, Per-device package-file setting, Target selector and workspace behavior

### Community 181 - "openFocusedContentForPlayback"
Cohesion: 0.40
Nodes (4): assert, contentRows, test, workflows

### Community 182 - "navigation.test.js"
Cohesion: 0.50
Nodes (3): assert, navigation, test

### Community 183 - "createdAt"
Cohesion: 0.67
Nodes (3): format, type, createdAt

### Community 184 - "defaultPackageVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, defaultPackageVersion

## Knowledge Gaps
- **1495 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `{createLogRedactor}`, `{
    DEFAULT_SIMULTANEOUS_DEVICES,
    SIMULTANEOUS_DEVICE_OPTIONS,
    normalizeSimultaneousDevices,
}`, `PROGRESS_CODES` (+1490 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `requestJson()` (2× useful, score=1.701052558) _(code changed — re-verify)_
- `submitFlowCaseResults()` (2× useful, score=1.701052558) _(code changed — re-verify)_

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolve()` connect `build` to `webos-read-only-adapter.js`, `index.js`, `mytv-session-fixture.js`, `renderer.js`, `lg-webos-case-runner-core.test.js`, `run-test-case-tv.spec.js`, `lastKnownHost`, `lastKnownHost`, `AGENTS.md`, `content-rows.test.js`, `Internal TV-Lab Lease Service`, `content-rows.js`, `workflows.js`, `Real-TV Appium Handoff Ledger`, `defaultPackagePath`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `createRunCloseGuard()` connect `run-test-case-tv.spec.js` to `mytv-helpers.js`, `Server-Driven Test Case Runner Implementation Plan`, `build`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `normalizePlayerCheckTimeoutSeconds()` connect `webos-target-registration.js` to `mytv-helpers.js`, `main.js`, `Target selector and workspace behavior`, `ai-row-selection.spec.js`, `getFocusedState`, `webos-mytv-automation.js`, `tizen-poc-semantic.js`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `remotePress()` (e.g. with `returnFromPlayerOrDetail()` and `returnToFirstRowContent()`) actually correct?**
  _`remotePress()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `.opencode/plugins/graphify.js`, `{createLogRedactor}` to the rest of the system?**
  _1495 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mytv-helpers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.017841079460269867 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md` be split into smaller, more focused modules?**
  _Cohesion score 0.06207482993197279 - nodes in this community are weakly interconnected._