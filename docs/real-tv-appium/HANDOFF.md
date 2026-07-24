# Real-TV Appium Handoff Ledger

## Read this first in a new session

This repository has a large existing dirty worktree unrelated to this plan.
Preserve it. Do not reset, checkout, or broadly reformat files. This plan added
only the `docs/real-tv-appium/` folder and no executable real-TV code.

## User intent

- Owns MyTV and can package it for Tizen and webOS.
- Wants production-build behavior on real Samsung Tizen and LG webOS TVs.
- Wants the existing Electron desktop GUI to select/control/observe test runs.
- Can enable Developer Mode on both TVs.
- Wants Browser, Samsung, and LG choices plus device scan or direct-IP entry.
- Chose Appium community TV drivers as the proposed control method.
- Every selected case must be runnable on Browser, Samsung, and LG by default;
  do not add per-case target filtering in v1.
- During a TV run, the GUI shows live status, screenshots, and **Stop** only;
  it never offers manual remote-key or other interactive TV controls.
- Send credential-free native OS notifications when a run completes, a recovery
  cycle needs **Keep retrying / Stop**, or results remain unsynced.

## Pilot hardware supplied by the user

| Platform | Pilot model | Software reported | Scope note |
|---|---|---|---|
| Samsung Tizen | 2022 `QAQ80BAKXXV` | `T-PTMUABC-1720.7, BT-S` | First Samsung compatibility baseline. |
| LG webOS | 2023 `55QNED80SRA` | `webOS25 / 10.3.1-3001` | First LG compatibility baseline. |

The intended long-term estate covers Samsung and LG devices from approximately
2017 through current models. Do not claim that range is supported until each
engine/firmware family has passed the phase-5 pilot/reliability gates. Older
devices may require Appium remote-only operation and therefore the later QA
bridge transport fallback.

## Test-host decision supplied by the user

The initial supported test-host operating systems are **Windows and macOS**.
Phase 1 starts on **macOS**. Record the Appium, vendor SDK/CLI, Node, Electron,
and required Chromedriver behavior there first; validate Windows afterward
before it is advertised as supported for real-TV runs.

Within the macOS pilot, prove the Samsung workflow first, then the LG workflow.

Tests are expected to run from many engineers' own laptops, each connecting to
the TV targets they are authorized to use. Therefore the app must support
per-laptop vendor tooling, local device profiles, and local encrypted pairing
state. A main-process lock alone protects only one laptop; shared-TV collision
policy and any central reservation service remain a blocking design decision.

## Shared-TV decision and recommendation

The user reports Samsung Developer Mode is normally configured with one
developer laptop IP, which discourages more than one developer connection.
LG Developer Mode can allow several laptops to connect concurrently. The
architecture must not rely on the Samsung behavior as a lock and must not rely
on people warning each other for LG.

**Current v1 policy:** mark each device private or `shared-manual`. Before each
shared-TV run, the desktop GUI requires the operator to acknowledge that they
have manually confirmed the TV is free; the report records this acknowledgement.
This is intentional risk acceptance and provides no cross-laptop protection.

The agreed shared-TV process is a paper note physically attached to the TV.
Before running, the engineer checks the note. While using it, they write their
name, start time, expected finish time, and purpose; they remove the note on
completion, stop, or failure. A stale note requires contacting the named person
or lab owner, not unilateral reuse of the TV.

**Future policy:** when an always-on internal host is available, deploy the
separate central lease service documented in [lease-service.md](lease-service.md)
and replace the manual acknowledgement with atomic reservations.

## Current repository facts

- `app/main.js` owns `run-test`, child process launch, live preview watcher,
  report paths, and the single active process guard.
- `app/preload.js` is the secure renderer/main bridge.
- `app/renderer/index.html` and `app/renderer/renderer.js` own the case UI,
  settings, sequential batch selection, and preview presentation.
- `tests/run-test-case-mytv.spec.js` runs the generic case through a Playwright
  fixture; `tests/lib/test-case-action-runner.js` and navigation helpers assume
  a Playwright `page` and direct DOM/CDP access.
- `playwright.config.js` intentionally uses one worker; do not parallelize a TV
  path on the same device.

## Chosen architecture

