# Phase 4: Optimize DOM Scanning Performance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 4-optimize-dom-scanning-performance
**Areas discussed:** Container scope and fallback, Snapshot lifetime, Locator migration boundary, Batch budget behavior

---

## Container scope and fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Scoped-first with bounded fallback | Query known containers first; use the existing full-page scan once with diagnostics when a root is unavailable. | ✓ |
| Strict scoped-only | Fail immediately when a known container is missing. | |
| Per-helper policy | Apply different fallback rules to each helper. | |

**User's choice:** Scoped-first with bounded fallback; central ordered selector contracts; no fallback for empty scoped results.
**Notes:** Canonical roots such as `.content-area` and `.service-grid` should be defined in `selectors.js`. A missing root may trigger one diagnostic fallback per helper operation; an empty existing root should remain in the bounded retry path.

---

## Snapshot lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| One navigation step or retry loop | Reuse during a step, invalidate after state changes. | ✓ |
| One helper invocation | Safer freshness with less reuse. | |
| Short time-based cache | Reuse across helpers with TTL-based freshness. | |

**User's choice:** Cache per navigation step/retry loop with explicit invalidation and route/container identity validation.
**Notes:** Snapshots contain minimal immutable records only; no DOM nodes, Locator handles, or global MutationObserver.

---

## Locator migration boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Stable structural elements only | Use Locators for left menu, settings/account controls, and known action containers; retain evaluate-based dynamic discovery. | ✓ |
| All content and navigation discovery | Migrate dynamic content and navigation enumeration broadly. | |
| No Locator migration | Leave all traversal evaluate-based. | |

**User's choice:** Stable structural elements only, using centralized selector contracts and one diagnostic evaluate fallback.
**Notes:** The keyboard-only path is mandatory: locate/filter, move remote focus, validate the contract, and press Enter. `locator.click()` is not permitted.

---

## Batch budget behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful stop with report | Stop at the limit and return partial, structured results. | ✓ |
| Fail immediately | Treat reaching a budget as a test failure. | |
| Continue with warning | Continue despite the configured limit. | |

**User's choice:** Default to 10 items; explicit 0 means all within a hard runtime budget; stop gracefully with structured artifacts.
**Notes:** Budget configuration uses named helper defaults with per-call options overrides. Reports should include completed/attempted counts, elapsed time, budget, and `budgetLimited: true`; the surrounding scenario decides pass/fail.

---

## the agent's Discretion

- Exact selector-contract field names and fallback order beyond the locked root behavior.
- Snapshot record property names and cache object placement.
- The specific default duration for the runtime budget.
- The exact stable menu/settings Locator filters.

## Deferred Ideas

None.
