# Phased Delivery Plan

> Work phases in order. A failed gate stops the next phase; do not hide a
> platform limitation with timing sleeps or visual guesses.

## Phase 0 — Commit the test-lab contract

**Outcome:** A named Samsung and LG pilot device exist, their compatibility
facts are recorded, and the team agrees what may be installed and reset.

- [ ] Answer every blocking item in [HANDOFF.md](HANDOFF.md).
- [ ] Record model, model year, OS/firmware, network IP/reservation, app ID,
  package format, and owner for one Samsung and one LG TV.
- [ ] Confirm both TVs can stay on the same trusted LAN as the macOS/Windows
  Appium host and that each has a dedicated test account.
- [ ] Mark each TV `private` or `shared-manual`. For a shared device, agree the
  human coordination process and require the planned GUI acknowledgement. This
  is a temporary risk acceptance, not a concurrency control.
- [ ] Identify the production-equivalent signed package and app ID for each
  platform; the initial pilot packages connect to the production backend using
  dedicated test accounts. Do not add test-only application code for v1.
- [ ] Decide whether package installation/reset is permitted before every run,
  once per batch, or manually.

**Gate:** The team can state, for both devices, how the production-equivalent
package is signed,
installed, launched, observed, and returned to a clean session.

## Phase 1 — Command-line hardware POC (no GUI changes)

**Outcome:** Appium controls one physical TV per platform before this project
depends on it. Execute this POC on macOS first; validate Windows only after the
macOS pilot evidence passes. The office Samsung pilot is unsupported for the
current remote-input path; the user authorized the 2022 LG office TV as the
next Phase 1 target.

- [ ] Install/validate the vendor SDK and CLI on the future test-host machine:
  Tizen Studio/SDB for Samsung; webOS TV CLI for LG.
- [ ] Enable developer mode and connect each device through its vendor workflow.
- [ ] Install Appium plus the two community drivers as pinned local project/tool
  dependencies; record exact versions and driver checks in a setup script.
- [ ] Pair the Samsung remote and LG remote once with operator confirmation on
  the actual TV. Keep pairing artifacts out of source control.
- [ ] Deploy the QA build, launch it, send `up/right/ok/back`, and attempt a
  genuine Appium screenshot for both platforms. Samsung may record
  `visualCapture: unavailable` and continue only under the approved DOM-only
  policy; LG screenshot capture remains a gate. Never substitute a synthetic
  image.
- [ ] Prove the exact platform-specific reset method clears only MyTV app
  storage, restarts the app, and preserves Developer Mode, pairing, and
  unrelated apps on both pilot TVs.
- [ ] Prove a selected multi-case batch resets/restarts before every individual
  case and reports a reset failure before any case action is attempted.
- [ ] Verify Appium exposes reliable DOM inspection on the pilot models: body
  text, focused element, virtual keyboard, content rows, and player checks.
  Visual capture is separately recorded. Its absence does not block the
  approved Samsung DOM-only semantic path, but it remains an LG gate and must
  never be hidden or substituted.

**Gate:** A reproducible, documented command starts one session per platform,
presses a real remote key, reads the expected DOM focus/screen state, and ends
cleanly. Samsung may record `visualCapture: unavailable` without visual-
regression coverage; LG must capture a genuine screenshot until explicitly
changed.

### Current Samsung Phase 1 record — 2026-07-24

**Pilot identity caveat (2026-07-27):** SDB previously reported
`QA50Q80BAKXXV`, while the `2022` label in this historical record came from
operator-supplied metadata rather than an SDB model-year field. Reconfirm the
model string and obtain the TV's displayed model/firmware information before
the next live session; the model year is currently unconfirmed.

- [x] Added a macOS command-line Samsung POC harness and safety/redaction unit
  tests. It has no Electron dependency or GUI change.
- [x] Pinned local Appium `2.19.0` and installed
  `appium-tizen-tv-driver` `0.18.1` in ignored project-local Appium state.
  Appium `3.5.2` was incompatible with this driver and was removed from the
  POC pin.
- [x] Verified the local server loads `tizentv@0.18.1`, listens only on
  `127.0.0.1`, responds to health checking, and can be stopped cleanly.
- [x] Connected SDB to the Samsung pilot on 2026-07-24. SDB reports
  `QA50Q80BAKXXV`; SDB `4.2.36` and Tizen CLI `2.5.25` are installed. Read-only
  app discovery found only the Samsung store MyTV app, which was left untouched.
- [x] Inspected a supplied `PP2MTMRMs8.MyTV` v`3.5.3` `.wgt` and attempted
  installation through the Tizen TV CLI. The TV rejected it with invalid
  certificate chain (`install failed[118, -12]`); no test package was installed
  and the store app stayed untouched.
