# Roadmap: MyTV Auto Test - Code Quality & Performance

**Created:** 2026-07-13
**Target:** Improve test stability and maintainability through modularization, selector hardening, and performance optimization

## Overview

This roadmap delivers a more maintainable, faster, and more reliable test automation framework by breaking apart the monolithic helper module, hardening selector contracts, and replacing fixed waits with smart state detection. All changes preserve backward compatibility with existing test scenarios and the TV remote navigation model.

**Success Criteria:**
- Test suite runs 40-60% faster through smart waits and optimized DOM scanning
- Helper logic is unit-testable in isolated modules
- Selector failures surface actionable diagnostic data
- All existing test scenarios pass without modification

## Phases

### Phase 1: Extract Core Helper Modules

**Goal:** Break the 2,825-line `mytv-helpers.js` into focused, testable modules while maintaining full backward compatibility

**Requirements Covered:**
- REFACTOR-01: Text normalization and fuzzy matching module
- REFACTOR-02: Navigation primitives module
- REFACTOR-03: Content row discovery module
- REFACTOR-04: Playback verification module
- REFACTOR-05: Artifact capture module
- REFACTOR-06: Central index with backward-compatible exports
- REFACTOR-07: Update test specs to use new structure

**Success Criteria:**
- `text-utils.js` exports `normalizeVietnameseText()` and `fuzzyMatch()` with identical behavior to original
- `navigation.js` exports remote focus primitives (`remoteFocusById`, `remoteFocusByText`, `remoteFocus`)
- `content-rows.js` exports `collectVisibleContentRows()` and `focusRequestedContentRow()`
- `playback.js` exports `assertPlayback()` and player state functions
- `artifacts.js` exports screenshot and report attachment functions
- `index.js` re-exports all functions maintaining original import paths
- All existing test specs run unchanged or with minimal import updates
- No behavioral regressions in login, channel, movie, search, settings, or AI scenarios

**Dependencies:** None (foundational phase)

**Estimated Complexity:** Medium

---

### Phase 2: Harden Selector Contracts and Validation

**Goal:** Add defensive selector contracts, validation, and diagnostic capture to reduce flakiness from external UI changes

**Requirements Covered:**
- SELECTOR-01: Central selector contracts configuration
- SELECTOR-02: DOM snapshot capture on selector failures
- SELECTOR-03: Element verification before activation
- SELECTOR-04: Selector health check before test execution

**Success Criteria:**
- `selectors.js` config defines all attribute names, class patterns, and geometry constraints in one place
- Failed selector matches attach DOM snapshots showing candidates and context
- Navigation helpers verify focused element ID/text matches intention before pressing Enter
- Startup health check validates expected DOM structure exists (left menu, content containers, focus system)
- Test failures provide actionable diagnostic data showing what selector contract broke

**Dependencies:**
- Phase 1 (Navigation and content modules must exist to add validation)

**Estimated Complexity:** Medium

---

### Phase 3: Replace Fixed Waits with Smart Detection

**Goal:** Eliminate 2.5-10 second sleeps and 250ms per-key delays by detecting actual application state

**Requirements Covered:**
- PERF-01: Focus state detection after app open
- PERF-02: Home screen readiness check after login
- PERF-03: Player state polling after playback start
- PERF-04: Reduce per-key navigation delays to 100ms
- PERF-05: Bounded wait utilities with timeouts

**Success Criteria:**
- App open waits for `.focused` element instead of 2.5 second sleep
- Login completion waits for left menu + content rows instead of 10 second sleep
- Playback verification polls `hasVideo`/`isProbablyPlaying` instead of 6 second sleep
- Navigation key delay reduced from 250ms to 100ms (configurable constant)
- New `waitForFocusState()`, `waitForPlayerReady()`, `waitForContentVisible()` utilities with 30s timeout defaults
- Test suite completes 40-60% faster on healthy environments
- No new flakiness introduced (tests still pass consistently)

**Dependencies:**
- Phase 1 (Navigation and playback modules must be extracted)

**Estimated Complexity:** High

---

### Phase 4: Optimize DOM Scanning Performance

**Goal:** Reduce expensive full-page DOM traversal through scoped queries, attribute extraction, and snapshot caching

**Requirements Covered:**
- PERF-06: Scope queries to containers instead of `body *`
- PERF-07: Extract only required attributes during enumeration
- PERF-08: Cache screen snapshots during navigation steps
- PERF-09: Use Playwright Locator filtering where stable
- PERF-10: Reduce default batch playback limits and enforce budgets

**Success Criteria:**
- Content item queries target known containers (`.content-area`, `.service-grid`) instead of full page
- Element enumeration extracts only ID/title/bounds attributes, not full computed styles
- Navigation step caches visible element snapshot to avoid repeated scans in retry loops
- Stable elements (left menu, settings) use Playwright Locators instead of evaluate-based traversal
- Default `maxItems` reduced from 60 to 10 with total run time budget enforcement
- DOM query time reduced by 50-70% measured via Playwright traces
- No behavioral changes to existing test scenarios

**Dependencies:**
- Phase 1 (Content row and navigation modules must be extracted)
- Phase 3 (Smart waits reduce retry loops that would benefit from caching)

**Estimated Complexity:** High

---

## Phase Dependencies

```
Phase 1 (Module Extraction)
  ├──→ Phase 2 (Selector Hardening)
  ├──→ Phase 3 (Smart Waits)
  └──→ Phase 4 (DOM Optimization)
```

## Coverage Validation

**Total v1 requirements:** 21
**Requirements mapped to phases:** 21
**Unmapped requirements:** 0 ✓

---
*Roadmap created: 2026-07-13*
