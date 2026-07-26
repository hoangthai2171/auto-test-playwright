# Physical-TV Appium POC Runbook

## Purpose

Prove the device path before changing the Electron GUI. This runbook is for a
dedicated lab host and two non-production lab TVs. Never put private keys,
remote pairing tokens, QA app packages, or account credentials in this repo.

## Preconditions

- Samsung pilot: exact model/firmware known; TV and host are on the same trusted
  LAN; Samsung Developer Mode is enabled; Tizen Studio can reach the TV through
  SDB; a production-equivalent signed `.wgt` is available.
- LG pilot: exact model/firmware known; Developer Mode app is enabled and
  signed in; webOS TV CLI can reach the TV; the TV key/passphrase setup has been
  completed; a production-equivalent `.ipk` is available.
- Both: a dedicated MyTV test account, static/reserved IP, and no human using
  the physical remote during a run.

## Tooling to pin and record

Record the actual versions in a lab-private setup record:

- Node and Appium server version.
- `appium-tizen-tv-driver` version.
- `appium-lg-webos-driver` version.
- Tizen Studio/SDB version.
- webOS TV CLI version and matching Chromedriver version for the LG TV.
- TV model, model year, OS version, firmware, and app package version.

Appium's TV drivers are community drivers. Treat a successful run on one model
as proof for that model/firmware only, not every Samsung or LG TV.

## Current Samsung macOS command harness

The repository provides a Samsung-only Phase 1 harness. It does not touch the
Electron GUI, and it creates only ignored local evidence under
`.real-tv-appium/evidence/`.

```bash
npm run tv:poc:tizen:doctor
npm run tv:poc:tizen:setup
npm run tv:poc:tizen:pair -- --host <tv-ip>
[MYTV_TIZEN_RC_TOKEN=<runtime-pairing-token>] \
MYTV_TIZEN_TEST_USERNAME=<dedicated-account> \
MYTV_TIZEN_TEST_PASSWORD=<dedicated-password> \
npm run tv:poc:tizen -- \
  --host <tv-ip> \
  --sdb-serial <live-sdb-host:port> \
  --model <actual-tv-model> --model-year <actual-model-year> \
  --app-id PP2MTMRMs8.MyTV \
  --chromedriver <absolute-compatible-chromedriver-path> \
  --package <absolute-signed-test.wgt> --deploy \
  --login-from-env \
  --verify-logout
```

`PP2MTMRMs9.MyTV` is rejected unconditionally, before session creation or
deployment. The harness reads the `.wgt` application ID before `--deploy`,
uses the exact explicit `--sdb-serial` verified in `sdb devices`, starts Appium
on loopback, uses real remote key commands, writes redacted DOM diagnostics and
genuine screenshots only when visual capture is available, then closes the
WebDriver session and Appium. The SDB
serial may differ from the TV address given to `--host`; copy the live
`host:port` value from `sdb devices` rather than deriving it. Do not put the
pairing token, IP address, package path, credentials, screenshots, or generated
evidence in source control.

After a successful `pair-remote` command, the Samsung driver can obtain an
omitted `appium:rcToken` from its local secure cache. The optional
`MYTV_TIZEN_RC_TOKEN` environment variable is only a runtime override; never
copy either token source into the repository or evidence.

`--login-from-env` reads the dedicated test account only at runtime from
`MYTV_TIZEN_TEST_USERNAME` and `MYTV_TIZEN_TEST_PASSWORD`. It reaches MyTV's
login controls with real remote keys and enters both values through the MyTV
virtual keyboard one character at a time. These variables are redacted from
evidence and must never be saved in source control. `--verify-logout` requires
that flag so it cannot claim to prove a logout without a fresh dedicated-account
login after reset.

The harness creates the paired session in remote-only mode first, then
terminates only the distinct test package before it asks the driver to attach
Chromedriver in debug mode. This avoids the Tizen driver's foreground-app
startup race while preserving the production-app block and DOM-inspection
requirement.

The POC command requires the actual `--model` and `--model-year` rather than
assuming the named 2022 pilot. This prevents a run against a separate home or
lab TV from producing misleading pilot compatibility evidence. A passing run
still establishes only that exact model/firmware combination; it never changes
the support status of another model.

