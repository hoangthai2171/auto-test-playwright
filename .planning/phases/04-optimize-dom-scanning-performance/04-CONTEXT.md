# Phase 4: Optimize DOM Scanning Performance - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce expensive full-page DOM traversal in the existing Playwright/MyTV helper workflows through scoped selector-contract queries, minimal attribute extraction, navigation-step snapshot caching, stable Locator filtering, and bounded batch playback budgets. Preserve keyboard-only TV remote interaction, existing selector diagnostics, backward-compatible CommonJS exports, shared-session ordering, explicit transition delays, and intentional playback viewing durations.

</domain>

<decisions>
## Implementation Decisions

### Container scope and fallback
- **D-01:** Define per-query container roots through central ordered selector contracts, including known roots such as `.content-area` and `.service-grid`.
- **D-02:** Query canonical scoped roots first and permit one bounded full-page fallback per helper operation, with diagnostics when the root is unavailable.
- **D-03:** Do not fallback merely because a scoped root is empty; let the bounded readiness/retry loop handle delayed content.

### Snapshot lifetime and representation
- **D-04:** Reuse snapshots within one navigation step or retry loop, then invalidate them after navigation state changes.
- **D-05:** Invalidate explicitly after remote key presses, Enter/Backspace, route changes, and known content refreshes; do not add a global `MutationObserver`.
- **D-06:** Store minimal immutable records — IDs, labels/titles, required bounds, row metadata, and a screen key — and never cache DOM nodes or Locator handles.
- **D-07:** Require route/hash plus scoped-container identity before reusing a snapshot; explicit invalidation remains authoritative.

### Locator migration boundary
- **D-08:** Migrate only stable structural elements, such as the left menu, settings/account controls, and known action containers, to Playwright Locator filtering. Keep dynamic content discovery contract-aware and evaluate-based.
- **D-09:** Reuse centralized selector contracts for stable Locators; `selectors.js` remains the source of truth.
- **D-10:** On a Locator contract miss, use the existing evaluate-based path once with diagnostics rather than silently hiding the migration regression.
- **D-11:** Preserve the keyboard-only activation path: use Locators to find/filter, move remote focus, validate the selector contract, and press Enter. Never use `locator.click()`.

### Batch budget behavior
- **D-12:** When the item limit or total runtime budget is reached, stop gracefully and report partial results without starting another item.
- **D-13:** Default `itemLimit` to 10; explicit `0` means all available but remains constrained by the hard runtime budget.
- **D-14:** Configure the runtime budget through a named helper default with per-call options override; do not add environment variables.
- **D-15:** Return structured results and artifacts with completed/attempted counts, elapsed time, budget, and `budgetLimited: true`; let the surrounding scenario decide pass/fail.

### the agent's Discretion
The implementation may choose exact selector-contract field names, snapshot record property names, cache object placement, budget default duration, and the specific stable menu/settings Locator filters, provided the decisions above and PERF-06 through PERF-10 remain true.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` — Phase 4 goal, PERF-06 through PERF-10 scope, success criteria, dependencies, and no-behavior-change boundary.
- `.planning/REQUIREMENTS.md` — PERF-06 through PERF-10 requirement definitions and traceability.
- `.planning/PROJECT.md` — CommonJS, keyboard-only navigation, shared-session, backward-compatibility, and platform constraints.
- `.planning/STATE.md` — prior Phase 3 decisions and current project state.

### Codebase patterns
- `.planning/codebase/TESTING.md` — Playwright synthetic-DOM testing, polling, fixtures, and artifact conventions.
- `.planning/codebase/CONVENTIONS.md` — CommonJS style, helper naming, selector/error handling, and module conventions.
- `.planning/codebase/STRUCTURE.md` — test-library locations and integration points.
- `AGENTS.md` — repository-specific TV remote navigation and test constraints.

### Implementation points
- `tests/lib/selectors.js` — central selector contracts and candidate constraints.
- `tests/lib/content-rows.js` — visible content-row and item discovery helpers.
- `tests/lib/navigation.js` — remote focus, key presses, keyboard entry, and retry behavior.
- `tests/lib/workflows.js` — service/menu/content discovery, navigation loops, batch playback, and integration points.
- `tests/lib/selector-validation.js` — focused target validation and diagnostics.
- `tests/lib/artifacts.js` — screenshot and JSON attachment conventions.
- `tests/lib/index.js` — public helper exports that must remain compatible.
- `tests/lib/mytv-helpers.js` — compatibility alias consumed by existing specs.
- `tests/fixtures/mytv-session-fixture.js` — worker/session and page lifecycle constraints.

No external specs — requirements and implementation decisions are fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/lib/selectors.js`: centralize new container roots and stable-element contracts here.
- `tests/lib/content-rows.js`: preserve row grouping and focus semantics while narrowing DOM enumeration.
- `tests/lib/navigation.js`: use existing remote-focus primitives and explicit invalidation hooks around state-changing keys.
- `tests/lib/selector-validation.js`: retain activation verification and diagnostic artifacts for Locator and fallback paths.
- `tests/lib/artifacts.js`: attach budget-limited and fallback diagnostics using established report conventions.

### Established Patterns
- All MyTV interaction is keyboard-driven; mouse clicks are not valid test behavior.
- Helpers use CommonJS, explicit `page`/`testInfo`/`options` arguments, bounded retries, fuzzy Vietnamese matching, and structured failure artifacts.
- Deterministic helper specs use `page.setContent()` with minimal synthetic DOM fixtures; live workflows use the shared worker-scoped session.
- `workers: 1` and login-first ordering must remain unchanged.

### Integration Points
- Scoped enumeration and snapshot caching connect to content-row discovery, service/menu lookup, search candidates, and navigation retry loops.
- Stable Locator filtering connects to left-menu and settings/action helpers while preserving `activateVerifiedTarget()` and Enter activation.
- Batch budget results connect to `playAllItemsInFirstRow()`, AI plan execution, playback reports, and the existing `itemLimit`/`maxItems` options.
- New helpers/options must remain reachable through `tests/lib/index.js` and `tests/lib/mytv-helpers.js`.

</code_context>

<specifics>
## Specific Ideas

- Prefer a resilient scoped-first strategy: one diagnosable full-page fallback is acceptable when a root is missing, but repeated fallback scans must be prevented.
- Treat snapshots as immutable data, not live DOM references, and invalidate them explicitly at known state transitions.
- Enforce budgets as safe operational limits with structured partial reports rather than converting intentional limits into test failures.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 4 scope.

</deferred>

---

*Phase: 4-optimize-dom-scanning-performance*
*Context gathered: 2026-07-14*