- [x] Rebuilt the distinct test app with the currently active Samsung profile
  `MyTV-test-2`. The initial rebuild included stale unsigned `.sign` content.
  A clean temporary rebuild excluding stale signing artifacts, package outputs,
  and Finder metadata produced `MyTV-VNPT-test-clean.wgt`, retaining
  `PP2MTMRMs8.MyTV` v`3.5.3`, with redacted local SHA-256
  `bf33974bcb4c…30cd9a7121429`.
- [ ] Deploy/launch the re-signed test package, then provide a compatible
  Chromedriver, pair the remote, and validate DOM inspection, screenshots,
  per-case MyTV-only reset/restart, and automatic logout.
- [ ] Restore the pilot TV's SDB reachability from the current Mac network (or
  update its direct IP) before retrying deployment. The latest attempt made no
  package transfer and changed neither MyTV app.
- [x] Exploratory home-TV connection: SDB reached `QA65Q70TAKXXV`; its
  initial package transferred but failed. A no-space retry revealed unsigned
  stale `.sign/.manifest.tmp`; the clean package then installed successfully as
  `PP2MTMRMs8.MyTV` alongside production `PP2MTMRMs9.MyTV`. This is a separate
  non-pilot deployment result and does not establish Samsung support.
- [x] Home-TV launch: the Samsung-documented `tizen run -p
  PP2MTMRMs8.MyTV` command reported success after an earlier package-ID attempt
  failed, and the operator physically confirmed MyTV opened.
- [x] Home-TV read-only SDB recheck on 2026-07-26: the current connected model
  is `QA65Q70TAKXXV`. The live serial differed from an earlier supplied value,
  so the POC harness now requires the serial explicitly and provides it to
  Appium as `appium:udid`, separately from the TV address. The serial/address
  values remain out of this repository.
- [x] Home-TV Samsung Appium remote pairing completed with operator confirmation.
  The driver retains the token in its local secure cache; the harness can use
  that cache without receiving, logging, or storing the token.
- [x] Home-TV visual-capture capability is `unavailable`. The dedicated test
  account is runtime-only and is neither guessed nor stored; this does not
  block the approved DOM-only semantic POC.
- [x] Home-TV Appium/DOM preflight: a paired remote-only session started, the
  detected Chrome `69.0.3497.128` endpoint accepted ChromeDriver `2.44` and
  `2.43`, plus the compatible `2.42` candidate, and
  the reset test app exposed visible welcome/focus DOM state. Session and
  Appium shutdown completed cleanly for the earlier `2.44`/`2.43` trials. This
  is not a POC pass.
- [x] Home-TV Appium visual-capture capability is `unavailable`: the fresh
  welcome-screen screenshot failed because
  all three compatible ChromeDriver candidates (`2.44`, `2.43`, and `2.42`)
  timed out receiving a renderer response. The driver's documented fallback
  `2.36` attached and advertised screenshot support but reproduced the same
  hang while DOM JavaScript still responded. Direct DevTools evaluation also
  worked while `Page.captureScreenshot` timed out, eliminating a driver-side
  ChromeDriver-versus-DevTools capture fix. The hardened retry stopped Appium
  and released its SDB forward but could not cleanly delete the blocked
  WebDriver session. Keep visual capture unavailable; this no longer blocks the
  approved DOM-only semantic POC.
- [x] Screenshot-capture investigation: the current `appium-tizen-tv-driver`
  `0.18.1` has no native Tizen capture command; its standard screenshot route
  is proxied to ChromeDriver, while direct DevTools capture also times out.
  Samsung documents no supported application screen-capture API. No compliant
  genuine-Appium screenshot candidate exists for this Tizen `5.5` / Chromium
  `69.0.3497.128` home TV. No new physical-TV action was run during this
  investigation; synthetic/DOM, `html2canvas`, HDMI, and camera alternatives
  remain invalid for this gate.
- [x] Home-TV partial no-screenshot POC: an explicit
  `--skip-screenshot-gate` mode may continue reset/restart, real remote keys,
  DOM inspection, normal WebDriver close, Appium stop, and SDB-forward cleanup
  without making any screenshot request. The first test-app-only/no-account
  run recorded `passed_without_screenshot_gate`: reset/restart, `up/right/ok/back`,
  DOM focus change, WebDriver close, Appium stop, and new-forward cleanup all
  passed. It is transport/auth evidence for the DOM-only POC, not visual
  evidence or general Samsung support.
- [x] Home-TV remote-input recheck on 2026-07-27: a fresh read-only preflight
  confirmed `QA65Q70TAKXXV` and the installed distinct test app. A fresh
  no-credential/no-deployment `--skip-screenshot-gate` run with ChromeDriver
  `2.44` again passed reset/restart, DOM inspection, real
  `KEY_UP`/`KEY_RIGHT`/`KEY_ENTER`/`KEY_RETURN`, clean WebDriver close, Appium
  stop, and only-new SDB-forward cleanup. `KEY_RIGHT` moved focus from
  `Đăng nhập` to `Trải nghiệm`. Visual capture remains unavailable and this
  does not establish support for the separate 2022 pilot.