See [architecture.md](architecture.md): Electron main process owns device
registry, secret handling, Appium lifecycle, device locks, and reporting.
Renderer only sees redacted device state. Real-device adapters implement a
target-neutral `TvSession`. Appium sends actual remote keys and reads DOM state
plus screenshots; no test-only MyTV app instrumentation is permitted in v1.

## Work order

1. Get the two-device POC green using [poc-runbook.md](poc-runbook.md).
2. Update this file with actual model/OS/driver facts and POC evidence.
3. Implement phase 2 from [phases.md](phases.md), test-first.
4. Do not start GUI work until Appium DOM inspection and screenshots work on
   both pilot TVs.
5. Implement target-neutral actions before making a selected TV appear runnable
   in the GUI.

## Reset policy supplied by the user

Before every TV test run, automatically clear **MyTV application storage** and
restart the app. Do not automatically reinstall the package unless the operator
explicitly selects a new build. The platform adapters must prove this reset does
not affect Developer Mode, vendor pairing, or unrelated TV apps.

For a selected multi-case batch, clear storage and restart before **each
individual case**, not only once at batch start. Reset/restart failure fails the
affected case before its first action.

## Batch-failure decision supplied by the user

Continue remaining selected cases after a business/product failure while the TV
connection and Appium session remain healthy. On host-to-TV connection loss,
network/technical failure, Appium/session loss, reset failure, or another
untrustworthy environment error, pause at the active case: capture diagnostics,
reconnect/revalidate, reset, and restart that case from its first action. Make
three automatic attempts. If they all fail, show **Keep retrying** or **Stop**
so the engineer can repair the environment. Keep retrying starts another
three-attempt recovery cycle; Stop uses the manual-stop result submission rule.
Never resume an interrupted action or advance to another case during recovery;
pairing remains a separate manual pause.

## Manual-stop submission decision supplied by the user

When the user presses **Stop**, stop the active case and mark it plus unstarted
selected cases `stopped_by_user`. Still submit status/results to the required
API for every case that fully completed before the stop. Do not submit the
interrupted case or unstarted cases as tested. This deliberately changes the
current all-selected-cases-only submission policy and requires dedicated
regression coverage before implementation.

If sending completed results fails, retain the immutable locally generated
payload in memory for the current desktop-app session and show a visible
**Retry sync** action. Retry sends the same completed case records only; it
never reruns/reset cases or silently changes results. Do not restore pending
sync after app reopening.

When the user attempts to close the desktop app while a run is active or result
sync is pending, show a blocking warning. Closing a running run requires an
explicit stop-and-close confirmation; closing with unsynced results requires an
explicit discard confirmation. A normal completed-and-synced run closes without
this warning.

## V1 execution-concurrency decision supplied by the user

Run one selected batch against one target device at a time in v1. The user may
run the same batch again on another device after it completes/stops. Concurrent
multi-device execution is a future feature requiring independent Appium
sessions, artifacts, reports, and device coordination.

## Deployment-artifact decision supplied by the user

The user already has the MyTV application IDs and deployable production-
equivalent artifacts for both target platforms: signed Samsung `.wgt` and LG
`.ipk` packages. Phase 1 therefore starts with installing/launching those
artifacts; packaging-pipeline implementation is not a prerequisite for the
first Appium POC.

The initial pilot uses clearly labelled production-connected packages and the
dedicated test accounts. The desktop runner cannot switch an installed app
between production and staging at run time. A staging option, if needed later,
requires a separately packaged, labelled artifact and profile.

## Playback-lab decision supplied by the user

The pilot TVs' dedicated test accounts can log in and play the required
DRM-protected content from the lab network without manual approval, VPN,
geographic, or device-limit blockers. The POC must still capture an actionable
player DOM/screenshot artifact if this assumption fails on a particular model.

Each server-provided case provides the account it needs in its own `login`
action, whether explicit or deterministically compiled from `qaDescription`.
TV profiles contain no test credentials. Real-TV execution must otherwise use
the same test-case action contract as the existing Browser runner, with the
same password masking and report redaction guarantees.

Every authenticated case must include its own login action after the mandatory
per-case reset. The runner never reuses a prior case's session or adds a shared
automatic sign-in.

