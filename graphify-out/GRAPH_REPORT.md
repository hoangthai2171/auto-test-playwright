# Graph Report - auto-test-playwright  (2026-08-01)

## Corpus Check
- 221 files · ~174,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2393 nodes · 3868 edges · 152 communities (144 shown, 8 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 397 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `87877ff5`
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
- lg-toolchain-manifest.js
- tv-device-ipc.test.js
- AGENTS.md
- service-access.spec.js
- lg-toolchain-installer.js
- webos-target-registration.js
- Internal TV-Lab Lease Service
- openAppAndEnterLoginPage
- openLeftMenuFromHome
- lg-toolchain-detector.js
- Architecture and Contracts
- Phased Delivery Plan
- createScopedDomScanner
- appium-server-manager.test.js
- required
- dom-scanning-performance.spec.js
- focusRequestedContentRow
- device-profile-service.js
- searchAndOpenBestContent
- redactSensitiveText
- device-secret-store.test.js
- device-profile.schema.json
- playAllItemsInFirstRow
- tv-batch-runner.test.js
- browser-toolchain-ipc.test.js
- test-case-action-runner.test.js
- tv-batch-runner.test.js
- webos-appium-session.test.js
- tv-device-ipc.js
- lg-toolchain-npm-closure.js
- devices
- login-popups.js
- defaultPackagePath
- target-action-runner.test.js
- tizen-poc-semantic.test.js
- devDependencies
- files
- assertPlayback
- locator-contracts.spec.js
- playwright-runner.test.js
- Real-TV Appium Delivery Plan
- package-config.test.js
- preload.test.js
- createRendererController
- enum
- lg-webos-poc-core.js
- browser-run-launcher.test.js
- appId
- enum
- tv-batch-runner.test.js
- label
- enum
- app-cleanup.test.js
- firmwareVersion
- dom-snapshot.spec.js
- target-action-context.js
- findServiceIdInAllServices
- compilerOptions
- tv-batch-runner.test.js
- defaultPackageVersion
- lg-toolchain-installer.test.js
- flow-case-api.test.js
- createdAt
- vendorDeviceName
- App-deployment decision supplied by the user
- lg-cli-operator-guide.md
- lg-compatibility-catalog-store.test.js
- lg-compatibility-attempt-service.test.js
- dom-scanning-performance.spec.js
- lg-compatibility-catalog-service.test.js
- Device Compatibility Check
- osVersion

## God Nodes (most connected - your core abstractions)
1. `Real-TV Appium Handoff Ledger` - 51 edges
2. `runPoc()` - 42 edges
3. `normalizeVietnameseText()` - 33 edges
4. `Current Samsung macOS command harness` - 31 edges
5. `remotePress()` - 27 edges
6. `runPoc()` - 26 edges
7. `Phase 1 implementation and findings — 2026-07-24` - 20 edges
8. `createContentRowsApi()` - 19 edges
9. `scripts` - 18 edges
10. `resolve()` - 18 edges

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

## Communities (152 total, 8 thin omitted)

### Community 0 - "mytv-helpers.js"
Cohesion: 0.08
Nodes (14): approvedChromeDriverArtifact(), {createHash: defaultCreateHash}, createLgManagedInstallDependencies(), {createReadStream: defaultCreateReadStream}, {execFile}, fsPromises, path, {promisify} (+6 more)

### Community 1 - "AGENTS.md"
Cohesion: 0.13
Nodes (23): attachCurrentAppScreenshot(), attachFailureArtifacts(), attachFirstRowPlaybackReport(), attachMovieSearchFailureArtifacts(), attachSearchNoResultArtifacts(), captureCurrentAppScreenshot(), collectMovieSearchCandidates(), collectSearchResultCandidates() (+15 more)

### Community 2 - "renderer.js"
Cohesion: 0.13
Nodes (10): assertVisibleScreenText(), createDefaultActionHandlers(), escapeRegExp(), resolveReadyWait(), visibleScreenTextPredicate(), assert, {
  createActionRunner,
  createDefaultActionHandlers,
  runTestCase,
  assertVisibleScreenText,
}, defaultHelpers (+2 more)

### Community 3 - "mytv-session-fixture.js"
Cohesion: 0.06
Nodes (31): {__internal}, {test, expect}, applyViewportScale(), base, {chromium}, fs, {getTestOptions}, isInteractiveBrowserPage() (+23 more)

### Community 4 - "main.js"
Cohesion: 0.02
Nodes (90): {app, BrowserView, BrowserWindow, dialog, ipcMain, safeStorage, shell}, applyInteractiveViewZoom(), browserRoot, browserRunLauncher, browserToolchain, browserToolchainInstaller, {buildPlaywrightTestArgs}, bundledLgCompatibilityCatalog (+82 more)

### Community 5 - "MyTV Auto Test - Session Handoff Notes"
Cohesion: 0.67
Nodes (3): maxLength, type, model

### Community 6 - "Playwright Interactive Skill"
Cohesion: 0.07
Nodes (27): Bootstrap (Run Once), Checklists, Choose Session Mode, Cleanup, Common Failure Modes, Core Workflow, Desktop Web Context, Dev Server (+19 more)

### Community 7 - "run-headed.js"
Cohesion: 0.13
Nodes (26): baseDefaults(), channelPlayModeQuestion, defaults, fs, main(), moviePlayModeQuestion, parseChannelPlayMode(), parseMoviePlayMode() (+18 more)

### Community 8 - "package.json"
Cohesion: 0.17
Nodes (11): author, dependencies, playwright, description, keywords, license, main, name (+3 more)

### Community 9 - "build"
Cohesion: 0.15
Nodes (13): build, appId, asar, directories, electronDist, mac, productName, win (+5 more)

### Community 10 - "MyTV Auto Test"
Cohesion: 0.04
Nodes (44): Action compiler guide, Action grammar and output, Back navigation, Compilation algorithm, Failure behavior, Focus a named control and press OK, Home and service navigation, Login (+36 more)

### Community 11 - "playAllItemsInFirstRow"
Cohesion: 0.07
Nodes (35): caseRun(), createLgDesktopBatchRunner(), requireMethod(), SAFE_EVENT_CODES, safeExecutionResult(), text(), TV_CAPABILITIES, {TV_FAILURE_KIND, classifyTvFailure} (+27 more)

### Community 12 - "lastKnownHost"
Cohesion: 0.32
Nodes (5): createLgDeviceConnectionChecker(), assert, createHarness(), {createLgDeviceConnectionChecker}, test

### Community 13 - "findServiceIdInAllServices"
Cohesion: 0.23
Nodes (12): normalizeVietnameseText(), searchKeyboardInput(), collectSearchResultCandidates(), findBestSearchResult(), focusSearchResult(), focusSearchRowItemByPosition(), focusStableSearchResult(), isFocusedOnSearchResult() (+4 more)

### Community 14 - "preparePreview"
Cohesion: 0.22
Nodes (8): createBrowserToolchainInstaller(), deepFreeze(), assert, child(), {createBrowserToolchainInstaller}, {EventEmitter}, spawn(), test

### Community 15 - "install-playwright-browsers.js"
Cohesion: 0.18
Nodes (10): browsersPath, {buildBrowserInstallCommand}, child, {command, args}, path, { spawn }, buildBrowserInstallCommand(), assert (+2 more)

### Community 16 - "run-electron-app.js"
Cohesion: 0.40
Nodes (4): child, electronPath, env, { spawn }

### Community 17 - "playwright.config.js"
Cohesion: 0.50
Nodes (3): { defineConfig, devices }, VIEWPORT, WINDOW_SIZE

### Community 18 - "dom-scanning-performance.spec.js"
Cohesion: 0.31
Nodes (7): createDeviceSecretFileStore(), decodeEnvelope(), invalidStore(), requireKey(), assert, {createDeviceSecretFileStore}, test

### Community 19 - "graphify.js"
Cohesion: 0.20
Nodes (6): {expect}, navigation, {POPUP_FOCUS_DIALOG_IDS}, {
  acceptDeviceLimitPopupIfVisible,
}, assert, test

### Community 20 - "ai-row-selection.spec.js"
Cohesion: 0.18
Nodes (11): maxLength, type, properties, pattern, type, maxLength, minLength, type (+3 more)

### Community 23 - "content-rows.js"
Cohesion: 0.11
Nodes (46): activateVerifiedTarget(), collectFirstRowPlayableItems(), collectVisibleContentRows(), configureContentRows(), CONTENT_ITEM_CONTRACT, contentItemSignature(), createContentRowsApi(), {createDomSnapshotCache,getDomSnapshotIdentity} (+38 more)

### Community 24 - "workflows.js"
Cohesion: 0.06
Nodes (44): expectFocusedElementToLookOrange(), {acceptDeviceLimitPopupIfVisible}, artifacts, assertServiceOpened(), attachServiceOpenFailure(), chooseFirstProfileAndEnterHome(), closeAdvertisePopupIfVisible(), closeHomePopups() (+36 more)

### Community 25 - "Real-TV Appium Handoff Ledger"
Cohesion: 0.04
Nodes (49): Artifact decision supplied by the user, Batch-failure decision supplied by the user, Blocking questions — answer before phase 1, Browser configuration local contracts — 2026-07-29, Chosen architecture, Compatibility catalog maintainer workflow, Current LG device dialog, Current repository facts (+41 more)

### Community 26 - "lg-webos-poc.js"
Cohesion: 0.09
Nodes (46): wait(), appiumHome, appiumRequest(), commandVersion(), assertSafeLgAppId(), buildLgCapabilities(), buildLgPocEnvironment(), buildLgRuntimeRedactionSecrets() (+38 more)

### Community 27 - "waits.js"
Cohesion: 0.08
Nodes (30): assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), attachPlaybackTimeout(), attachPlayerFailureArtifacts(), {expect}, inspectPlaybackAfterWait() (+22 more)