- [x] Home-TV authorized partial login/logout: a subsequent
  `--skip-screenshot-gate --login-from-env --verify-logout` run used only the
  distinct test app and runtime-only credentials. It reset the test app after
  the remote-key proof, activated the welcome login control, entered both
  values through the virtual keyboard one character at a time, then completed
  trusted `window.processLogOut`. The redacted local manifest records passed
  login, logout, normal WebDriver close, Appium shutdown, and only-new SDB
  forward cleanup. It made no screenshot request and performed no deployment.
  Appium process-log capture was disabled before credential entry, and profile
  selection DOM is redacted before retained evidence is written.
- [x] Historical DOM-only semantic evidence (superseded for teardown/logout
  confirmation by the final retained manifest below):
  `samsung-tizen-2026-07-26T05-38-38-188Z` records the completed exact-model
  DOM-only semantic result with successful search, playback assessment,
  WebDriver close, local Appium shutdown, and newly-created SDB-forward
  cleanup. The trusted logout invocation resolved, but there is still no
  partial-POC assertion for a clean visible post-logout screen. The earlier
  `Mã lỗi: 3000` observation in `samsung-tizen-2026-07-26T04-36-53-108Z`
  remains unresolved and is not a product-flow logout pass or failure. A local
  unit contract prevents any later required cleanup failure from retaining or
  printing a partial-success result.
- [x] Home-TV reset-preservation observation: after the MyTV-only reset runs,
  the operator confirmed Developer Mode remained enabled and opened unrelated
  YouTube; subsequent Appium sessions continued using the existing pairing
  cache. A genuine Appium screenshot remains unavailable. These partial
  findings do not establish visual capture or general Samsung support.
- [x] Samsung DOM-only semantic Phase 1 teardown recheck (exact home model
  only): the historical semantic evidence
  `samsung-tizen-2026-07-26T05-38-38-188Z` is valid for search/playback but
  called trusted logout while the player remained open. The corrected harness
  now directly activates the initial `Đăng nhập` control, then exits the player
  with Back and waits two seconds before logout; every `--verify-logout` run
  waits two seconds, requires MyTV's account-login control, and clears MyTV
  `localStorage`. The final physical evidence,
  `samsung-tizen-2026-07-26T06-23-41-538Z`, passed direct login, semantic
  search/playback, Back plus the two-second unload wait, account-login logout
  confirmation, WebDriver close, Appium shutdown, and only-new SDB-forward
  cleanup. The scoped unit suite passed all 188 tests. It made no deployment or
  screenshot request. This remains DOM-only
  and exact-model only; `visualCapture` is unavailable and no result supports
  `QAQ80BAKXXV` or any other Samsung model.
- [x] 2022 Samsung pilot read-only preflight on 2026-07-27: SDB connected and
  reported `QA50Q80BAKXXV`, but the inventory did not contain the required
  distinct test app `PP2MTMRMs8.MyTV`. The store app was inventory-observed
  only and was not selected or changed. The POC stopped before Chromedriver,
  pairing, Appium, screenshots, reset, remote keys, or account actions. This
  is a prerequisite blocker, not support evidence.
- [x] 2022 Samsung pilot authorized installation on 2026-07-27: the explicitly
  confirmed `Debug/SS2020353.wgt` was verified as `PP2MTMRMs8.MyTV` v`3.5.3`,
  then installed successfully and confirmed through a fresh read-only SDB
  inventory. Local ChromeDriver `2.36`, `2.42`, `2.43`, and `2.44` binaries are
  only evidenced for the separate 2020 home TV's Chromium 69 endpoint; none
  was guessed or selected for this pilot. The POC stopped before pairing,
  Appium, screenshots, reset, remote keys, or account actions.
- [x] 2022 Samsung pilot test-app Chromium discovery on 2026-07-27: an
  operator-authorized SDB debug launch of only `PP2MTMRMs8.MyTV` reported Tizen
  `6.5` and Chromium `85.0.4183.93`. Its temporary SDB forward was removed;
  no credentials, product flow, Appium, remote keys, screenshots, or store-app
  operation occurred. No ChromeDriver 85 binary was found in local
  development/tool locations, so the genuine screenshot gate remains blocked.
- [x] 2022 Samsung pilot default screenshot-gate attempt on 2026-07-27: the
  verified Google ChromeDriver `85.0.4183.87` was used once with only the
  distinct test app and no deployment, credentials, product flows, or screenshot
  bypass. Appium created a Tizen session but failed while requesting a remote
  pairing token with `Invalid WebSocket frame: invalid status code 1005`; it did
  not reach reset, DOM, remote-key, or screenshot checks. Appium stopped and no
  new SDB forward remained. No retry or prompt dismissal occurred.