As of 2026-07-24, the exact project pins are Appium `2.19.0` and
`appium-tizen-tv-driver` `0.18.1`. Appium `3.5.2` is incompatible with this
driver's declared Appium-2 peer range. This macOS host has SDB `4.2.36` and
Tizen CLI `2.5.25`; it has successfully connected to the pilot by SDB. A
supplied `PP2MTMRMs8.MyTV` v`3.5.3` package initially failed deployment with
`install failed[118, -12]` (invalid certificate chain). It was subsequently
rebuilt with the currently active Samsung profile `MyTV-test-2` and passed
local archive/manifest validation. That first rebuild retained stale unsigned
`.sign` content from the source tree. A clean temporary rebuild excluding stale
signing artifacts, package outputs, and Finder metadata produced
`MyTV-VNPT-test-clean.wgt` (redacted local SHA-256
`bf33974bcb4c…30cd9a7121429`). At that point, a compatible Chromedriver had
not yet been validated, so this was not a completed Samsung POC.

### Current home-TV exploratory result

The separately connected home TV identifies as `QA65Q70TAKXXV`, not the named
2022 pilot. Its first rebuilt package attempts failed. Changing the filename to
no spaces exposed the detailed vendor error: an unsigned stale
`.sign/.manifest.tmp` was packaged. The clean package then installed
successfully as `PP2MTMRMs8.MyTV`, alongside—not over—the store app
`PP2MTMRMs9.MyTV`. This proves only deployment on this separate target; it does
not prove visual launch, Appium operation, or model support. Samsung documents
that TV `tizen run -p` expects the application ID, not package ID. The corrected
`tizen run -p PP2MTMRMs8.MyTV` command reported launch success, and the
operator physically confirmed MyTV opened. Screenshot availability is recorded
separately from the mandatory DOM-only semantic POC evidence.

On 2026-07-26, a fresh read-only SDB connection again identified this home TV.
The live SDB serial differed from an earlier supplied serial, so the harness
now requires `--sdb-serial` and uses it as `appium:udid`; keep both values
local and obtain the serial from `sdb devices` immediately before a run. This
was not an Appium run: no pairing, session, remote key, DOM inspection,
screenshot, reset/restart, login, logout, deployment, or app selection took
place. The pairing token, compatible Chromedriver, and dedicated test account
remain required. The home TV—and the named 2022 pilot—remain unsupported.

### Home-TV Appium preflight finding — 2026-07-26

The test application's debug endpoint reported Tizen `5.5` with Chromium
`69.0.3497.128`. ChromeDriver `2.44`, `2.43`, and the compatible `2.42`
candidate each attached successfully, and paired remote-only sessions reset
the distinct test app to the welcome screen with readable visible/focused DOM
state. The Appium screenshot command then timed out waiting for a renderer
response in every trial. The driver's documented ChromeDriver `2.36` fallback
also attached, advertised screenshot support, and reproduced the same timeout
while DOM JavaScript stayed responsive. The hardened retry stopped its local
Appium process group and released its newly created SDB forward, but could not
cleanly delete the WebDriver session while that screenshot request was blocked.
Direct DevTools evaluation succeeded but `Page.captureScreenshot` also timed
out, so a driver-side DevTools screenshot fallback cannot make this model pass.
Visual capture is therefore unavailable on this model. The earlier screenshot
attempt stopped before real keys or test-account login/logout, but this
limitation does not block the approved DOM-only semantic POC or imply support
for the named pilot.

### Screenshot-capture investigation boundary — 2026-07-26

