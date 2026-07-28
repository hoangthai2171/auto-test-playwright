# Deferred Real-TV Appium Phase 2 Design

## Goal

Prepare an implementation-ready plan for Phase 2—the real-TV runner foundation—without beginning Phase 2 code or relaxing its physical-pilot evidence gate.

## Execution gate

Phase 2 implementation is blocked until both named pilot devices have recorded
Phase 1 POC evidence under the documented platform policies. Samsung evidence
may be DOM-only only where its exact model records `visualCapture: unavailable`;
LG still requires a genuine Appium screenshot. The current 2020 Samsung home-TV
DOM-only result does not satisfy the named 2022 Samsung pilot requirement and
does not substitute for LG evidence.

Before the first implementation task, the executing engineer must:

1. Re-read `docs/real-tv-appium/HANDOFF.md`, `phases.md`, `architecture.md`,
   and `poc-runbook.md`.
2. Verify that both pilot manifests are retained locally and their observed
   facts are recorded in `HANDOFF.md`.
3. Confirm that beginning Phase 2 is explicitly authorized.

Without all three conditions, the only permitted work is design, documentation,
or safe local validation.

## Phase 2 boundary

Phase 2 provides a trusted Electron-main-process foundation for one real-TV
run. It does not add renderer controls, target-selection UI, production
deployment automation, multi-device execution, LG product-flow execution, or
changes to the Browser runner behavior.

The implementation boundary is:

```text
Electron main process
  ├─ non-secret device registry
  ├─ secret capability/redaction boundary
  ├─ vendor-aware discovery and validation orchestration
  ├─ loopback Appium process lifecycle
  ├─ per-device local lock
  └─ TV-runner orchestration
            │
            └─ test-side TV session contracts
                 ├─ Tizen Appium adapter
                 └─ webOS Appium adapter
```

The renderer receives only validated, redacted records through future preload
methods. It never receives pairing tokens, credentials, executable paths,
Appium capabilities, shell text, or unrestricted device commands.

## Components and responsibilities

`app/device-registry.js` owns schema validation and atomic persistence of
non-secret device profiles. Profiles use an optional `lastKnownHost`; they do
not contain passwords, remote tokens, private keys, or vendor passphrases.

`app/device-secret-store.js` owns the main-process secret boundary. It exposes
only whether required pairing material is available and must never return raw
secrets to the renderer or logs.

`app/device-discovery.js` coordinates bounded vendor-aware validation and
discovery. Samsung discovery is limited to saved profiles and SDB-connected
devices; LG uses its vendor CLI. Direct-IP validation remains supported.

`app/appium-server-manager.js` starts one Appium server bound to loopback,
waits for health, redacts log output, and shuts down the isolated child process
reliably.

`tests/lib/tv-session/` defines the platform-neutral session API and explicit
capability/error vocabulary. `TizenAppiumSession` and `WebOsAppiumSession`
adapt Appium clients behind that API. Each adapter supports real remote keys,
mandatory DOM inspection, reset/restart, diagnostics, cleanup, and optional
genuine screenshot capability; an unavailable Samsung capture path is reported
as unavailable, never synthesized.

`app/tv-runner.js` resolves an immutable run configuration, checks device
identity and shared-manual acknowledgement, acquires and releases the local
lock, starts the selected runner, and returns normalized redacted events. It
does not alter the existing Browser process path.

## Safety rules

- Samsung production app `PP2MTMRMs9.MyTV` is permanently ineligible for
  selection and deployment; `PP2MTMRMs8.MyTV` or another approved distinct test
  identity is required.
- No production Samsung app action, package deployment, live vendor command,
  or physical-TV session is part of the Phase 2 planning work.
- Credentials remain runtime-only per test-case `login` action. Device profiles
  do not gain account fields.
- Screenshots and DOM diagnostics remain local/redacted only; no artifact is
  uploaded to the flow-case API.
- The Browser runner retains its current contracts and result payload.
- Phase 2 contains no Electron renderer/UI change and no LG product-flow work.

## Test and verification strategy

Each implementation task begins with focused `node:test` contracts using
injected filesystem, process, Appium-client, and clock fakes. Required coverage
includes registry validation/atomicity, profile and log redaction, secret
availability, lock release on every terminal path, shared-manual
acknowledgement, loopback Appium command construction, lifecycle cleanup,
remote-key normalization, DOM/capability handling, and business-versus-
infrastructure error classification.

After each task, run its focused unit command. At the end, run the full unit
suite, syntax checks for changed Electron and real-TV modules, the generic
Playwright test listing, and `git diff --check`. Live TV commands remain out of
scope unless separately authorized after the execution gate is satisfied.

## Deliverable

The follow-on implementation plan will decompose this design into small,
test-first tasks with exact file ownership, interfaces, commands, and expected
results. Its first task will repeat the execution gate and stop before code if
the required pilot evidence or authorization is absent.
