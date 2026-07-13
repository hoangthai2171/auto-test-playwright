# Phase 3: Replace Fixed Waits with Smart Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 3-replace-fixed-waits-with-smart-detection
**Areas discussed:** Readiness contract, Playback polling, Navigation pacing, Wait configuration

---

## Readiness contract

| Option | Description | Selected |
|--------|-------------|----------|
| Layered readiness | App-open readiness recognizes login, welcome, or home; each state has marker checks plus visible focus. | ✓ |
| Focus-first | Only require a valid focused element and let each workflow decide the screen. | |
| Route/DOM-first | Prefer route and structural markers, with focus as secondary evidence. | |

**User's choice:** Layered readiness.
**Notes:** Home requires valid home hash, visible left menu, at least one content row, and focused element. Timeout fails with diagnostics. Session-restored home is a valid app-open state.

## Playback polling

| Option | Description | Selected |
|--------|-------------|----------|
| Poll popup and player together | Wait for no popup, `hasVideo`, and `isProbablyPlaying` within a bound. | ✓ |
| Video first, playing second | Stage the checks and inspect popup at the end. | |
| Minimum delay plus one check | Keep a short fixed delay before reading player state once. | |

**User's choice:** Poll popup and player together.
**Notes:** On timeout, record final state and continue the overall workflow/report. Preserve `waitSeconds` as intentional item viewing time. Default is 30 seconds with 250 ms polling.

## Navigation pacing

| Option | Description | Selected |
|--------|-------------|----------|
| Reduce loop and virtual-keyboard pacing | Use 100 ms in navigation loops and character entry while retaining explicit transition delays. | |
| Reduce only loop and virtual-keyboard defaults | Keep all existing explicit call-site delays unchanged. | ✓ |
| Normalize every delay | Set activation and transition delays to 100 ms as well. | |

**User's choice:** Reduce only loop and virtual-keyboard defaults.
**Notes:** Use a shared 100 ms default with per-call override. Keep 100 ms as a minimum pacing floor, confirm focus where needed, and retain the opposite-direction fallback when focus does not move.

## Wait configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Shared defaults with per-type overrides | Focus, content, and player waits have distinct defaults while sharing a policy. | ✓ |
| One global policy | Every wait uses the same timeout and polling interval. | |
| Local helper defaults | Each helper owns its timing policy independently. | |

**User's choice:** Shared defaults with per-type overrides.
**Notes:** Tuning uses helper defaults and an `options` object, not new environment variables. Timeout diagnostics are structured and bounded. Polling intervals are focus 100 ms, content 250 ms, and player 250 ms.

## the agent's Discretion

- Exact internal wait primitive and helper placement.
- Option names and diagnostic JSON field layout.
- How the named wait utilities share internal predicates.

## Deferred Ideas

None. Phase 4 DOM-scanning optimization and other out-of-scope requirements were not folded into this discussion.
