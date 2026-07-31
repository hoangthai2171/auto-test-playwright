---
name: device-compatibility-check
description: Use when a maintainer needs to validate or update an LG model-and-firmware ChromeDriver compatibility entry, including a new device, firmware change, or an existing catalog pair that may need replacement.
---

# Device Compatibility Check

Maintain `DEVICE-COMPATIBILITY.json` only from an approved exact-device product-gate result. This is a maintainer workflow; it never publishes the file.

For an existing catalog pair, the desktop app provides the easiest operator path:

1. In **Settings → SDK configuration → Compatibility catalog**, select **Check device compatibility**.
2. Enter the device name, host, and passphrase only in that dialog. Do not paste connection values into chat, logs, the catalog, or an API request.
3. Before clicking **Confirm inspection**, obtain fresh explicit approval for the read-only inspection. The app creates and removes one temporary local CLI target, then stops when the model/firmware pair is unknown.
4. For a verified pair, select exactly one product-gate case. Before clicking **Confirm one-case validation**, obtain separate fresh approval. The app downloads and verifies the catalog-selected temporary driver, executes the case once, and removes its target, driver, and in-memory connection attempt.

The dialog is a verification route only: it never saves a device, creates a catalog entry, retries a TV operation, or publishes a result. An unknown pair still requires the candidate process below; do not guess a driver.

1. Read and locally validate the candidate and catalog. Identify the exact `{model, firmware}` pair:
   - absent: call it a new compatibility;
   - present: call it an existing compatibility update.
2. Before any TV or vendor CLI operation, state the intended read-only preflight and MyTV-only product gate, then obtain fresh explicit live-TV approval. Stop without approval. Never request or repeat a host or passphrase in chat; have the operator use the desktop dialog when its existing-profile route applies.
3. After approval, use `npm run tv:compatibility:lg -- --validate-candidate ...`. It validates the exact device identity, uses one temporary current-platform ChromeDriver, runs the approved product gate, then removes temporary files. Do not retry automatically.
4. Report only the fixed redacted result. On failure, stop; do not record or contact the TV again.
5. On success, ask one final question before writing:
   - new pair: **Record this compatibility?**
   - existing pair: **Update this compatibility?**
6. Only after that explicit answer, run the local-only record mode with `--confirm-record`; add `--replace-existing` only for the approved update branch. It must not contact a TV or network.
7. Leave publication to the maintainer's separate API workflow.

## Safety

- LG only. Never add Samsung behavior.
- Never use `appium:rcMode "js"` or `webos: clearApp`.
- Never deploy, install, uninstall, reset, pair, or otherwise alter a TV app outside the existing explicitly approved MyTV-only gate.
- Never print or persist connection values, credentials, pairing data, evidence locations, screenshots, hashes, or archive paths.
- Never use a guessed/latest ChromeDriver or silently overwrite an existing pair.
