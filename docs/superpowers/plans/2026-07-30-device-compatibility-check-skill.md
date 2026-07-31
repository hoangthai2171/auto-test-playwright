# Device Compatibility Check Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a repository-local maintainer skill that validates a proposed LG model-and-firmware ChromeDriver mapping through the approved product gate and records it in `DEVICE-COMPATIBILITY.json` only after a final explicit confirmation.

**Architecture:** A deterministic local candidate runner validates catalog input, downloads and verifies only the current-platform candidate into a temporary directory, and invokes the existing product-gate runner with that isolated executable. The project-only skill orchestrates that runner, enforces fresh live-TV approval and preflight, and performs the final project-file edit only after a passed result and explicit **Record this compatibility** confirmation. Neither component publishes to the API.

**Tech Stack:** Project-local Codex skill, CommonJS command-line runner, existing LG product-gate runner, `node:fs/promises`, `node:crypto`, `node:child_process`, and `node:test`.

## Global Constraints

- LG only. Do not add Samsung behavior.
- Every live invocation requires fresh explicit user approval and the current approved LG product-gate preflight; no implementation test may contact a TV.
- Never deploy, install, uninstall, reset outside approved MyTV-only reset behavior, or otherwise alter the LG TV app.
- Never use `appium:rcMode "js"` or `webos: clearApp`.
- Candidate archives must be the same exact schema accepted by `DEVICE-COMPATIBILITY.json`; validate both platform records, but download only the current platform's artifact.
- Keep candidate archives/extractions in a unique temporary directory and remove them after the runner exits. Do not alter the active per-user managed toolchain.
- Do not persist or print hosts, credentials, passphrases, pairing data, screenshots, evidence directories, raw vendor output, hashes, or archive paths.
- Never upload or otherwise publish `DEVICE-COMPATIBILITY.json`.
- Use `apply_patch` for edits and the six required repository validation commands after every edit. Do not stage or commit.

---

## File structure

| File | Responsibility |
| --- | --- |
| `scripts/real-tv-appium/lg-device-compatibility-check-core.js` | Pure candidate validation, safe command construction, result classification, and catalog append preparation. |
| `scripts/real-tv-appium/lg-device-compatibility-check.js` | CLI entry that owns temporary files, candidate download/extraction, redacted product-gate invocation, and final local record request. |
| `.codex/skills/device-compatibility-check/SKILL.md` | Project-only maintainer workflow, explicit approval gates, and command routing. |
| `.codex/skills/device-compatibility-check/agents/openai.yaml` | Skill interface metadata generated from the finished skill. |
| `tests/unit/lg-device-compatibility-check-core.test.js` | Pure candidate schema, safety, command, and append contracts. |
| `tests/unit/package-config.test.js` | Ensures the new script is not a packaged desktop runtime dependency. |

### Task 1: Define the pure candidate-validation and recording contract

**Files:**
- Create: `scripts/real-tv-appium/lg-device-compatibility-check-core.js`
- Create: `tests/unit/lg-device-compatibility-check-core.test.js`

**Interfaces:**
- Produces `parseCompatibilityCandidate(input)` → immutable catalog entry or classified error.
- Produces `buildCandidateGateArgs({candidate, runtime})` → fixed product-gate argument array without secrets.
- Produces `applyCompatibilityProfile({catalog, candidate, confirmed, replaceExisting})` → new catalog only when `confirmed === true`; an existing exact pair additionally requires `replaceExisting === true` and is then replaced rather than duplicated.

- [ ] **Step 1: Write failing pure tests**

```js
test("requires both audited platform artifacts before a live candidate can start", () => {
  assert.throws(() => parseCompatibilityCandidate({model: "model-a", firmware: "firmware-a", chromedriver: {darwin: validArtifact}}), /win32/i);
});

test("refuses to record a passed candidate without final confirmation", () => {
  assert.throws(() => applyCompatibilityProfile({catalog: {profiles: []}, candidate: validCandidate, confirmed: false}), /confirmation/i);
});

test("requires separate update confirmation before replacing an existing pair", () => {
  assert.throws(() => applyCompatibilityProfile({catalog: {profiles: [validCandidate]}, candidate: validCandidate, confirmed: true}), /update confirmation/i);
});

test("builds a gate command without host or credential values", () => {
  const args = buildCandidateGateArgs({candidate: validCandidate, runtime: {deviceName: "registered", model: "model-a", chromedriverPath: "/tmp/chromedriver"}});
  assert.deepEqual(args.slice(0, 2), ["scripts/real-tv-appium/lg-webos-case-runner.js", "--device"]);
  assert.doesNotMatch(JSON.stringify(args), /host|password|passphrase/i);
});
```

