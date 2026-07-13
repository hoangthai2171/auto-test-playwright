# MyTV Auto Test

## What This Is

MyTV Auto Test is a desktop application that runs automated Playwright tests for the MyTV HTML5 TV web application. It provides a graphical interface for QA engineers and testers to execute pre-built test scenarios (login, channel playback, movie playback, search, settings) and view results with live browser preview, plus an AI mode that converts Vietnamese natural-language test descriptions into executable test plans.

## Core Value

QA engineers can reliably test MyTV TV app functionality through remote-control navigation without writing code, using either pre-built test scenarios or natural language descriptions.

## Requirements

### Validated

- ✓ Electron desktop UI with test selection and parameter input — existing
- ✓ Playwright test suite with TV remote-style keyboard navigation — existing
- ✓ Login authentication flow with virtual keyboard — existing
- ✓ Channel playback testing (by name and by category) — existing
- ✓ Movie playback testing (first item, by name, by category) — existing
- ✓ Search and playback verification — existing
- ✓ Settings screen navigation — existing
- ✓ AI test plan generation from Vietnamese descriptions — existing
- ✓ Live browser preview during test execution — existing
- ✓ Interactive CDP-based browser mode — existing
- ✓ HTML test reports with screenshots and artifacts — existing
- ✓ macOS and Windows desktop app packaging — existing
- ✓ Terminal-based test execution modes — existing
- ✓ Role-based selector contracts, bounded activation verification, and ready-state health checks — Phase 2

### Active

- [ ] Improve test stability and reduce fixed waits
- [ ] Add CI pipeline for automated testing
- [ ] Implement secure credential management
- [ ] Refactor monolithic helper module into focused components
- [ ] Add unit tests for helper functions
- [ ] Improve AI plan validation and error handling

### Out of Scope

- Real-time collaborative testing — single-user tool
- Cloud-based test execution — local desktop app only
- Test recording/generation UI — uses pre-built or AI-generated tests
- Multi-application support — MyTV app only

## Context

**Existing System:**
The codebase is a fully functional Electron + Playwright test automation application with three execution modes: direct Playwright CLI, interactive terminal runner, and desktop GUI. The application automates a TV web app that uses remote-control style navigation (arrow keys, Enter, Backspace) rather than mouse clicks, requiring specialized navigation helpers and fuzzy Vietnamese text matching.

**Technical Environment:**
- Node.js 20+ with CommonJS modules
- Electron 31.7.7 for desktop UI
- Playwright 1.61.1 for browser automation
- Single-worker Playwright configuration for shared session state
- Platform-specific browser binaries bundled with the app

**Current Challenges:**
- Large monolithic helper module (2,825 lines) with duplicated logic
- Heavy use of fixed waits affecting test speed and reliability
- External UI drift remains possible, but Phase 2 now centralizes selector contracts and reports bounded activation/health diagnostics
- Hard-coded credentials in multiple locations
- No CI/CD pipeline
- Limited test coverage for Electron IPC and AI features

**User Base:**
QA engineers and testers working on the MyTV platform who need to verify TV app functionality across multiple scenarios without writing test code.

## Constraints

- **Platform**: macOS and Windows desktop apps only; must build on each target platform due to platform-specific browser binaries
- **Tech Stack**: Must preserve Electron + Playwright + CommonJS architecture; existing test suite depends on this structure
- **Navigation Model**: All MyTV app interaction must use keyboard navigation (arrow keys + Enter); no mouse clicks allowed due to TV remote control interface
- **Session Sharing**: Must maintain `workers: 1` in Playwright config because test scenarios depend on shared authenticated session state
- **Vietnamese Language**: All UI text and search queries are in Vietnamese; fuzzy text matching with accent normalization required
- **Backward Compatibility**: Changes must not break existing test scenarios or desktop UI functionality

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-worker Playwright with shared session | Feature tests depend on login state established by login spec; parallel workers would require separate authentication per worker | ✓ Good — Enables simple test scenarios but limits parallelization |
| TV remote-style keyboard navigation only | Target app is HTML5 TV controlled by remote; mouse clicks don't map to actual user interaction | ✓ Good — Tests match real user experience |
| Electron desktop app vs web-based runner | QA team needs standalone tool with bundled browsers; no server infrastructure available | ✓ Good — Self-contained deployment |
| CommonJS modules | Project initialized before widespread ES modules adoption; Playwright and Electron both support CommonJS | — Pending — May revisit for ES modules |
| Bundle Playwright browsers with app | Users may not have internet access or npm global cache on test machines | ✓ Good — Enables offline test execution |
| AI mode with local + cloud planners | Provides value without requiring API keys; cloud option available for complex requests | ✓ Good — Flexible for different user needs |
| Fuzzy Vietnamese text matching | MyTV UI uses dynamic content without stable test IDs; exact matching too brittle | ⚠️ Revisit — Works with Phase 2 score thresholds and ambiguity checks, but still needs maintenance when UI changes |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-13 after Phase 2 completion*