### Community 28 - "Current Samsung macOS command harness"
Cohesion: 0.05
Nodes (43): 1. Verify vendor connection first, 2022 Samsung pilot authorized test-app installation — 2026-07-27, 2022 Samsung pilot default screenshot-gate attempt — 2026-07-27, 2022 Samsung pilot DOM-only partial attempt — 2026-07-27, 2022 Samsung pilot foreground-context check — 2026-07-27, 2022 Samsung pilot fresh-pairing recovery check — 2026-07-27, 2022 Samsung pilot one-key readiness diagnostic — 2026-07-27, 2022 Samsung pilot paired screenshot-gate retry — 2026-07-27 (+35 more)

### Community 29 - "tizen-poc.js"
Cohesion: 0.11
Nodes (39): appiumEnvironment(), appiumHome, appiumRequest(), captureEvidence(), commandVersion(), capturePocEvidence(), doctor(), evidenceRoot (+31 more)

### Community 30 - "tizen-poc-semantic.js"
Cohesion: 0.09
Nodes (19): assessPlayback(), CONTENT_TYPES, { createRemotePage }, createSemanticDriver(), leavePlayerAfterAssessment(), navigation, normalizeText(), parseSemanticRequest() (+11 more)

### Community 31 - "tizen-poc-core.js"
Cohesion: 0.13
Nodes (22): assertSafePackage(), assertSafeSamsungAppId(), assertSdbSerial(), buildTizenCapabilities(), buildTizenInstallArgs(), createCredentialSafeAppiumLogCapture(), escapeRegExp(), focusIdentity() (+14 more)

