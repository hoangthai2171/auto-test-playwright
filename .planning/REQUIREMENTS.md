# Requirements: MyTV Auto Test

**Defined:** 2026-07-13
**Core Value:** QA engineers can reliably test MyTV TV app functionality through remote-control navigation without writing code, using either pre-built test scenarios or natural language descriptions.

## v1 Requirements

Requirements for code quality and performance improvements milestone.

### Code Quality - Module Refactoring

- [x] **REFACTOR-01**: Extract text normalization and fuzzy matching into dedicated `text-utils.js` module with exported `normalizeVietnameseText()` and `fuzzyMatch()` functions
- [x] **REFACTOR-02**: Extract navigation primitives (arrow key movement, Enter, Backspace) into `navigation.js` module with `remoteFocusById()`, `remoteFocusByText()`, `remoteFocus()` functions
- [x] **REFACTOR-03**: Extract content row discovery logic into `content-rows.js` module with `collectVisibleContentRows()` and `focusRequestedContentRow()` functions
- [x] **REFACTOR-04**: Extract playback verification into `playback.js` module with `assertPlayback()` and player state checking functions
- [x] **REFACTOR-05**: Extract artifact capture logic into `artifacts.js` module with screenshot, JSON attachment, and report generation functions
- [x] **REFACTOR-06**: Create central `index.js` that re-exports all module functions to maintain backward compatibility with existing test specs
- [x] **REFACTOR-07**: Update all test spec files to import from new modular structure without breaking existing test scenarios

### Code Quality - Selector Stability

- [ ] **SELECTOR-01**: Define selector contracts in a central `selectors.js` config file with explicit attribute names, class patterns, and geometry constraints
- [ ] **SELECTOR-02**: Add candidate validation that captures and attaches DOM snapshots when selector matching fails
- [ ] **SELECTOR-03**: Verify selected element title/ID immediately before activation and fail fast if mismatch detected
- [ ] **SELECTOR-04**: Add selector health check that validates expected DOM structure exists before running test scenarios

### Performance - Smart State Detection

- [ ] **PERF-01**: Replace 2.5-second fixed wait after opening app with focus state detection polling (wait for `.focused` element to exist)
- [ ] **PERF-02**: Replace 10-second sleep after login with home screen readiness check (wait for left menu and content rows to appear)
- [ ] **PERF-03**: Replace 6-second fixed wait after playback Enter with player state polling (check `hasVideo` and `isProbablyPlaying` properties)
- [ ] **PERF-04**: Replace 250ms per-key delays in navigation loops with configurable delay constant and reduce default to 100ms
- [ ] **PERF-05**: Add bounded wait utilities (`waitForFocusState()`, `waitForPlayerReady()`, `waitForContentVisible()`) with timeout and polling interval configuration

### Performance - Optimized DOM Scanning

- [ ] **PERF-06**: Scope content item queries to container selectors instead of `body *` full-page scan
- [ ] **PERF-07**: Extract only required attributes during element enumeration instead of computing full bounding rectangles for all elements
- [ ] **PERF-08**: Cache screen snapshot during a navigation step to avoid repeated full-DOM scans in retry loops
- [ ] **PERF-09**: Use Playwright Locator filtering for stable elements instead of evaluate-based full-DOM traversal where possible
- [ ] **PERF-10**: Reduce default `maxItems` batch playback limit from 60 to 10 and enforce total run time budget

## v2 Requirements

Deferred to future milestones after v1 refactoring and performance work is complete.

### Testing Infrastructure

- **TEST-01**: Add unit tests for text normalization and fuzzy matching functions
- **TEST-02**: Add unit tests for content row discovery and scoring logic
- **TEST-03**: Add integration tests for Electron IPC handlers (run-test, stop-test, show-report)
- **TEST-04**: Add tests for AI plan validation and execution paths
- **TEST-05**: Create fixture-based tests that don't depend on live MyTV staging environment

### Security Improvements

- **SEC-01**: Remove hard-coded credentials from all source files
- **SEC-02**: Add `.env.example` template and `.env*` to `.gitignore`
- **SEC-03**: Implement OS credential vault storage for API keys (replace localStorage)
- **SEC-04**: Add HTTPS endpoint validation before sending API keys to custom AI providers
- **SEC-05**: Implement artifact retention controls and sensitive data redaction

### CI/CD Pipeline

- **CI-01**: Add GitHub Actions workflow for dependency installation and audit
- **CI-02**: Add unit test execution in CI pipeline
- **CI-03**: Add platform-specific browser binary installation and packaging smoke tests
- **CI-04**: Add automated dependency update checks

## Out of Scope

Explicitly excluded features to prevent scope creep.

| Feature | Reason |
|---------|--------|
| TypeScript migration | Adds complexity without addressing current quality/performance goals; reconsider after refactoring complete |
| ESLint / Prettier setup | Code style tooling deferred; focus on functional improvements first |
| Test recording UI | Users work with pre-built scenarios or AI descriptions; recording adds significant complexity |
| Multi-application support | Tool is MyTV-specific; generalizing requires rearchitecting navigation and assertion logic |
| Parallel test execution | Shared session architecture requires `workers: 1`; enabling parallelism requires per-worker authentication redesign |
| Real-time collaboration | Single-user desktop app; multi-user features not in scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REFACTOR-01 | Phase 1 | Complete |
| REFACTOR-02 | Phase 1 | Complete |
| REFACTOR-03 | Phase 1 | Complete |
| REFACTOR-04 | Phase 1 | Complete |
| REFACTOR-05 | Phase 1 | Complete |
| REFACTOR-06 | Phase 1 | Complete |
| REFACTOR-07 | Phase 1 | Complete |
| SELECTOR-01 | Phase 2 | Pending |
| SELECTOR-02 | Phase 2 | Pending |
| SELECTOR-03 | Phase 2 | Pending |
| SELECTOR-04 | Phase 2 | Pending |
| PERF-01 | Phase 3 | Pending |
| PERF-02 | Phase 3 | Pending |
| PERF-03 | Phase 3 | Pending |
| PERF-04 | Phase 3 | Pending |
| PERF-05 | Phase 3 | Pending |
| PERF-06 | Phase 4 | Pending |
| PERF-07 | Phase 4 | Pending |
| PERF-08 | Phase 4 | Pending |
| PERF-09 | Phase 4 | Pending |
| PERF-10 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 after initial definition*
