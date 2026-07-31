# LG SDK Auto-Configuration Design

## Purpose

Move LG local toolchain setup out of the test workspace into
**Settings → SDK configuration**. A non-developer must be able to prepare a
supported macOS or Windows host without knowing SDK paths, Appium commands, or
ChromeDriver versions.

This increment remains LG-only and local-toolchain-only. It never pairs with,
registers, validates, navigates, resets, deploys to, installs on, uninstalls
from, or otherwise contacts a TV.

## Scope and success criteria

The app must:

1. Detect supported local components on macOS and Windows without changing the
   host.
2. Offer a single explicit installation review for missing components.
3. Install the current, LG-verified host bundle into a managed per-user
   directory after the user confirms, while requiring the operator to download
   the legacy LG CLI directly from LG under LG's terms.
4. Verify every installed component before atomically activating the bundle.
5. Keep existing user-managed tools intact and expose manual paths only through
   an Advanced fallback.
6. Expose only safe readiness, versions, progress, and classified failures to
   the renderer.

The workspace keeps only target selection, saved-device selection, validation,
and execution state. It contains no SDK paths, toolchain setup fields, or local
target registration controls.

## User experience

`Settings` gains an **SDK configuration** navigation item. The panel is a
persistent status-first page rather than a one-time wizard.

It shows these components and their state:

- Node.js and npm
- webOS CLI / `ares`
- Appium
- LG webOS Appium driver
- ChromeDriver

The primary button is **Auto configure** when no managed bundle exists and
**Repair** when one exists but fails verification. Clicking it performs only
local detection and displays a review panel. The review names each missing
component, exact pinned version, official source, license/source notice,
download size, and any permission requirement. **Install missing tools** is a
separate confirmation action. Nothing downloads when Settings opens, when a TV
is selected, or when the user clicks Auto configure.

The legacy webOS TV CLI is an exception. LG's SDK terms prohibit redistribution,
so the app does not bundle or download that archive on the user's behalf.
When it is missing, the review presents **Download from LG**, which opens LG's
official CLI page. The operator accepts any LG terms and downloads the archive
for their operating system themselves, then uses **Choose downloaded CLI
archive**. The app verifies the selected filename, audited SHA-256, extracted
layout, and `ares -V` output before installing it under its managed per-user
toolchain directory. The user never manually installs it: the app extracts it
into its own managed location after selection.

LG's page does not publish that SHA-256. Therefore, the strict import action is
release-gated until MyTV records an audited value for each official archive in
the compatibility manifest. Until then the UI may explain and open the official
LG page, but it must not accept or activate a selected archive based only on a
filename or claimed version.

The final state is either:

- `Ready`: all components verified locally; subsequent target registration or
  read-only TV validation remains a separate operator action; or
- `Needs attention`: a safe component-level code with **Retry**, **Open Help**,
  and **Advanced paths**. It does not suggest pairing retries or perform a TV
  operation.

Advanced paths are collapsed by default. They allow a developer to opt into a
validated existing system or NVM-managed installation. The GUI never reads the
filesystem itself and never receives resolved paths after a save.

## Compatibility model

The installer uses a versioned, app-shipped compatibility manifest. Each
automatically acquired macOS/Windows artifact records:

- component ID and exact version
- official source URL and license/source metadata
- archive type and expected SHA-256 checksum
- managed install location relative to Electron user data
- post-install executable/version verification

The legacy webOS TV CLI has the same version, archive-name, MyTV-audited SHA-256,
and post-install verification data, but is marked `operatorSelected: true`.
Its manifest entry provides an official help/download page rather than an
application-controlled download endpoint.

The default bundle is the currently LG-verified bundle, not a floating
`latest` selection. Node/npm, webOS CLI, Appium, and the LG driver are
host-toolchain components and remain pinned together.