The installed/current `appium-tizen-tv-driver` `0.18.1` has no native Tizen
display-capture command: its standard WebDriver screenshot route is proxied to
ChromeDriver. The direct DevTools capture trial exercises the same renderer
boundary and also timed out, while DOM evaluation remained responsive. Samsung
documents that application screen capture is unsupported; see [Other Features
Q&A](https://developer.samsung.com/smarttv/develop/faq/other-features.html).

Accordingly, there is no safe, documented, genuine-Appium screenshot candidate
to validate on this Tizen `5.5` / Chromium `69.0.3497.128` home TV. Do not
substitute HDMI/camera capture, DOM rendering, `html2canvas`, or another
synthetic image: none is accepted as genuine visual evidence. This investigation
did not open a new TV/Appium session or send keys, and did not deploy, launch,
select, change, or remove either MyTV application. The test app remains
`PP2MTMRMs8.MyTV`; the production app `PP2MTMRMs9.MyTV` remains permanently
ineligible.

### Approved Samsung DOM-only semantic POC when screenshot is unavailable

`--skip-screenshot-gate` is an explicit POC-only opt-in for continuing the
remaining DOM-only semantic checks on the installed Samsung test app. It does
not call Appium `GET /screenshot`, create a PNG, or use a synthetic image. The
manifest must record `visualCapture: unavailable` and no result may claim
visual-regression coverage.

Use it without deployment or dedicated-account flags for the next partial
check:

```bash
npm run tv:poc:tizen -- \
  --host <tv-ip> \
  --sdb-serial <live-sdb-host:port> \
  --model <actual-tv-model> --model-year <actual-model-year> \
  --app-id PP2MTMRMs8.MyTV \
  --chromedriver <absolute-compatible-chromedriver-path> \
  --skip-screenshot-gate
```

This run may collect redacted local DOM evidence for reset/restart, real remote
keys, DOM inspection, and normal session/Appium/SDB-forward cleanup. A success
is reported as `passed_without_screenshot_gate`; it can contribute to the exact
model's DOM-only semantic POC but cannot claim visual capture or general Samsung
support.

The semantic opt-in must omit `--deploy`, use only the already installed test
app, and supply all of these runtime-only inputs together:

```bash
MYTV_TIZEN_TEST_USERNAME=<dedicated-account> \
MYTV_TIZEN_TEST_PASSWORD=<dedicated-password> \
npm run tv:poc:tizen -- \
  --host <tv-ip> --sdb-serial <live-sdb-host:port> \
  --model <actual-tv-model> --model-year <actual-model-year> \
  --app-id PP2MTMRMs8.MyTV \
  --chromedriver <absolute-compatible-chromedriver-path> \
  --skip-screenshot-gate --login-from-env --verify-logout \
  --search-name <known-playable-title> \
  --content-type <channel|movie|content>
```

The harness opens search and activates the selected result with real remote
keys, enters the query through MyTV's virtual keyboard one character at a time,
and records only redacted DOM metadata. Playback requires no visible error
popup plus a visible, non-paused/non-ended video with usable data and either an
advancing media clock or rendered video dimensions. It creates no screenshot or
synthetic visual substitute. The manifest records separate `semanticSearch` and
`semanticPlayback` checks before trusted logout; a local implementation result
is not physical-TV evidence or Samsung support.

The physical home-TV semantic run on 2026-07-26 completed as
`passed_without_screenshot_gate` in local redacted manifest
`samsung-tizen-2026-07-26T05-38-38-188Z`. After the runtime-only dedicated
login, it searched `VTV1 HD` through the on-screen keyboard, activated the
matching visible result with real remote keys, and recorded a non-paused,
advancing visible video with usable data/frames and no detected error popup.
Trusted logout invocation, WebDriver close, Appium shutdown, and cleanup of
only its newly created SDB forwards passed. The run used only
`PP2MTMRMs8.MyTV`, no deployment, and no screenshot request.

That historical run did not leave the player before trusted logout, so it is
not evidence for the corrected teardown contract. The current harness directly
activates `Đăng nhập` on the initial welcome screen for dedicated-account runs;
it does not run the former `up/right/enter/back` experience-screen probe or a
second reset. After semantic playback it sends Back, waits two seconds for
player-session unload, calls `processLogOut`, waits two seconds, requires the
account-login control, and clears MyTV `localStorage`. The account-login check
and local-storage clear apply to every `--verify-logout` run.

The corrected flow has passed focused local tests and physical-TV validation.
After a transient SDB reconnection, the final redacted manifest
`samsung-tizen-2026-07-26T06-23-41-538Z` recorded direct Login without the
Experience detour, semantic search/playback, player Back plus the two-second
unload wait, and trusted logout. Logout waits two seconds for MyTV's actual
account-login screen (`#loginSelfCare` / `remote-login-method`) before clearing
MyTV `localStorage`; it does not require the welcome landing screen. WebDriver,
Appium, and newly-created SDB-forward cleanup passed. The run used only
`PP2MTMRMs8.MyTV`, no deployment, and no screenshot request.

`visualCapture` remains unavailable; there is no visual-regression result or
Samsung support claim. When the 2022 pilot is available, retry the genuine
Appium screenshot gate before any DOM-only flow for that separate model.

On 2026-07-26, this partial command completed against the separate 2020 home
TV using only `PP2MTMRMs8.MyTV`, no deployment, and no account flags. Its local
redacted manifest recorded a focus change from `Đăng nhập` to `Trải nghiệm`
after the real right key, plus passed reset/restart, DOM inspection, clean
WebDriver session close, Appium shutdown, and release of its newly created SDB
forward. No screenshot request occurred. This is partial transport evidence
only: it does not prove physical reset preservation, dedicated-account
login/logout, semantic search/playback, visual capture, or general Samsung
support.

Later on 2026-07-26, an explicitly authorized partial run added
`--login-from-env --verify-logout`, still with no deployment and only
`PP2MTMRMs8.MyTV`. It reset that distinct test package after the remote-key
proof, activated the MyTV welcome login control, entered the runtime-only
dedicated account through the on-screen virtual keyboard one character at a
time, and completed trusted `window.processLogOut`. Its replacement redacted
local manifest recorded passed login/logout, normal session close, Appium
shutdown, and release of only its newly-created SDB forwards. It made no
screenshot request and created no PNG. The POC stops Appium process-log capture
before any credential key actions and redacts profile-selection DOM, so retained
evidence does not contain credentials, profile labels, or profile IDs.

This remains `passed_without_screenshot_gate`. It does not establish physical
reset preservation, a genuine screenshot path, semantic search/playback, or
support for any other Samsung model.

The latest retained local redacted manifest,
`samsung-tizen-2026-07-26T06-23-41-538Z`, records the completed DOM-only
semantic result, player exit/unload, account-login logout confirmation,
successful WebDriver-session close, local Appium shutdown, and newly-created
SDB-forward cleanup. The earlier `Mã lỗi: 3000` post-call DOM observation in
`samsung-tizen-2026-07-26T04-36-53-108Z` remains historical and unresolved—not
a product-flow logout pass or failure. The harness unit-tests that any later
required cleanup failure changes a partial result to `failed` and suppresses
its partial-success message. This local hardening does not create visual
capture or establish Samsung support beyond exact-model DOM-only evidence.

After these MyTV-only reset runs, the operator confirmed that Developer Mode
remained enabled and opened the unrelated YouTube application. Subsequent
Appium sessions continued using the existing pairing cache. This records the
observed reset-preservation check but does not create visual-capture capability
or general Samsung support.

## POC sequence

### 1. Verify vendor connection first

Samsung:

1. Confirm developer mode and host/TV network reachability.
2. Connect with SDB and confirm the device is listed.
3. Install/launch the signed production-equivalent package using the vendor
   workflow.
4. Complete the Appium driver's one-time remote pairing prompt on the TV.

LG:

1. Confirm Developer Mode has remaining session time.
2. Verify the device is registered and reachable through webOS CLI.
3. Complete the key-server/passphrase flow in the Developer Mode app.
4. Install/launch the production-equivalent package with the vendor workflow.
5. Complete the Appium driver's remote permission prompt on the TV.

Stop here if a vendor connection is unreliable. Appium cannot compensate for a
device that is not registered, paired, or reachable.

### 2. Prove Appium capabilities

For each TV, create an Appium session using only the driver-required
capabilities: platform, automation name, connected device identity/host, app
ID or package, and platform debugger/remote settings. Keep the capability JSON
in a lab-private file because it can include local paths and device metadata.

Prove this exact sequence:

1. Start the selected production-equivalent MyTV app.
2. Clear only MyTV app storage, restart the app, and verify its first-run/login
   state without disturbing Developer Mode or another installed application.
3. Attempt a genuine Appium screenshot. If it is unavailable on Samsung, record
   `visualCapture: unavailable`, create no substitute, and continue only under
   this DOM-only POC policy. On LG, stop until genuine capture works unless the
   user explicitly changes the policy.
4. Send one `right` key and verify the real TV focus changes.
5. Read visible DOM text and the existing focused-element selectors through the
   driver; verify focus/screen state changed as expected.
6. Press `back` and verify state again.
7. End session; confirm the app and device return to the documented clean state.

### 3. Prove the product flow

Run the smallest legal MyTV case:

1. Launch app.
2. Login via remote navigation and the on-screen virtual keyboard.
3. Open search and enter a short content title character by character.
4. Play one item.
5. Use the existing DOM player checks and, where exposed, verify media time
   increases after a bounded wait.
6. Capture a completion screenshot only when visual capture is available;
   otherwise retain redacted DOM/player diagnostics, logout, and close the
   Appium session.

## Failure classification

| Failure | Action |
|---|---|
| TV not reachable | Stop; repair LAN/developer-mode/SDB or webOS CLI connection. |
| Pairing prompt/token invalid | Stop; operator completes pairing; do not auto-retry. |
| App not installed/launch fails | Inspect signing, package/app ID, developer session, and platform logs. |
| Appium starts but cannot inspect the required DOM | Do not port semantic actions for that model; mark it unsupported in v1 and retain the future QA-bridge option. |
| Samsung screenshot unavailable | Record `visualCapture: unavailable`; preserve redacted DOM diagnostics and continue the approved DOM-only POC without a substitute image. |
| LG screenshot unavailable | Stop the POC; do not create a substitute image or apply the Samsung exception. |
| Playback UI appears but position does not advance | Treat as a product failure; retain player diagnostics and a screenshot only when visual capture is available. |

## POC evidence to retain outside git

- Redacted Appium server log.
- Redacted capability summary and driver versions.
- First/last genuine screenshots for each platform where visual capture is available.
- DOM focus/screen/player diagnostics before/after key presses and during playback.
- A short model compatibility record and unresolved limitations.