### Community 32 - "playFocusedContent"
Cohesion: 0.21
Nodes (9): ALLOWED_FIELDS, createDeviceRegistry(), invalidProfile(), normalizeProfile(), REQUIRED_FIELDS, assert, {createDeviceRegistry}, livingRoom (+1 more)

### Community 33 - "Server-Driven MyTV Test Case Runner"
Cohesion: 0.29
Nodes (10): collectVisibleAllServiceLabelsScoped(), findLeftMenuItemIdByFuzzyText(), findServiceIdInAllServices(), findVisibleElementIdByFuzzyLabelScoped(), findVisibleServiceIdByTitleAttributeScoped(), getServiceSearchNames(), openServiceFromLeftMenuOrAllServices(), scopedScanRecords() (+2 more)

### Community 34 - "FakeElement"
Cohesion: 0.09
Nodes (8): assert, createRendererFixture(), FakeClassList, FakeElement, fs, matchesSelector(), path, test

### Community 35 - "test-case-action-runner.js"
Cohesion: 0.16
Nodes (23): actionName(), assertPlayerReadyAfterDefaultWait(), attachJson(), { captureCurrentAppScreenshot }, capturePlayerCheckScreenshot(), classifyExpectedResult(), cleanupAfterFailedPlayerAction(), cleanupAfterPlayerAction() (+15 more)

### Community 36 - "selector-validation.js"
Cohesion: 0.10
Nodes (34): activateVerifiedTarget(), assertFocusedTarget(), assertSelectorHealth(), captureActivationDiagnostics(), collectSelectorDiagnostics(), DEFAULT_MATCH_OPTIONS, describeVerificationFailure(), fuzzyLabelMatch() (+26 more)

### Community 37 - "window-close-controller.test.js"
Cohesion: 0.10
Nodes (15): confirmWindowClose(), createWindow(), discardUnsyncedResultSubmission(), createRunCloseGuard(), requiredCheck(), createManagedWindowCloseController(), createWindowCloseController(), required() (+7 more)

### Community 38 - "lg-webos-case-runner-core.test.js"
Cohesion: 0.12
Nodes (14): createDeviceLock(), {createAppiumServerManager}, {createDeviceLock}, {
  createLgProductGateCase,
  createLgProductGateEvidenceWriter,
  createLgProductGateManifest,
  parseLgCaseRunnerArgs,
  runLgProductGateWithEvidence,
  withoutLgProductGateCredentials,
}, {createLoopbackAppiumClient}, {createTvRunner}, {createWebOsSessionFactory}, {EXPECTED_LG_APP_ID, buildLgRuntimeRedactionSecrets} (+6 more)

### Community 39 - "Architecture"
Cohesion: 0.29
Nodes (6): {collectVisibleContentRows}, {createScopedDomScanner}, SCAN_OPTIONS, {test, expect}, createScopedDomScanner(), {getSelectorContract}

### Community 40 - "artifacts.js"
Cohesion: 0.33
Nodes (7): {
  DEFAULT_BATCH_MAX_ITEMS,
  DEFAULT_BATCH_RUNTIME_BUDGET_MS,
  normalizeBatchLimits,
  createBatchBudget,
}, fs, path, {test, expect}, createBatchBudget(), hasExplicitItemLimit(), normalizeBatchLimits()

### Community 41 - "mytv-helpers.legacy.js"
Cohesion: 0.14
Nodes (21): attachFirstRowPlaybackReport(), center(), chooseDirection(), collectVisibleAllServiceLabels(), containsTextPattern(), DEFAULT_OPTIONS, escapeHtml(), escapeRegExp() (+13 more)

### Community 42 - "test-report.js"
Cohesion: 0.17
Nodes (22): applyInteractiveViewFitZoom(), finishTestProcess(), reportPath(), stopActiveTest(), stopPreviewWatcher(), userReportHtmlPath(), userReportJsonPath(), writeLgReportEntry() (+14 more)

### Community 43 - "navigation.js"
Cohesion: 0.19
Nodes (21): acceptDeviceLimitPopupIfVisible(), center(), chooseDirection(), enterWithVirtualKeyboard(), {expect}, expectFocusedText(), fallbackDirection(), {FOCUS_SELECTORS} (+13 more)

### Community 44 - "run-test-case-tv.spec.js"
Cohesion: 0.11
Nodes (8): createWebOsSessionFactory(), assert, {createDeviceLock}, createFakeTvRunner(), {createTvRunner}, {createWebOsAppiumSession, createWebOsSessionFactory}, {runTvTestCase}, test

