# Phase 2: Harden Selector Contracts and Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 2-Harden Selector Contracts and Validation
**Areas discussed:** Selector contract scope, Failure diagnostics, Activation verification, Startup health check

---

## Selector contract scope

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Centralize all selector assumptions across navigation, content rows, workflows, and playback. | |
| 2 | Centralize only high-risk selector families. | |
| 3 | Centralize stable contracts while allowing narrowly scoped helper-specific selectors for dynamic details. | ✓ |

**User's choice:** Two-tier selector strategy.
**Notes:** The user emphasized automation without manual intervention. Follow-up decisions selected declarative role-based contracts, ordered alternatives for known UI variants, and declared fallbacks followed by actionable failure.

## Failure diagnostics

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Bounded structured snapshot with focused element, contract, top candidates, and relevant HTML context. | |
| 2 | Full DOM HTML and screenshot. | |
| 3 | Candidate and focused-element diagnostics only. | ✓ |

**User's choice:** Minimal candidate/focused diagnostics.
**Notes:** Keep only the top candidate, capture before every activation attempt, and attach JSON plus the current screenshot.

## Activation verification

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Stable identity checks with exact ID when available, normalized title/label otherwise, and focus containment. | |
| 2 | Exact ID only. | |
| 3 | Fuzzy title/label verification with a threshold and ambiguity guard. | ✓ |

**User's choice:** Fuzzy verification with a clear score threshold and margin.
**Notes:** Ambiguous matches require bounded reselection/fallbacks and then failure. Verification compares ID/attributes, normalized labels, and focused-container relation; geometry is supporting evidence.

## Startup health check

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Run after app readiness, validate minimal required structure, and emit a structured report. | ✓ |
| 2 | Run at `DOMContentLoaded` or validate every selector contract before each test. | |
| 3 | Run only after a selector failure. | |

**User's choice:** Ready-state preflight with required/optional severity.
**Notes:** Required structures are focus system, left menu, content container, and key identity attributes. Missing required contracts fail fast; optional contracts warn. Report pass/fail/warning status, reasons, checked contracts, and a screenshot.

## the agent's Discretion

- Exact contract names, thresholds, score margins, retry limits, and JSON field layout remain implementation choices within the locked decisions.

## Deferred Ideas

None.
