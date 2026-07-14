---
phase: 03-replace-fixed-waits-with-smart-detection
verified: 2026-07-14T08:48:28+07:00
status: verified
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "PERF-02: Login completion waits for left menu and content rows instead of a 10-second sleep"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Benchmark healthy-environment performance"
    expected: "App-open, login-to-home, playback-start, and navigation-loop timings demonstrate the intended improvement without new flakiness."
    why_human: "Deterministic tests prove readiness behavior but cannot establish the roadmap's 40-60% end-to-end speed improvement on healthy staging."
    result: pass
---

# Phase 3: Replace Fixed Waits with Smart Detection — Verification Report

**Phase Goal:** Eliminate 2.5-10 second sleeps and 250ms per-key delays by detecting actual application state
**Verified:** 2026-07-13T08:52:00Z
**Status:** verified
**Re-verification:** Yes — after PERF-02 gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | PERF-01: App open waits for a recognized screen marker plus a visible focused element instead of a fixed 2.5 s sleep | ✓ VERIFIED | `waitForAppReady()` uses `waitForFocusState()` with `observeAppReadyState()` and requires a recognized login, welcome, or home marker plus valid visible focus (`tests/lib/workflows.js:475-484`). The app-open marker and missing-focus tests pass. |
| 2 | PERF-02: Login completion waits for left menu and content rows instead of a 10 s sleep | ✓ VERIFIED | `chooseFirstProfileAndEnterHome()` activates `item_0` with `testInfo`, `profile-selection`, `contentItem`, and `item_0` contract fields, has no `delay: 10000`, and immediately calls `waitForHomeReady(page, testInfo)` (`tests/lib/workflows.js:118-124`). `waitForHomeReady()` requires route, visible menu, content rows, and valid focus (`tests/lib/workflows.js:487-501`). The named regression passes 1/1 and the full readiness spec passes 7/7. |
| 3 | PERF-03: Playback startup polls `hasVideo` and `isProbablyPlaying` instead of a fixed 6 s sleep | ✓ VERIFIED | `assertPlayback()` calls shared `waitForPlayerReady()`; `getPlayerState()` performs a single state observation with no hidden 1.5 s sleep (`tests/lib/playback.js:39-132`, `216-339`). Playback polling, timeout, duration, batch, and artifact tests pass in the focused suite. |
| 4 | PERF-04: Navigation key pacing defaults to a configurable 100 ms constant | ✓ VERIFIED | `DEFAULT_REMOTE_PRESS_DELAY` is `100`, `remotePress()` uses it by default, explicit per-call overrides remain supported, and virtual-keyboard Enter uses the default (`tests/lib/navigation.js:5-11`, `36-40`). The pacing regression passes. |
| 5 | PERF-05: Bounded focus/content/player wait utilities expose configurable timeout and polling defaults | ✓ VERIFIED | `WAIT_DEFAULTS` defines 30,000 ms timeouts, 100 ms focus polling, and 250 ms content/player polling; all public waits use bounded polling, structured diagnostics, and option overrides (`tests/lib/waits.js:1-7`, `223-342`). Smart-wait and focused regression coverage passes. |

**Score:** 5/5 truths verified