### Community 45 - "remotePress"
Cohesion: 0.16
Nodes (22): chooseFirstProfileAndEnterHome(), enterWithVirtualKeyboard(), findChannelIdByName(), findLeftMenuItemIdByFuzzyText(), findLeftMenuItemIdByText(), focusLeftMenuItem(), focusSearchMenuItem(), getSubpage() (+14 more)

### Community 46 - "tv-runner.test.js"
Cohesion: 0.12
Nodes (11): createTvRunner(), requiredDependency(), APPIUM, assert, CONNECTION, {createDeviceLock}, createHarness(), {createTvRunner} (+3 more)

### Community 47 - "Phase 1 implementation and findings — 2026-07-24"
Cohesion: 0.10
Nodes (20): 2022 Samsung pilot authorized test-app installation — 2026-07-27, 2022 Samsung pilot default screenshot-gate attempt — 2026-07-27, 2022 Samsung pilot DOM-only partial attempt — 2026-07-27, 2022 Samsung pilot paired screenshot-gate retry — 2026-07-27, 2022 Samsung pilot read-only preflight — 2026-07-27, 2022 Samsung pilot test-app Chromium discovery — 2026-07-27, Actual macOS setup evidence, Current home-TV connectivity check — 2026-07-26 (+12 more)

### Community 48 - "tv-runner.js"
Cohesion: 0.13
Nodes (20): buildRuntimeAppium(), buildRuntimeConnection(), createError(), {createLgMyTvCaseHelpers}, freezeValue(), path, redactedText(), redactValue() (+12 more)

### Community 49 - "lastKnownHost"
Cohesion: 0.10
Nodes (18): {createElevatedHostsFileWriter}, createHostsFileService(), createElevatedHostsFileWriter(), createMacOsScript(), createWindowsCommand(), encodePowerShellCommand(), runCommand(), net (+10 more)

### Community 50 - "device-discovery.test.js"
Cohesion: 0.15
Nodes (9): createDeviceDiscovery(), readIdentity(), readInstalledApp(), redactText(), requireReadOnlyAdapter(), approvedProfile, assert, {createDeviceDiscovery} (+1 more)

### Community 51 - "tv-toolchain-config.js"
Cohesion: 0.15
Nodes (15): classifiedError(), createTvToolchainConfig(), missingComponents(), normalizeConfiguration(), path, readyStatus(), REQUIRED_SDK_TOOLS, requireType() (+7 more)

### Community 52 - "content-rows.test.js"
Cohesion: 0.11
Nodes (24): readDeviceInfo(), {
  applyCompatibilityProfile,
  buildCandidateGateArgs,
  parseCompatibilityCandidate,
}, {createReadStream}, {createWebOsReadOnlyAdapter}, crypto, extractChromeDriver(), fs, listFiles() (+16 more)

### Community 53 - "getFocusedState"
Cohesion: 0.17
Nodes (18): attachCurrentAppScreenshot(), attachFailureArtifacts(), attachMovieSearchFailureArtifacts(), attachSearchNoResultArtifacts(), collectMovieSearchCandidates(), collectSearchResultCandidates(), findBestSearchResult(), focusSearchResult() (+10 more)

### Community 54 - "webos-mytv-automation.js"
Cohesion: 0.12
Nodes (5): bestSearchCandidate(), CONTENT_TYPES, FOCUS_SELECTORS, {normalizeVietnameseText}, scoreCandidate()

### Community 55 - "lg-cli-archive-importer.js"
Cohesion: 0.14
Nodes (12): createLgCliArchiveImporter(), path, REQUIRED_CLI_COMMANDS, {trustedLgCliArchive}, archive, assert, CLI_COMMANDS, createHarness() (+4 more)

### Community 56 - "lg-cli-import-operations.js"
Cohesion: 0.12
Nodes (12): {createHash: defaultCreateHash}, createLgCliImportOperations(), {createReadStream: defaultCreateReadStream}, {execFile}, {promisify}, runDefault, SUPPORTED_PLATFORMS, assert (+4 more)

### Community 57 - "Server-Driven Test Case Runner Implementation Plan"
Cohesion: 0.33
Nodes (6): createWebOsMyTvAutomation(), openSearch(), assert, createAutomation(), {createWebOsMyTvAutomation}, test

### Community 58 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, app:build, app:build:mac, app:build:mac:dmg, app:build:win, app:dev, browsers:install, test (+10 more)

### Community 59 - "tizen-poc-login.js"
Cohesion: 0.21
Nodes (14): createRemotePage(), inputLabelContains(), loginWithDedicatedAccount(), logoutToLoginScreen(), navigation, prepareDedicatedLogin(), pressRemote(), REMOTE_KEY_CODES (+6 more)

### Community 60 - "run-test-case-mytv.spec.js"
Cohesion: 0.14
Nodes (13): waitForServiceScreenImages(), {captureCurrentAppScreenshot}, capturePassedTestScreenshot(), fs, {loadLocalTestCases, loadCachedTestCases, findTestCaseById}, {logoutApp}, path, {runTestCase} (+5 more)

### Community 61 - "test-case-compiler.js"
Cohesion: 0.27
Nodes (10): attachLocatorContractMiss(), findLeftMenuItemIdByText(), focusLeftMenuItem(), focusSearchMenuItem(), isLeftMenuOpen(), openLeftMenuFromHome(), openMovieFromLeftMenu(), openSearchFromLeftMenu() (+2 more)