- [x] 2022 Samsung pilot paired screenshot-gate retry on 2026-07-27: after
  operator-approved pairing, the default POC created the paired Appium session,
  reset only the distinct test app, attached ChromeDriver `85.0.4183.87` to
  Chromium `85.0.4183.93`, and read welcome-screen DOM/focus state. Its genuine
  Appium screenshot request timed out after 20 seconds. No image was saved or
  substituted; the runner marked visual capture unavailable for this attempt,
  stopped Appium, and released its new SDB forward. The screenshot block left
  clean WebDriver deletion and remaining POC gates unproven.
- [x] 2022 Samsung pilot DOM-only partial attempt on 2026-07-27: after reset,
  welcome-screen DOM focused `Đăng nhập`. The harness sent `KEY_UP` and then
  `KEY_RIGHT`, but the retained DOM focus remained on `Đăng nhập`; the required
  focus-change check failed. Session close, Appium stop, and SDB-forward cleanup
  passed. One separately user-authorized unchanged repeat reproduced the same
  `KEY_RIGHT` result and passed its session-close, Appium-stop, and SDB-forward
  cleanup checks. No automatic follow-up retry, credentials, product flow,
  screenshot, or store-app action occurred, so this model is not yet eligible
  for DOM-only semantic automation.
- [x] 2022 Samsung pilot one-key readiness diagnostic on 2026-07-27: a
  user-authorized `KEY_DOWN` command was sent only to the distinct test app,
  but its pre-key DOM sample was empty while subsequent samples showed the
  initial `Đăng nhập` focus. The result is inconclusive rather than a key
  transition; session-close and SDB-forward cleanup passed. No screenshot,
  credentials, product flow, deployment, or store-app action occurred.
- [x] 2022 Samsung pilot readiness-guarded `KEY_RIGHT` diagnostic on
  2026-07-27: the paired Appium `rcMode: remote` session confirmed initial
  welcome focus before the command, but `Đăng nhập` remained focused after one
  and three seconds. Session-close and SDB-forward cleanup passed. The result
  proves no detectable transition for this route. A subsequent manual physical
  `KEY_RIGHT` in an otherwise equivalent active session changed focus from
  `Đăng nhập` to `Trải nghiệm`, so app welcome-screen handling works and the
  remaining fault domain is the current Appium remote-command path or its key
  delivery/mapping.
- [x] 2022 Samsung pilot redacted Appium remote trace on 2026-07-27: the
  `tizen: pressKey` request reached the driver, selected its remote-control
  implementation, used a cached token with a connected WebSocket, and reported
  no remote API error, but `KEY_RIGHT` still left `Đăng nhập` focused. Together
  with the physical-key control check, this blocks Phase 1 at or below the
  current Appium remote-client command path. Further live retries are deferred
  pending a compatible driver/vendor path.
- [x] 2022 Samsung pilot remote-input configuration and key-family checks on
  2026-07-27: read-only SDB capability reports Tizen `6.5`; the installed
  `appium-tizen-tv-driver` `0.18.1` is also the current registry version.
  Omitting `rcOnly` still left `KEY_RIGHT` without a transition, and
  `KEY_ENTER` did not leave the focused welcome Login control. These results
  rule out the DOM-session configuration and a direction-only mapping issue;
  Appium remote input remains blocked on this pilot.
- [x] 2022 Samsung pilot fresh-pairing recovery check on 2026-07-27: after the
  operator removed all TV Device Connection Manager entries and manually
  approved one fresh `pair-remote` request, a no-credential `KEY_ENTER` check
  still left the focused welcome control unchanged. The stale/denied-pairing
  recovery path is excluded; no automatic pairing retry occurred.
- [x] 2022 Samsung pilot foreground-context check on 2026-07-27: after debug
  attach, the operator manually confirmed that the distinct MyTV test app was
  visibly foregrounded at its welcome screen before one no-credential Appium
  `KEY_ENTER` command. The welcome DOM focus and screen state remained
  unchanged at one and three seconds; session-close and SDB-forward cleanup
  passed. The Internet Browser/debug-foreground hypothesis is excluded for
  this route.
- [x] Pilot final same-harness remote-key recheck on 2026-07-28: a fresh
  read-only preflight again reported `QA50Q80BAKXXV`, Tizen `6.5`, and the
  installed test app v`3.5.3`; the historical `2022` model-year label remains
  unconfirmed. The exact no-credential/no-deployment screenshot-skipped
  harness sequence used for the 2020 home-TV control run was repeated with the
  locally available Chromium-85-compatible ChromeDriver `85.0.4183.87`.
  Reset/restart, session close, Appium stop, and SDB-forward cleanup passed,
  but `KEY_RIGHT` left the same welcome control focused. This reproduces the
  pilot remote-input blocker under the equivalent harness without establishing
  its root cause.
