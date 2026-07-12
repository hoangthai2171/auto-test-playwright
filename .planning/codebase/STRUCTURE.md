# Codebase Structure

**Analysis Date:** 2026-07-13

## Directory Layout

```
[project-root]/
├── app/                         # Electron desktop application
│   ├── main.js                  # Main process and test orchestration
│   ├── preload.js               # Context-isolated IPC bridge
│   └── renderer/                # Static desktop renderer assets
│       ├── index.html           # UI markup
│       ├── renderer.js          # Browser-side UI behavior
│       └── styles.css           # Renderer styling
├── scripts/                     # Node command-line launch/install adapters
├── tests/                       # Playwright test suite
│   ├── fixtures/                # Shared Playwright fixtures
│   ├── lib/                     # MyTV domain automation and plan execution
│   └── *.spec.js                # User-flow and helper-focused test specs
├── .playwright-browsers/        # Locally installed Chromium bundle (generated)
├── dist/                        # Electron Builder output (generated)
├── playwright-report/           # Local HTML report output (generated)
├── test-results/                # Local Playwright artifacts (generated)
├── package.json                 # Scripts, dependencies, Electron Builder config
├── playwright.config.js         # Test runner configuration
├── README.md                    # User-facing project documentation
└── AGENTS.md                    # Project automation guidance
```

## Directory Purposes

**`app/`:**
- Purpose: Electron desktop application layer.
- Contains: one main-process module, a preload bridge, and static renderer resources.
- Key files: `app/main.js`, `app/preload.js`, `app/renderer/index.html`, `app/renderer/renderer.js`.

**`app/renderer/`:**
- Purpose: unprivileged browser-side UI for starting tests, viewing logs/reports, configuring AI, and showing preview state.
- Contains: plain HTML, CSS, and browser JavaScript; no Node imports.
- Key files: `app/renderer/index.html`, `app/renderer/renderer.js`, `app/renderer/styles.css`.

**`scripts/`:**
- Purpose: executable Node adapters for developer workflows and packaging prerequisites.
- Contains: standalone CommonJS scripts with process spawning/prompting.
- Key files: `scripts/run-headed.js`, `scripts/run-electron-app.js`, `scripts/install-playwright-browsers.js`.

**`tests/`:**
- Purpose: Playwright specs for login and supported MyTV user workflows.
- Contains: feature specs directly under the directory, plus shared fixtures and domain libraries.
- Key files: `tests/login-mytv.spec.js`, `tests/play-channel-mytv.spec.js`, `tests/play-movie-mytv.spec.js`, `tests/search-content-mytv.spec.js`, `tests/open-setting-mytv.spec.js`, `tests/run-ai-plan-mytv.spec.js`.

**`tests/fixtures/`:**
- Purpose: centralize worker-scoped browser/session setup and preview/CDP modes.
- Contains: custom Playwright fixture modules.
- Key files: `tests/fixtures/mytv-session-fixture.js`.

**`tests/lib/`:**
- Purpose: own reusable MyTV navigation, selection, assertion, artifact, and AI-plan behavior.
- Contains: CommonJS helper libraries, not test-discovery specs.
- Key files: `tests/lib/mytv-helpers.js`, `tests/lib/ai-plan-runner.js`.

**`.playwright-browsers/`:**
- Purpose: local Playwright Chromium binaries used in development and copied as package resources.
- Generated: Yes, by `scripts/install-playwright-browsers.js`.
- Committed: No; package configuration copies it into packaged app resources (`package.json:38`).

**`dist/`:**
- Purpose: Electron Builder package output.
- Generated: Yes, by `npm run app:build` commands from `package.json`.
- Committed: No.

**`playwright-report/` and `test-results/`:**
- Purpose: local Playwright report and test artifacts for terminal runs.
- Generated: Yes, by Playwright.
- Committed: No.

**`.planning/codebase/`:**
- Purpose: generated codebase map documents for planning and execution agents.
- Contains: architecture, structure, stack, integration, quality, test, and concern analyses as available.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `package.json`: declares npm commands and `app/main.js` as Electron's main module.
- `app/main.js`: Electron startup, IPC handlers, mode selection, process management, AI planning, and preview management.
- `scripts/run-electron-app.js`: development Electron process launcher.
- `scripts/run-headed.js`: interactive terminal Playwright launcher.
- `playwright.config.js`: direct Playwright CLI entry configuration.
- `tests/login-mytv.spec.js`: prerequisite login flow used before selected feature scenarios.