Cover duplicate catalog pairs, the required update-confirmation branch, unknown platform, invalid SHA/HTTPS/approved host, a candidate whose observed model/firmware differs, and a failed product gate that cannot produce a record.

- [ ] **Step 2: Run focused tests to verify red**

Run: `rtk node --test tests/unit/lg-device-compatibility-check-core.test.js`

Expected: FAIL because the candidate core does not exist.

- [ ] **Step 3: Implement pure schema, command, and append functions**

```js
function applyCompatibilityProfile({catalog, candidate, confirmed, replaceExisting} = {}) {
  if (confirmed !== true) throw new Error("Record confirmation is required.");
  const existingIndex = catalog.profiles.findIndex((entry) => entry.model === candidate.model && entry.firmware === candidate.firmware);
  if (existingIndex >= 0 && replaceExisting !== true) {
    throw new Error("Update confirmation is required for this existing model and firmware.");
  }
  const profiles = existingIndex >= 0
    ? catalog.profiles.map((entry, index) => index === existingIndex ? candidate : entry)
    : [...catalog.profiles, candidate];
  return {profiles: profiles.sort((left, right) => `${left.model}\u0000${left.firmware}`.localeCompare(`${right.model}\u0000${right.firmware}`))};
}
```

Reuse the catalog validator from the first plan; do not duplicate URL/host/SHA rules. Build only fixed product-gate flags and accept runtime connection values through the runner's existing runtime-only environment/arguments. Never include them in returned status, thrown messages, or persisted data.

- [ ] **Step 4: Run focused tests to verify green**

Run: `rtk node --test tests/unit/lg-device-compatibility-check-core.test.js`

Expected: PASS with every unsafe or duplicate candidate rejected before any command can be built.

- [ ] **Step 5: Run the required repository validation**

Run the six required validation commands from Global Constraints.

### Task 2: Add the non-interactive candidate runner without running it live

**Files:**
- Create: `scripts/real-tv-appium/lg-device-compatibility-check.js`
- Modify: `package.json`
- Modify: `tests/unit/package-config.test.js`
- Modify: `tests/unit/lg-device-compatibility-check-core.test.js`

**Interfaces:**
- Adds `npm run tv:compatibility:lg -- --validate-candidate ...` and a separate `--record-candidate ... --confirm-record` maintainer-only command.
- `--validate-candidate` requires `--device`, `--model`, `--firmware`, `--catalog-candidate`, `--search-name`, and `--content-type` only after the skill has obtained fresh live approval. `--record-candidate` performs no TV or network operation; its existing-pair branch additionally requires `--replace-existing` after the skill has obtained a distinct update confirmation.
- Reads runtime host and product credentials only from runtime sources used by the existing LG gate; no returned status, persisted data, or user-visible output includes them.

- [ ] **Step 1: Write failing command-construction and safety tests**

```js
test("record mode requires explicit confirmation after a previously passed validation", async () => {
  const result = await recordCandidate({candidate: validCandidate, confirmed: false});
  assert.deepEqual(result, {ok: false, status: "RECORD_CONFIRMATION_REQUIRED"});
});

test("candidate runner cleans temporary extraction when the gate fails", async () => {
  const calls = [];
  await validateCandidate({candidate: validCandidate, createTempDir: async () => "/tmp/candidate", removeTempDir: async () => calls.push("removed"), runGate: async () => ({ok: false})});
  assert.deepEqual(calls, ["removed"]);
});
```

Add package tests proving the command is available for maintainers but does not add an Electron packaging include or run automatically.

- [ ] **Step 2: Run focused tests to verify red**

