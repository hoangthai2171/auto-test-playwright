# External Integrations

**Analysis Date:** 2026-07-13

## APIs & External Services

**Target application automation:**
- MyTV HTML5 TV web application - Playwright opens and tests the configured TV interface; the default staging target is `https://html5stage.mytv.vn/` in `playwright.config.js` and `tests/lib/mytv-helpers.js`.
  - SDK/Client: `playwright` Chromium browser automation in `tests/fixtures/mytv-session-fixture.js`.
  - Auth: `USERNAME` and `PASSWORD` are supplied to the MyTV UI flow by `tests/lib/mytv-helpers.js`; this repository has no direct MyTV API client.

**AI planning:**
- OpenAI-compatible Chat Completions - Converts Vietnamese manual-test descriptions into validated JSON plans in `app/main.js`.
  - SDK/Client: native Node `fetch` in `app/main.js`; no OpenAI SDK is installed.
  - Endpoint: defaults to `https://api.openai.com/v1/chat/completions` but accepts `AI_ENDPOINT` for compatible providers in `app/main.js`.
  - Auth: bearer token provided as `AI_API_KEY` in `app/main.js`.
- Google Gemini Generative Language API - Optional JSON-plan generation and model connection checks in `app/main.js`.
  - SDK/Client: native Node `fetch` in `app/main.js`; no Gemini SDK is installed.
  - Endpoint: defaults to `https://generativelanguage.googleapis.com/v1beta` in `app/main.js`.
  - Auth: API key supplied as `AI_API_KEY` in a `key` query parameter by `app/main.js`.
- Custom OpenAI-compatible provider - Renderer allows a user-configured endpoint and model in `app/renderer/renderer.js`; requests retain the OpenAI-compatible chat-completions payload handled by `app/main.js`.
  - SDK/Client: native Node `fetch` in `app/main.js`.
  - Auth: bearer token supplied as `AI_API_KEY`.

## Data Storage

**Databases:**
- None. No database driver, ORM, schema, or connection variable is detected in `package.json`, `app/`, `tests/`, or `scripts/`.

**File Storage:**
- Local filesystem only. Electron writes generated plans, Playwright reports, test results, and live-preview screenshots under `app.getPath("userData")` in `app/main.js`.
- Local Chromium binaries are stored in `.playwright-browsers/` by `scripts/install-playwright-browsers.js` and bundled through `package.json`.
- AI provider settings, including the configured API key, are stored in browser `localStorage` under `mytv-auto-test-settings` by `app/renderer/renderer.js`.

**Caching:**
- None detected. Browser state is in the worker-scoped Playwright context in `tests/fixtures/mytv-session-fixture.js`, not an external cache.

## Authentication & Identity

**Auth Provider:**
- MyTV application authentication - Custom UI-driven login automation through the target website; helper entry flow starts in `tests/lib/mytv-helpers.js`.
  - Implementation: account credentials are runtime inputs (`USERNAME`, `PASSWORD`) passed from Electron `app/main.js` or terminal `scripts/run-headed.js` into the Playwright worker fixture.
- AI provider authentication - API-key authentication for OpenAI-compatible and Gemini requests in `app/main.js`.
  - Implementation: `AI_API_KEY` originates in the Electron settings UI and is persisted in `localStorage` by `app/renderer/renderer.js`; terminal test modes do not call these cloud services.

## Monitoring & Observability

**Error Tracking:**
- None. No third-party error-tracking SDK is declared in `package.json`.

**Logs:**
- Playwright subprocess stdout/stderr is forwarded over Electron IPC to the renderer by `app/main.js` and displayed in `app/renderer/renderer.js`.
- Playwright produces an HTML report, failure screenshots, and traces according to `playwright.config.js`; packaged runs store reports in Electron `userData` via `app/main.js`.

## CI/CD & Deployment

**Hosting:**
- Desktop distribution only: Electron Builder creates macOS and Windows packages configured in `package.json`; no web hosting configuration is detected.

**CI Pipeline:**
- None detected. No workflow files are present in `.github/` and no other CI configuration is detected.

## Environment Configuration

**Required env vars:**
- `APP_URL`, `USERNAME`, and `PASSWORD` configure the target MyTV session in `tests/lib/mytv-helpers.js`.
- Use playback variables (`CHANNEL_*`, `MOVIE_*`, and `SEARCH_KEYWORD`) for the selected Playwright flow; the complete parser is `tests/lib/mytv-helpers.js`.
- `AI_PLAN_PATH` provides an AI execution plan to `tests/run-ai-plan-mytv.spec.js`; Electron supplies it in `app/main.js`.
- `PLAYWRIGHT_BROWSERS_PATH` and `PLAYWRIGHT_HTML_REPORT` are runtime integration variables assigned by `app/main.js`.
- Electron-only preview variables are `MYTV_PREVIEW_PATH`, `MYTV_INTERACTIVE_CDP_URL`, `MYTV_INTERACTIVE_VIEW_SCALE`, and optional `MYTV_INTERACTIVE_BROWSER_DEBUG_PORT`, used in `app/main.js` and `tests/fixtures/mytv-session-fixture.js`.
- `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, and `AI_ENDPOINT` configure optional cloud planning in `app/main.js` and `app/renderer/renderer.js`.

**Secrets location:**
- No repository `.env` file is detected. The terminal runner receives credentials through process environment/prompt input in `scripts/run-headed.js`.
- Desktop AI settings are persisted in renderer `localStorage` by `app/renderer/renderer.js`; generated plans and reports are stored under Electron `userData` by `app/main.js`.

## Webhooks & Callbacks

**Incoming:**
- None. The desktop app exposes local Electron IPC handlers in `app/main.js`, not HTTP webhook endpoints.

**Outgoing:**
- No webhooks. Outbound HTTPS requests are limited to the configured MyTV website through Playwright and optional AI generation/connection requests in `app/main.js`.

---

*Integration audit: 2026-07-13*
