# Graph Report - auto-test-playwright  (2026-07-31)

## Corpus Check
- 265 files · ~233,519 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2782 nodes · 4212 edges · 196 communities (190 shown, 6 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 397 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cdffb9b7`
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
- webos-appium-session.js
- lg-toolchain-manifest.js
- LG-only Real-TV Phase 2 Foundation Design
- tv-device-ipc.test.js
- AGENTS.md
- service-access.spec.js
- lg-toolchain-installer.js
- webos-target-registration.js
- Internal TV-Lab Lease Service
- File Structure
- openAppAndEnterLoginPage
- openLeftMenuFromHome
- lg-toolchain-detector.js
- Architecture and Contracts
- properties
- Phased Delivery Plan
- Global Constraints
- LG SDK Auto-Configuration Implementation Plan
- LG Device Dialog and Validation Design
- createScopedDomScanner
- appium-server-manager.test.js
- target-action-context.js
- LG Installer Progress and Driver Registration Design
- required
- File map
- Global Constraints
- LG SDK Auto-Configuration Design
- dom-scanning-performance.spec.js
- focusRequestedContentRow
- device-profile-service.js
- searchAndOpenBestContent
- redactSensitiveText
- device-secret-store.test.js
- device-profile.schema.json
- Flow-case API browser design
- Deferred Real-TV Appium Phase 2 Design
- Global Constraints
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
- Global Constraints
- Global Constraints
- Test Case Table and Sequential Batch Execution
- Tizen No-Screenshot POC Design
- Phase 3 Target-Neutral Actions Design
- LG Local Registration Design
- files
- app-cleanup.test.js
- assertPlayback
- createdAt
- Global Constraints
- locator-contracts.spec.js
- playwright-runner.test.js
- Real-TV Appium Delivery Plan
- Global Constraints
- Global Constraints
- Global Constraints
- Global Constraints
- Global Constraints
- Global Constraints
- Samsung Tizen DOM Semantic POC Design
- package-config.test.js
- preload.test.js
- Target selector and workspace behavior
- createRendererController
- enum
- Header brand and window sizing design
- Test Case Details Actions Block
- Test Case Details Value Blocks
- lg-webos-poc-core.js
- Desktop LG product-gate flow design
- browser-run-launcher.test.js
- appId
- enum
- tv-batch-runner.test.js
- label
- enum
- Global Constraints
- Global Constraints
- Service Navigation Success Criteria
- app-cleanup.test.js
- firmwareVersion
- Desktop LG Product-Gate Flow Implementation Plan
- dom-snapshot.spec.js
- target-action-context.js
- findServiceIdInAllServices
- compilerOptions
- Target selector and workspace behavior
- tv-batch-runner.test.js
- File structure
- defaultPackageVersion
- File structure
- lg-toolchain-manifest.test.js
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

## Communities (196 total, 6 thin omitted)

### Community 0 - "mytv-helpers.js"
Cohesion: 0.08
Nodes (14): approvedChromeDriverArtifact(), {createHash: defaultCreateHash}, createLgManagedInstallDependencies(), {createReadStream: defaultCreateReadStream}, {execFile}, fsPromises, path, {promisify} (+6 more)

### Community 1 - "AGENTS.md"
Cohesion: 0.15
Nodes (21): attachCurrentAppScreenshot(), attachFailureArtifacts(), attachFirstRowPlaybackReport(), attachMovieSearchFailureArtifacts(), attachSearchNoResultArtifacts(), captureCurrentAppScreenshot(), collectMovieSearchCandidates(), collectSearchResultCandidates() (+13 more)

### Community 2 - "renderer.js"
Cohesion: 0.17
Nodes (12): 1. Verify vendor connection first, 2. Prove Appium capabilities, 3. Prove the product flow, Failure classification, First desktop LG product-gate pilot (fresh approval required), LG compatibility catalog maintenance, Physical-TV Appium POC Runbook, POC evidence to retain outside git (+4 more)

### Community 3 - "mytv-session-fixture.js"
Cohesion: 0.12
Nodes (13): {__internal}, {test, expect}, test, {
  runStep,
  openAppAndEnterLoginPage,
  loginWithAccount,
  chooseFirstProfileAndEnterHome,
  closeHomePopupsAndVerifyHome,
}, { test }, {
  runStep,
  openSettingFromLeftMenu,
  attachCurrentAppScreenshot,
}, { test }, {
  runStep,
  openTelevisionFromLeftMenu,
  openChannel,
  playAllItemsInFirstRow,
  assertChannelPlayback,
  attachCurrentAppScreenshot,
} (+5 more)

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
Cohesion: 0.29
Nodes (6): Global Constraints, LG Read-only Connection Check Implementation Plan, Plan self-review, Task 1: Add a main-process read-only checker, Task 2: Expose a narrow main/preload/renderer interaction, Task 3: Record the safety boundary and complete verification

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
Cohesion: 0.18
Nodes (12): applyViewportScale(), base, {chromium}, fs, {getTestOptions}, isInteractiveBrowserPage(), isLivePreviewMode(), path (+4 more)

### Community 20 - "ai-row-selection.spec.js"
Cohesion: 0.18
Nodes (11): maxLength, type, properties, pattern, type, maxLength, minLength, type (+3 more)

### Community 23 - "content-rows.js"
Cohesion: 0.10
Nodes (49): activateVerifiedTarget(), collectFirstRowPlayableItems(), collectVisibleContentRows(), configureContentRows(), CONTENT_ITEM_CONTRACT, contentItemSignature(), createContentRowsApi(), {createDomSnapshotCache,getDomSnapshotIdentity} (+41 more)

### Community 24 - "workflows.js"
Cohesion: 0.05
Nodes (56): expectFocusedElementToLookOrange(), normalizeVietnameseText(), searchKeyboardInput(), {acceptDeviceLimitPopupIfVisible}, artifacts, assertServiceOpened(), attachServiceOpenFailure(), chooseFirstProfileAndEnterHome() (+48 more)

### Community 25 - "Real-TV Appium Handoff Ledger"
Cohesion: 0.04
Nodes (49): Artifact decision supplied by the user, Batch-failure decision supplied by the user, Blocking questions — answer before phase 1, Browser configuration local contracts — 2026-07-29, Chosen architecture, Compatibility catalog maintainer workflow, Current LG device dialog, Current repository facts (+41 more)

### Community 26 - "lg-webos-poc.js"
Cohesion: 0.09
Nodes (46): wait(), appiumHome, appiumRequest(), commandVersion(), assertSafeLgAppId(), buildLgCapabilities(), buildLgPocEnvironment(), buildLgRuntimeRedactionSecrets() (+38 more)

### Community 27 - "waits.js"
Cohesion: 0.09
Nodes (31): assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), attachPlaybackTimeout(), attachPlayerFailureArtifacts(), {expect}, inspectPlaybackAfterWait() (+23 more)

### Community 28 - "Current Samsung macOS command harness"
Cohesion: 0.06
Nodes (31): 2022 Samsung pilot authorized test-app installation — 2026-07-27, 2022 Samsung pilot default screenshot-gate attempt — 2026-07-27, 2022 Samsung pilot DOM-only partial attempt — 2026-07-27, 2022 Samsung pilot foreground-context check — 2026-07-27, 2022 Samsung pilot fresh-pairing recovery check — 2026-07-27, 2022 Samsung pilot one-key readiness diagnostic — 2026-07-27, 2022 Samsung pilot paired screenshot-gate retry — 2026-07-27, 2022 Samsung pilot read-only preflight — 2026-07-27 (+23 more)

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
Cohesion: 0.07
Nodes (28): Acceptance criteria for the first implementation, Action DSL, `assert_screen`, Chosen architecture, Current project constraints, Delivery phases, Description fallback compiler, Electron UI and IPC (+20 more)

### Community 34 - "FakeElement"
Cohesion: 0.09
Nodes (8): assert, createRendererFixture(), FakeClassList, FakeElement, fs, matchesSelector(), path, test

### Community 35 - "test-case-action-runner.js"
Cohesion: 0.09
Nodes (33): actionName(), assertPlayerReadyAfterDefaultWait(), assertVisibleScreenText(), attachJson(), { captureCurrentAppScreenshot }, capturePlayerCheckScreenshot(), classifyExpectedResult(), cleanupAfterFailedPlayerAction() (+25 more)

### Community 36 - "selector-validation.js"
Cohesion: 0.12
Nodes (28): activateVerifiedTarget(), assertFocusedTarget(), assertSelectorHealth(), captureActivationDiagnostics(), collectSelectorDiagnostics(), DEFAULT_MATCH_OPTIONS, describeVerificationFailure(), fuzzyLabelMatch() (+20 more)

### Community 37 - "window-close-controller.test.js"
Cohesion: 0.11
Nodes (12): createRunCloseGuard(), requiredCheck(), createManagedWindowCloseController(), createWindowCloseController(), required(), assert, {createRunCloseGuard}, test (+4 more)

### Community 38 - "lg-webos-case-runner-core.test.js"
Cohesion: 0.15
Nodes (15): parseLgCaseRunnerArgs(), withoutLgProductGateCredentials(), {createAppiumServerManager}, {createDeviceLock}, {
  createLgProductGateCase,
  createLgProductGateEvidenceWriter,
  createLgProductGateManifest,
  parseLgCaseRunnerArgs,
  runLgProductGateWithEvidence,
  withoutLgProductGateCredentials,
}, {createLoopbackAppiumClient}, {createTvRunner}, {createWebOsSessionFactory} (+7 more)

### Community 39 - "Architecture"
Cohesion: 0.22
Nodes (8): {collectVisibleContentRows}, {createScopedDomScanner}, SCAN_OPTIONS, {test, expect}, createScopedDomScanner(), {getSelectorContract}, collectVisibleAllServiceLabelsScoped(), scopedScanRecords()

### Community 40 - "artifacts.js"
Cohesion: 0.25
Nodes (7): Boundaries, Deferred live behavior, LG Device Connection Status Design, Non-goals, Purpose, Tests and verification, User experience

### Community 41 - "mytv-helpers.legacy.js"
Cohesion: 0.14
Nodes (21): attachFirstRowPlaybackReport(), center(), chooseDirection(), collectVisibleAllServiceLabels(), containsTextPattern(), DEFAULT_OPTIONS, escapeHtml(), escapeRegExp() (+13 more)

### Community 42 - "test-report.js"
Cohesion: 0.17
Nodes (22): applyInteractiveViewFitZoom(), finishTestProcess(), reportPath(), stopActiveTest(), stopPreviewWatcher(), userReportHtmlPath(), userReportJsonPath(), writeLgReportEntry() (+14 more)

### Community 43 - "navigation.js"
Cohesion: 0.11
Nodes (27): acceptDeviceLimitPopupIfVisible(), {expect}, navigation, {POPUP_FOCUS_DIALOG_IDS}, center(), chooseDirection(), enterWithVirtualKeyboard(), {expect} (+19 more)

### Community 44 - "run-test-case-tv.spec.js"
Cohesion: 0.10
Nodes (10): createTvRunner(), requiredDependency(), createWebOsSessionFactory(), assert, {createDeviceLock}, createFakeTvRunner(), {createTvRunner}, {createWebOsAppiumSession, createWebOsSessionFactory} (+2 more)

### Community 45 - "remotePress"
Cohesion: 0.16
Nodes (22): chooseFirstProfileAndEnterHome(), enterWithVirtualKeyboard(), findChannelIdByName(), findLeftMenuItemIdByFuzzyText(), findLeftMenuItemIdByText(), focusLeftMenuItem(), focusSearchMenuItem(), getSubpage() (+14 more)

### Community 46 - "tv-runner.test.js"
Cohesion: 0.11
Nodes (13): createDeviceLock(), assert, {createDeviceLock}, test, APPIUM, assert, CONNECTION, {createDeviceLock} (+5 more)

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
Cohesion: 0.14
Nodes (10): createDeviceDiscovery(), readIdentity(), readInstalledApp(), redactText(), requireReadOnlyAdapter(), approvedProfile, assert, {createDeviceDiscovery} (+2 more)

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
Cohesion: 0.09
Nodes (12): bestSearchCandidate(), CONTENT_TYPES, createWebOsMyTvAutomation(), FOCUS_SELECTORS, {normalizeVietnameseText}, scoreCandidate(), openSearch(), logout() (+4 more)

### Community 55 - "lg-cli-archive-importer.js"
Cohesion: 0.14
Nodes (12): createLgCliArchiveImporter(), path, REQUIRED_CLI_COMMANDS, {trustedLgCliArchive}, archive, assert, CLI_COMMANDS, createHarness() (+4 more)

### Community 56 - "lg-cli-import-operations.js"
Cohesion: 0.12
Nodes (12): {createHash: defaultCreateHash}, createLgCliImportOperations(), {createReadStream: defaultCreateReadStream}, {execFile}, {promisify}, runDefault, SUPPORTED_PLATFORMS, assert (+4 more)

### Community 57 - "Server-Driven Test Case Runner Implementation Plan"
Cohesion: 0.12
Nodes (16): Create, Delete, File map, Follow-up plan boundary: API retrieval and runtime cache, Global Constraints, Modify, Server-Driven Test Case Runner Implementation Plan, Task 1: Establish the pure test-case contract and unit-test command (+8 more)

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
Cohesion: 0.16
Nodes (17): getContractLocator(), resolveContractLocatorId(), attachLocatorContractMiss(), findLeftMenuItemIdByText(), focusLeftMenuItem(), focusSearchMenuItem(), isLeftMenuOpen(), openLeftMenuFromHome() (+9 more)

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

### Community 67 - "index.js"
Cohesion: 0.14
Nodes (13): File structure, Global Constraints, Placeholder scan, Plan self-review, Spec coverage, Task 1: Add an add/remove-only temporary webOS CLI target lease, Task 2: Add redacted, expiring compatibility inspection attempts, Task 3: Run one selected case with a verified temporary driver (+5 more)

### Community 68 - "File structure"
Cohesion: 0.20
Nodes (9): File structure, Global Constraints, LG Device Dialog and Deferred Validation Implementation Plan, Self-review, Task 1: Create an encrypted device-secret persistence boundary, Task 2: Add a candidate-only, fake-testable device-profile service, Task 3: Replace device IPC with a deferred, redacted candidate boundary, Task 4: Implement the compact LG selector and dialog editor (+1 more)

### Community 69 - "window-startup.test.js"
Cohesion: 0.18
Nodes (7): confirmWindowClose(), createWindow(), discardUnsyncedResultSubmission(), revealWindowOnFirstPaint(), assert, {revealWindowOnFirstPaint}, test

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
Cohesion: 0.16
Nodes (12): {classifyTvFailure}, {createDomSession}, {createTargetActionContext}, frameDataUrl(), PROGRESS_CODES, requireReset(), {runTargetActions}, runTvTestCase() (+4 more)

### Community 76 - "test-case-schema.js"
Cohesion: 0.12
Nodes (19): APPIUM_FAILURE_CODES, CREDENTIAL_STATUSES, FAILED_ACTIONS, FAILED_CODES, FAILED_STAGES, INSPECTION_STATUSES, publicCredentialStatus(), publicInspection() (+11 more)

### Community 77 - "tv-session.test.js"
Cohesion: 0.20
Nodes (14): applyCompatibilityProfile(), buildCandidateGateArgs(), compareProfiles(), {EXPECTED_LG_APP_ID}, parseCatalog(), parseCompatibilityCandidate(), requiredText(), {validateLgCompatibilityCatalog} (+6 more)

### Community 78 - "webos-appium-session.js"
Cohesion: 0.22
Nodes (6): api, fs, helpers, path, {test, expect}, workflows

### Community 79 - "lg-toolchain-manifest.js"
Cohesion: 0.20
Nodes (14): bundledCatalog, cloned(), createLgToolchainManifest(), expectedCliArchiveName(), isHttpsUrl(), {selectChromeDriver, validateChromeDriverArtifact, validateLgCompatibilityCatalog}, SUPPORTED_PLATFORMS, TRUSTED_BASELINE_CATALOG (+6 more)

### Community 80 - "LG-only Real-TV Phase 2 Foundation Design"
Cohesion: 0.15
Nodes (12): Architecture, Completion criteria, Components, Device and secret boundaries, Goal, LG-only Real-TV Phase 2 Foundation Design, Platform-neutral session contracts, Runner orchestration (+4 more)

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
Cohesion: 0.29
Nodes (6): CLOSURE, {gunzipSync}, trustedLgToolchainNpmClosure(), assert, test, {trustedLgToolchainNpmClosure}

### Community 85 - "webos-target-registration.js"
Cohesion: 0.18
Nodes (7): createWebOsTargetRegistration(), net, path, {spawnSync: defaultSpawnSync}, assert, {createWebOsTargetRegistration}, test

### Community 86 - "Internal TV-Lab Lease Service"
Cohesion: 0.17
Nodes (12): Acquire lease, API, Authentication and roles, Data model, Electron integration, Explicitly rejected alternatives, Future decision, Future feature — not in the first release (+4 more)

### Community 87 - "File Structure"
Cohesion: 0.17
Nodes (11): File Structure, Global Constraints, LG Local Toolchain Registration Implementation Plan, Placeholder scan, Plan Self-Review, Spec coverage, Task 1: Private, atomic local toolchain configuration, Task 2: Add-only webOS vendor target command boundary (+3 more)

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
Cohesion: 0.15
Nodes (13): Action compatibility strategy, Architecture and Contracts, Batch continuation and failure classification, Current LG desktop product-gate boundary, Current LG device-dialog boundary, Device data and secrets, Existing boundary to preserve, Future MyTV QA bridge contract (+5 more)

### Community 92 - "properties"
Cohesion: 0.40
Nodes (5): Browser configuration, Deferred future feature: Manage Samsung signing / Repackage for this TV, Device discovery and direct IP, Per-device package-file setting, Target selector and workspace behavior

### Community 93 - "Phased Delivery Plan"
Cohesion: 0.18
Nodes (11): Current LG-only increment — 2026-07-29, Current Phase 3 local-contract record — 2026-07-28, Current Samsung Phase 1 record — 2026-07-24, Phase 0 — Commit the test-lab contract, Phase 1 — Command-line hardware POC (no GUI changes), Phase 2 — Runner foundation and safe device registry, Phase 3 — Make server test cases truly target-neutral, Phase 4 — Device management IPC and target GUI (+3 more)

### Community 94 - "Global Constraints"
Cohesion: 0.18
Nodes (10): Deferred Real-TV Appium Phase 2 Implementation Plan, Global Constraints, Task 0: Prove that implementation is authorized, Task 1: Establish TV session contracts and redacted DOM state, Task 2: Build non-secret profiles, secret availability, and local locking, Task 3: Add loopback-only Appium lifecycle management, Task 4: Implement bounded device discovery and validation orchestration, Task 5: Add Tizen and webOS Appium session adapters behind the shared contract (+2 more)

### Community 95 - "LG SDK Auto-Configuration Implementation Plan"
Cohesion: 0.18
Nodes (10): File structure, Global Constraints, LG SDK Auto-Configuration Implementation Plan, Manual QA inventory (after automated contracts pass), Task 1: Define the pinned bundle and compatibility contracts, Task 2: Detect managed and Advanced sources without writes, Task 3: Build a confirmed-only, atomic installer, Task 4: Replace workspace setup with safe SDK settings IPC (+2 more)

### Community 96 - "LG Device Dialog and Validation Design"
Cohesion: 0.22
Nodes (8): Data and IPC boundaries, LG Device Dialog and Validation Design, Live validation boundary, Non-goals, Purpose, Tests and verification, Toolchain and compatibility behavior, User experience

### Community 97 - "createScopedDomScanner"
Cohesion: 0.26
Nodes (12): ACTION_KEYS, ALLOWED_ACTIONS, hasOwn(), isNonEmptyString(), normalizeTestCase(), PLAY_CONTENT_TYPES, READY_NAMES, validateAction() (+4 more)

### Community 98 - "appium-server-manager.test.js"
Cohesion: 0.12
Nodes (6): createAppiumServerManager(), requireFunction(), assert, {createAppiumServerManager}, {EventEmitter}, test

### Community 99 - "target-action-context.js"
Cohesion: 0.22
Nodes (8): Catalog format, Components, Failure behavior, LG Compatibility Catalog Design, Maintainer validation skill, Normal-user flow, Purpose, Tests and verification

### Community 100 - "LG Installer Progress and Driver Registration Design"
Cohesion: 0.22
Nodes (8): Architecture and data flow, Failure handling, LG Installer Progress and Driver Registration Design, Non-goals, Purpose, Root cause, Tests and verification, User experience

### Community 101 - "required"
Cohesion: 0.20
Nodes (10): $defs, device, additionalProperties, required, type, appId, backendEnvironment, id (+2 more)

### Community 102 - "File map"
Cohesion: 0.20
Nodes (9): File map, Global Constraints, LG-only Real-TV Phase 2 Foundation Implementation Plan, Plan self-review, Task 1: Define TV contracts and redacted DOM state, Task 2: Add non-secret LG profiles, secret availability, and local locks, Task 3: Implement read-only LG validation and loopback Appium lifecycle, Task 4: Implement the installed-app webOS session adapter (+1 more)

### Community 103 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Global Constraints, Phase 3 Target-Neutral Actions Implementation Plan, Task 1: Define the target-neutral action contract, Task 2: Add trusted TV DOM primitives, Task 3: Extract target-neutral action dispatch and preserve Browser behavior, Task 4: Port authenticated/navigation/search actions through trusted adapters, Task 5: Port playback and row-navigation actions, Task 6: Add fake-only terminal execution and cleanup/result contracts (+1 more)

### Community 104 - "LG SDK Auto-Configuration Design"
Cohesion: 0.20
Nodes (9): Compatibility model, Error and security behavior, LG SDK Auto-Configuration Design, Main-process architecture, Non-goals, Purpose, Scope and success criteria, Testing and validation (+1 more)

### Community 105 - "dom-scanning-performance.spec.js"
Cohesion: 0.17
Nodes (14): loadLgBatchCase(), testCasesCachePath(), validateTestCaseList(), findTestCaseById(), fs, loadCachedTestCases(), loadLocalTestCases(), { validateTestCaseList } (+6 more)

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

### Community 112 - "Flow-case API browser design"
Cohesion: 0.22
Nodes (8): Architecture and data flow, Cache and execution, Flow-case API browser design, Goal, Scope boundaries, Testing strategy, UI state and error handling, User-facing behavior

### Community 113 - "Deferred Real-TV Appium Phase 2 Design"
Cohesion: 0.22
Nodes (8): Components and responsibilities, Deferred Real-TV Appium Phase 2 Design, Deliverable, Execution gate, Goal, Phase 2 boundary, Safety rules, Test and verification strategy

### Community 114 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, LG Device Connection Status Implementation Plan, Plan self-review, Task 1: Lock the local-only connection-status contract with renderer tests, Task 2: Implement the local-only panel and neutral renderer state

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
Cohesion: 0.13
Nodes (17): assertApprovedProfile(), assertInstalledAppId(), createWebOsAppiumSession(), {createWebOsMyTvAutomation}, endpointRedactionSecrets(), factoryError(), normalizeConnection(), {normalizeDomState} (+9 more)

### Community 119 - "tv-batch-runner.test.js"
Cohesion: 0.13
Nodes (19): COMPATIBILITY_APPIUM_FAILURE_CODES, COMPATIBILITY_FAILED_ACTIONS, COMPATIBILITY_FAILED_CODES, COMPATIBILITY_FAILED_STAGES, COMPATIBILITY_GATE_ACTIONS, createLgCompatibilityValidation(), failedCompatibilityAction(), failedCompatibilityAppiumCode() (+11 more)

### Community 120 - "webos-appium-session.test.js"
Cohesion: 0.20
Nodes (7): APPROVED_PROFILE, assert, createSession(), {createWebOsAppiumSession, createWebOsSessionFactory}, LOOPBACK_SERVER, RUNTIME_CONNECTION, test

### Community 121 - "tv-device-ipc.js"
Cohesion: 0.33
Nodes (10): trustedLgCliArchive(), INSTALL_PROGRESS_CODES, INSTALL_PROGRESS_FAILURES, publicCompatibilityCatalogStatus(), publicInstallProgress(), publicLgToolchainInstallResult(), publicLgToolchainReview(), redactValue() (+2 more)

### Community 122 - "lg-toolchain-npm-closure.js"
Cohesion: 0.15
Nodes (7): requestLoopbackAppium(), assert, {
  createLgProductGateCase,
  createLgProductGateEvidenceWriter,
  createLgProductGateManifest,
  finalizeLgProductGateManifest,
  parseLgCaseRunnerArgs,
  requestLoopbackAppium,
  runLgProductGateWithEvidence,
  withoutLgProductGateCredentials,
}, fs, os, path, test

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

### Community 129 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Flow-case API Browser Implementation Plan, Global Constraints, Task 1: Add tested API and cache primitives, Task 2: Connect main-process IPC, cache-backed execution, and preload, Task 3: Replace sidebar APP_URL with folders and add Settings/network controls, Task 4: Update project documentation and verify the complete change

### Community 130 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Render a selectable semantic test-case table, Task 2: Move case details into a modal with safe display formatting, Task 3: Execute selected cases sequentially and isolate failures, Task 4: Validate compatibility and finish the change, Test Case Table and Sequential Batch Execution Implementation Plan

### Community 131 - "Test Case Table and Sequential Batch Execution"
Cohesion: 0.29
Nodes (6): Batch execution, Compatibility and error handling, Goal, Test Case Table and Sequential Batch Execution, UI structure, Verification

### Community 132 - "Tizen No-Screenshot POC Design"
Cohesion: 0.29
Nodes (6): Documentation, Goal, Safety and Result Semantics, Scope, Test Design, Tizen No-Screenshot POC Design

### Community 133 - "Phase 3 Target-Neutral Actions Design"
Cohesion: 0.29
Nodes (6): Boundary, Execution model, Goal, Phase 3 Target-Neutral Actions Design, Safety and scope, Testing

### Community 134 - "LG Local Registration Design"
Cohesion: 0.29
Nodes (6): Architecture, Goal, LG Local Registration Design, Scope, Testing and Verification, Validation and Errors

### Community 135 - "files"
Cohesion: 0.25
Nodes (7): files, app/**/*, DEVICE-COMPATIBILITY.json, node_modules/**/*, playwright.config.js, testcased.json, tests/**/*

### Community 136 - "app-cleanup.test.js"
Cohesion: 0.22
Nodes (8): Browser Configuration Implementation Plan, File structure, Global Constraints, Task 1: Establish a pinned managed-browser detector, Task 2: Add confirmed-only browser installation and fixed progress, Task 3: Wire safe Browser IPC and Browser-run gating, Task 4: Add Browser configuration and the missing-browser call to action, Task 5: Document release behavior and maintain the graph

### Community 137 - "assertPlayback"
Cohesion: 0.33
Nodes (7): assertChannelPlayback(), assertMoviePlayback(), assertPlayback(), assertSearchContentPlayback(), getPlayerState(), getVisiblePopup(), inspectPlaybackAfterWait()

### Community 138 - "createdAt"
Cohesion: 0.26
Nodes (11): CONTENT_TYPES, createLgProductGateCase(), createLgProductGateEvidenceWriter(), createLgProductGateManifest(), finalizeLgProductGateManifest(), fs, path, required() (+3 more)

### Community 139 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, LG Installer Progress and Driver Registration Implementation Plan, Plan self-review, Task 1: Correct the flat Appium driver verification contract, Task 2: Emit and transport fixed local installer milestones, Task 3: Render transient safe progress in SDK Settings

### Community 140 - "locator-contracts.spec.js"
Cohesion: 0.29
Nodes (4): createBrowserToolchain(), assert, {createBrowserToolchain}, test

### Community 141 - "playwright-runner.test.js"
Cohesion: 0.40
Nodes (4): buildPlaywrightTestArgs(), assert, {buildPlaywrightTestArgs}, test

### Community 143 - "Real-TV Appium Delivery Plan"
Cohesion: 0.33
Nodes (6): Current status, Decisions already made, Definition of success, Explicit non-goals for the first release, Goal, Real-TV Appium Delivery Plan

### Community 144 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Header Brand and Window Sizing Implementation Plan, Task 1: Add failing layout and window contract tests, Task 2: Implement the header brand and taller default window, Task 3: Verify and commit the isolated change

### Community 145 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Add the failing Action-list stylesheet contract test, Task 2: Add the grouped Action-list block styling, Task 3: Verify and commit, Test Case Details Actions Block Implementation Plan

### Community 146 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Add the failing stylesheet contract test, Task 2: Add the value block styling, Task 3: Verify and commit, Test Case Details Value Blocks Implementation Plan

### Community 147 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Samsung Tizen DOM Semantic POC Implementation Plan, Task 1: Define and test the semantic request boundary, Task 2: Add remote-only search-result selection and player observation, Task 3: Wire the opt-in POC command and documentation

### Community 148 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Test screenshot-policy behavior, Task 2: Wire the explicit partial-POC mode, Task 3: Update runbook gates and validate locally, Tizen No-Screenshot POC Implementation Plan

### Community 149 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Phase 4 LG Safety Closeout Implementation Plan, Task 1: Verify target-specific preview controls in Electron, Task 2: Record the scoped LG Phase 4 gate result, Task 3: Hold the material direct-IP/device-modal expansion for confirmation

### Community 150 - "Samsung Tizen DOM Semantic POC Design"
Cohesion: 0.33
Nodes (5): Design, Goal, Samsung Tizen DOM Semantic POC Design, Scope and safety boundary, Validation

### Community 151 - "package-config.test.js"
Cohesion: 0.33
Nodes (5): assert, fs, packageJson, path, test

### Community 152 - "preload.test.js"
Cohesion: 0.40
Nodes (3): assert, Module, test

### Community 153 - "Target selector and workspace behavior"
Cohesion: 0.25
Nodes (7): Architecture and data flow, Browser Configuration Design, Goal, Non-goals, Scope and constraints, User experience, Verification and failure behavior

### Community 154 - "createRendererController"
Cohesion: 0.17
Nodes (14): bootstrapRenderer(), BROWSER_INSTALL_FAILURE_STATUSES, BROWSER_INSTALL_PROGRESS_STEPS, cloneFrozenSubmission(), createRendererController(), DEFAULT_SETTINGS, freezeSubmission(), LG_INSTALL_FAILURE_STATUSES (+6 more)

### Community 155 - "enum"
Cohesion: 0.40
Nodes (5): enum, accessMode, private, shared-leased, shared-manual

### Community 156 - "Header brand and window sizing design"
Cohesion: 0.40
Nodes (4): Design, Goal, Header brand and window sizing design, Verification

### Community 157 - "Test Case Details Actions Block"
Cohesion: 0.40
Nodes (4): Design, Goal, Test Case Details Actions Block, Verification

### Community 158 - "Test Case Details Value Blocks"
Cohesion: 0.40
Nodes (4): Design, Goal, Test Case Details Value Blocks, Verification

### Community 159 - "lg-webos-poc-core.js"
Cohesion: 0.21
Nodes (8): APPIUM_FAILURE_CODES, createLoopbackAppiumClient(), normalizeLoopbackBaseUrl(), assert, {createLoopbackAppiumClient}, fetchImpl(), response(), test

### Community 160 - "Desktop LG product-gate flow design"
Cohesion: 0.18
Nodes (10): Desktop LG product-gate flow design, Goal, Main-process execution boundary, Non-goals, Prerequisites and preflight, Reporting and recovery, Scope, Status (+2 more)

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

### Community 167 - "Global Constraints"
Cohesion: 0.50
Nodes (3): Global Constraints, Task 1: Make partial-success cleanup status truthful and record the scope boundary, Tizen Partial POC Cleanup Status Implementation Plan

### Community 168 - "Global Constraints"
Cohesion: 0.50
Nodes (3): Global Constraints, Task 1: Record the screenshot-capture investigation, Tizen Screenshot Gate Evidence Implementation Plan

### Community 169 - "Service Navigation Success Criteria"
Cohesion: 0.50
Nodes (3): Decision, Service Navigation Success Criteria, Verification

### Community 170 - "app-cleanup.test.js"
Cohesion: 0.33
Nodes (4): logoutApp(), assert, {logoutApp}, test

### Community 171 - "firmwareVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, firmwareVersion

### Community 172 - "Desktop LG Product-Gate Flow Implementation Plan"
Cohesion: 0.20
Nodes (9): Desktop LG Product-Gate Flow Implementation Plan, File and interface map, Global Constraints, Plan self-review, Task 1: Lock zero-contact LG batch admission and compatibility contracts, Task 2: Extract the local Appium transport and add safe TV-run lifecycle hooks, Task 3: Build the main-process serial LG batch, retry/recovery, report, and IPC boundary, Task 4: Integrate the existing workspace UI with LG readiness, confirmation, run state, previews, and recovery (+1 more)

### Community 173 - "dom-snapshot.spec.js"
Cohesion: 0.22
Nodes (6): {collectVisibleContentRows}, {createDomSnapshotCache, getDomSnapshotIdentity}, {remotePress}, {test, expect}, getDomSnapshotIdentity(), {getSelectorContract}

### Community 174 - "target-action-context.js"
Cohesion: 0.27
Nodes (6): createTargetActionContext(), objectOrEmpty(), TargetActionError, assert, {
  TargetActionError,
  createTargetActionContext,
  requireActionCapabilities,
}, test

### Community 175 - "findServiceIdInAllServices"
Cohesion: 0.17
Nodes (16): containsTextPattern(), escapeRegExp(), fuzzyMatch(), normalizeVietnameseText(), findLeftMenuItemIdByFuzzyText(), findServiceIdInAllServices(), findVisibleElementIdByFuzzyLabelScoped(), findVisibleServiceIdByTitleAttributeScoped() (+8 more)

### Community 177 - "Target selector and workspace behavior"
Cohesion: 0.25
Nodes (7): Dialog flow, Entry point, Goal, Implementation boundary, Safety boundaries, Transient LG compatibility connection design, Verification

### Community 178 - "tv-batch-runner.test.js"
Cohesion: 0.19
Nodes (16): approvedChromeDriverUrl(), clone(), freeze(), PLATFORM_KEYS, publicCatalogStatus(), requiredText(), selectChromeDriver(), createLgCompatibilityCatalogService() (+8 more)

### Community 179 - "File structure"
Cohesion: 0.25
Nodes (7): File structure, Global Constraints, LG Compatibility Catalog Implementation Plan, Task 1: Add the baseline catalog and pure catalog contract, Task 2: Fetch, validate, and atomically cache the catalog in the main process, Task 3: Route selected catalog artifacts through managed installation and run readiness, Task 4: Expose catalog status and explicit refresh in SDK configuration

### Community 180 - "defaultPackageVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, notes

### Community 181 - "File structure"
Cohesion: 0.29
Nodes (6): Device Compatibility Check Skill Implementation Plan, File structure, Global Constraints, Task 1: Define the pure candidate-validation and recording contract, Task 2: Add the non-interactive candidate runner without running it live, Task 3: Create and validate the project-only skill and documentation

### Community 182 - "lg-toolchain-manifest.test.js"
Cohesion: 0.33
Nodes (6): assert, automaticArtifact(), {createLgToolchainManifest, trustedLgCliArchive, trustedChromeDriverArchive, trustedLgToolchainBundle, trustedLgToolchainManifest}, fixedManifest(), SHA, test

### Community 183 - "lg-toolchain-installer.test.js"
Cohesion: 0.15
Nodes (11): createLgToolchainInstaller(), SAFE_INSTALL_FAILURES, SAFE_VERIFICATION_RESULTS, {trustedLgToolchainBundle, trustedLgToolchainManifest}, {trustedLgToolchainNpmClosure}, trustedLgToolchainBundle(), trustedLgToolchainManifest(), assert (+3 more)

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
Cohesion: 0.11
Nodes (19): {
  DEFAULT_BATCH_MAX_ITEMS,
  DEFAULT_BATCH_RUNTIME_BUDGET_MS,
  normalizeBatchLimits,
  createBatchBudget,
}, fs, path, {test, expect}, createBatchBudget(), hasExplicitItemLimit(), normalizeBatchLimits(), artifacts (+11 more)

### Community 196 - "lg-compatibility-catalog-service.test.js"
Cohesion: 0.33
Nodes (4): assert, catalog, {createLgCompatibilityCatalogService}, test

### Community 201 - "osVersion"
Cohesion: 0.67
Nodes (3): maxLength, type, osVersion

## Knowledge Gaps
- **1278 isolated node(s):** `PROGRESS_CODES`, `FAILURE_STATUSES`, `{randomUUID}`, `VERIFIED_FACT_FIELDS`, `REQUIRED_FIELDS` (+1273 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolve()` connect `lg-webos-poc.js` to `tv-toolchain.test.js`, `window-close-controller.test.js`, `waits.js`, `assertPlayback`, `locator-contracts.spec.js`, `graphify.js`, `tizen-poc-login.js`, `tizen-poc.js`, `tizen-poc-core.js`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `getPlayerState()` connect `assertPlayback` to `openAppAndEnterLoginPage`, `mytv-helpers.legacy.js`, `lg-webos-poc.js`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `normalizeVietnameseText()` connect `findServiceIdInAllServices` to `AGENTS.md`, `webos-read-only-adapter.js`, `test-case-action-runner.js`, `selector-validation.js`, `dom-session.js`, `webos-mytv-automation.js`, `content-rows.js`, `workflows.js`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `PROGRESS_CODES`, `FAILURE_STATUSES`, `{randomUUID}` to the rest of the system?**
  _1278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mytv-helpers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._
- **Should `mytv-session-fixture.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._