- [x] LG office-TV read-only preflight on 2026-07-28: authenticated webOS CLI
  inspection reported model `55QNED80SRA`, SDK `10.3.1`, firmware `33.31.61`,
  and installed inspectable MyTV `com.mytvb2c.app` v`3.5.0`. The registered
  target matched the runtime-only host. The project-local Appium home has only
  the Tizen driver and no local ChromeDriver was evidenced compatible with this
  TV, so the preflight stopped without Appium, pairing, launch, reset,
  deployment, credentials, product flows, or retained live evidence.
- [x] LG Appium screenshot-gated POC attempted once on 2026-07-28: the
  project-local Appium webOS driver `0.5.0`, legacy webOS TV CLI `1.12.4`, and
  locally present ChromeDriver `2.36.540469` were available. The driver created
  a webOS session but received `ECONNRESET` while connecting remote transport,
  before app launch/reset, ChromeDriver attachment, DOM inspection, remote
  input, or screenshot capture. Thus ChromeDriver compatibility and the
  mandatory genuine screenshot gate remain unproven; no retry was made.
  Deployment still needs separate explicit confirmation naming the exact target
  and package, and no bypass or synthetic visual fallback is permitted.
- [x] LG approved package deployment on 2026-07-28: the user named
  `LG_FHD_3.5.0.ipk` for the shown registered LG target. Its control metadata
  is `com.mytvb2c.app` v`3.5.0`; the authorized install returned `Success` and
  a read-only inventory reported the same inspectable, visible app/version.
  No launch or product flow was issued. The preceding single POC was not
  rerun, so the screenshot gate remains unmet.
- [x] LG freshly authorized post-deployment POC on 2026-07-28: fresh read-only
  device and installed-app checks passed, then the Appium webOS driver created
  a session and again failed with `ECONNRESET` at its remote-transport
  connection step. It did not reach app launch/reset, ChromeDriver, DOM,
  remote input, or a screenshot request. This separately authorized attempt is
  complete and was not retried; the genuine screenshot gate remains unmet.
- [x] LG secure remote-transport diagnosis on 2026-07-28: after active VS Code
  debugging was closed, read-only TCP checks reached both webOS remote endpoints.
  A separately authorized secure-WebSocket POC established remote pairing
  registration and obtained a secure pointer-input socket path, then failed
  with `unable to get local issuer certificate`. It did not reach app
  launch/reset, ChromeDriver, DOM, input, or screenshot capture, and no retry
  was made. The local transcript was redacted after it was found to contain a
  pairing key; the screenshot gate remains unmet.
- [x] LG secure screenshot-gated POC passed on 2026-07-28: after the user
  explicitly approved a process-scoped self-signed-certificate exception, the
  secure-WebSocket Appium run foregrounded installed MyTV, reset only MyTV
  local storage, inspected DOM, observed a real Right focus change and a real
  Back action, and saved genuine Appium screenshots before input, after Right,
  and after Back. Session/Appium cleanup passed. No credentials or product flow
  was used. Retained metadata/log evidence is redacted; the gate screenshots
  are retained locally.
- [x] LG operator-observable secure screenshot-gated POC recheck on 2026-07-28:
  fresh read-only identity/app-inventory preflight passed, followed by one
  requested run against the already installed MyTV target. Genuine Appium
  screenshots before input, after a real Right focus change, and after a real
  Back action passed; session/Appium cleanup passed. No pairing prompt,
  credentials, deployment, uninstall, or product flow was used. Evidence is
  retained locally as redacted metadata/logs plus genuine gate screenshots.
- [ ] LG welcome-screen target-focus check on 2026-07-28: after the initial
  Right established `Đăng nhập`, a second real Right did not produce the
  required `Trải nghiệm` DOM focus within the bounded wait. The check failed;
  genuine screenshot capture and session/Appium cleanup still passed. Treat
  splash-to-`Đăng nhập` as initial focus establishment only, not as proof of
  button-to-button right navigation. No further key retry was made.
- [x] LG reset-only check on 2026-07-28: the explicitly requested MyTV-only
  local-storage reset verified the installed test target and clean session/
  Appium shutdown. No screenshot, remote key, credential, deployment,
  uninstall, or product-flow action was requested; the operator must launch
  MyTV manually to inspect its first-run screen.
- [ ] LG Appium one-Right comparison on 2026-07-28: the operator manually
  observed `Đăng nhập` already focused and one physical Right reaching
  `Trải nghiệm`. A fresh Appium session confirmed the same initial DOM focus
  and genuine screenshot, but its single Right did not produce `Trải nghiệm`
  within the bounded wait. Keep LG remote navigation unresolved; this is not a
  Samsung-equivalent unsupported-transport conclusion.
