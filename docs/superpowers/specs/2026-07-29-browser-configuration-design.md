# Browser Configuration Design

## Goal

Remove Playwright Chromium from the packaged Electron application and let a
normal user install the project-pinned Chromium on demand from Settings. The
browser remains app-owned, per-user, and separate from any system Chrome or
Chromium installation.

## Scope and constraints

- Browser-only work. LG SDK behavior and all TV boundaries are unchanged.
- The packaged application must no longer ship `.playwright-browsers` through
  Electron Builder `extraResources`.
- The application retains the Playwright library, pinned to its exact project
  version. That library is the sole source of the matching Chromium revision.
- macOS and Windows acquire only their current host's matching Chromium build.
  No cross-platform archive is selected, copied, or guessed.
- Managed Chromium lives below Electron `userData`, not in the app bundle,
  project checkout, user PATH, or a system browser location.
- The application accepts no user-selected browser executable and never falls
  back to an installed Chrome or Chromium.
- **Auto configure** is read-only: it detects the expected managed browser and
  returns redacted component status only.
- Download, extraction, and installation require a separate explicit
  **Install reviewed Chromium** confirmation.
- Browser acquisition runs only through the packaged project's Playwright CLI
  and its matching official revision manifest. No `latest`, custom download
  host, custom archive, or user-provided URL is accepted.
- Paths, command output, download URLs, environment details, and errors do not
  cross main-process IPC.
- Existing terminal development workflows may keep their project-local browser
  cache. This change applies to Electron's managed Browser runner and release
  package.

## User experience

`Settings → SDK configuration` gains a **Browser configuration** section above
the LG-specific sections:

1. A component card reports `Playwright Chromium` as Ready, Missing, Installing,
   or Attention, without a filesystem path.
2. **Auto configure** performs a local, read-only check. It explains that no
   download happens until the user confirms installation.
3. **Install reviewed Chromium** is disabled until a review finds Chromium
   missing and the user explicitly confirms it.
4. A fixed-copy progress panel reports preparation, download, verification,
   extraction, and completion. It follows the existing rule for transient
   installer progress: a completed bar fills and stops; closing Settings clears
   it.
5. When Browser is the selected run target but the managed Chromium is missing,
   the run action is disabled. A **Configure Browser** action opens Settings
   directly to Browser configuration.

There is no in-app Chromium update action. A compatible browser revision is
changed only by a future application update that changes the pinned Playwright
version.

## Architecture and data flow

```text
Settings renderer
  → preload: plan/install/get status browser IPC
  → main process: browser toolchain coordinator
  → managed browser detector (read-only)
  → managed browser installer (confirmed only)
  → Playwright CLI with app-owned browser path
```

The main process derives the managed browser root from Electron `userData`.
The detector derives the expected executable from the installed pinned
Playwright package and confirms it exists below that root. The installer
launches the packaged Playwright CLI with a controlled environment that points
only to the managed browser root. It exposes fixed progress codes to the
renderer and classifies failures without leaking implementation details.

The Browser runner resolves the same managed root before launching Playwright.
It will not start if the detector cannot confirm the expected Chromium build.
Packaged runs never read a Chromium resource from the application bundle.

## Verification and failure behavior

- Install success requires the expected Playwright Chromium executable to exist
  in the managed root after the official installer exits successfully.
- A missing executable, failed installer, unsupported host, or unexpected
  subprocess result is a classified failure. The renderer receives fixed copy
  only; no paths or raw output are shown.
- Auto configure, status, and a disabled Browser run must not download,
  install, launch a test browser, change a system browser, or contact a TV.
- Unit tests use injected filesystem and child-process fakes. Renderer tests
  cover the missing-browser call to action, explicit confirmation, safe
  progress, and successful re-enablement of Browser runs.
- Packaging tests assert that `.playwright-browsers` is absent from release
  `extraResources` while Playwright itself remains a production dependency.

## Non-goals

- Selecting an existing Chrome/Chromium executable.
- Automatic Chromium updates.
- Bundling Chromium in macOS or Windows releases.
- Changing Browser test actions, the browser preview, LG SDK configuration, or
  any live-TV behavior.
