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
- During a TV run, the GUI shows live status, screenshots when the target
  advertises visual capture, redacted DOM diagnostics when it does not, and
  **Stop** only; it never offers manual remote-key or other interactive TV
  controls.
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
target-neutral `TvSession`. Appium sends actual remote keys and reads mandatory
DOM state; genuine screenshots are an optional `visualCapture` capability. No
test-only MyTV app instrumentation is permitted in v1.

## Work order

1. Get the two-device POC green using [poc-runbook.md](poc-runbook.md).
2. Update this file with actual model/OS/driver facts and POC evidence.
3. Implement phase 2 from [phases.md](phases.md), test-first.
4. Do not start GUI work until Appium DOM inspection works on both pilot TVs.
   Samsung may be explicitly represented as DOM-only when visual capture is
   unavailable; LG still requires genuine visual capture unless this policy is
   changed explicitly.
5. Implement target-neutral actions before making a selected TV appear runnable
   in the GUI.

## Phase 1 implementation and findings — 2026-07-24

**Status: Samsung POC is in progress but has not passed.** No model is
supported yet, and LG work has not started. SDB connectivity is proven; package
deployment, remote pairing, DOM inspection, screenshot, reset, login/playback,
and logout remain unproven.

### Implemented command-line harness (no Electron changes)

- `scripts/real-tv-appium/tizen-poc.js` provides project-local setup, doctor,
  pairing, and physical-run commands. It starts Appium only on `127.0.0.1`,
  performs real Tizen remote keys (`up`, `right`, `ok`, `back`), collects DOM
  focus/body evidence plus screenshots, executes `tizen: clearApp` followed by
  restart, and—with explicit `--login-from-env`—uses the MyTV virtual keyboard
  to log in the runtime-only dedicated account character by character before
  invoking the trusted existing `window.processLogOut` cleanup. It deletes the
  session and terminates Appium.
- `scripts/real-tv-appium/tizen-poc-core.js` hard-blocks Samsung store ID
  `PP2MTMRMs9.MyTV` before capability creation or deployment. There is no
  override. It accepts the normal test ID `PP2MTMRMs8.MyTV` or another supplied
  non-store test ID, verifies a `.wgt`'s `config.xml` identity before an
  explicit `--deploy`, and deploys only through the Tizen TV installer with
  the explicitly verified SDB device serial. It discovers a standard macOS
  Tizen Studio installation when `TIZEN_HOME` is not already set.
- Evidence goes only to ignored `.real-tv-appium/evidence/`, is mode-restricted
  locally, and redacts pairing tokens, obvious credentials, and host IPs. It
  is never uploaded. Pairing tokens are runtime-only in `MYTV_TIZEN_RC_TOKEN`.

### Actual macOS setup evidence

