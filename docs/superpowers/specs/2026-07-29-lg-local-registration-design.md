# LG Local Registration Design

## Goal

Let an operator configure the local LG toolchain and add a new webOS vendor
target from Electron without contacting or changing a TV.

## Scope

- LG only; Samsung remains excluded.
- A configured vendor target is add-only. A conflicting target name fails; the
  app never modifies, removes, resets, or makes a target the vendor default.
- Registration writes only the vendor CLI's local target configuration. It does
  not run identity/app validation, pairing, key retrieval, remote navigation,
  reset, deployment, installation, uninstallation, or a test case.
- The registered target is not automatically saved as a MyTV profile. The
  existing explicit Save LG device action remains the only profile write.
- Hosts, credentials, pairing material, screenshots, and local tool paths are
  never returned from the main process or retained in repository evidence.

## Architecture

The Electron main process owns a small user-data toolchain configuration with
three operator-provided paths: webOS SDK home, Appium home, and ChromeDriver.
It validates the paths before atomically writing them, and returns only a
redacted availability summary. The configured SDK home is the sole source for
webOS CLI execution; the project-local Appium binary is invoked with the
configured Appium home only for metadata inspection.

A separate main-process vendor-registration adapter first lists configured
vendor targets, then invokes `ares-setup-device --add` only when the requested
target name is unused. It supplies the entered host, port `9922`, and user
`prisoner` as individual spawn arguments. It never runs a shell, uses no
interactive command mode, and does not invoke the pairing/key command.

The renderer exposes two explicit actions: save local toolchain configuration
and register a local target. The registration form reuses the existing vendor
device name and current-host inputs, clears the host after a successful local
write, and receives only a status plus the target name. LG Run remains disabled.

## Validation and Errors

Toolchain configuration requires an existing webOS SDK directory containing
`CLI/bin/ares`, `ares-setup-device`, `ares-device-info`, and `ares-install`; an
existing Appium home directory; and an existing ChromeDriver executable. The
toolchain inspector runs the project-local Appium binary with `APPIUM_HOME`
set from this main-process configuration, plus local CLI version commands. It
reports component readiness and versions without paths.

Registration requires a conservative vendor target name and a syntactically
valid host. Before adding, the adapter reads `ares-setup-device --listfull`.
If that output already contains the requested name, it returns
`TARGET_NAME_CONFLICT`; it never falls back to modify. Vendor-command failures
return a stable redacted status. No response includes the host or command
arguments.

## Testing and Verification

Unit tests cover path validation, redacted configuration responses, Appium-home
environment injection, add-only vendor command arguments, target-name conflict,
and renderer clearing of the host. Tests must prove no validation, pairing, or
run IPC is called by registration. Manual Electron verification is local-only:
save a valid configuration and inspect the registration UI without pressing
Validate or Run. Any later TV validation remains a separately approved live
operation with its mandatory preflight.
