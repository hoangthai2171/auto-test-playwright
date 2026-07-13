# Phase 2: Selector Contracts and Validation — Research

**Researched:** 2026-07-13
**Scope:** Local codebase and planning artifacts

## Executive Summary

Phase 1 created focused CommonJS modules, but selector assumptions remain embedded in `navigation.js`, `content-rows.js`, and `workflows.js`. The safest implementation is a small declarative contract registry plus a validation/diagnostics layer, followed by integration at shared activation boundaries. This preserves existing helper signatures while making selector drift observable and preventing ambiguous Enter actions.

## Current Codebase Findings

### Selector assumptions are distributed

- `tests/lib/navigation.js` scans `body *` for text and uses `.focused`, element IDs, visibility, and geometry to drive remote focus.
- `tests/lib/content-rows.js` uses element IDs, row geometry, content label attributes, focus containment, and configurable navigation dependencies.
- `tests/lib/workflows.js` contains high-level lookup logic for services, channels, movies, search results, and repeated `remotePress(page, "Enter", ...)` activation points.
- `tests/lib/artifacts.js` already provides report attachment patterns; `tests/lib/playback.js` attaches player and popup diagnostics.
- Existing deterministic coverage in `tests/ai-row-selection.spec.js` uses `page.setContent()` and `__internal` exports, so synthetic DOM tests can exercise selector scoring without staging credentials.

### Integration constraints

- Existing specs import `tests/lib/mytv-helpers.js`, which is a compatibility alias over the Phase 1 barrel. New modules must be wired without breaking that import surface.
- The fixture uses a shared worker/context and may connect over CDP. Health checks must run after the application is ready, not at `DOMContentLoaded`, and must not create a new browser/session.
- Virtual-keyboard character entry is a special activation path. Selector verification should cover user-facing controls and content activation while preserving character-by-character keyboard behavior.

## Recommended Design

1. Add `tests/lib/selectors.js` as a declarative registry. Group contracts by role and include ordered alternatives, required/optional severity, identity attributes, class patterns, geometry limits, and excluded ID prefixes.
2. Add a focused validation module for candidate collection, fuzzy score threshold/margin checks, focused/container identity checks, minimal pre-activation diagnostics, and ready-state health checks.
3. Keep diagnostics bounded to the focused element and top candidate. Attach JSON and screenshot before each activation attempt; do not serialize the full DOM.
4. Route activation through one shared verified activation helper. Use declared fallbacks with a bounded retry count, and fail when the match remains missing or ambiguous.
5. Run the minimal health check after the home-ready flow and before scenario-specific actions. Required contract failures stop the scenario; optional failures produce structured warnings.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Fuzzy matching activates the wrong near-match | Require threshold plus score margin, then reselect/fail on ambiguity. |
| External UI variants break a single selector | Store ordered, explicit alternatives and report the matched alternative. |
| Large diagnostics slow or leak reports | Capture only focused/top candidate JSON plus screenshot. |
| Health check runs before dynamic content exists | Gate it on the existing ready-state/home flow. |
| Refactoring breaks callers | Preserve CommonJS exports and existing helper signatures; make new verification parameters optional where needed. |

## Verification Strategy

- Add synthetic DOM tests for contract alternative selection, required/optional health results, threshold and score-margin behavior, focused-container matching, and bounded fallback failure.
- Assert diagnostics contain only focused/top-candidate JSON and a screenshot attachment path/name.
- Run the focused selector tests plus existing deterministic `tests/ai-row-selection.spec.js`.
- Run the Playwright suite in its normal single-worker configuration when credentials/staging are available; otherwise record the live-environment limitation without weakening synthetic coverage.

## Canonical Local Sources

- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONVENTIONS.md`
- `tests/lib/navigation.js`
- `tests/lib/content-rows.js`
- `tests/lib/workflows.js`
- `tests/lib/artifacts.js`
- `tests/lib/playback.js`
- `tests/ai-row-selection.spec.js`

## Planning Implication

Use two executable plans: first establish the contract and validation primitives with deterministic tests; then integrate them into navigation/workflows and preflight health checks while preserving the public helper API.