Run: `rtk node --test tests/unit/lg-device-compatibility-check-core.test.js tests/unit/package-config.test.js`

Expected: FAIL because no candidate runner command exists.

- [ ] **Step 3: Implement the candidate runner**

```js
try {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mytv-lg-compatibility-"));
  const archivePath = await downloadApprovedArtifact(currentPlatformArtifact, temporaryRoot);
  await verifySha256(archivePath, currentPlatformArtifact.sha256);
  const chromedriverPath = await extractSingleChromeDriver(archivePath, temporaryRoot);
  await verifyChromeDriverVersion(chromedriverPath, currentPlatformArtifact.version);
  const passed = await runApprovedProductGate({chromedriverPath, ...runtimeOnlyInputs});
  return passed ? {ok: true, status: "CANDIDATE_VALIDATED"} : {ok: false, status: "PRODUCT_GATE_FAILED"};
} finally {
  await removeTemporaryRoot();
}
```

Use the existing product-gate runner rather than recreating Appium, session, reset, login, or cleanup logic. Require a separate read-only observed-device model/firmware match before product-gate start. Create no new TV capability and never initiate the command during automated tests. Use owner-only temporary files when supported; clean them in `finally` without reporting their path. Implement `--record-candidate` as a distinct local-only branch that calls `applyCompatibilityProfile` only when `--confirm-record` is present. If the candidate matches an existing model-and-firmware pair, require `--replace-existing` as well. It must not re-run validation or contact a TV.

- [ ] **Step 4: Run focused tests to verify green**

Run: `rtk node --test tests/unit/lg-device-compatibility-check-core.test.js tests/unit/package-config.test.js`

Expected: PASS. No test invokes a real network request, subprocess, or TV.

- [ ] **Step 5: Run the required repository validation**

Run the six required validation commands from Global Constraints.

### Task 3: Create and validate the project-only skill and documentation

**Files:**
- Create: `.codex/skills/device-compatibility-check/SKILL.md`
- Create: `.codex/skills/device-compatibility-check/agents/openai.yaml`
- Modify: `docs/real-tv-appium/poc-runbook.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `README.md`

**Interfaces:**
- The skill triggers for requests to validate a new LG device/ChromeDriver compatibility mapping or record a compatibility catalog entry.
- The skill must stop for fresh live approval before even read-only TV activity and stop again for **Record this compatibility** after a passed gate.

- [ ] **Step 1: Write the skill workflow with explicit gates**

```markdown
1. Read `DEVICE-COMPATIBILITY.json` and validate the candidate locally.
2. State the exact intended live-TV operations and request fresh approval.
3. After approval, run `--validate-candidate` with runtime-only connection and product-gate inputs.
4. Report only the fixed redacted result.
5. On a pass, ask: "Record this compatibility?" for a new pair, or "Update this compatibility?" for an existing pair. Do not edit the catalog until the maintainer explicitly approves, then run the separate local-only `--record-candidate --confirm-record` action; include `--replace-existing` only for the explicitly approved update branch.
6. Never upload the catalog. Tell the maintainer to publish the reviewed file through their API workflow.
```

Include all LG safety prohibitions, forbid raw secret/evidence output, and route any failure to a stop rather than a retry that could contact the TV again.

- [ ] **Step 2: Generate skill metadata and validate the skill**

Run: `rtk proxy python /Users/thainguyen/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py .codex/skills/device-compatibility-check --interface display_name="Device Compatibility Check" --interface short_description="Validate and record LG ChromeDriver compatibility" --interface default_prompt="Validate a new LG device and ChromeDriver compatibility mapping."`

Run: `rtk proxy python /Users/thainguyen/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/device-compatibility-check`

Expected: the validator exits 0 with a valid name, frontmatter, and metadata.

- [ ] **Step 3: Update maintainer documentation and run final verification**

Document the project JSON as the publishable source, the API update flow, the maintenance-only command, fresh approval, preflight, explicit record confirmation, and no-publish boundary. Run `rtk graphify update .`, `rtk graphify check-update .`, then the six required repository validation commands.

Expected: all commands pass. Do not run the live candidate command without a new user approval at that time.