| Item | Finding |
|---|---|
| Host | macOS 26.5.2 (build 25F84), arm64 |
| Node / npm / Electron | v24.18.0 / 11.16.0 / 31.7.7 |
| Appium | 2.19.0, pinned locally in `devDependencies` |
| Samsung driver | `appium-tizen-tv-driver` 0.18.1, installed in ignored project-local `APPIUM_HOME` |
| Appium startup | Passed locally: the server loaded `tizentv@0.18.1`, bound only to `127.0.0.1:4724`, answered `/status`, then was SIGTERM-stopped; the port closed. No TV session was created. |
| Compatibility finding | Appium 3.5.2 was tried and rejected by the Samsung driver's declared peer range `^2.0.0-beta.46`; Appium 2.19.0 is therefore the POC pin. |
| Tizen Studio / SDB | Connected on 2026-07-24. Detected SDB `4.2.36`, Tizen CLI `2.5.25`, device serial redacted from this ledger, and model reported by SDB as `QA50Q80BAKXXV`. |
| Vendor connection | Passed: SDB listed the device after the TV Developer Mode host-IP correction. TCP reachability alone was insufficient; the successful SDB handshake is the gate evidence. |
| Installed MyTV identity | Read-only SDB discovery found the store app `PP2MTMRMs9.MyTV` and **did not find** `PP2MTMRMs8.MyTV`. The store app was not selected, launched, changed, or removed. |
| Chromedriver | Not yet supplied or validated against the pilot TV's web engine. |
| Test package | The verified source was rebuilt locally on 2026-07-24 with the currently active Samsung profile `MyTV-test-2`, using its Samsung author/distributor certificates. The final clean package, `MyTV-VNPT-test-clean.wgt`, identifies `PP2MTMRMs8.MyTV`, version `3.5.3`; archive integrity passed (local SHA-256 `bf33974bcb4c…30cd9a7121429`). It was not copied into this repository. |
| Deployment attempt | Reached the Samsung TV through the documented `tizen install` path, but the TV rejected it with `install failed[118, -12]`: invalid certificate chain. No test app was installed; the production store app was not selected, changed, or removed. |
| Signing status | The earlier generic Tizen profile caused the initial failed deployment. A newer Samsung certificate profile, `MyTV-test-2`, is active. Its first rebuild included stale `.sign` artifacts, including an unsigned `.sign/.manifest.tmp`; the TV rejected that archive. A clean temporary rebuild excluding stale signing artifacts, package outputs, and Finder metadata installed successfully on the home target, proving that target accepts this certificate chain. |
| Office-network reachability interlude | A prior post-repackage office-TV attempt did not transfer a package because the Mac had moved to a different network. This was resolved only for the separate home-TV exploration and does not replace the named pilot connection. |
| Home-TV exploratory deployment | A separate home TV reported by SDB as `QA65Q70TAKXXV` connected successfully. Earlier rebuilt archives transferred but failed. Retrying with a no-space filename exposed the actual TV error: unsigned `.sign/.manifest.tmp`. A clean temporary rebuild excluding stale `.sign` artifacts (and copied to `MyTV-VNPT-test-clean.wgt`) transferred and installed successfully as `PP2MTMRMs8.MyTV`. Read-only app discovery confirms it is installed alongside, not over, production `PP2MTMRMs9.MyTV`. An earlier SDB launch gave no visible result, and the initial `tizen run` incorrectly used the package ID. Samsung's TV CLI requires application ID `PP2MTMRMs8.MyTV`; the corrected command reported successful launch with a local PID, and the operator physically confirmed MyTV opened. This TV is not the named 2022 pilot and does not establish support. |
| Pairing token, compatible Chromedriver, dedicated account | Not supplied to this workspace; none were stored or guessed. |

### Current home-TV connectivity check — 2026-07-26

- A fresh read-only SDB connection to the separate home TV succeeded. `sdb
  devices` identifies the connected target as `QA65Q70TAKXXV`.
- The live SDB serial did not match the earlier supplied serial. Neither value
  is recorded here. The Samsung harness now requires an explicit
  `--sdb-serial` and passes it to Appium as `appium:udid`, separately from the
  TV address used for remote pairing and `appium:deviceAddress`. Before a POC,
  copy the currently listed `host:port` serial from `sdb devices`; never infer
  it from the TV address.
- The harness also now requires `--model` and `--model-year` for each run. It
  no longer records the named 2022 pilot as a default, preventing the separate
  2020 home TV from being mislabelled as pilot evidence.
- This was connection evidence only. No Appium session, remote pairing,
  Chromedriver validation, remote key, screenshot, DOM, reset/restart, login,
  logout, deployment, or app-selection action ran. In particular, production
  `PP2MTMRMs9.MyTV` was not selected or changed.
- The pairing token, a Chromedriver proven compatible by a real WebDriver DOM
  session, and the dedicated test account are still required. They have not
  been guessed or stored. Samsung remains unsupported, and LG remains
  deliberately out of scope.

### Pairing update — 2026-07-26

- The operator completed the Samsung Appium remote-pairing prompt for the home
  TV. The driver keeps that token in its local secure cache; neither the token
  nor its cache location is recorded in this repository.
- The harness now omits `appium:rcToken` when `MYTV_TIZEN_RC_TOKEN` is absent,
  allowing the paired driver to use its local cache. The environment variable
  remains a runtime-only override for a cache-less or different host.
- This establishes pairing only. A compatible Chromedriver, dedicated test
  account, real session, remote-key/DOM/screenshot/reset/logout evidence, and
  clean session/server shutdown are still unproven.

