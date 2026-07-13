# Phase 3: Replace Fixed Waits with Smart Detection - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase replaces fixed waits used for app readiness, post-login home readiness, playback startup, and selected keyboard-navigation pacing with bounded state detection. It preserves keyboard-only TV remote interaction, intentional AI playback viewing durations, existing transition delays, shared-session execution, and backward-compatible helper APIs. DOM-scanning optimization, test infrastructure, CI, and security work remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Readiness contract
- **D-01:** Use layered readiness contracts for the valid app-open states: login, welcome, and already-authenticated home. Each state must have its own marker set and also require a valid visible `.focused` element.
- **D-02:** Home readiness requires all primary signals: a valid home hash/route, visible left menu, at least one content row, and a valid focused element.
- **D-03:** Readiness waits are bounded. If the condition is not met, fail the wait immediately with structured diagnostics rather than falling back to a fixed sleep. Diagnostics should identify the missing condition and include the relevant URL/hash, focused state, and screenshot when available.

### Playback polling
- **D-04:** After activation, poll popup visibility and player state together until there is no error popup, `hasVideo` is true, and `isProbablyPlaying` is true, or the bounded timeout expires.
- **D-05:** A playback readiness timeout must not abort the overall workflow or batch run. Record the failed item with its final player state, popup/error information, screenshot, and reason; allow the surrounding scenario/reporting flow to decide the final result.
- **D-06:** Preserve `waitSeconds` in AI batch playback as an intentional viewing duration. Smart polling replaces only the activation/startup wait and must not shorten the requested viewing interval.
- **D-07:** Use a configurable playback default of 30 seconds with a 250 ms polling interval.

### Navigation pacing
- **D-08:** Reduce pacing to 100 ms only for navigation loops and virtual-keyboard character entry. Existing explicitly supplied transition/activation delays remain unchanged.
- **D-09:** Provide a shared 100 ms default with per-call override support. Do not add environment variables solely for timing configuration.
- **D-10:** Keep 100 ms as the minimum pacing floor and perform focus confirmation where needed; do not require an expensive focus-state poll after every key.
- **D-11:** When focus does not change after a navigation key, retain the existing fallback behavior: try the opposite direction once, continue the bounded `maxMoves` loop, and fail after the bound is exhausted.

### Wait configuration and diagnostics
- **D-12:** Use shared wait defaults with named per-wait-type overrides so focus, content, and player waits can have distinct behavior without duplicating policy.
- **D-13:** Expose tuning through helper defaults and an `options` object. Do not add a new set of environment variables for timing.
- **D-14:** Timeout diagnostics must be structured and bounded: wait name, configured timeout, elapsed time, last observed condition/state, URL/hash, focused state, and a screenshot when `testInfo` is available.
- **D-15:** Use polling intervals by wait type: focus 100 ms, content 250 ms, and player 250 ms. Keep the required bounded 30-second default for the named wait utilities unless a caller explicitly overrides it.

### the agent's Discretion
The implementation may choose the exact internal wait primitive, helper placement, option names, diagnostic JSON shape, and how the named `waitForFocusState()`, `waitForPlayerReady()`, and `waitForContentVisible()` utilities share their internal predicate logic, provided the decisions above and PERF-01 through PERF-05 remain true. Existing explicit transition delays may be retained where they represent navigation or UI stabilization rather than polling.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — PERF-01 through PERF-05 define the required smart readiness detection, player polling, configurable navigation delay, and bounded wait utilities.
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, dependency on Phase 1, and backward-compatibility boundary.
- `.planning/phases/01-extract-core-helper-modules/01-CONTEXT.md` — locked module boundaries, CommonJS conventions, explicit Playwright arguments, and public export compatibility.
- `.planning/phases/02-harden-selector-contracts-and-validation/02-CONTEXT.md` — ready-state health-check decisions, required/optional structural contracts, bounded diagnostics, and activation integration points.

### Codebase patterns
- `.planning/codebase/TESTING.md` — Playwright polling, synthetic DOM tests, `runStep()`, and report-artifact patterns.
- `.planning/codebase/CONVENTIONS.md` — CommonJS style, helper naming, explicit arguments, bounded retries, and error handling.
- `.planning/codebase/STRUCTURE.md` — test-library locations and integration points.

### Implementation points
- `tests/lib/workflows.js` — app-open/login/home readiness, activation call sites, fixed transition waits, batch playback orchestration, and existing `waitForAppReady()` / `waitForProfileSelection()` helpers.
- `tests/lib/navigation.js` — `remotePress()`, navigation loops, focus confirmation, fallback direction handling, and virtual-keyboard entry.
- `tests/lib/playback.js` — `assertPlayback()`, `inspectPlaybackAfterWait()`, popup checks, player-state inspection, and playback artifacts.
- `tests/lib/content-rows.js` — content-row readiness and focused-content helpers used by home/content waits.
- `tests/lib/selector-validation.js` — pre-activation validation and existing bounded diagnostic integration.
- `tests/lib/artifacts.js` — shared screenshot and JSON attachment helpers.
- `tests/lib/index.js` — public module barrel that must preserve compatibility.
- `tests/lib/mytv-helpers.js` — compatibility alias consumed by existing specs.
- `tests/fixtures/mytv-session-fixture.js` — shared worker/session and Playwright page lifecycle constraints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/lib/navigation.js` already provides `remotePress()`, `remoteFocus()`, `getFocusedState()`, and virtual-keyboard helpers; timing changes should build on these primitives.
- `tests/lib/playback.js` already exposes player-state and popup inspection plus report attachment patterns; polling can wrap these without changing report semantics.
- `tests/lib/workflows.js` already composes app/login/profile/home flows and has route/text/focus checks that can become layered readiness predicates.
- `tests/lib/selector-validation.js` and `tests/lib/artifacts.js` provide the existing bounded diagnostic and screenshot/JSON conventions.

### Established Patterns
- All interaction remains keyboard-only through Arrow keys, Enter, Backspace, and Escape; no mouse interaction is permitted.
- Helpers use CommonJS, explicit `page`/`testInfo`/`options` arguments, Playwright polling, fuzzy Vietnamese matching, and bounded retries.
- The suite uses one shared worker/session, so readiness improvements must not change test ordering or authentication reuse.
- Phase 2 established minimal, structured pre-activation diagnostics and a structural health-check boundary; Phase 3 should extend that style to wait timeouts.

### Integration Points
- Readiness utilities will be consumed by `workflows.js` at app-open, post-login/home, content, and activation boundaries.
- Playback polling must integrate with `assertPlayback()` and the AI batch result/report path without removing intentional `waitSeconds` behavior.
- Navigation pacing changes must flow through `remotePress()` and virtual-keyboard entry while preserving explicit transition delays.
- New wait utilities and options must be re-exported through `tests/lib/index.js` and remain reachable through `tests/lib/mytv-helpers.js`.

</code_context>

<specifics>
## Specific Ideas

- Prefer state-driven waits over sleeps, but retain explicit delays that represent deliberate UI transitions or the user's requested playback viewing time.
- Keep timeout failures diagnosable and bounded without dumping the full DOM by default.
- Make the normal path faster while retaining a configurable escape hatch for unusual staging latency through helper options.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 3 scope. DOM query scoping, attribute extraction, snapshot caching, Locator migration, and batch `maxItems` changes belong to Phase 4 or later requirements.

</deferred>

---

*Phase: 3-replace-fixed-waits-with-smart-detection*
*Context gathered: 2026-07-13*
