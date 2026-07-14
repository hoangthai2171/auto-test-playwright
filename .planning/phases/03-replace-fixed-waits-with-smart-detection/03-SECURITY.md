---
phase: 03
slug: replace-fixed-waits-with-smart-detection
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-14
register_authored_at_plan_time: true
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test source to deterministic regression | The source-contract spec reads repository source text and treats it as a local asserted artifact, not runtime application input. | Local JavaScript source text |
| Test workflow to MyTV page | The existing keyboard-only workflow sends activation to the external TV page; this gap fix adds no new input or network surface. | Keyboard activation and existing page state |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-04-01 | Tampering | `tests/readiness-pacing.spec.js` source-contract assertion | mitigate | The named test scopes to `chooseFirstProfileAndEnterHome()` and asserts activation identity, selector contract fields, readiness ordering, absence of `delay: 10000`, and preservation of non-profile delays. | closed |
| T-03-04-02 | Elevation of privilege | Profile activation in `tests/lib/workflows.js` | accept | Existing `activateVerifiedTarget()` validation and keyboard-only Enter path are preserved; the change adds no authentication or authorization behavior. | closed |
| T-03-04-SC | Tampering | npm/Playwright test execution | mitigate | No package installs are required; syntax checks and the focused deterministic regression are the prescribed verification path. | closed |

*Status: open · closed*  
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

## Threat Verification

| Threat ID | Evidence |
|-----------|----------|
| T-03-04-01 | `tests/readiness-pacing.spec.js:65-87` reads the named workflow function and checks the exact activation contract, ordering, removed delay, and preserved delay sequence. The focused and full readiness regressions passed. |
| T-03-04-02 | `tests/lib/workflows.js:118-123` retains `activateVerifiedTarget()` with `testInfo`, `contentItem`, and `item_0`, then calls `waitForHomeReady()`; no authentication or authorization code was introduced. |
| T-03-04-SC | `03-04-PLAN.md` verification requires `node --check` and the focused Playwright test; `03-04-SUMMARY.md` records those checks as passed and no package installation was performed. |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-04-01 | T-03-04-02 | The phase preserves an existing validated profile activation path and changes only a fixed wait; it introduces no privilege or authentication behavior. | Phase 03 plan disposition (`03-04-PLAN.md`) | 2026-07-14 |

## Unregistered Threat Flags

None. No `## Threat Flags` entries were present in the Phase 03 summaries.

## Security Audit 2026-07-14

| Metric | Count |
|--------|-------|
| Threats found | 3 |
| Closed | 3 |
| Open | 0 |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-14
