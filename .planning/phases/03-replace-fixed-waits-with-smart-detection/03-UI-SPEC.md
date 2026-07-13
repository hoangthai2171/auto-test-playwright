---
phase: 3
slug: replace-fixed-waits-with-smart-detection
status: approved
reviewed_at: 2026-07-13T00:00:00+07:00
shadcn_initialized: false
preset: none
created: 2026-07-13
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for the existing Electron test runner while smart readiness detection, playback polling, and navigation pacing are introduced.

This is a diagnostics and interaction contract, not a consumer-facing redesign. Preserve the current dark Electron shell, the existing status bar, Logs modal, report actions, and the TV web-app preview. All interaction inside the TV preview remains keyboard-only through the remote-control keys.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — vanilla HTML/CSS/JS Electron renderer |
| Icon library | none — retain existing text controls and visible `×` close affordances; add accessible `Close Logs` / `Close Settings` text labels |
| Font | Existing `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` stack |

Source: existing `app/renderer/index.html`, `app/renderer/renderer.js`, and `app/renderer/styles.css`. No `components.json`, React stack, or shadcn registry is present.

## Phase UI Scope

Only these UI-facing surfaces are in scope:

- The workspace status bar (`Ready`, `Running`, `Passed`, `Failed`, `Stopped`).
- The existing Logs modal and its appended test output.
- The existing live/interactive browser preview while the TV app is waiting for state.
- Existing `Run Test`, `Stop`, `Open Report`, and `Show Folder` feedback paths.

Do not add timing environment variables, a consumer-facing timing-settings screen, a progress dashboard, a new preview overlay, or Phase 4 DOM-scanning controls. Smart waits are surfaced through concise logs and bounded report artifacts.

## Visual Hierarchy

Primary focal point: the live/interactive browser preview in the workspace, where the TV app state is observed. Establish hierarchy in this order: preview first, status bar second as the immediate run-state cue, sidebar controls third for test configuration/actions, and Logs/report actions fourth as secondary diagnostics. Smart-wait feedback must support the preview and status bar without obscuring either.

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none. Preserve existing renderer-only dimensions that are unrelated to Phase 3 without introducing them as new spacing tokens; no new spacing values are needed for smart-wait feedback.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 13px | 700 | 1.35 |
| Heading | 18px | 700 | 1.2 |
| Display | 24px | 700 | 1.2 |

Use the existing monospace treatment for diagnostic log output as a utility-surface implementation detail; it is not a declared contract font size and must not expand the general UI type scale. Keep the contract to the existing two weights: 400 and 700.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#101114` | App shell and primary background |
| Secondary (30%) | `#17191f` | Sidebar, dialogs, and secondary surfaces; retain `#14161b`/`#12141a` for existing toolbar/nav variants |
| Accent (10%) | `#2f80ed` with existing `#55a7ff` focus variant | Primary `Run Test` action and form-control focus indication only |
| Destructive | `#ff5d5d` / `#ff7a7a` | Failed status and error messages only; not used for ordinary wait progress |