### Home-TV Appium session finding — 2026-07-26

- The home TV reports Tizen `5.5` and its MyTV test-app debug endpoint reports
  Chromium `69.0.3497.128`. Official ChromeDriver release guidance lists both
  ChromeDriver `2.44` and `2.43` as compatible with Chrome `69–71`; each local
  binary successfully attached through Appium to this app's debug endpoint.
- A paired remote-only Appium session succeeded using the driver's local token
  cache. The harness then terminated only `PP2MTMRMs8`, attached the debugger
  to `PP2MTMRMs8.MyTV`, cleared MyTV local storage, and observed the fresh
  welcome screen and its focused `Đăng nhập` control through DOM JavaScript.
  The store app `PP2MTMRMs9.MyTV` was never selected, launched, changed, or
  removed.
- The required Appium screenshot did **not** work with either compatible
  ChromeDriver `2.44` or `2.43`: both timed out receiving a renderer response
  at the welcome screen. A third compatible candidate, ChromeDriver `2.42`
  (the documented Chrome `68–70` line), reproduced the same bounded
  `GET /screenshot` timeout after DOM/reset success. This is a platform/tool
  limitation under investigation, not a passing screenshot result.
- The Tizen driver's own documented fallback, ChromeDriver `2.36`, also
  attached despite the TV's newer Chrome `69` engine. Its negotiated WebDriver
  capabilities advertised `takesScreenshot: true`, and DOM JavaScript remained
  responsive at the welcome screen, but the proxied screenshot request still
  never returned. This narrows the current failure to the TV renderer's
  standard ChromeDriver screenshot path; it is not a pairing, app-ID, DOM, or
  reset failure.
- A local diagnostic attached directly to the distinct test app's DevTools
  endpoint. `Runtime.evaluate` succeeded, while the renderer's own
  `Page.captureScreenshot` request timed out. Therefore a driver-side switch
  from ChromeDriver screenshot to DevTools screenshot cannot repair this model:
  both supported capture transports reach the same renderer limitation. This
  diagnostic produced no saved image and is not counted as POC screenshot
  evidence.
- The screenshot timeout blocks a normal WebDriver `DELETE /session`, so the
  harness now terminates its isolated local Appium process group and removes
  only SDB forwards that were absent before the run. The latest `2.42` manifest
  records Appium stopped and its new forward released, but it deliberately does
  **not** claim a clean WebDriver session close. The full clean-shutdown gate
  remains unproven.
- Because screenshot capture failed before key dispatch, the real-key,
  dedicated-account login/logout, and full POC gates are still unproven. The
  separate 2020 home TV remains unsupported; this result says nothing about
  the named 2022 pilot. LG work remains out of scope.

### Screenshot-capture investigation — 2026-07-26