- [x] LG native-WebSocket remote-input POC on 2026-07-28: source inspection
  found that the unresolved check had configured `rcMode: js`, which uses
  synthetic ChromeDriver keyboard events. With `rcMode: rc`, secure-WebSocket
  `RIGHT` moved focus from `Đăng nhập` to `Trải nghiệm` and held for five
  seconds; genuine screenshots, `BACK`, DOM inspection, and session/Appium
  cleanup passed. This establishes only the observed LG model/firmware path.

## Phase 2 — Runner foundation and safe device registry

**Outcome:** The project can start one TV test through a controlled internal
API, with no renderer access to tools or secrets.

**Files to create/modify:**

- Create `app/device-registry.js`, `app/device-secret-store.js`,
  `app/device-discovery.js`, `app/appium-server-manager.js`, and
  `app/tv-runner.js`.
- Create `tests/lib/tv-session/{tv-session,qa-state,tizen-appium-session,webos-appium-session}.js`.
- Create `tests/run-test-case-tv.spec.js`.
- Modify `app/main.js`, `app/preload.js`, `package.json`, and Electron build
  packaging configuration.
- Add focused `node:test` contracts under `tests/unit/` for every pure module.

- [ ] Implement atomic non-secret device-registry reads/writes using the schema,
  with optional `lastKnownHost` rather than a required static IP.
- [ ] Implement redacted profile responses and encrypted secret capability
  checks; never return pairing tokens to the renderer or logs.
- [ ] Add a per-device local lock keyed by profile ID. Add a manual
  shared-device acknowledgement to the immutable run configuration and report
  metadata; it does not claim cross-laptop exclusivity.
- [ ] Implement Appium lifecycle start/health/stop, loopback binding, robust
  child-process termination, and log redaction.
- [ ] Implement session creation/close and normalized `pressKey`, optional
  visual capture, mandatory DOM inspection, diagnostic, reset, and capability
  errors for each platform.
- [ ] Retain the existing Browser process and result behavior unchanged.

**Tests:** Unit-test schema validation, registry atomicity, redaction, lock
release, shared-device acknowledgement, Appium command/config construction,
remote-key normalization, and failure classification using injected child/client
fakes.

**Gate:** A CLI/integration harness starts `TvSession`, runs one `pressKey`,
gets DOM focus/screen evidence, and cleans up for both pilot devices. Browser
unit tests continue passing.

## Phase 3 — Make server test cases truly target-neutral

**Outcome:** The existing case format runs through an abstraction rather than
requiring a Playwright `page`.

Every selected case is eligible on Browser, Samsung, and LG by default. Do not
add per-case target tags, filtering, or target-specific catalogues in v1.

- [ ] Introduce a target-neutral action context: `{session, testInfo, helpers,
  capabilities}`.
- [ ] Keep test-account selection in each server-provided case's `login`
  action. Do not add credentials to TV profiles or a separate device-account
  picker; preserve current password masking and trusted-main-process handling.
- [ ] Enforce that an authenticated flow includes its own `login` action after
  the per-case clean-state reset; do not provide automatic shared login.
- [ ] Preserve the existing trusted automatic logout cleanup after each TV case
  and its existing result-precedence semantics.
- [ ] Split pure case validation/compiler behavior from DOM-specific helpers.
- [ ] Port current DOM helpers behind `DomSession`, then port actions in this
  safe order: `wait_for_ready`, `press_ok`,
  `press_back`, `assert_screen`, `login`, `open_home`, `open_search`,
  `search_content`, playback actions, then row-navigation actions.
- [ ] Preserve character-by-character virtual-keyboard input for TV login and
  search. No direct text injection.
- [ ] Make unsupported action/capability combinations fail preflight with the
  original case ID and action index.
- [ ] Map available screenshots, DOM state, focused control, visual-capture
  capability, and Appium diagnostics into the existing step-result/report
  format.
- [ ] Keep available TV screenshots and redacted DOM diagnostics in the local
  host-app report folder only. Submit status/results to the flow-case API
  without artifact uploads.
- [ ] Keep the v1 result submission payload identical to the Browser runner.
  Store TV metadata locally; do not add fields to the API until its versioned
  server contract supports them.
- [ ] Add explicit business-versus-infrastructure error codes. Continue a
  multi-case batch after business failures. On connection/network/Appium/reset/
  unknown technical failures, hold at the active case and retry full recovery
  plus clean-case rerun three times; then require **Keep retrying** or **Stop**.
  Never resume a mid-case action or advance to the next case while recovery is
  unresolved; preserve explicit pairing pauses.