### Community 62 - "API Testcase"
Cohesion: 0.12
Nodes (15): 1. Lấy cây thư mục testcase, 2. Lấy testcase theo đường dẫn thư mục hoặc ID, 3. Lưu hàng loạt testcase theo thư mục, 4. Yêu cầu tích hợp kết quả chạy testcase từ bên thứ ba, 5. Bộ trạng thái hiện tại, 6. Danh sách QA, 7. Script testcase, API Testcase (+7 more)

### Community 63 - "openMovieContentByName"
Cohesion: 0.50
Nodes (4): findMovieContentIdByName(), openFirstMovieContent(), openMovieContent(), openMovieContentByName()

### Community 64 - "test-case-cache.test.js"
Cohesion: 0.20
Nodes (12): fs, path, readFolderCacheEntry(), readMostRecentFolderCacheEntry(), readTestCaseCache(), replaceFolderCacheEntry(), assert, fs (+4 more)

### Community 65 - "tv-toolchain.test.js"
Cohesion: 0.15
Nodes (7): createTvToolchainInspector(), fs, path, {spawnSync: defaultSpawnSync}, assert, {createTvToolchainInspector}, test

### Community 66 - "webos-read-only-adapter.js"
Cohesion: 0.21
Nodes (15): ambiguousStepError(), compileLine(), compileQaDescription(), compileTestCase(), getCaseId(), hasOwn(), hasTrailingCommand(), { normalizeVietnameseText } (+7 more)

### Community 69 - "window-startup.test.js"
Cohesion: 0.25
Nodes (4): revealWindowOnFirstPaint(), assert, {revealWindowOnFirstPaint}, test

### Community 70 - "target-action-runner.js"
Cohesion: 0.29
Nodes (7): createTargetActionHandlers(), createTvMyTvActionHandlers(), enterVirtualText(), requiredOperation(), assert, {createTvMyTvActionHandlers}, test

### Community 71 - "test-case-source.test.js"
Cohesion: 0.14
Nodes (13): classifiedError(), compatibilityFacts(), createLgDesktopRunPreflight(), matchingProfile(), requireDependency(), safeError(), text(), assert (+5 more)

### Community 72 - "dom-session.js"
Cohesion: 0.15
Nodes (8): createDomSession(), normalizedIncludes(), {normalizeVietnameseText}, requireMethod(), {TvSessionError}, assert, {createDomSession}, test

### Community 73 - "flow-case-api.js"
Cohesion: 0.28
Nodes (15): buildDeviceCompatibilityUrl(), buildFlowCaseFoldersUrl(), buildFlowCaseResultsUrl(), buildFlowCasesUrl(), encodePathPart(), extractList(), fetchDeviceCompatibilityCatalog(), fetchFlowCaseFolders() (+7 more)

### Community 74 - "lg-managed-install-operations.test.js"
Cohesion: 0.15
Nodes (12): createLgManagedInstallOperations(), FAILURE_STATUSES, path, PROGRESS_CODES, assert, bundle, createHarness(), {createLgManagedInstallOperations} (+4 more)

### Community 75 - "tv-case-runner.js"
Cohesion: 0.15
Nodes (13): {classifyTvFailure}, {createDomSession}, {createTargetActionContext}, frameDataUrl(), PROGRESS_CODES, requireReset(), {runTargetActions}, runTvTestCase() (+5 more)

### Community 76 - "test-case-schema.js"
Cohesion: 0.12
Nodes (19): APPIUM_FAILURE_CODES, CREDENTIAL_STATUSES, FAILED_ACTIONS, FAILED_CODES, FAILED_STAGES, INSPECTION_STATUSES, publicCredentialStatus(), publicInspection() (+11 more)

### Community 77 - "tv-session.test.js"
Cohesion: 0.20
Nodes (14): applyCompatibilityProfile(), buildCandidateGateArgs(), compareProfiles(), {EXPECTED_LG_APP_ID}, parseCatalog(), parseCompatibilityCandidate(), requiredText(), {validateLgCompatibilityCatalog} (+6 more)

### Community 79 - "lg-toolchain-manifest.js"
Cohesion: 0.13
Nodes (22): bundledCatalog, cloned(), createLgToolchainManifest(), expectedCliArchiveName(), isHttpsUrl(), {selectChromeDriver, validateChromeDriverArtifact, validateLgCompatibilityCatalog}, SUPPORTED_PLATFORMS, TRUSTED_BASELINE_CATALOG (+14 more)

### Community 81 - "tv-device-ipc.test.js"
Cohesion: 0.12
Nodes (6): assert, createHarness(), profile, {redactSensitiveText}, {registerTvDeviceIpc}, test

### Community 82 - "AGENTS.md"
Cohesion: 0.09
Nodes (21): Adding or Changing Tests, Architecture, Content rows and playback, Credentials and Sensitive Data, Electron generic runner, Electron local case runner, Environment Variables, graphify (+13 more)

### Community 83 - "service-access.spec.js"
Cohesion: 0.17
Nodes (10): classifiedError(), createConfiguredWebOsReadOnlyAdapter(), createWebOsReadOnlyAdapter(), path, readDeviceName(), {spawnSync: defaultSpawnSync}, createReadDeviceInfo(), assert (+2 more)

