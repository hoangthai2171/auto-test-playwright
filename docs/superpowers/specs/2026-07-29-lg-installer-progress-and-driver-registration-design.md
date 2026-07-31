# LG Installer Progress and Driver Registration Design

## Purpose

Make the LG-only managed installer truthful and diagnosable without exposing
local paths, command output, credentials, archive data, hosts, or TV details.
The installer must correctly verify the already-audited LG driver after local
package installation, and Settings must show the current safe installation
milestone while a user-confirmed installation is running.

## Root cause

Appium 2.19 lists installed drivers as a flat JSON map keyed by the Appium
driver name. The audited LG package declares that name as `webos`. The managed
verifier currently looks for a nested entry, so it rejects a locally registered
driver even when Appium has discovered it. The correction uses the pinned
Appium contract: the top-level `webos` entry and its exact reviewed version.

This remains local-only. The existing `appium driver list --installed --json`
command performs Appium's local extension discovery from the managed package
tree; it does not contact or operate a TV. The design does not use `appium
driver install`, which could introduce a separate package acquisition outside
the audited npm closure.

## User experience

The existing component cards remain the durable source of component readiness.
During an explicit **Install reviewed Node and Appium** action, a compact
installer panel appears above the review controls. It uses an indeterminate
progress indicator and a current safe milestone; it intentionally does not
show a percentage because download and package-install durations are unknown.

The allowed milestones are:

1. Preparing the managed installation
2. Downloading reviewed Node
3. Verifying the reviewed Node archive
4. Extracting reviewed Node
5. Installing reviewed Appium and the LG driver
6. Registering and verifying the LG driver locally
7. Activating verified local tools
8. Complete or stopped at a classified failure

Only the active milestone is marked in progress. Completed milestones retain a
ready state. On failure, the current milestone becomes needs-attention and the
existing safe component-specific failure sentence remains visible. No raw
diagnostic data is added to the UI. A retry begins a new run and replaces the
previous transient milestone state.

## Architecture and data flow

The renderer continues to initiate one confirmed IPC request. The main process
owns all writes and emits an allowlisted progress event through the existing
preload boundary:

```text
Settings renderer
  -> confirmed install IPC
  -> main-process installer
  -> staged managed install operations
  -> safe milestone event
  -> preload subscription
  -> installer progress panel
```

`lg-managed-install-operations` emits a small fixed milestone code only after
entering each operation. It never emits a filesystem location, URL, command,
archive name, error text, or execution output. `tv-device-ipc` maps the fixed
code to a fixed public payload and sends it only to the requesting renderer.
`preload` exposes a subscription that returns an unsubscribe function.
`renderer` maps the fixed public payload to text and CSS state without deciding
which operation ran.

After dependencies are installed, verification consumes Appium's flat driver
list response and checks `webos.version` against the pinned LG driver version.
The installer then activates only after Node, Appium, and the locally
registered driver all verify.

## Failure handling

An IPC event is advisory UI state; the final IPC response remains authoritative
for success or classified failure. If no progress events arrive, installation
still completes or fails through the current final response. If an operation
throws, staging cleanup and atomic activation behavior remain unchanged.

The fixed public failure codes remain `NODE_UNVERIFIED`, `APPIUM_UNVERIFIED`,
and `LG_DRIVER_UNVERIFIED`. The progress panel can name only the failed
milestone and the existing classified component; it cannot reveal why a child
process failed.

## Tests and verification

Tests are written first and prove:

- Appium's flat `webos` driver-list entry verifies the audited LG driver, while
  the old nested shape does not define the supported contract.
- Managed install operations emit the ordered fixed milestones and preserve
  atomic activation only after verification.
- IPC forwards only allowlisted progress payloads and rejects/redacts unsafe
  values.
- Preload exposes subscription and cleanup without granting arbitrary IPC.
- Renderer renders progress, completion, and classified failure states without
  paths, URLs, credentials, archive data, or raw errors.

After each repository edit, run the project unit, syntax, Playwright-list, and
whitespace checks. This work does not start Electron, download an artifact,
start Appium, contact a TV, register a target, validate a device, or execute a
live-TV flow.

## Non-goals

- No Samsung behavior
- No automatic package acquisition beyond the existing separately confirmed,
  audited Node/npm closure workflow
- No `appium driver install`, global Node/npm, NVM, PATH, or shell changes
- No physical-TV contact, pairing, registration, validation, deployment,
  reset, install, uninstall, or execution
