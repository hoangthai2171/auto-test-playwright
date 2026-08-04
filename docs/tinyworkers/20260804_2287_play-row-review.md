# Tiny-Workers Plan: Case 2287 `play_row` review

## Status

Completed. The user’s four review requirements were the implementation authorization and acceptance criteria.

## Scope

Fix the Browser action runner for case 2287 and the shared `play_row` contract so that it:

1. Runs with a real 1920x1080 Playwright page viewport.
2. Starts the selected row at its first poster and handles the staging app’s first-activation reflow by retrying `Enter` only when the same focused poster is still on Home and no player/detail opened.
3. Records a failed poster, recovers from a known playback error dialog, and continues through the remaining reachable posters.
4. Reports every tested poster with name, content ID, poster, player/error screenshot, and pass/fail status; the action and testcase remain failed when any poster fails.

The existing row-navigation, selector-validation, player-state, and safe remote-control changes from `20260803_2287_play-row-return.md` remain in scope and are preserved.

## Evidence and decisions

- A live 1920x1080 diagnostic focused `homePage2_0_0` (`content_id=162566`, `Liễu Chu Ký`) first.
- The first remote `Enter` kept the same poster focused but moved its rendered position during carousel reflow; the second remote `Enter` opened `moviePlayerNew` and produced a healthy playing video.
- Therefore 1920x1080 is supported by Playwright and the app; the defect is an app-side asynchronous focus/reflow activation quirk, not a Playwright viewport requirement.
- The omitted `play_row.count` means all reachable items in the selected row. It must not stop at the shared default 120-second batch budget; explicit `count` remains bounded.
- A failed item is evidence, not a reason to abandon the row. Recovery remains safe: only a recognized playback error/unsupported-device dialog may be dismissed automatically; unknown modals remain a guarded failure.
- After the shared close helper detects the previous screen boundary, row playback waits 1.5 seconds for the Home carousel to finish re-rendering before the next focus/navigation action.

## Ordered milestones

### Milestone 1 — Diagnostic baseline (completed)

- Confirm first item identity, first activation behavior, and 1920x1080 player transition with live staging evidence.

### Milestone 2 — First-item activation and viewport (completed)

- Restore the shared Browser fixture to 1920x1080.
- Add a guarded same-item activation retry after the carousel reflow condition.
- Add focused unit coverage so ordinary activation is still single-press and fallback/detail activation is unchanged.

### Milestone 3 — Exhaustive failure-tolerant row playback (completed)

- Isolate per-item playback and cleanup failures.
- Dismiss only the recognized row-playback error dialog through remote focus/Enter.
- Always append an item result and continue until row navigation reaches the end.
- Remove the implicit runtime cap only for omitted `play_row.count`; keep explicit count/runtime controls intact.

### Milestone 4 — Evidence/reporting and verification (completed)

- Capture a screenshot for every item at the player check boundary (or the failure dialog/error state when no player opened).
- Carry content IDs and all item results into the compact user report and Playwright artifact.
- Run unit, syntax, list, diff, and live case checks; remove temporary diagnostics.
- Update project documentation for the 1920x1080 Browser viewport and all-item `play_row` behavior.

## Acceptance evidence

- Unit tests cover guarded activation retry, known-dialog recovery, unlimited omitted-count budget semantics, content ID extraction, aggregate expected-result handling, and all-item report rendering.
- `npm run test:unit`, syntax checks, Playwright test listing, `tests/batch-budget.spec.js`, and `git diff --check` pass.
- A live case 2287 run at 1920x1080 tested all 16 posters: the first poster passed, 14 posters passed overall, 2 posters failed, every item had a screenshot and content ID, and the overall `play_row` action failed with the two item failures while continuing through the last poster.

## Completed verification

- `npm run test:unit`: 617 tests passed after the row-mapping and report-summary follow-up.
- `npx playwright test tests/batch-budget.spec.js --project=chromium --reporter=line`: 5 passed.
- `node --check` for changed JavaScript entry/helper/report files: passed.
- `npx playwright test tests/run-test-case-mytv.spec.js --list`: one test listed.
- `git diff --check`: passed.
- The post-return carousel settle is covered by the content-row unit contract; the delay is 1.5 seconds after the close boundary and before the next row action.
- Live command: cached folder `6`, case `2287`, `APP_URL=https://html5stage.mytv.vn/`, host-level Chromium, 1920x1080 logical viewport.
- Live result: 16 results, `completed=16`, `attempted=16`, `reason=row-exhausted`, `budgetLimited=false`, `budgetMs=null`; pass/fail split `14/2`. The compact report projection produced 16 row items, preserved all names/content IDs/screenshots/results, and rendered the `Row Playback Results` table.

## Risks and boundaries

- This does not change the MyTV application or make an unsupported poster pass.
- Dynamic carousel content can change between runs; row exhaustion uses focused-item identity and bounded remote navigation rather than a hard-coded poster count.
- A modal that is not recognized as a row playback error is not auto-dismissed, to avoid pressing a destructive control on an unrelated screen.

## Follow-up correction: case 2291 row mapping and failure summary

- Case 2291 reproduced the numeric row-selection defect: the Home promotional
  row is `homePage1`, while content rows use `homePage2_<row>_<item>` IDs. The
  numeric selector now excludes `homePage1` and resolves public row `N` to
  `homePage2_(N-1)_*`, allowing row 5 to focus `homePage2_4_0`.
- Row playback failure errors now enumerate each failed content ID and name,
  while the compact report continues to list the complete per-poster evidence
  table.
- Focused live validation of case 2291 reached `SCTV đặc sắc` with first item
  `homePage2_4_0`. A subsequent full-run attempt was blocked before Home by the
  staging device-limit popup; this was an environment/session issue, not the
  row-selection path.