- [ ] Change manual-stop result handling: submit only fully completed cases to
  the flow-case API after a user stop, never the interrupted/unstarted cases;
  retain an immutable in-memory pending payload during the app session on sync
  failure and surface an explicit **Retry sync** action.
- [ ] Intercept app close while a run is active or results are unsynced. Require
  explicit **Stop run and close** / **Close and discard unsynced retry** consent;
  do not restore pending retry data after reopening.

**Tests:** Add contract tests running an injected fake `TvSession` through each
action. Keep existing Playwright action-runner tests and prove the Browser path
still selects its existing page-based helpers.

**Gate:** One fixture case covering login, search, playback, logout, and report
generation passes against each pilot TV from the terminal.

### Current Phase 3 local-contract record — 2026-07-28

- [x] Added a target-neutral action context, DOM/session facade, native-key
  dispatch, capability preflight with case/action context, trusted semantic
  adapter boundary, and per-case reset/logout precedence contracts.
- [x] Added fake-only terminal coverage for every supported server action,
  including character-by-character virtual-key entry; it does not contact a TV
  or use account credentials.
- [x] Added explicit business/technical classification, three-attempt
  clean-case recovery contracts, pairing pause behavior, manual-stop partial
  result submission, immutable in-memory retry-sync behavior, and close-consent
  guard contracts.
- [x] Kept the existing Browser action runner and flow-case submission payload
  unchanged; the Browser renderer now submits only fully completed cases after
  a manual stop and exposes an explicit Retry sync control.
- [x] Wired the close-consent guard into the Electron lifecycle. A close while
  a batch is active requires **Stop run and close**; a close with only an
  in-memory unsynced retry requires **Close and discard unsynced retry**. The
  retry payload is never restored after reopening.
- [x] Added the trusted LG DOM-semantic adapter required for the terminal-gate
  fixture: native remote focus, virtual-key character entry, account login,
  search-result selection, player assessment, and trusted logout. Its fixed
  local operations never accept server selectors or JavaScript. Service/row
  operations remain explicitly unavailable for the live LG adapter rather than
  being inferred from DOM text.
- [ ] A separately authorized terminal invocation accidentally ran the Phase 1
  welcome-screen POC rather than this Phase 3 product gate. It did not invoke
  login and must not be treated as product-flow evidence. The LG terminal gate
  now writes an ignored, local-only redacted manifest with semantic step status
  (never credentials, runtime host, messages, or screenshots); a fresh approved
  live run must verify login, `VTV3 HD` search/playback, logout, and cleanup.
  Any pairing prompt remains a manual on-TV pause.

## Phase 4 — Device management IPC and target GUI

**Outcome:** An operator can choose Browser/Samsung/LG and register or validate
the real target from the desktop app.

**Files to modify:**

- `app/renderer/index.html`, `app/renderer/renderer.js`,
  `app/renderer/styles.css`
- `app/preload.js`, `app/main.js`
- `tests/unit/renderer.test.js` plus new device/IPC unit tests.

- [ ] Add the target selector and platform-specific device fields described in
  [architecture.md](architecture.md).
- [ ] Add a device modal with direct IP, saved device list, scan results,
  validation state, a visible **Path to package file** field, default-package
  metadata, and an explicit **Save device** action. Samsung accepts only `.wgt`
  and LG only `.ipk`; the main process validates the chosen path and extracts
  package metadata.
- [ ] Support an explicit one-off direct-IP run without a saved profile. Keep
  its platform/IP/app confirmation in memory only; require confirmation of the
  detected installed app ID/version and offer **Save as device profile** as an
  optional post-validation action. List compatible installed MyTV apps first;
  when none can be found, offer explicit one-off package installation.
- [ ] Add a separate **Install/Update app** action that uses the saved or
  newly chosen **Path to package file**, confirms target/device/package, installs
  and validates the app, then updates the profile. Choosing/saving a path does
  not install it. Ordinary test runs must only reset and launch the already
  installed default app.
- [ ] Record the package backend label in the profile and artifact manifest.
  V1 accepts only production-connected pilot packages; a future staging build
  is separately packaged and never selected by a run-time backend switch.
- [ ] Add MyTV app-identity safety validation: LG uses `com.mytvb2c.app` and
  explicit deployment may replace the version already on a lab TV after an
  unambiguous confirmation; never
  select or deploy Samsung store app `PP2MTMRMs9.MyTV` as a test package. Make
  that safety block non-overridable, including for administrators. Allow a
  profile-specific distinct Samsung test ID, validate package metadata before
  install, and mark the store app non-eligible in discovery.
- [ ] Do not add automatic app uninstall, rollback, or restoration after a TV
  run. Engineers restore the LG release manually from the app store if needed.
- [ ] Before every run, validate installed MyTV app ID/version against the
  selected profile; block mismatches before reset or Appium actions and route
  the operator to **Install/Update app**.