After every TV case, preserve the current automatic trusted MyTV logout cleanup
even when the case does not explicitly contain a logout action. A cleanup
failure fails an otherwise passed case; an earlier business failure stays
authoritative. The following case still performs its own independent reset.

## Pairing decision supplied by the user

A person may complete Samsung and LG vendor/Appium remote-pairing prompts during
initial setup and whenever re-pairing is required. The desktop GUI must surface
this as an explicit paused `needs pairing` state with instructions; it must not
retry or attempt to dismiss the TV confirmation automatically.

## Pilot reliability decision supplied by the user

For initial support of a pilot TV model, each core flow—login, search, playback,
and logout—must complete successfully **three consecutive times** from the
desktop GUI. This is a POC threshold, not a permanent full-estate certification
bar; raise it when the 2017-to-latest compatibility matrix is expanded.

## Artifact decision supplied by the user

V1 failure evidence is limited to screenshots and redacted DOM diagnostics.
Video, audio, and HDMI-capture evidence are deferred future features. Add them
only through a future **Settings → Test** page with explicit opt-in capture,
availability checks, artifact location, retention notice, and redaction review.

TV screenshots and DOM diagnostics are saved locally in the existing writable
Electron host report folder under
`<Electron userData>/user-report/tv-artifacts/<runId>/<caseId>/`. Do not write
them beside the packaged app installation. DOM diagnostics require redaction;
screenshots are sensitive report data.

The required results API receives case status/results only. Never upload TV
screenshots, DOM diagnostics, or a local artifact archive to that API.
For v1, use the exact existing Browser status/result payload; retain TV details
only in the local report manifest. A later API contract revision may add
platform/device fields deliberately.

Add **Settings → Test → TV artifact retention** with `3 days` (default),
`5 days`, `7 days`, and `Forever`. Before a new TV run, main process cleanup
uses each completed run manifest's `completedAt` to delete only expired
`tv-artifacts` run folders. Do not delete active folders or existing Playwright
report/result directories.

Add a locally persisted **Settings → Test → TV case timeout**, defaulting to
**10 minutes**. It covers one complete real-TV execution attempt: reset/restart,
all actions/assertions, and automatic logout cleanup. A timeout follows the
technical recovery policy rather than silently continuing to another case.
An individual server case may explicitly override the default for a longer
flow, up to a hard maximum of **30 minutes**; record the validated effective
timeout in its artifact manifest.

## Physical-lab ownership decision supplied by the user

There is no separate lab owner: any engineer using a TV is responsible for its
network reachability, permitted firmware changes, and physical recovery for
that session. The real-TV runner must collect the detected model, OS version,
firmware version, app version, and host OS in every result/manifest so shared
device configuration drift can be traced later.

## Dynamic-IP decision supplied by the user

TV IP addresses can change every few days. Direct IP entry is therefore
mandatory for every real-TV target. Device profiles store an optional
`lastKnownHost` only; a validated connection updates it and every run manifest
records the actual host used. Discovery is best-effort: do not promise that
Samsung scanning can locate a TV whose current IP is unknown.

Each laptop saves named local device profiles containing device label, platform,
app ID, model metadata, and optional last-known IP. The operator updates the
current IP through scan/direct entry when it changes; profiles and pairing state
are not shared between laptops.

Direct IP may also start an one-off run without saving a profile. The current
platform, IP, detected/confirmed installed app identity, and coordination
acknowledgement remain in memory and are recorded only in that run's manifest.
Saving a named profile is optional for quick pick and future setup. For an
one-off, list compatible installed MyTV apps first; if none can be identified,
the operator can explicitly select/install a package for that run.

## Toolchain decision supplied by the user

On both Windows and macOS, the app first automatically detects Tizen Studio,
webOS TV CLI, Appium, and compatible Chromedriver. When detection fails, users
configure local installation paths in **Settings → Test**. Overrides are local
to the laptop and must be validated by the Electron main process before a TV
run.

