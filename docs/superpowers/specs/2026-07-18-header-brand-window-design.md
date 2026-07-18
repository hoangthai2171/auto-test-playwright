# Header brand and window sizing design

## Goal

Give the Electron runner’s product name and subtitle a stable home in the
header, and make the default window taller for the test-case workspace.

## Design

- Move the existing two-line brand block (`MyTV Auto Test` and
  `Chạy Playwright test bằng giao diện desktop.`) from the sidebar into the
  left side of the existing fixed-height header.
- Keep Settings and Logs aligned on the right side of that header.
- Remove the sidebar copy so the left sidebar starts with the folder browser.
- Set the default `BrowserWindow` size to `1040 × 900` and its minimum size to
  `920 × 760`; preserve the existing width and all responsive behavior.
- Add focused contract coverage for header placement, sidebar removal, and the
  new default/minimum heights. No runtime behavior or API flow changes are
  included.

## Verification

Run the renderer unit tests, Electron/main-process syntax check, and
`git diff --check`.