- The installed and currently published `appium-tizen-tv-driver` `0.18.1`
  provides no native Tizen display-capture command. Its driver source proxies
  standard WebDriver routes not on its Tizen command allowlist to ChromeDriver;
  therefore Appium `GET /screenshot` reaches the same Chrome renderer capture
  path already shown to hang on this TV. This is confirmed by the driver's
  local source and published [proxied-command documentation](https://www.npmjs.com/package/appium-tizen-tv-driver?activeTab=code).
- A direct DevTools `Page.captureScreenshot` request timed out under the same
  otherwise responsive renderer. Changing the client from Appium/ChromeDriver
  to DevTools cannot make a valid screenshot for this model, and the driver has
  no separate native capture capability to select.
- Samsung's TV documentation states that application screen capture is not
  supported ([Other Features Q&A](https://developer.samsung.com/smarttv/develop/faq/other-features.html)). That does not replace the observed failure with
  a broader hardware claim, but it leaves no documented Samsung app-capture
  transport to test as an Appium-native alternative on this device.
- No compliant genuine-capture candidate exists for `QA65Q70TAKXXV` / Tizen
  `5.5` / Chromium `69.0.3497.128`. HDMI, camera, synthetic DOM,
  `html2canvas`, or saved-page alternatives are not candidates and were neither
  added nor run. This investigation performed no new TV session, deployment,
  app launch, remote key, or account action.
- Keep this model's `visualCapture` capability unavailable. It can continue
  only through the separately documented DOM-only semantic POC and cannot claim
  visual-regression evidence or general Samsung support.

### Samsung DOM-only semantic POC policy — approved 2026-07-26

The screenshot route is no longer a Samsung semantic-automation gate. For a
model whose Appium/Chromedriver screenshot path is unavailable, the POC may use
the explicit `--skip-screenshot-gate` mode and must record
`visualCapture: unavailable` in its local redacted evidence. It must never
create, substitute, or imply a screenshot using DOM rendering, `html2canvas`,
HDMI, camera, or any other synthetic capture.

A DOM-only POC still requires real remote keys, usable body/focus/active DOM,
test-app-only reset/restart, dedicated-account virtual-keyboard login, semantic
search and playback assertions where the DOM exposes them, trusted logout
cleanup, and normal local cleanup. A model that completes these checks may be
described only as eligible for **DOM-only semantic automation** on its exact
model/firmware. It is not visual-regression capable, does not provide screenshot
preview evidence, and says nothing about other Samsung models or the Samsung
estate.

When access to the 2022 Samsung pilot resumes, rerun the genuine Appium
screenshot capability check before the DOM-only flow. A pass upgrades only that
model's `visualCapture` capability; another failure does not block the approved
DOM-only POC. LG remains deliberately unstarted.

### Samsung DOM-only semantic POC result — 2026-07-26

The local command-line harness now accepts an explicit Samsung-only semantic
request: `--skip-screenshot-gate --login-from-env --verify-logout
--search-name <known-playable-title> --content-type <channel|movie|content>`.
It rejects an incomplete request before session creation. After the existing
test-app-only reset and runtime-only dedicated-account login, it opens search,
types character by character with real remote keys, focuses and activates the
best visible DOM result, then evaluates playback from two visible-video DOM
samples and error-popup state. It writes separate redacted `semanticSearch` and
`semanticPlayback` manifest checks before trusted logout.

The first physical semantic attempt safely exposed an asynchronous handoff from
dedicated-account login to profile selection: the adapter tried to open Search
before that picker became ready. The adapter now condition-waits for the
profile-or-Home state before remote navigation; a focused unit contract covers
that transition.

The historical replacement physical-TV run completed with
`passed_without_screenshot_gate` in the local redacted manifest
`samsung-tizen-2026-07-26T05-38-38-188Z`. It used only
`PP2MTMRMs8.MyTV`, omitted deployment, made no Appium screenshot request, and
recorded a real-remote virtual-keyboard search for `VTV1 HD`, activation of the
matching visible result, and a two-sample visible-video DOM assessment: video
was non-paused, had usable data and frames, advanced its media clock, and had
no detected playback-error popup. Trusted `window.processLogOut`, normal
WebDriver close, local Appium stop, and only-new SDB-forward cleanup also
passed. Retained post-logout DOM does not prove a clean visible logout screen;
the evidence proves the trusted invocation and cleanup only.

That historical run called trusted logout while the player was still open, so
it does not verify the corrected player-teardown/logout contract below.

The current harness now uses direct initial `Đăng nhập` activation for a
dedicated-account run, rather than the former `up/right/enter/back`
experience-screen probe and second reset. After semantic playback it sends real
Back, waits two seconds for player-session unload, invokes `processLogOut`,
waits two seconds, requires the account-login control, and then clears MyTV
`localStorage`. This verified account-login logout sequence applies to every
`--verify-logout` run. Focused unit contracts passed (188 tests total).

The first corrected-flow attempt,
`samsung-tizen-2026-07-26T05-58-24-816Z`, failed before session creation
because SDB reported the paired target missing immediately after a successful
preflight. It launched no app and performed no login, playback, or logout
action; local Appium stop and SDB-forward cleanup passed.

After SDB reconnection, the intermediate attempt,
`samsung-tizen-2026-07-26T06-17-37-050Z`, proved that a neutral `Up` press can
initialize the welcome remote handler without changing focus or opening the
experience screen: direct `Đăng nhập`, dedicated login, semantic search and
playback, and real Back plus the two-second unload wait all passed. It then
correctly exposed that successful logout lands on MyTV's account-login screen,
not the welcome landing screen.

The replacement evidence,
`samsung-tizen-2026-07-26T06-23-41-538Z`, completed with
`passed_without_screenshot_gate`. After player Back and the two-second unload
wait, it invoked trusted `processLogOut`, waited two seconds, confirmed the
account-login screen (`#loginSelfCare` with `remote-login-method`), and cleared
MyTV `localStorage`. Direct login, semantic search/playback, WebDriver close,
local Appium stop, and only-new SDB-forward cleanup passed. It used only the
distinct test app, omitted deployment, and made no screenshot request.

This is exact-model DOM-only semantic evidence, not visual evidence or Samsung
support. `visualCapture` remains `unavailable`; the genuine screenshot gate is
unresolved, no PNG or synthetic capture was created, and LG remains unstarted.

### Previous partial no-screenshot POC evidence — 2026-07-26

- The command-line harness accepts explicit `--skip-screenshot-gate`. It makes
  no Appium screenshot request and records redacted DOM diagnostics only.
- This opt-in continuation may prove reset/restart, real remote keys, DOM
  inspection, normal WebDriver close, Appium stop, and SDB-forward cleanup for
  the installed distinct test app. It must use neither `--deploy` nor any
  account/login/logout flag unless those independent checks are deliberately
  authorized later.
- A successful DOM-only run reports `passed_without_screenshot_gate`. It may
  contribute to the exact model's DOM-only semantic POC; it cannot claim visual
  capture or general Samsung support.
- The first home-TV partial run completed on 2026-07-26 with that exact
  partial status. It used only `PP2MTMRMs8.MyTV`, omitted deployment and all
  account flags, and made no screenshot request. The manifest recorded passed
  vendor connection, test-app reset/restart, real remote `up/right/ok/back`,
  DOM focus inspection (right moved focus from `Đăng nhập` to `Trải nghiệm`),
  normal WebDriver close, Appium stop, and removal of its newly created SDB
  forward. Physical preservation of Developer Mode, pairing, and unrelated
  apps remains unverified; screenshots, dedicated-account login/logout, the
  full POC, and model support remain unproven.
- A later explicitly authorized partial run used runtime-only dedicated-account
  variables with `--login-from-env --verify-logout`, still against only
  `PP2MTMRMs8.MyTV`, without deployment or any screenshot request. It recorded
  `passed_without_screenshot_gate`: the MyTV welcome login control was
  activated with remote keys, credentials were entered one character at a time
  through the virtual keyboard, trusted `window.processLogOut` completed, and
  normal WebDriver close, Appium stop, and newly-created SDB-forward cleanup
  passed. The runner resets only the distinct test package again after the
  remote-key proof so login begins from the welcome state.
- Chromium `69.0.3497.128` cannot parse optional chaining in the shared
  navigation helper's injected script. The POC adapter now translates that
  syntax before evaluation. Appium process-log capture stops before any
  virtual-keyboard credential action, and profile-selection DOM is redacted
  before it can enter retained local evidence. The retained replacement
  manifest contains no account credentials, profile labels, or profile IDs.
- The latest retained redacted manifest,
  `samsung-tizen-2026-07-26T06-23-41-538Z`, records the completed DOM-only
  semantic result with `semanticSearch`, `semanticPlayback`,
  `semanticPlayerExit`, `automaticLogout`, `sessionClosed`, `appiumStopped`,
  and `sdbForwardsReleased` passed. `automaticLogout` confirms MyTV's actual
  account-login screen after trusted logout, then clears `localStorage`. The
  earlier `Mã lỗi: 3000` DOM observation in
  `samsung-tizen-2026-07-26T04-36-53-108Z` remains historical and unresolved;
  it is not a product-flow logout pass or failure. No credentials or profile
  data appear in retained evidence.
- The local cleanup-status contract now changes both full and no-screenshot
  partial POC results to `failed` when required WebDriver-session close, local
  Appium shutdown, or newly-created SDB-forward cleanup fails. It also prevents
  a failed cleanup from printing a partial-success message. This is local
  runner hardening only; it does not create visual-capture capability or general
  Samsung support.
- This successful partial login/logout evidence does not prove physical reset
  preservation beyond the documented operator check, semantic search/playback,
  visual capture, or support for any other Samsung model.
- After the MyTV-only reset runs, the operator physically confirmed Developer
  Mode remained enabled and opened the unrelated YouTube application. The
  subsequent Appium sessions also continued using the existing pairing cache.
  This records preservation of those observed states only; it does not create
  visual-capture capability.

The `tizen: clearApp` driver command is documented to clear the active web
app's local storage and reload it. The harness still requires an operator's
physical verification that this preserves Developer Mode, pairing, and an
unrelated installed app before reset can be marked passed.

### Samsung next handoff

1. The separate home-TV has completed its authorized no-screenshot
   remote-key/DOM/login/logout/cleanup checks against only
   `PP2MTMRMs8.MyTV`. The operator also confirmed Developer Mode and an
   unrelated YouTube app survived the reset; subsequent sessions confirmed the
   existing pairing cache remained usable.
2. On detected `QA50Q80BAKXXV` / reported firmware `T-PTMUABC-1720.7, BT-S`,
   restore the SDB connection, then deploy the re-signed package and confirm
   that the TV accepts its certificate chain and exposes `PP2MTMRMs8.MyTV`. Do
   not select or alter the store app.
3. Choose and validate a compatible Chromedriver for this TV in a real
   WebDriver DOM session. Its executable path remains local-only.
4. Before any POC invocation, read `sdb devices` and pass its exact live serial
   with `--sdb-serial`; it may differ from the TV address. Perform the one-time
   on-TV pairing only with operator confirmation, retain the emitted token
   outside this repository, then run the DOM-only semantic POC with the
   dedicated test account, `--skip-screenshot-gate --login-from-env
   --verify-logout --search-name <known-playable-title> --content-type
   <channel|movie|content>`, search/playback assertions, and physical
   reset-preservation checks. Retain only redacted local evidence.
5. Update this ledger with the generated manifest's pass/fail facts. Start LG
   only after the Samsung DOM-only semantic POC passes; do not infer general
   Samsung support from one model's result.

For the separate home-TV exploration, the current profile/package combination
has proven deployment, operator-confirmed launch, pairing, remote commands,
DOM, reset, and trusted logout-call execution. Visual capture remains
unavailable, and semantic search/playback remains unproven. The TV CLI does not
support the attempted device-log command; retain the detailed installer error
as local evidence and do not infer general Samsung support.

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

V1 failure evidence always includes redacted DOM diagnostics and includes
genuine screenshots only when the model advertises `visualCapture: available`.
An unavailable capture capability is recorded explicitly and never replaced by
video, audio, HDMI, DOM-rendered, camera, or synthetic evidence. Video, audio,
and HDMI capture remain deferred future features. Add them only through a future
**Settings → Test** page with explicit opt-in capture, availability checks,
artifact location, retention notice, and redaction review.

Available TV screenshots and required DOM diagnostics are saved locally in the
existing writable Electron host report folder under
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

The device form must expose this local profile value as **Path to package
file**, with a native file-picker option as well as direct path entry. Samsung
accepts `.wgt` and LG accepts `.ipk`; choosing the path only saves the candidate
for a later explicit deployment. The main process revalidates the extension,
file, platform, app ID, version, and backend label at install time. Saving a
path or starting an ordinary test run never installs/replaces an app.

Before every run, verify installed MyTV app ID and version match the selected
profile. A mismatch blocks the run before reset/actions and directs the user to
**Install/Update app**; it must never silently test a different build.

### Deferred future feature: Manage Samsung signing / Repackage for this TV

Keep Samsung DUID-specific signing outside ordinary test execution and outside
V1's **Install/Update app** flow. A later explicit, user-confirmed workflow may
read/request and show the selected TV DUID, open the vendor-managed Samsung
certificate authentication/profile flow, package from a selected local source
tree, and return a validated test `.wgt` candidate. It must preserve the
distinct test app-ID safety block, never capture Samsung credentials or private
key material, never commit signing material/DUIDs/packages, and require the
separate deployment confirmation. Until it is implemented and security-tested,
the operator must provide a pre-signed `.wgt` whose distributor certificate
already includes the target TV DUID.

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