The former PERF-02 blocker is closed. No override was required.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tests/lib/waits.js` | Shared bounded focus/content/player waits, defaults, and diagnostics | ✓ VERIFIED | Exists, substantive, exports all named waits and defaults, and is consumed by workflows/playback. |
| `tests/smart-waits.spec.js` | Deterministic wait success, timeout, override, popup, and attachment coverage | ✓ VERIFIED | Exists, imports `./lib/waits`, exercises all three wait types, and passes in the 34-test focused suite. |
| `tests/lib/navigation.js` | Configurable 100 ms remote-key pacing | ✓ VERIFIED | Exists, exports the 100 ms default, supports overrides, and is used by active workflows. |
| `tests/lib/workflows.js` | Layered app/home readiness and first-content smart waits | ✓ VERIFIED | Exists, imports shared waits, and wires app-open, home, first-row, and first-movie readiness. The profile flow now has no unconditional 10 s delay. |
| `tests/lib/index.js` | Compatibility barrel re-exporting wait utilities | ✓ VERIFIED | Exists and spreads `waits`; `tests/lib/mytv-helpers.js` remains the unchanged compatibility alias. |
| `tests/readiness-pacing.spec.js` | Synthetic readiness/pacing and PERF-02 workflow-contract coverage | ✓ VERIFIED | Contains the named profile-to-home contract test, source-preservation assertions, and synthetic app/home/pacing tests; passes 7/7. |
| `tests/lib/playback.js` | Smart playback readiness and compatible playback/report APIs | ✓ VERIFIED | Exists, calls shared player polling, preserves player fields/artifact contracts, and supports non-throwing inspection. |
| `tests/playback-smart-waits.spec.js` | Deterministic playback polling and batch-duration coverage | ✓ VERIFIED | Exists, covers transient/persistent popups, player failures, exact viewing duration, batch safety, and artifacts; passes in the 34-test focused suite. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `tests/lib/waits.js` | `WAIT_DEFAULTS` | Named defaults consumed by each wait primitive | ✓ WIRED | `getWaitOptions()` selects the named policy and all three waits call it. |
| `tests/smart-waits.spec.js` | `tests/lib/waits.js` | CommonJS import and synthetic fixtures | ✓ WIRED | Direct `require("./lib/waits")` is present and the tests execute successfully; the SDK path heuristic reported a false negative. |
| `tests/lib/workflows.js` | `tests/lib/waits.js` | App-open, profile/home, first-content, and focus readiness calls | ✓ WIRED | Workflows import waits and call `waitForFocusState()`/`waitForContentVisible()` at the active readiness boundaries. |
| `tests/lib/workflows.js` | `tests/lib/waits.js` | Profile activation followed by home readiness | ✓ WIRED | `activateVerifiedTarget()` in `chooseFirstProfileAndEnterHome()` is followed by `waitForHomeReady(page, testInfo)`, which calls `waitForContentVisible()`. |
| `tests/lib/index.js` | `tests/lib/waits.js` | Compatibility barrel | ✓ WIRED | `...waits` is exported and representative functions are identical through `mytv-helpers.js`. |
| `tests/readiness-pacing.spec.js` | `tests/lib/workflows.js` | Named source-contract regression | ✓ WIRED | The test reads `lib/workflows.js`, scopes to the profile function, checks contract fields/delay/order, and passes. |
| `tests/lib/playback.js` | `tests/lib/waits.js` | Injected popup/player observers | ✓ WIRED | `assertPlayback()` and `inspectPlaybackAfterWait()` call `waitForPlayerReady()` with popup/player observers. |
| `tests/lib/playback.js` | `tests/lib/artifacts.js` | Existing report/artifact contract | ✓ WIRED | Playback retains stable timeout, player-state, popup, screenshot, and failure attachments. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `tests/lib/workflows.js` | `marker`, `focused`, `route`, `menu`, `content` | `page.evaluate()`, `getFocusedState()`, and `collectVisibleContentRows(page)` | Yes — live DOM/hash/focus/content observations | ✓ FLOWING |
| `tests/lib/playback.js` | `popup`, `playerState` | `getVisiblePopup(page)` and `getPlayerState(page)` via `page.evaluate()` | Yes — live popup and media-element state | ✓ FLOWING |
| `tests/lib/waits.js` | `observation` | Injected observers or default DOM/media observers | Yes — each wait polls caller/page state and returns the final observation | ✓ FLOWING |
| Deterministic specs | Synthetic observations | `setContent()` DOM fixtures and stateful fake observers | Yes — tests exercise delayed success and bounded failure, not success-only constants | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Syntax and public exports | `node --check` on all eight phase implementation/spec files plus CommonJS export assertions | All exit 0; required wait, playback, workflow, and pacing exports present | ✓ PASS |
| PERF-02 source contract | `node -e` scoped to `chooseFirstProfileAndEnterHome()` | No `delay: 10000`; four profile fields present; `waitForHomeReady()` follows activation; non-profile delay sequence unchanged | ✓ PASS |
| Named PERF-02 regression | `npx playwright test tests/readiness-pacing.spec.js --grep "profile-to-home workflow contract removes the PERF-02 delay"` | 1 passed | ✓ PASS |
| Full readiness regression | `npx playwright test tests/readiness-pacing.spec.js` | 7 passed in 851 ms with host permissions | ✓ PASS |
| Complete deterministic Phase 3 regression | `npx playwright test tests/playback-smart-waits.spec.js tests/smart-waits.spec.js tests/readiness-pacing.spec.js tests/ai-row-selection.spec.js tests/selector-contracts.spec.js` | 34 passed in 10.3 s with host permissions | ✓ PASS |

The default sandbox attempt could not launch Chromium because macOS denied `MachPortRendezvousServer`; the same browser-backed checks passed with the approved host runtime. This is an environment limitation, not a code failure.

### Probe Execution

No phase-declared or conventional `scripts/**/tests/probe-*.sh` probes were found. Probe execution: SKIPPED (no probes applicable).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PERF-01 | 03-02 | Focus state detection after app open | ✓ SATISFIED | Layered login/welcome/home marker detection plus valid visible focus; readiness tests pass. |
| PERF-02 | 03-02, 03-04 | Home screen readiness check after login | ✓ SATISFIED | Profile flow no longer passes `delay: 10000`; bounded route/menu/content/focus readiness remains immediately after activation; named and full readiness tests pass. |
| PERF-03 | 03-03 | Player state polling after playback start | ✓ SATISFIED | Shared popup/player polling replaces fixed startup inspection and focused playback tests pass. |
| PERF-04 | 03-02 | Reduce per-key navigation delays to 100 ms | ✓ SATISFIED | Shared 100 ms default, explicit override support, and virtual-keyboard use are present and tested. |
| PERF-05 | 03-01, 03-02, 03-03 | Bounded wait utilities with timeouts | ✓ SATISFIED | Focus/content/player waits use 30 s defaults, named polling, bounded loops, and structured diagnostics. |

The `REQUIREMENTS.md` traceability checkboxes for PERF-01 and PERF-04 remain unchecked even though implementation evidence satisfies them; this verification report does not edit planning status.

No later roadmap phase addresses a remaining Phase 3 gap. Phase 4 is about DOM scanning optimization, so nothing is deferred.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| Phase 3 active implementation/spec files | — | `TBD`, `FIXME`, or `XXX` markers | ✓ NONE | No unreferenced debt markers found. |
| Phase 3 active implementation/spec files | — | Placeholder/empty user-visible implementations | ✓ NONE | Empty callbacks are confined to deterministic test stubs; no rendered or runtime data path is hollow. |
| `tests/lib/mytv-helpers.legacy.js` | legacy module | Fixed waits and 250 ms pacing remain in an unused compatibility-era file | ℹ INFO | Active `tests/lib/mytv-helpers.js` re-exports `index.js`; the legacy file is not on the active path and was not modified by this phase. |

### Human Verification Required

#### 1. Benchmark healthy-environment performance

**Test:** Run the representative healthy staging flow and deterministic suite before/after Phase 3, recording app-open, login-to-home, playback-start, and navigation-loop durations.

**Expected:** The intended 40–60% suite-speed improvement is demonstrated without new flakiness, including after removal of the profile-to-home 10-second delay.

**Why human:** The repository has no pre-phase timing baseline or healthy staging run available here; deterministic tests establish correctness, not end-to-end speed or staging performance feel.

### Gaps Summary

No automated gaps remain. The previous PERF-02 blocker is resolved in the active profile workflow, and all five phase requirements are supported by substantive, wired, data-flowing implementation plus deterministic regressions. The only remaining gate is human benchmarking of the roadmap's performance-improvement claim.

### Acknowledged Gaps

- The healthy-environment performance benchmark was completed and accepted by the user on 2026-07-14. No repository baseline or staging timing artifacts were available for independent verification, so this result is recorded as human-confirmed.

---

_Verified: 2026-07-13T08:52:00Z_
_Verifier: the agent (gsd-verifier)_
