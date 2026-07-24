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
3. Capture a screenshot.
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
6. Capture a completion screenshot, logout, and close the Appium session.

## Failure classification

| Failure | Action |
|---|---|
| TV not reachable | Stop; repair LAN/developer-mode/SDB or webOS CLI connection. |
| Pairing prompt/token invalid | Stop; operator completes pairing; do not auto-retry. |
| App not installed/launch fails | Inspect signing, package/app ID, developer session, and platform logs. |
| Appium starts but cannot inspect the required DOM | Do not port semantic actions for that model; mark it unsupported in v1 and retain the future QA-bridge option. |
| Screenshot unavailable | Preserve logs/DOM diagnostics, then decide whether a supported capture path exists for this model. |
| Playback UI appears but position does not advance | Treat as a product failure; retain player diagnostics and screenshot. |

## POC evidence to retain outside git

- Redacted Appium server log.
- Redacted capability summary and driver versions.
- First/last screenshots for each platform.
- DOM focus/screen/player diagnostics before/after key presses and during playback.
- A short model compatibility record and unresolved limitations.