Accent reserved for: `Run Test`, keyboard focus borders on renderer inputs/selects/textareas, and no other wait or playback state. Use existing semantic status colors instead: running `#f7b955`, passed `#46d083`, failed `#ff5d5d`, idle/stopped `#7b8494`, and successful inline feedback `#46d083`.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Run Test` |
| Empty state heading | None — retain the existing single-line preview message |
| Empty state body | `Browser preview will appear here when a test starts.` |
| Error state | Readiness timeout: `Smart wait timed out: {waitName}. See Logs and the test report for diagnostics.` Playback timeout: `Playback readiness timed out for {item}. Failure recorded; continuing the run.` |
| Destructive confirmation | `Stop Test`: no confirmation dialog; preserve the existing immediate stop interaction, set status to `Stopped`, and append `Stopped by user.` to Logs. |

Smart-wait log copy is concise and stable:

- Start: `[WAIT] {waitName} — waiting (timeout {timeoutMs}ms, poll {pollIntervalMs}ms)`
- Success: `[WAIT READY] {waitName} — ready after {elapsedMs}ms`
- Bounded failure: `[WAIT TIMEOUT] {waitName} — timed out after {elapsedMs}ms; see diagnostics`
- Playback continuation: `[PLAYBACK TIMEOUT] {itemLabel} — failure recorded; continuing run`

Do not claim `Ready` or `Playing` before the corresponding predicate is true. Do not describe a playback timeout as an overall run abort; the surrounding scenario/report determines the final result.

## Interaction and State Contract

| Surface | State | Required feedback |
|---------|-------|-------------------|
| Status bar | Idle | Gray dot and `Ready`; preview may show its existing empty message. |
| Status bar | Test active / smart wait polling | Amber dot and `Running`; keep `Run Test` disabled and `Stop` enabled. Do not add a fake percentage or countdown. |
| Status bar | Final success | Green dot and `Passed`; preserve existing report actions. |
| Status bar | Final failure or bounded readiness failure | Red dot and `Failed`; keep Logs/report access available. |
| Status bar | User stop | Gray dot and `Stopped`; append the stop event to Logs. |
| Logs modal | Wait in progress | Append one start line per named wait (`focus`, `content`, `player`, or layered app/home readiness). Autoscroll using the current log behavior. |
| Logs modal | Wait succeeds | Append one `[WAIT READY]` line with elapsed time. Avoid per-poll noise. |
| Logs modal | Wait times out | Append one bounded timeout line containing wait name, configured timeout, elapsed time, last observed condition/state, URL/hash, and focused state. Do not dump the full DOM. |
| Logs modal | Playback readiness timeout | Record the item failure and immediately show that the batch continues. The next item must remain observable in the same log stream. |
| Browser preview | Waiting for state | Keep showing the latest live screenshot or interactive TV page. Do not replace it with a loading overlay or imply readiness from elapsed time. |
| Browser preview | No screenshot yet / preview disabled | Retain the current empty copy and `Preview is disabled.` behavior. |
| Run/Stop controls | Test active | Disable form inputs and `Run Test`; enable `Stop`. Preserve current keyboard/mouse behavior of the Electron controls. |

Modal close affordances: retain the visible `×`, and provide an accessible text label for each control (`Close Logs` and `Close Settings`) via an accessible name plus visually hidden text fallback. The label must remain available to assistive technology even if the symbol is not announced.

The TV app itself remains a remote-navigation surface: use Arrow keys, Enter, Backspace, and Escape as already implemented. The phase may reduce navigation-loop and virtual-keyboard pacing to the configured 100ms floor, but must not visually or behaviorally convert TV actions into mouse clicks.

## Diagnostics Contract

Timeout and playback diagnostics are report-facing but must be discoverable from the existing Logs and report buttons. When `testInfo` is available, attach a screenshot and bounded JSON using the existing artifact conventions. Each timeout diagnostic must expose:

```json
{
  "waitName": "home-readiness",
  "timeoutMs": 30000,
  "elapsedMs": 0,
  "pollIntervalMs": 250,
  "lastObserved": {
    "missingCondition": "content row",
    "url": "...",
    "hash": "...",
    "focused": {}
  },
  "screenshot": "attached when available"
}
```

The exact internal JSON field names remain implementation discretion, but the visible Log summary and attached artifact must contain the same bounded facts. Capture only the relevant focused state, last condition, URL/hash, and screenshot; do not introduce full-page DOM dumps in this phase.

Playback polling must show the final `hasVideo`, `isProbablyPlaying`, popup/error text, elapsed timeout, item label, and continuation decision. Preserve the requested AI `waitSeconds` viewing duration after readiness; do not expose or alter it as a smart-wait countdown.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn is not initialized |
| Third-party registries | none | not applicable |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved
