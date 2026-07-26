# Architecture and Contracts

## Existing boundary to preserve

The current renderer invokes `run-test` through `app/preload.js`; `app/main.js`
validates the selected case, spawns the generic Playwright spec, streams logs,
and writes the compact report. The browser action runner and helpers are
currently `page`/DOM based.

Do not make the renderer import Appium, invoke shell commands, read device
files, or hold pairing tokens. Extend the existing main-process boundary.

```text
renderer target selector
        │ safe preload IPC
        ▼
Electron main process
  device registry · secret storage · local lock · lab-lease client · report lifecycle
        │ spawns one isolated runner for one case
        ├─────────────────────┬──────────────────────┐
        ▼                     ▼                      ▼
Browser runner          Tizen Appium session    webOS Appium session
Playwright (existing)   Samsung TV + QA build   LG TV + QA build
        │                     │                      │
        └──────────── test-case action contract ─────┘
                              │
                       compact result + preview
```

## Target selector and workspace behavior

Add a **Run target** panel in the sidebar immediately above the existing Run
and Stop controls. It controls the selected cases; it does not change folder
or API retrieval.

```text
Run target
  [ Browser ] [ Samsung ] [ LG ]

  Browser: existing APP_URL + preview options

  Samsung / LG:
  Device  [ Lab Samsung 2024 (192.168.1.40)       ▾ ]
          [ Scan ] [ Add IP ]
  Status  ● Ready · Tizen 8 · app vn.mytv.qa
  Build   Installed v3.14.2
  Package [ Path to package file…                    ] [ Choose… ]
          Samsung: .wgt · LG: .ipk
          [ Install/Update app… ]
```

- `Browser` is the default and preserves today's behavior.
- Every selected test case is eligible for Browser, Samsung, and LG by default.
  The case catalogue has no target filter in v1; only preflight capability
  validation may block a real-TV run before interaction.
- `Samsung` and `LG` require a selected, validated device before Run becomes
  enabled.
- The workspace preview title changes to the selected device label and target.
  Browser retains its optional interactive webview; TVs show screenshot frames
  only when the selected device advertises `visualCapture: available`.
  DOM-only devices show an explicit non-visual state and redacted diagnostics.
  During a TV run, the GUI is observation and emergency-stop only: do not
  provide manual remote keys, clicking, or other interactive TV controls,
  because concurrent input makes results nondeterministic.
- **Stop** ends the case, stops preview polling, asks the session to clean up,
  releases the local lock, and applies the documented manual-stop result-sync
  policy for fully completed cases only.
- Send a local native operating-system notification when a TV run completes,
  when a failed recovery cycle needs **Keep retrying** or **Stop**, and when
  completed results remain unsynced. Notifications contain no credentials or
  DOM/screenshot content.

### Per-device package-file setting

The TV device form includes a visible **Path to package file** setting. The
operator can type a local absolute path or select it through a main-process
native file picker. The field is platform-specific: Samsung accepts only a
`.wgt`; LG accepts only an `.ipk`. The selected path is local profile metadata,
not a shared project setting, because it is meaningful only for one engineer's
laptop and one platform/device profile.

Choosing or saving a path never installs an app. It records the profile's
default package candidate for a future explicit **Install/Update app** action.
The main process rechecks file existence, extension, package metadata, app ID,
version, backend label, and target platform immediately before deployment; the
renderer must not trust the saved path or inspect the package itself. The
confirmation names the exact TV, platform, app ID, package version, backend
label, and selected path. A normal Run never reads this field to install or
replace an app: it validates, clears MyTV storage, and launches the already
installed expected app only.

For Samsung, a selected `.wgt` is rejected before confirmation if its app ID is
`PP2MTMRMs9.MyTV`. This safety rule applies to typed paths, file-picker paths,
saved profiles, one-off runs, and every administrator role; there is no
override. A successful explicit deployment updates the profile's default
package path and detected app ID/version only after installed-app validation
passes.

### Deferred future feature: Manage Samsung signing / Repackage for this TV

This is explicitly **not** part of V1, ordinary **Install/Update app**, or a
test Run. A future, separately user-confirmed device-management workflow may
help an authorised developer prepare a Samsung test package for a newly chosen
TV:

1. Read or ask the operator to enter the TV DUID and display it for review.
2. Require the operator to authenticate in the vendor-managed Samsung
   certificate flow; the app never collects, logs, or transmits Samsung account
   credentials, certificate passwords, or private-key material.
3. Create or select a Samsung **TV** distributor certificate profile that
   includes that DUID. Adding a TV to an existing distributor certificate is
   not assumed possible; the workflow must support issuing/selecting a new
   profile while retaining the approved author certificate where appropriate.
4. Repackage from an explicitly selected local source tree, validate the
   distinct Samsung test app ID and package metadata, and save the resulting
   local `.wgt` only as a package candidate.
5. Require the normal separate **Install/Update app** confirmation before any
   deployment.

It must be unavailable during a run, default to off, retain only redacted local
audit metadata, and never add certificate files, private keys, DUIDs, or signed
packages to source control. Until this feature is implemented and validated,
engineers provide a pre-signed `.wgt` whose distributor certificate already
includes the selected TV's DUID.

V1 TV evidence always includes redacted DOM diagnostics and includes genuine
Appium screenshots only when `visualCapture: available`. A missing capture path
is recorded as `visualCapture: unavailable`, without HDMI, camera, DOM-rendered,
or other synthetic substitutes. Video, audio, and HDMI capture are deferred.
When implemented, they belong in a new **Settings → Test** page with an explicit
capture mode and retention notice; they must never start implicitly or become a
hidden dependency of ordinary test-case runs.

The currently approved DOM-only exception is Samsung Tizen only. LG keeps a
genuine screenshot requirement until the user explicitly changes that policy.

Store v1 TV artifacts in the existing writable Electron host report location,
not beside the installed application bundle:

```text
<Electron userData>/user-report/tv-artifacts/<runId>/<caseId>/
  screenshots/                  # present only when visualCapture is available
  dom-diagnostics/
  manifest.json
```

The compact HTML report links only to artifacts from its own run/case folder.
DOM diagnostic files must be redacted before writing. Screenshots are sensitive
because they can display test accounts or customer-like data.

Add **Settings → Test → TV artifact retention** with these exact local choices:

| Value | Stored value | Meaning |
|---|---|---|
| `3 days` | `3` | Default; delete completed TV artifact folders older than three days. |
| `5 days` | `5` | Delete completed TV artifact folders older than five days. |
| `7 days` | `7` | Delete completed TV artifact folders older than seven days. |
| `Forever` | `forever` | Never delete TV artifact folders automatically. |

The renderer persists this setting with the existing local settings record and
includes it in each TV run request. Before a new TV run starts, the main process
removes only completed `tv-artifacts/<runId>` folders whose manifest
`completedAt` is older than the selected threshold. It never deletes an active
run folder, an unreadable folder without reporting it, or existing Playwright
HTML/test-result directories. A saved `Forever` value skips cleanup. The report
logs a redacted count of folders removed, not their sensitive contents.

Add **Settings → Test → TV case timeout** as a locally persisted timeout for
one complete real-TV case attempt: reset/restart, actions, assertions, and
automatic logout cleanup. Its default is **10 minutes**. A timeout is a
technical incident: capture diagnostics, then use the active-case recovery
policy rather than moving to another case. A server test case may explicitly
override that default for a longer flow; the override is validated before run
start, must not exceed **30 minutes**, and is recorded in its manifest.

Add **Settings → Test → TV toolchain**. On startup and before TV validation,
the main process automatically detects Tizen Studio/SDB, webOS TV CLI, Appium,
and compatible Chromedriver using platform-appropriate standard installation
locations and executable/version checks. If automatic detection fails, Settings
shows the failed component and lets the user choose a local executable/directory
override. Overrides are stored locally, revalidated before each TV run, and can
be reset to automatic detection. The renderer never probes the file system
directly.

When a required component is missing, this page offers an explicit **Install
missing tools** action. It downloads and installs the required Appium drivers
and vendor tooling automatically after the user initiates that action; it never
silently installs software at application startup. The installer must use a
pinned manifest of official vendor/package sources, display source/version/
license and any required elevated-permission prompt, verify the installed
version/executable afterward, and preserve an existing user-managed installation
unless the user explicitly chooses replacement.

Add a **Help** button on the Settings page. It opens an instruction modal with
Windows/macOS prerequisites, detected status, install/repair guidance,
developer-mode and pairing steps, direct-IP troubleshooting, and a redacted
copyable diagnostics summary. Help must remain useful when automatic download,
network access, signing verification, or operating-system permissions fail.

Every TV artifact manifest and compact report row records the detected TV
platform, model, OS/firmware version, MyTV app version, and host operating
system. There is no separate lab owner; the active operator is responsible for
the TV's physical recovery and permitted configuration changes, so this metadata
is required to diagnose cross-user device drift.

Keep screenshots and redacted DOM diagnostics local in the host app's report
folder only. The flow-case API receives case status/results as required, but no
TV screenshots, DOM diagnostics, or artifact archive uploads.

For v1, submit the exact existing Browser status/result payload and validation
contract to the flow-case API. TV platform, model, firmware, app version,
effective timeout, and artifact paths belong only in the local manifest. Add
TV details to the API only through a future versioned backend contract change.

### Device discovery and direct IP

`Scan` means a vendor-aware, bounded refresh, never an arbitrary LAN scan.

| Target | Scan behavior | Direct-IP behavior |
|---|---|---|
| Browser | Not shown | Existing `APP_URL` configuration only |
| Samsung | List currently SDB-connected and saved profiles. This is best-effort, not a guaranteed subnet discovery mechanism. | Ask for the TV's current host/IP, then attempt `sdb connect <host>` and validate developer-mode access. Remote pairing remains an explicit user-approved step. |
| LG | Run webOS CLI target discovery/list commands and merge saved profiles. | Ask for the TV's current host/IP and label, register/validate the Developer Mode target, then ask the operator to complete TV passphrase/key and remote-pair prompts. |

Discovery must show **Found**, **Configured but unreachable**, **Needs pairing**,
or an actionable validation error. It must not store a device until the user
chooses **Save device**. A scan must never be the only route to a TV: IPs can
change. Direct IP entry is always available, and a successful validation updates
only that profile's `lastKnownHost` value.

Direct IP supports an **one-off run** without creating a profile. Its platform,
current host/IP, selected installed app identity/version, and manual shared-TV
acknowledgement exist only in the immutable current run configuration; do not
write them to `devices.json` unless the operator explicitly chooses **Save as
device profile**. Because an one-off run has no saved expected build, validation
first asks the platform adapter to list compatible installed MyTV app candidates,
then shows the detected app ID/version for operator confirmation before any
reset/action begins. If discovery cannot find a usable app, offer package
selection and explicit one-off installation; use the selected package's detected
app identity/version for that run without creating a profile automatically.

## Device data and secrets

Persist non-sensitive device metadata in:

```text
<Electron userData>/devices.json
```

The intended JSON shape is defined in
[device-profile.schema.json](device-profile.schema.json). It contains no
passwords, SSH private keys, LG passphrases, Samsung remote-control tokens, or
Appium server credentials.

Device profiles are intentionally IP-independent because the user reports that
TV IP addresses can change every few days. A profile identifies a named device;
`lastKnownHost` is optional convenience metadata only. The selected current IP
is copied into an immutable run manifest so a later failure can be traced.

Secrets belong in an Electron main-process secret store protected with
`safeStorage` when available. Vendor CLI key files remain in their vendor
managed location and the profile stores only an opaque device ID/reference. The
renderer receives only `hasSecret`, `needsPairing`, and redacted diagnostics.

## Shared-device coordination: manual in v1, lease service later

The local main-process device lock prevents two runs from one laptop. It cannot
prevent two engineers' laptops from driving the same LG TV. The desired central
lease service is deferred because no always-on internal host exists today.

For **v1**, shared-device coordination is a human process. The GUI must show a
prominent warning before running against a device marked `shared-manual`:

```text
Shared TV — manual coordination required
This run can interrupt another engineer's app, account, or test.
Confirm you have verified that <device label> is free before continuing.
[ ] I confirmed this TV is free
```

Run remains disabled until the operator acknowledges the warning for that run.
The report records `coordination: "manual"` and acknowledgement timestamp.
This reduces accidental use but does not protect against simultaneous laptops;
the GUI must never claim the TV is reserved or available globally.

The agreed v1 physical-lab process is a paper note attached to the TV. The note
must contain the engineer's name, started time, expected finish time, and short
test purpose. The engineer removes it immediately after completion, stop, or
failure. A stale note is not permission to use the TV: contact its named person
or the lab owner before removing/replacing it. The GUI acknowledgement text
should mirror this rule.

The separate **TV lab lease service** remains the required future solution for
every shared TV, including Samsung. Samsung's configured Developer Mode host IP
may reduce accidental concurrency on some models, but it is not a cross-model
coordination contract.

The Electron main process—not the renderer—uses the service:

```text
Future GUI clicks Run
  → main process atomically acquires lease for device ID
  → validates TV and starts Appium run
  → renews lease every 30 seconds (120-second expiry suggested)
  → releases lease on completed/stopped/failed cleanup
  → expiry frees a lease after a crashed/disconnected laptop
```

When an always-on internal host becomes available, implement the service with
these minimum operations:

- `GET /tv-lab/devices` — registered device availability and redacted holder
  display name.
- `POST /tv-lab/devices/{id}/leases` — atomic acquire; returns an opaque lease
  token and expiration, or a conflict containing the holder/expiry.
- `POST /tv-lab/leases/{id}/renew` — valid only for the opaque lease token.
- `DELETE /tv-lab/leases/{id}` — idempotent release.

The future GUI shows **Available**, **Reserved by you**, or **In use by <display
name> until <time>**. It offers **Reserve** and **Release**; Run is enabled only
while the main process holds a current lease. A device assigned permanently to
one engineer can be configured as private and skip the central lease, but a
shared LG must never do so.

The existing MyTV backend cannot host this API and no always-on internal host
exists today. The separate service described in
[lease-service.md](lease-service.md) is deferred. A shared spreadsheet, local
lock file, Slack warning, or raw TV IP check is only the temporary manual v1
process, not an acceptable future concurrency-control replacement.

## Main-process and preload contract

Keep `run-test` as the orchestration entry point, but version its payload and
add a target descriptor:

```js
{
  TEST_CASE_ID: "case-42",
  TEST_CASE_FOLDER_ID: "folder-7", // optional, existing behavior
  APP_URL: "https://html5stage.mytv.vn/", // Browser only
  PREVIEW_TYPE: "live",
  target: {
    kind: "browser" | "tizen" | "webos",
    deviceId: "lab-samsung-2024", // required for TV targets
    app: { mode: "installed", appId: "vn.mytv.qa" }
  }
}
```

Add only structured preload methods:

- `listTvDevices()` → redacted device profiles and last-known status.
- `scanTvDevices({platform})` → ephemeral discovery results.
- `saveTvDevice(profile)` and `removeTvDevice(deviceId)` → validated metadata.
- `chooseTvPackage({platform})` → a user-selected, extension-filtered local
  path plus main-process-extracted non-secret package metadata; it does not
  install anything.
- `validateTvDevice(deviceId)` → connection, developer mode, build/app, and
  pairing readiness; it never starts a test.
- `runTest(payload)` and `stopTest()` → extend the existing methods.

The main process validates the target, resolves an immutable run configuration,
requires the manual shared-device acknowledgement when applicable, acquires the
local lock, then spawns the correct runner. The renderer must never send
selectors, JavaScript, Appium capabilities, shell snippets, or secret material.

V1 runs one selected batch against one target at a time. To execute the same
cases on another Samsung/LG TV, the operator starts a separate batch after the
first one completes or stops. Do not add a multi-device checkbox, shared batch,
or concurrent Appium sessions in v1.

Each saved TV profile has a visible **Path to package file** value and expected
app ID/version. Ordinary runs reset and launch that already installed app; they
do not install a package. A separate **Install/Update app** device-management
action uses the saved or newly chosen `.wgt`/`.ipk`, confirms the exact device
and package, installs it through the platform adapter, validates the installed
app ID/version, and then updates the local profile's default-package metadata.
This action is unavailable while a run is active.

Before every TV run, main-process validation reads the installed app identity
and version from the platform adapter and compares them with the saved profile.
On mismatch, do not clear storage or start Appium actions. Show the expected and
detected redacted build information, mark the device `wrong app version`, and
direct the operator to **Install/Update app**.

The initial pilot permits only packages labelled `production` backend. Their
dedicated test accounts still exercise the live MyTV service. A future staging
artifact is a separately packaged and explicitly labelled build, recorded in
its profile metadata; the runner never changes an installed package's backend
at run time. Include the backend label in deployment confirmation and the run
manifest.

The strict saved-profile version comparison does not apply to an one-off run;
instead it requires explicit confirmation of the discovered/entered installed
app identity and records that identity in its report manifest.

### MyTV application identities

| Platform | Test-run app ID policy |
|---|---|
| LG webOS | Use `com.mytvb2c.app` for the supplied MyTV app. Explicit **Install/Update app** is allowed to replace the MyTV version already installed on a lab TV; the confirmation must state this effect. |
| Samsung Tizen | The store app ID `PP2MTMRMs9.MyTV` is **not eligible** for test-package installation or selection. This is a non-overridable safety block, including for administrators. Use a distinct test-package ID such as `PP2MTMRMs8.MyTV`, or another approved ID different from the store app. |

Store the chosen non-production Samsung app ID in each TV profile rather than
hard-coding one test suffix globally. On Samsung, installed-app discovery can
show the store app as `Production store app — not eligible`, but it must not
preselect it. **Install/Update app** verifies that package metadata matches the
selected test ID and rejects the store app ID before deployment, protecting the
main store app on the same TV.

The runner must never automatically uninstall, restore, or reinstall an app
after a test. When an engineer needs the normal LG release again, they restore
it manually from the LG app store.

## Batch continuation and failure classification

Each selected case is independently reset and run. A **business failure** does
not stop the batch: record the failed case and continue with the next selected
case. Examples are an expected screen/focus assertion failure, search/result
mismatch, player DOM/media-time assertion failure, or a product-visible action
that deterministically fails while the Appium session and TV connection remain
healthy.

A **technical/infrastructure failure** pauses the batch at its active case.
Examples are host-to-TV connection loss, network transport failure, TV
unreachable, Appium server/session loss, vendor CLI failure, failed
reset/restart, or any unknown error that cannot prove the environment remains
valid. Do not advance to another case or resume the interrupted action. Capture
the diagnostic, reconnect and revalidate, then rerun the active case from its
mandatory clean reset and first action. Attempt this recovery at most three
times automatically. If all three attempts fail, show an operator modal with
**Keep retrying** and **Stop**. **Keep retrying** begins another three-attempt
recovery cycle after the engineer repairs the environment; **Stop** marks the
active and unstarted cases `stopped_by_user` and applies the manual-stop sync
policy. Vendor pairing requirements remain an explicit operator pause, never
an automatic retry target.

Classify errors with explicit error codes at the adapter/runner boundary; do not
infer business versus technical failure from a translated message string. If an
API-loaded batch is stopped by the operator before every selected case
completes, submit only the fully completed cases under the manual-stop policy.
If all selected cases finish (including business failures and recovered
technical incidents), submit their complete result set through the existing
validated batch path.

A **manual user stop** has a separate submission policy: safely stop the active
case, mark it `stopped_by_user`, mark not-yet-started selected cases
`stopped_by_user`, then submit results for only the cases that fully completed
before the stop. Never submit the interrupted case or an unstarted case as
tested. This is an intentional change from the current all-selected-cases-only
submission behavior and requires explicit unit/renderer/API regression coverage.
If the partial completed-case submission itself fails, preserve the local report
and show `results_not_synced`; do not retry silently with changed case data.
Keep the immutable completed-case submission payload in memory for the current
desktop-app session and expose a visible **Retry sync** action. Retry sends that
exact payload only; it never reruns, resets, or changes any test case. Pending
sync is deliberately not restored after the app closes.

Intercept desktop-app close requests while a TV/browser run is active or a
result is unsynced. Show a blocking confirmation:

- Running: **Keep app open** or **Stop run and close**. The latter requests
  bounded runner cleanup, then closes; it does not leave a background test.
- Unsynced only: **Keep app open** or **Close and discard unsynced retry**.
- Both: explain that the active run will stop and completed unsynced results
  will be discarded if the user confirms closing.

Never show this warning after a normal completed-and-synced run. Closing with
unsynced data is an explicit user decision and the compact local report remains
for investigation, but no retry payload is available after reopening.

## Runner and session interface

Create a platform-neutral session API under `tests/lib/tv-session/`. The
existing browser path may be adapted later; initially it remains a compatible
implementation wrapped by a browser runner.

```js
class TvSession {
  async start({app, runId}) {}
  async resetAppState() {}
  async pressKey(key) {}
  async getDomState() {}
  async waitForDomState(predicate, {timeoutMs}) {}
  async screenshot() {} // throws a capability error when visualCapture is unavailable
  async collectDiagnostics() {}
  async cleanup() {}
  async close() {}
}
```

For v1 TV runs, `resetAppState()` is mandatory before **every individual case**
execution: clear MyTV application storage, then start/restart the already
selected production-equivalent package. This applies even when the user starts
a multi-case batch and gives every case a known login/session baseline. Package
reinstallation is not implicit; it remains a deliberate selected-build/deployment
operation. A reset/restart failure fails that case before its first action and
does not misreport an unclean run as product behavior.

TV runs use the same server-provided case contract as the current Browser
runner. A case supplies its account through its own `login` action (explicitly
or from the existing deterministic `qaDescription` compiler); device profiles
never store or select test-account credentials. Treat the raw case payload and
action attachments as sensitive: pass the password only to the trusted action
executor, mask it in renderer previews and logs, and redact it from DOM
diagnostics and reports.

Because every case begins clean, an authenticated case must include its own
`login` action. The runner must not prepend a configured/shared login action or
reuse the preceding case's session.

After every TV case, run the existing trusted MyTV logout cleanup even when the
case has no explicit `logout` action. Preserve the Browser runner's failure
semantics: a logout-cleanup failure turns an otherwise passed case into a
cleanup failure, while an earlier business failure remains authoritative. The
next case still performs its mandatory independent reset.
Phase 1 must prove the platform-specific reset method clears only the intended
MyTV app and does not erase developer-mode configuration, vendor pairing, or
unrelated TV applications.

Implement `TizenAppiumSession` and `WebOsAppiumSession` as Appium-client
adapters. Appium server lifecycle belongs in an `app/appium-server-manager.js`
module; it is started locally and bound to loopback only. One session and one
Appium server slot may serve one device at a time in the pilot.

Proposed source ownership:

```text
app/
  device-registry.js              non-secret profile read/validate/atomic write
  device-secret-store.js          main-process encrypted secret boundary
  device-discovery.js             vendor-aware discovery/validation orchestration
  appium-server-manager.js        local Appium process lifecycle
  tv-runner.js                    child runner selection and normalized events
  renderer/                       target selector, device modal, TV preview
tests/lib/tv-session/
  tv-session.js                   interface/error vocabulary/key normalization
  tizen-appium-session.js         Samsung adapter
  webos-appium-session.js         LG adapter
  dom-state.js                    DOM-state normalization and redaction
tests/run-test-case-tv.spec.js    generic TV case entry point
tests/unit/                       contracts and renderer/device tests
```

## V1 observation contract: mandatory DOM, optional visual capture

V1 does not modify the MyTV package. Appium must expose a compatible WebDriver
DOM session for the installed production-equivalent app. Each physical model is
preflighted using the selectors and DOM-scanning rules already used by the
current browser runner:

- visible body/screen text;
- `.focused` and supported dialog `.active` focus state;
- virtual-keyboard controls;
- content-row discovery;
- player DOM state and media time where the platform exposes it.

Each model also declares `visualCapture: available | unavailable`. An available
model captures genuine Appium screenshots after actions and on errors. An
unavailable **Samsung** model records redacted DOM diagnostics only and may run
the approved DOM-only semantic automation; its manifest/report must state the
limitation and must not create or imply a visual artifact. An unavailable LG
model fails visual preflight until its policy changes explicitly.

The TV adapters may use read-only DOM JavaScript/standard WebDriver queries but
must not inject application behavior, click elements directly, or modify app
storage except for the authorized reset policy. Remote navigation remains real
Appium remote-key input.

The existing Playwright `page` helpers cannot be passed directly to an Appium
session because their client APIs differ. Extract/port the selector, DOM scan,
focus, virtual-keyboard, row, and playback primitives behind a target-neutral
`DomSession` facade, then keep Playwright and Appium as separate implementations.

Every selected TV must advertise `domInspection: true` during validation. If
Appium can only run in remote-only mode, reject semantic test cases before the
first action with an explicit unsupported-model/capability result. Visual
capture is not a replacement for `focus_row`, search, or playback assertions,
and its absence is not a reason to reject a DOM-capable model.

## Future MyTV QA bridge contract

Do not implement this in v1. If future model coverage requires it, the package
under test can expose a production-code-compatible, **QA-build-only** read-only
browser bridge queried by Appium `executeScript`:

```js
window.__MYTV_QA__ = {
  version: 1,
  getState() {
    return {
      screen: "home",
      focus: {id: "search", label: "Tìm kiếm", role: "control"},
      rows: [{id: "movies", label: "Phim", itemCount: 12}],
      player: {state: "playing", positionMs: 8400}
    };
  }
};
```

Future rules:

- Build it from the same source, feature configuration, API endpoints, DRM
  settings, and minification policy as release wherever practical.
- Compile the bridge out of the store artifact. Its state must never include
  account credentials, authorization headers, user profile data, or tokens.
- Version the state object. The runner rejects an unknown major version.
- Use actual remote key presses for navigation; the bridge observes state and
  does not click application elements or bypass product flows.
- If a model can use only Appium remote-only mode, `getQaState` needs an
  authenticated outbound transport. That is a future fallback, not a reason to
  weaken DOM-based v1 assertions.

## Action compatibility strategy

Existing actions are authoritative and stay server-safe. Reimplement their
handlers against `TvSession`/`DomSession`, not directly against a Playwright
`page`:

- `press_ok`, `press_back`, and `wait_for_ready` map first.
- `login`, `open_search`, and `search_content` press remote keys character by
  character and use DOM focus/screen text to confirm transitions.
- `focus_row`, `focus_text`, `play_content`, `play_search_result`, and
  `play_row` use DOM scanning/focus inspection and retain the current fuzzy
  Vietnamese matching rules.
- `assert_screen` asserts visible DOM text.
- Playback success uses the current player DOM checks and advancing media time
  where available, with a genuine screenshot retained only when visual capture
  is available. Do not claim that a screenshot alone proves playback.

Do not silently run a DOM-dependent action in remote-only mode. Fail before
interaction with a message naming the action, platform, TV model, and missing
capability.
