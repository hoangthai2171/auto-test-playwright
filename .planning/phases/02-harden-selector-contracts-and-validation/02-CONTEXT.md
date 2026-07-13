# Phase 2: Harden Selector Contracts and Validation - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase hardens selector matching across the modular MyTV helper library by centralizing stable selector contracts, validating candidates before activation, capturing actionable diagnostics, and running a preflight health check before scenarios. It preserves keyboard-only navigation, fuzzy Vietnamese matching, and backward compatibility with existing test flows.

</domain>

<decisions>
## Implementation Decisions

### Selector contract scope and representation
- **D-01:** Use a two-tier selector strategy. `selectors.js` centralizes stable contract data, while narrowly scoped helper-specific selectors remain allowed for genuinely dynamic screen details.
- **D-02:** Represent centralized contracts declaratively and group them by role, such as `focus`, `contentItem`, `channel`, `menuItem`, and `popup`. Each role may define attributes, class patterns, geometry constraints, exclusions, and required/optional fields.
- **D-03:** Support ordered contract alternatives so the helpers can adapt automatically to known UI variants and report which alternative matched.
- **D-04:** When no declared contract or fallback matches, fail with actionable diagnostics. Do not continue with an undeclared broad heuristic that could activate the wrong element.

### Failure diagnostics
- **D-05:** Keep diagnostics intentionally small: capture the focused element and only the top candidate, not the full DOM or a complete candidate list.
- **D-06:** Capture the diagnostic state before every activation attempt, including successful attempts, so the report can show what was selected immediately before Enter.
- **D-07:** Attach the pre-activation state as JSON together with the current screenshot.

### Activation verification
- **D-08:** Verify the intended target using fuzzy title/label matching, but accept it only when the match passes a configured threshold and is clearly better than competing candidates.
- **D-09:** A merely highest-scoring but ambiguous candidate is not sufficient; ambiguous matches must trigger reselection or failure.
- **D-10:** If verification fails, retry through declared fallback contracts/reselection with a bounded attempt count, then fail with diagnostics.
- **D-11:** Compare stable ID/attribute identity when available, normalized title/label, and the focused-element/container relationship. Use geometry as supporting evidence rather than the sole identity check.

### Startup health check
- **D-12:** Run the health check after the app reaches a ready state and before the main scenario begins.
- **D-13:** Keep the preflight scope minimal and structural: verify the focus system, left menu, content container, and key identity attributes required by the scenario framework.
- **D-14:** Classify contracts as `required` or `optional`. Missing required structures fail fast; missing optional structures produce warnings with diagnostics.
- **D-15:** Emit a structured health-check summary containing pass/fail/warning status, the contracts checked, reasons, and a screenshot from the preflight state.

### the agent's Discretion
The implementation may choose exact contract object names, thresholds, score-margin values, fallback attempt limits, and the concrete JSON field layout, provided the decisions above remain true and the defaults are configurable rather than hidden in helpers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — SELECTOR-01 through SELECTOR-04 define the required selector contracts, diagnostics, activation verification, and health check.
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, dependencies, and backward-compatibility boundary.
- `.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md` — locked module boundaries, CommonJS conventions, public export compatibility, and reusable helper patterns from Phase 1.

### Codebase patterns
- `.planning/codebase/TESTING.md` — Playwright fixture, `runStep()`, synthetic DOM, and report-artifact patterns.
- `.planning/codebase/CONVENTIONS.md` — naming, CommonJS exports, explicit Playwright arguments, and error-handling conventions.
- `.planning/codebase/STRUCTURE.md` — locations and integration points for test libraries and specs.

### Selector and diagnostics implementation points
- `tests/lib/navigation.js` — remote focus primitives, focused-element semantics, geometry-based direction selection, and current selector scanning behavior.
- `tests/lib/content-rows.js` — content-row discovery, candidate geometry filtering, focus containment, and dependency wiring.
- `tests/lib/workflows.js` — high-level menu/content activation flows and inline candidate lookup rules that need contract integration.
- `tests/lib/playback.js` — playback assertions and player-related diagnostic attachment behavior.
- `tests/lib/artifacts.js` — shared screenshot/JSON attachment helpers.
- `tests/lib/index.js` — central module wiring and backward-compatible public exports.
- `tests/lib/mytv-helpers.js` — compatibility alias used by existing specs and downstream imports.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/lib/navigation.js`: `remoteFocusById()`, `remoteFocusByText()`, `remoteFocus()`, and `getFocusedState()` already provide the focus and geometry primitives that contract validation can wrap.
- `tests/lib/content-rows.js`: `collectVisibleContentRows()` and `focusRequestedContentRow()` already centralize content-item discovery and focus containment checks.
- `tests/lib/workflows.js`: high-level service, channel, movie, and search flows provide the main activation call sites for pre-Enter verification.
- `tests/lib/artifacts.js` and `tests/lib/playback.js`: existing report attachment patterns can be reused for JSON state and screenshots.

### Established Patterns
- All MyTV interaction is keyboard-driven through Arrow keys, Enter, and Backspace; selector hardening must not introduce mouse interaction.
- Helpers use CommonJS, explicit `page`/`testInfo` arguments, Playwright polling, and `runStep()`-style failure artifacts.
- Vietnamese identity matching uses normalization and fuzzy token scoring because external UI labels are dynamic.
- The suite uses one shared worker/session, so health checks and selector diagnostics must not change execution ordering or authentication behavior.

### Integration Points
- A new `tests/lib/selectors.js` contract module must be consumed by navigation/content/workflow helpers without breaking the `tests/lib/index.js` and `tests/lib/mytv-helpers.js` public import surface.
- Pre-activation diagnostics belong at the shared activation boundary so channel, movie, search, menu, and AI-plan flows receive consistent reporting.
- Preflight health checks must run after the existing app-ready/login flow and before scenario-specific actions, with required/optional severity available to callers.

</code_context>

<specifics>
## Specific Ideas

- The user prioritized automation without manual intervention. Declared alternatives should be tried automatically, but ambiguous or undeclared matches must fail safely rather than silently selecting an incorrect element.
- The user preferred minimal diagnostics: only the top candidate and focused element, accompanied by JSON and a screenshot.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2-harden-selector-contracts-and-validation*
*Context gathered: 2026-07-13*
