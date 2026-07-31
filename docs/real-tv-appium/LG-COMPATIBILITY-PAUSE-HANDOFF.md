# LG Compatibility Work — Pause Handoff

Status: paused on 2026-07-31. The LG-only SDK, device setup, managed toolchain,
catalog, encrypted compatibility account, read-only inspection, and one-shot
fixed product-gate validation are implemented and retained in the desktop app.

## User-visible flow

In **Settings → SDK configuration**:

1. Configure the Browser or LG toolchain independently.
2. For LG, add/select a saved device and use the redacted connection status.
3. Refresh the compatibility catalog when needed.
4. Use **Check device compatibility** to enter a temporary device name, host,
   and passphrase. The first confirmation creates a temporary local CLI target
   and reads model/firmware only.
5. If the model/firmware has an exact catalog record, configure the dedicated
   encrypted compatibility account once and confirm the built-in validation.

The built-in validation case is deliberately local and fixed:

```text
login → open_home → open_search → search_content "VTV1 HD" → play_search_result
```

It does not use a selected browser/API test case. It temporarily downloads and
verifies the catalog ChromeDriver, creates a local CLI target, runs once, then
removes the target, temporary driver, and in-memory connection values.

## Latest diagnostic result

Inspection repeatedly succeeded and selected the existing exact compatibility
record. Validation then failed during Appium session creation, before the fixed
test case or any MyTV action began. Cleanup succeeded each time: the temporary
target and temporary driver were removed, and no catalog data changed.

The current trusted failure classification is:

```text
failure stage: session-creating
failure class: APPIUM_CAPABILITIES
```

This is not yet proven to be a ChromeDriver, catalog, device-identity, or test
case failure. The first diagnostic incorrectly named `automationName` because
the classifier treated an echoed request payload as a rejection. That
implementation bug is fixed and covered by tests. The current classifier also
prioritizes explicit ChromeDriver and `session not created` responses before a
generic Appium-capabilities classification.

An offline local Appium exercise with a fake target accepted the complete
intended capability shape and proceeded as far as fake-device lookup. Do not
infer a live-device fix from that result.

## Safety invariants

- LG only; Samsung/Tizen work is out of scope.
- Never deploy, uninstall, reset, or clear the TV app.
- `appium:noReset` must remain `true`.
- Never use `appium:rcMode="js"` or `webos:clearApp`.
- Do not expose hosts, credentials, pairing data, screenshots, archive paths,
  or hashes in chat, renderer state, logs, reports, or commits.
- Toolchain installation remains explicit-confirmation only.
- A real TV is contacted only after a fresh explicit user approval.

## Resume procedure

1. Read this file, `docs/real-tv-appium/HANDOFF.md`, and the LG design/plan
   documents named in `AGENTS.md`.
2. Run the normal local validation suite before changing code.
3. Keep investigation test-first. Do not remove or alter session capabilities
   speculatively; the generic failure does not identify one.
4. If another diagnostic is necessary, ask for a fresh explicit approval for
   both inspection and validation. Ask the user to enter current device fields
   privately in the dialog; never request them in chat.
5. Run exactly one approved diagnostic cycle. If it fails, stop TV work again,
   preserve only redacted outcome data, and continue safe local analysis.

## Local validation baseline

The last completed local checks passed:

```text
npm run test:unit                 539 passing tests
node --check app/main.js
node --check app/preload.js
node --check app/renderer/renderer.js
npx playwright test tests/run-test-case-mytv.spec.js --list
git diff --check
```

Graphify was rebuilt sequentially because multiprocessing is not reliable in
the sandbox. Regenerate it sequentially after code changes; do not spend time
on Graphify unless it is needed for navigation.