ChromeDriver is selected through a compatibility profile, because the embedded
Chromium runtime can differ between TV firmware/model families. The initial
manifest includes only the currently verified LG profile and its pinned
ChromeDriver. The main process may select a profile only after a separately
approved, read-only TV validation supplies model/firmware/app facts. An unknown
profile stops with `COMPATIBILITY_PROFILE_UNVERIFIED`; it does not download a
latest driver or guess a mapping. Adding another profile requires a future
manifest update backed by explicit verification.

## Main-process architecture

The renderer uses narrowly scoped preload IPC only. The main process owns:

```text
Settings renderer
  -> preload IPC
  -> toolchain status / detector / install planner / installer / verifier
  -> app-managed per-user toolchain directory
```

New pure modules should separate:

- platform detection and normalized status
- compatibility-manifest validation and bundle/profile selection
- install-plan construction
- download/checksum/staging/atomic activation
- component verification

The installer uses a temporary sibling staging directory. It verifies archive
integrity and installed executables before atomically moving the completed
bundle into place. A prior healthy bundle is retained until replacement
verification succeeds. Cancellation or failure removes only temporary staged
content and never deletes an existing user-managed installation.

The managed Node runtime is per-user and app-owned. The app does not install
or configure NVM, change shell startup files, replace a system Node install,
or rely on a global PATH. It uses the managed runtime and managed Appium home
for its own child processes only.

All renderer responses exclude paths, archive locations, hosts, credentials,
pairing material, raw command output, and raw download errors. Persisted local
configuration remains in Electron user data and is not project source.

## Error and security behavior

Expected user-visible states are `ready`, `missing`, `downloading`,
`verifying`, `repair-needed`, and `unsupported-profile`. Failures are classified
without unsafe details, including network unavailable, source unavailable,
checksum mismatch, permission denied, installation failure, verification
failure, and compatibility-profile unverified.

The installer permits only manifest-listed HTTPS official sources for automatic
downloads. It verifies the pinned checksum before extraction, never runs an
archive-provided installer without the reviewed implementation path, and never
silently replaces a user-managed tool. The legacy webOS TV CLI is never
redistributed by this app: it accepts only an operator-selected archive from the
LG-directed flow after its MyTV-audited hash is available, then checks the hash,
layout, and version. If an
artifact cannot be verified, setup fails safely and directs the user to Help or
Advanced paths.

This workflow does not call vendor target commands, webOS discovery, Appium,
or any operation that could contact a TV. Target registration and read-only
validation remain separately approved actions with their existing controls.

## Testing and validation

Use test-first development for every behavior:

- Manifest and compatibility-profile tests cover platform selection, exact
  pins, rejection of untrusted URLs/checksums, and unknown-TV refusal.
- Detector and plan tests cover empty, partial, healthy system-managed, and
  healthy app-managed states with injected filesystem/process dependencies.
- Installer tests cover downloaded checksum verification, cancellation,
  staging cleanup, atomic activation, rollback/preservation of a prior healthy
  bundle, and post-install executable verification without real downloads.
- IPC tests prove that unsafe configuration/path data never reaches the
  renderer and that installation cannot begin without explicit confirmation.
- Renderer tests prove the workspace no longer contains setup controls, the
  SDK settings tab renders status/progress/error states, and Auto configure
  does not start installation by itself.
- Manual GUI verification on both macOS and Windows covers missing, partial,
  ready, repair, cancellation, Help, and Advanced states. It does not operate a
  TV.

After each repository edit, run the project-required unit, syntax, Playwright
list, and whitespace checks. Do not claim physical-TV readiness from these
local checks; any live LG validation remains separately approved.

## Non-goals

- Samsung support or setup
- NVM installation or global Node/shell management
- Floating latest-version updates
- Automatic compatibility probing against a TV
- Pairing, target registration, live validation, remote input, app reset,
  deployment, installation, uninstallation, or Electron TV execution
- Downloading from unpinned mirrors or retaining sensitive diagnostics