**Configuration:**
- `package.json`: package metadata, CommonJS module type, scripts, and Electron Builder packaging rules.
- `playwright.config.js`: single-worker Playwright configuration, viewport, timeout, reporter, and Chromium project settings.
- `AGENTS.md`: repository-level behavioral constraints for TV remote automation and all execution modes.

**Core Logic:**
- `app/main.js`: main-process orchestration and the AI planner implementation.
- `app/preload.js`: renderer-to-main IPC API contract.
- `app/renderer/renderer.js`: desktop UI state, validation, preview behavior, and bridge calls.
- `tests/fixtures/mytv-session-fixture.js`: shared context/page/options fixture.
- `tests/lib/mytv-helpers.js`: primary MyTV test-domain library.
- `tests/lib/ai-plan-runner.js`: persisted-plan loader/validator/executor.

**Testing:**
- `tests/*.spec.js`: Playwright-discovered scenario specs.
- `tests/ai-row-selection.spec.js`: isolated unit-style checks for exported helper internals using synthetic page content.
- `tests/fixtures/mytv-session-fixture.js`: suite fixture setup.
- `playwright.config.js`: test discovery and reporting configuration.

## Naming Conventions

**Files:**
- Use lowercase kebab-case for Playwright specs and script filenames: `tests/play-channel-mytv.spec.js`, `scripts/run-headed.js`.
- Name Playwright files with the `.spec.js` suffix and place user-flow specs directly in `tests/`.
- Use descriptive kebab-case names for reusable libraries: `tests/lib/mytv-helpers.js`, `tests/lib/ai-plan-runner.js`.
- Use standard Electron names for process roles: `app/main.js` and `app/preload.js`.
- Keep static renderer asset names conventional and co-located: `app/renderer/index.html`, `app/renderer/renderer.js`, `app/renderer/styles.css`.

**Directories:**
- Group code by runtime responsibility: Electron app in `app/`, launch scripts in `scripts/`, and all Playwright artifacts in `tests/`.
- Put fixtures in `tests/fixtures/` and reusable, non-discovered test-domain modules in `tests/lib/`.
- Do not create a general `src/` directory; this project locates production desktop code under `app/` and automation code under `tests/`.

## Where to Add New Code

**New Feature:**
- Primary test flow: add `tests/<feature>-mytv.spec.js`, importing `{ test }` from `tests/fixtures/mytv-session-fixture.js`.
- Shared navigation/assertion logic: add or extend a focused exported function in `tests/lib/mytv-helpers.js`.
- Tests: use `tests/ai-row-selection.spec.js` as the location/pattern for isolated synthetic-DOM regression tests when helper internals need coverage.
- Desktop mode: add the selected ordered spec list to `testModes` in `app/main.js`; add it to `playbackModes` in `scripts/run-headed.js` when interactive-terminal support is required; add matching form controls in `app/renderer/index.html` and behavior in `app/renderer/renderer.js`.

**New Component/Module:**
- Electron main-process behavior: implement in `app/main.js`; expose only required renderer operations through `app/preload.js`.
- Renderer UI behavior: implement in `app/renderer/renderer.js`, markup in `app/renderer/index.html`, and styles in `app/renderer/styles.css`.
- Shared Playwright lifecycle behavior: extend `tests/fixtures/mytv-session-fixture.js` rather than duplicating browser/context construction in specs.
- AI-plan action execution: validate/generate the action in `app/main.js`, implement execution dispatch in `tests/lib/ai-plan-runner.js`, and put UI-navigation details in `tests/lib/mytv-helpers.js`.

**Utilities:**
- Shared MyTV helpers: `tests/lib/mytv-helpers.js`. Keep functions page-oriented, keyboard-driven, and artifact-aware.
- AI plan file handling: `tests/lib/ai-plan-runner.js`.
- Developer process utilities: add a standalone script in `scripts/` and wire it into `package.json`.

## Special Directories

**`node_modules/`:**
- Purpose: installed Node/Electron/Playwright dependencies.
- Generated: Yes.
- Committed: No.

**`.git/`:**
- Purpose: Git metadata.
- Generated: Yes.
- Committed: Not applicable.

**`graphify-out/`:**
- Purpose: generated project knowledge-graph data and reports.
- Generated: Yes.
- Committed: Repository-specific; treat as generated analysis output, not application source.

**`.opencode/`:**
- Purpose: OpenCode project configuration/plugins.
- Generated: No.
- Committed: Repository-specific configuration.

---

*Structure analysis: 2026-07-13*
