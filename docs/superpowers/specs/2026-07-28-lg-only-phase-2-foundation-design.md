# LG-only Real-TV Phase 2 Foundation Design

## Goal

Build the trusted Electron-main-process foundation needed to run one installed
LG MyTV test target through Appium. Samsung remains explicitly unsupported and
is not selectable, validated, or run by this Phase 2 slice.

## Scope and execution gate

This design supersedes the dual-pilot execution gate only for the LG-first
foundation. The LG office-TV Phase 1 POC passed with genuine Appium screenshots,
DOM inspection, remote Right/Back input, and cleanup. The office Samsung pilot
has no supported Appium remote-input path and remains blocked; no new Samsung
adapter or live retry is included.

Phase 2 remains main-process and terminal-harness work. It adds no Electron
renderer/UI controls, no Electron GUI launch, no MyTV credentials, and no
product flows. Live TV activity is not part of unit implementation; any later
live command requires separate user approval.

## Architecture

```text
Electron main process / terminal harness
  ├─ LG device registry (non-secret metadata only)
  ├─ secret availability + redaction boundary
  ├─ bounded LG read-only validation
  ├─ per-device in-process lock
  ├─ loopback Appium server manager
  ├─ LG WebOS Appium session adapter
  └─ TV-run orchestrator
           │
           └─ redacted local events, manifest metadata, screenshots
```

The renderer receives no new interface in this phase. Future preload/renderer
work consumes redacted main-process APIs, not tool paths, environment values,
pairing keys, Appium capabilities, shell text, or secret material.

## Components

### Platform-neutral session contracts

`tests/lib/tv-session/tv-session.js` defines remote-key normalization,
capability names, and structured `TvSessionError` values. `dom-state.js`
normalizes and redacts body/focus/active/URL state. These modules contain no
Electron, Appium, vendor CLI, or browser dependencies.

`webos-appium-session.js` is the only platform adapter in this phase. It
creates a normal Appium webOS session against an already installed MyTV app,
requires DOM inspection and genuine screenshot capture, normalizes remote keys,
and provides structured diagnostics/cleanup. A secure WebSocket and
self-signed TLS exception are explicit run options; the TLS exception exists
only in the Appium child environment and is never a persisted default.

### Device and secret boundaries

`app/device-registry.js` atomically persists non-secret LG profile metadata in
the Electron user-data directory. A profile has an optional last-known host and
must never store a password, pairing key, passphrase, private key, or Appium
credential. The profile response is redacted before crossing a future IPC
boundary.

For the current LG office-TV route, the runtime host is stricter than ordinary
profile metadata: it exists only in the active in-memory run configuration. It
is not written to `devices.json`, documentation, retained evidence, or any
response. All validation, manifest, and diagnostic output uses its redacted
form.

`app/device-secret-store.js` owns only opaque main-process secret availability.
It does not expose raw values to callers intended for renderer use. Pairing
material remains vendor/driver-owned where possible; the store reports whether
a named secret capability is available.

### Validation, lock, and lifecycle

`app/device-discovery.js` provides bounded, vendor-aware LG validation through
injected webOS CLI adapters. It returns a redacted identity, firmware,
installed-app identity/version, and actionable pairing/transport state without
starting Appium, launching MyTV, clearing storage, or deploying a package.

`app/device-lock.js` permits one local in-process run per device profile and
returns an idempotent release closure. It does not claim cross-laptop locking.

`app/appium-server-manager.js` starts a manager-owned Appium child on loopback
only, waits for health, captures redacted logs, and terminates only its own
child process group. It never scans for or kills unrelated Appium processes.

### Runner orchestration

`app/tv-runner.js` resolves an immutable LG run configuration, validates the
installed MyTV identity before session creation, records a manual
shared-device acknowledgement, acquires the local lock, starts the manager,
creates the session, and guarantees cleanup. It returns only normalized,
redacted events and local artifact references. It leaves Browser execution and
the existing flow-case API payload unchanged.

## Safety and privacy rules

- LG accepts only `com.mytvb2c.app` for this Phase 2 slice.
- Normal runs target an already installed app; deployment stays a separate,
  explicitly confirmed workflow and is not implemented here.
- All Appium servers bind to `127.0.0.1`.
- Genuine Appium screenshots are mandatory for LG. No screenshot bypass,
  DOM-rendered substitute, HDMI, camera, or synthetic fallback is permitted.
- DOM diagnostics and logs are redacted before local persistence. Pairing keys
  and proxied screenshot payloads are removed.
- Credentials remain only in a future test-case `login` action and are never
  device-profile fields.
- Samsung remains represented only by an explicit unsupported capability/error;
  this implementation never invokes Samsung tooling.

## Test strategy

Every module is created test-first with `node:test` and injected filesystem,
clock, child-process, Appium-client, and vendor-adapter fakes. Coverage must
prove atomic registry writes, profile redaction, secret non-disclosure, lock
release on success/failure, LG validation without Appium launch, loopback-only
command construction, log redaction, session key normalization, mandatory
visual-capture failure classification, and runner cleanup ordering.

The final local gate is the project-required unit suite, Electron syntax checks,
Playwright generic-case listing, and `git diff --check`. No live LG command is
part of this implementation plan.

## Completion criteria

Phase 2 foundation is complete when an injected LG adapter can run through the
main-process orchestration path, emit redacted DOM/screenshot-capability events,
and cleanly release its Appium manager and device lock. Browser tests remain
unchanged, and Samsung remains blocked with an actionable unsupported result.