### Community 84 - "lg-toolchain-installer.js"
Cohesion: 0.16
Nodes (10): SAFE_INSTALL_FAILURES, SAFE_VERIFICATION_RESULTS, {trustedLgToolchainBundle, trustedLgToolchainManifest}, {trustedLgToolchainNpmClosure}, CLOSURE, {gunzipSync}, trustedLgToolchainNpmClosure(), assert (+2 more)

### Community 85 - "webos-target-registration.js"
Cohesion: 0.18
Nodes (7): createWebOsTargetRegistration(), net, path, {spawnSync: defaultSpawnSync}, assert, {createWebOsTargetRegistration}, test

### Community 86 - "Internal TV-Lab Lease Service"
Cohesion: 0.17
Nodes (12): Acquire lease, API, Authentication and roles, Data model, Electron integration, Explicitly rejected alternatives, Future decision, Future feature — not in the first release (+4 more)

### Community 88 - "openAppAndEnterLoginPage"
Cohesion: 0.21
Nodes (12): closeAdvertisePopupIfVisible(), closeHomePopups(), closeHomePopupsAndVerifyHome(), expectFocusedElementToLookOrange(), expectFocusedText(), gotoApp(), hasVisibleText(), isWelcomeScreen() (+4 more)

### Community 89 - "openLeftMenuFromHome"
Cohesion: 0.27
Nodes (6): createLgCompatibilityCredentials(), createLgCompatibilityProductGateCase(), text(), assert, {
  createLgCompatibilityCredentials,
  createLgCompatibilityProductGateCase,
}, test

### Community 90 - "lg-toolchain-detector.js"
Cohesion: 0.22
Nodes (7): COMPONENTS, createLgToolchainDetector(), managedChecks(), path, assert, {createLgToolchainDetector}, test

### Community 91 - "Architecture and Contracts"
Cohesion: 0.11
Nodes (18): Action compatibility strategy, Architecture and Contracts, Batch continuation and failure classification, Browser configuration, Current LG desktop product-gate boundary, Current LG device-dialog boundary, Deferred future feature: Manage Samsung signing / Repackage for this TV, Device data and secrets (+10 more)

### Community 93 - "Phased Delivery Plan"
Cohesion: 0.18
Nodes (11): Current LG-only increment — 2026-07-29, Current Phase 3 local-contract record — 2026-07-28, Current Samsung Phase 1 record — 2026-07-24, Phase 0 — Commit the test-lab contract, Phase 1 — Command-line hardware POC (no GUI changes), Phase 2 — Runner foundation and safe device registry, Phase 3 — Make server test cases truly target-neutral, Phase 4 — Device management IPC and target GUI (+3 more)

### Community 97 - "createScopedDomScanner"
Cohesion: 0.26
Nodes (13): ACTION_KEYS, ALLOWED_ACTIONS, hasOwn(), isNonEmptyString(), normalizeTestCase(), PLAY_CONTENT_TYPES, READY_NAMES, validateAction() (+5 more)

### Community 98 - "appium-server-manager.test.js"
Cohesion: 0.12
Nodes (6): createAppiumServerManager(), requireFunction(), assert, {createAppiumServerManager}, {EventEmitter}, test

### Community 101 - "required"
Cohesion: 0.20
Nodes (10): $defs, device, additionalProperties, required, type, appId, backendEnvironment, id (+2 more)

### Community 105 - "dom-scanning-performance.spec.js"
Cohesion: 0.17
Nodes (13): loadLgBatchCase(), testCasesCachePath(), findTestCaseById(), fs, loadCachedTestCases(), loadLocalTestCases(), { validateTestCaseList }, assert (+5 more)

### Community 106 - "focusRequestedContentRow"
Cohesion: 0.24
Nodes (10): collectFirstRowPlayableItems(), collectVisibleContentRows(), findBestContentRowMatch(), findContentRowByPosition(), findLastContentRow(), focusFirstRowStart(), focusRequestedContentRow(), isFocusedOnContentItem() (+2 more)

### Community 107 - "device-profile-service.js"
Cohesion: 0.16
Nodes (8): createDeviceProfileService(), {randomUUID}, text(), VERIFIED_FACT_FIELDS, verifiedFacts(), assert, {createDeviceProfileService}, test

### Community 108 - "searchAndOpenBestContent"
Cohesion: 0.21
Nodes (10): createLgTemporaryWebOsTarget(), net, path, {spawnSync: defaultSpawnSync}, targetEntries(), text(), assert, createHarness() (+2 more)

### Community 109 - "redactSensitiveText"
Cohesion: 0.18
Nodes (11): createLogRedactor(), redactSensitiveText(), cloneApiLogValue(), cloneForUi(), runLgCompatibilityCase(), sanitizeApiLog(), sanitizeCaseForUi(), withApiLog() (+3 more)

### Community 110 - "device-secret-store.test.js"
Cohesion: 0.25
Nodes (4): createDeviceSecretStore(), assert, {createDeviceSecretStore}, test

### Community 111 - "device-profile.schema.json"
Cohesion: 0.22
Nodes (8): additionalProperties, $id, required, $schema, title, type, devices, version