When tools are missing, the user approved automatic download/installation of
Appium drivers and vendor tooling. Interpret this as an explicit
**Install missing tools** button in **Settings → Test**, not a silent startup
download. Installation uses pinned official sources, shows progress and
permission/license prompts, verifies the result, and does not replace an
existing user-managed installation without consent. Add a Settings **Help**
button that opens a cross-platform instruction modal for setup and recovery.

## App-deployment decision supplied by the user

Each saved TV profile uses a default installed MyTV package. Ordinary test runs
only clear MyTV storage and launch that installed app. A separate explicit
**Install/Update app** action chooses and deploys a replacement `.wgt` or `.ipk`
to the selected TV, validates the resulting app ID/version, and updates the
profile's default-package metadata.

Before every run, verify installed MyTV app ID and version match the selected
profile. A mismatch blocks the run before reset/actions and directs the user to
**Install/Update app**; it must never silently test a different build.

## MyTV app-ID decision supplied by the user

- LG MyTV app ID: `com.mytvb2c.app`.
- Explicit LG deployment is permitted to install/update that same app ID and
  replace the currently installed MyTV version on a lab TV. The desktop app
  must say so in its confirmation.
- The runner never restores, uninstalls, or rolls back an app automatically;
  engineers restore the LG release manually from the app store if necessary.
- Samsung store app ID: `PP2MTMRMs9.MyTV`.
- Samsung test packages must use a different approved ID, normally
  `PP2MTMRMs8.MyTV` but potentially another non-store number.
- The runner must hard-block the Samsung store ID from selection and deployment;
  there is no administrator override.

The Samsung store app ID is non-eligible for this test runner's package
installation and app selection. Store the chosen distinct test ID in each
profile and validate package metadata before install so the test runner cannot
overwrite/conflict with the store app on the same device.

## Blocking questions — answer before phase 1

1. What exact Samsung and LG model numbers, model years, OS versions, and
   firmware versions are in the pilot? One driver result does not generalize.
2. Is the host macOS, Windows, or Linux? It must host Electron, vendor SDKs,
   Appium, and matching legacy Chromedriver where needed.
3. Who owns the static/reserved IPs, firmware-update policy, and physical
   access to each test TV? Which TVs are shared versus private?
4. May QA builds be installed/reinstalled and app storage cleared during a run?
   What is the required clean-state policy?
5. A QA-build-only bridge is deferred. Appium DOM inspection and screenshots
   are the v1 assertion channel; a remote-only model is unsupported for semantic
   automation until the future bridge is approved.
6. Does "production build" mean the current production-equivalent package,
   signed for the vendor developer workflow without any test-only app changes?
7. App IDs and deployable `.wgt`/`.ipk` artifacts exist. Record their exact
   identifiers, versions, and secure local artifact location in the lab-private
   POC evidence, never in source control.
8. Are DRM licenses, backend allowlists, device registration limits, and test
   accounts approved for the physical TV lab? Playback cannot be validated
   honestly without them.
9. The v1 shared-device paper-note process is agreed. When an always-on host
   becomes available, reconsider the deferred lease service.
10. Is a manual pairing prompt acceptable during setup/re-pairing? If not, what
   approved credential/bootstrap mechanism replaces it?
11. What pass-rate and duration target makes the pilot trustworthy? Suggested:
    10 consecutive runs per critical flow on each pilot TV.
12. Is visual capture sufficient, or must video/audio/HDMI evidence be kept for
    failed playback? That changes hardware scope.
13. Which data may leave the TV to the desktop screenshot/report, and what
    retention/redaction rule applies to test credentials and user data?

## First implementation-session prompt

> Implement phase 2 of `docs/real-tv-appium/phases.md` only after the POC
> evidence for both pilot devices is recorded in `docs/real-tv-appium/HANDOFF.md`.
> Preserve the existing dirty worktree. Start with failing unit tests for device
> registry validation, secret redaction, device lock release, and Appium command
> construction. Do not add renderer UI or run live vendor commands until the
> pure contracts pass.

## Validation baseline for future sessions

```text
npm run test:unit
node --check app/main.js
node --check app/preload.js
node --check app/renderer/renderer.js
npx playwright test tests/run-test-case-mytv.spec.js --list
git diff --check
```

Add target-specific unit commands as phase 2 introduces them. Live TV tests are
environment-dependent and must be reported separately from local unit results.