- [ ] Add **Settings → Test** with TV artifact retention choices `3 days`
  (default), `5 days`, `7 days`, and `Forever`; pass the retained value only to
  the main-process TV run and implement manifest-based cleanup of completed TV
  artifact folders.
- [ ] Add a locally persisted **Settings → Test → TV case timeout**, default
  `10 minutes`, covering one complete real-TV case attempt from reset through
  automatic logout cleanup. Permit a validated server-case override for longer
  flows up to `30 minutes` and record the effective timeout in the manifest.
- [ ] Add **Settings → Test → TV toolchain** status. Automatically detect and
  validate vendor SDK/CLI, Appium, and Chromedriver on Windows/macOS; provide
  locally persisted, main-process-validated path overrides only when detection
  fails.
- [ ] Implement an explicit user-initiated **Install missing tools** workflow
  backed by a pinned official-source manifest, download/progress/error events,
  post-install verification, and no overwrite of an existing user-managed SDK
  without consent. Do not silently install at app startup.
- [ ] Add a Settings **Help** button and instruction modal for manual
  installation/repair, developer mode, pairing, direct-IP, and redacted
  diagnostics on Windows/macOS.
- [ ] Connect only preload IPC methods; never put a CLI command in renderer JS.
- [ ] Disable Run with a clear reason until a TV is selected and validation
  passes. Preserve Browser default behavior.
- [ ] Present pairing-required states as an operator pause with exact on-TV
  instructions; do not loop or retry pairing silently.
- [ ] Change preview labels and use TV screenshot frames when `visualCapture`
  is available; otherwise show an explicit DOM-only/no-visual-capture state.
  Hide Browser's interactive-webview mode for TV targets; during a run expose
  only live status, artifacts/logs, and **Stop**, never manual remote keys.
- [ ] Send credential-free native OS notifications for run completion, recovery
  decisions, and unsynced results.

**Gate:** Mocked renderer tests prove target persistence, platform switching,
scan/add/validate flows, invalid-run prevention, redaction, and payload shape.
Manual GUI verification shows a selected TV's status and either screenshot
preview or explicit DOM-only/no-visual-capture state.

## Phase 5 — End-to-end lab pilot and reliability hardening

**Outcome:** A small, trustworthy physical-TV regression suite runs from the
desktop GUI.

- [ ] Run five cases per platform: launch, login, search, play, logout.
- [ ] Repeat each case at least ten times per device and record pass rate,
  median duration, failure class, and recovery behavior.
- [ ] Validate cancellation at pairing, launch, navigation, player, and report
  stages. Ensure stopped cases are never partially submitted to the flow-case
  API.
- [ ] Add three-attempt recovery cycles only around known transport/session
  establishment/reset failures, rerunning the active case from clean state;
  never retry user-visible product assertions automatically. Require an
  operator decision after a failed cycle.
- [ ] Validate Electron packaging contains the required Appium runtime/drivers
  or presents a clear host-prerequisite failure.
- [ ] Update `README.md` and `AGENTS.md` with supported target behavior,
  setup, security, diagnostics, and validation commands.

**Gate:** The GUI successfully runs the pilot suite on both TVs with reliable
artifacts and cleanup. The team signs off on the supported model/firmware list.

## Phase 6 — Optional scale-out

Only begin after phase 5 is stable.

- [ ] Add multi-device selected batches with one independent run/session,
  artifact subtree, report result, and lock per target. Do not repurpose the
  existing one-worker browser assumption without redesigning session ownership.
- [ ] Deploy the separate internal TV-lab lease service documented in
  [lease-service.md](lease-service.md), then replace manual shared-device
  acknowledgement with atomic acquire/renew/release behavior.
- [ ] Add the deferred QA-build-only read-only bridge for model families that
  cannot expose a reliable debugger/DOM channel.
- [ ] Add controlled power/HDMI capture hardware only if visual or boot
  recovery evidence is a proven requirement.
- [ ] Add **Settings → Test** capture configuration for opt-in video, audio, or
  HDMI evidence, including availability checks, artifact paths and redaction
  review. Keep screenshots plus DOM diagnostics as the default evidence path.
- [ ] Add CI/lab-agent execution after host secrets, network access, and device
  locking are managed by infrastructure rather than a developer desktop.
- [ ] **Deferred future feature:** add a separately user-confirmed **Manage
  Samsung signing / Repackage for this TV** workflow. It may create/select a
  Samsung TV certificate profile for a reviewed DUID and package from a local
  source tree, but it must never run during test execution, silently collect
  Samsung credentials/private keys, or deploy without the separate
  **Install/Update app** confirmation. Pre-signed DUID-bound `.wgt` packages
  remain the supported workflow until this feature passes dedicated security
  and vendor-integration validation.