### Community 115 - "playAllItemsInFirstRow"
Cohesion: 0.39
Nodes (9): contentItemSignature(), expectFocusedContent(), getFocusedContentMetadata(), imageDataUrl(), isFocusedContentItem(), isFocusedNearRow(), moveToNextFirstRowContent(), playAllItemsInFirstRow() (+1 more)

### Community 116 - "tv-batch-runner.test.js"
Cohesion: 0.20
Nodes (10): normalizeDomState(), redact(), normalizeRemoteKey(), REMOTE_KEYS, TV_CAPABILITIES, TvSessionError, assert, {normalizeDomState} (+2 more)

### Community 117 - "browser-toolchain-ipc.test.js"
Cohesion: 0.22
Nodes (7): FAILURE_STATUSES, PROGRESS_CODES, publicResult(), registerBrowserToolchainIpc(), assert, {registerBrowserToolchainIpc}, test

### Community 118 - "test-case-action-runner.test.js"
Cohesion: 0.18
Nodes (11): assertApprovedProfile(), {createWebOsMyTvAutomation}, factoryError(), normalizeConnection(), {normalizeDomState}, normalizeLoopbackBaseUrl(), {normalizeRemoteKey, TvSessionError}, path (+3 more)

### Community 119 - "tv-batch-runner.test.js"
Cohesion: 0.13
Nodes (19): COMPATIBILITY_APPIUM_FAILURE_CODES, COMPATIBILITY_FAILED_ACTIONS, COMPATIBILITY_FAILED_CODES, COMPATIBILITY_FAILED_STAGES, COMPATIBILITY_GATE_ACTIONS, createLgCompatibilityValidation(), failedCompatibilityAction(), failedCompatibilityAppiumCode() (+11 more)

### Community 120 - "webos-appium-session.test.js"
Cohesion: 0.12
Nodes (14): assertInstalledAppId(), createWebOsAppiumSession(), endpointRedactionSecrets(), reset(), cleanup(), close(), start(), APPROVED_PROFILE (+6 more)

### Community 121 - "tv-device-ipc.js"
Cohesion: 0.33
Nodes (10): trustedLgCliArchive(), INSTALL_PROGRESS_CODES, INSTALL_PROGRESS_FAILURES, publicCompatibilityCatalogStatus(), publicInstallProgress(), publicLgToolchainInstallResult(), publicLgToolchainReview(), redactValue() (+2 more)

### Community 122 - "lg-toolchain-npm-closure.js"
Cohesion: 0.11
Nodes (23): CONTENT_TYPES, createLgProductGateCase(), createLgProductGateEvidenceWriter(), createLgProductGateManifest(), finalizeLgProductGateManifest(), fs, parseLgCaseRunnerArgs(), path (+15 more)

### Community 123 - "devices"
Cohesion: 0.25
Nodes (8): items, type, uniqueItems, $ref, properties, devices, version, const

### Community 124 - "login-popups.js"
Cohesion: 0.67
Nodes (3): updatedAt, format, type

### Community 125 - "defaultPackagePath"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, defaultPackagePath

### Community 126 - "target-action-runner.test.js"
Cohesion: 0.15
Nodes (12): requireActionCapabilities(), ACTION_CAPABILITIES, {compileTestCase}, {createTvMyTvActionHandlers}, notifyStep(), {requireActionCapabilities}, runTargetActions(), validateTargetCaseCapabilities() (+4 more)

### Community 127 - "tizen-poc-semantic.test.js"
Cohesion: 0.28
Nodes (10): caseIds(), registerLgRunIpc(), requestPayload(), SAFE_STATUS_CODES, safeResult(), text(), assert, createHarness() (+2 more)

### Community 128 - "devDependencies"
Cohesion: 0.29
Nodes (7): appium, electron, electron-builder, devDependencies, appium, electron, electron-builder

### Community 135 - "files"
Cohesion: 0.25
Nodes (7): files, app/**/*, DEVICE-COMPATIBILITY.json, node_modules/**/*, playwright.config.js, testcased.json, tests/**/*

### Community 137 - "assertPlayback"
Cohesion: 0.33
Nodes (7): assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), getPlayerState(), getVisiblePopup(), inspectPlaybackAfterWait()

### Community 140 - "locator-contracts.spec.js"
Cohesion: 0.29
Nodes (4): createBrowserToolchain(), assert, {createBrowserToolchain}, test

### Community 141 - "playwright-runner.test.js"
Cohesion: 0.40
Nodes (4): buildPlaywrightTestArgs(), assert, {buildPlaywrightTestArgs}, test

### Community 143 - "Real-TV Appium Delivery Plan"
Cohesion: 0.33
Nodes (6): Current status, Decisions already made, Definition of success, Explicit non-goals for the first release, Goal, Real-TV Appium Delivery Plan

### Community 151 - "package-config.test.js"
Cohesion: 0.33
Nodes (5): assert, fs, packageJson, path, test

### Community 152 - "preload.test.js"
Cohesion: 0.40
Nodes (3): assert, Module, test

### Community 154 - "createRendererController"
Cohesion: 0.17
Nodes (14): bootstrapRenderer(), BROWSER_INSTALL_FAILURE_STATUSES, BROWSER_INSTALL_PROGRESS_STEPS, cloneFrozenSubmission(), createRendererController(), DEFAULT_SETTINGS, freezeSubmission(), LG_INSTALL_FAILURE_STATUSES (+6 more)

### Community 155 - "enum"
Cohesion: 0.40
Nodes (5): enum, accessMode, private, shared-leased, shared-manual

### Community 159 - "lg-webos-poc-core.js"
Cohesion: 0.21
Nodes (8): APPIUM_FAILURE_CODES, createLoopbackAppiumClient(), normalizeLoopbackBaseUrl(), assert, {createLoopbackAppiumClient}, fetchImpl(), response(), test

### Community 161 - "browser-run-launcher.test.js"
Cohesion: 0.40
Nodes (4): createBrowserRunLauncher(), assert, {createBrowserRunLauncher}, test

### Community 162 - "appId"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, appId

### Community 163 - "enum"
Cohesion: 0.50
Nodes (4): enum, backendEnvironment, production, staging

### Community 164 - "tv-batch-runner.test.js"
Cohesion: 0.50
Nodes (3): assert, contentRows, test

### Community 165 - "label"
Cohesion: 0.50
Nodes (4): maxLength, minLength, type, label

### Community 166 - "enum"
Cohesion: 0.50
Nodes (4): enum, platform, tizen, webos

### Community 170 - "app-cleanup.test.js"
Cohesion: 0.33
Nodes (4): logoutApp(), assert, {logoutApp}, test

### Community 171 - "firmwareVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, firmwareVersion

### Community 173 - "dom-snapshot.spec.js"
Cohesion: 0.22
Nodes (7): {collectVisibleContentRows}, {createDomSnapshotCache, getDomSnapshotIdentity}, {remotePress}, {test, expect}, createDomSnapshotCache(), getDomSnapshotIdentity(), {getSelectorContract}

### Community 174 - "target-action-context.js"
Cohesion: 0.27
Nodes (6): createTargetActionContext(), objectOrEmpty(), TargetActionError, assert, {
  TargetActionError,
  createTargetActionContext,
  requireActionCapabilities,
}, test

### Community 175 - "findServiceIdInAllServices"
Cohesion: 0.29
Nodes (8): containsTextPattern(), escapeRegExp(), fuzzyMatch(), normalizeVietnameseText(), getTestOptions(), assert, {
  normalizeVietnameseText,
  fuzzyMatch,
}, test

### Community 178 - "tv-batch-runner.test.js"
Cohesion: 0.19
Nodes (16): approvedChromeDriverUrl(), clone(), freeze(), PLATFORM_KEYS, publicCatalogStatus(), requiredText(), selectChromeDriver(), createLgCompatibilityCatalogService() (+8 more)

### Community 180 - "defaultPackageVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, notes

### Community 183 - "lg-toolchain-installer.test.js"
Cohesion: 0.29
Nodes (5): createLgToolchainInstaller(), assert, createInstaller(), {createLgToolchainInstaller}, test

### Community 185 - "createdAt"
Cohesion: 0.67
Nodes (3): format, type, createdAt

### Community 186 - "vendorDeviceName"
Cohesion: 0.67
Nodes (3): vendorDeviceName, maxLength, type

### Community 190 - "lg-compatibility-catalog-store.test.js"
Cohesion: 0.17
Nodes (10): createLgCompatibilityCatalogStore(), path, {validateLgCompatibilityCatalog}, assert, catalog, {createLgCompatibilityCatalogStore}, fs, os (+2 more)

### Community 192 - "lg-compatibility-attempt-service.test.js"
Cohesion: 0.32
Nodes (5): createLgCompatibilityAttemptService(), assert, createHarness(), {createLgCompatibilityAttemptService}, test

### Community 193 - "dom-scanning-performance.spec.js"
Cohesion: 0.15
Nodes (12): artifacts, batchBudget, contentRows, domScan, domSnapshots, navigation, playback, selectors (+4 more)

### Community 196 - "lg-compatibility-catalog-service.test.js"
Cohesion: 0.33
Nodes (4): assert, catalog, {createLgCompatibilityCatalogService}, test

### Community 201 - "osVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, osVersion

## Knowledge Gaps
- **1006 isolated node(s):** `PROGRESS_CODES`, `FAILURE_STATUSES`, `{randomUUID}`, `VERIFIED_FACT_FIELDS`, `REQUIRED_FIELDS` (+1001 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolve()` connect `lg-webos-poc.js` to `tv-toolchain.test.js`, `mytv-session-fixture.js`, `window-close-controller.test.js`, `waits.js`, `assertPlayback`, `locator-contracts.spec.js`, `tizen-poc-login.js`, `tizen-poc.js`, `tizen-poc-core.js`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `getPlayerState()` connect `assertPlayback` to `openAppAndEnterLoginPage`, `mytv-helpers.legacy.js`, `lg-webos-poc.js`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `normalizeVietnameseText()` connect `findServiceIdInAllServices` to `AGENTS.md`, `renderer.js`, `test-case-action-runner.js`, `selector-validation.js`, `webos-read-only-adapter.js`, `Server-Driven MyTV Test Case Runner`, `dom-session.js`, `findServiceIdInAllServices`, `webos-mytv-automation.js`, `content-rows.js`, `workflows.js`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `PROGRESS_CODES`, `FAILURE_STATUSES`, `{randomUUID}` to the rest of the system?**
  _1006 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mytv-helpers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md` be split into smaller, more focused modules?**
  _Cohesion score 0.13230769230769232 - nodes in this community are weakly interconnected._
- **Should `renderer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._