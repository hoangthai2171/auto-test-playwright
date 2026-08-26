# MyTV Auto Test

Desktop runner and Playwright regression suite for the MyTV HTML5 TV web app.
The Electron app runs server-shaped cases from a local fixture, while the
terminal suite keeps the older helper-based specs available for regression
coverage.

## Requirements

- Node.js 20+ recommended.
- npm.
- Network access to the target MyTV app URL.
- Network access when installing dependencies. The desktop app requests network access only after a user confirms its reviewed Browser installation.

Install dependencies:

```bash
npm install
```

The desktop app does not bundle Chromium. In **Settings → SDK configuration →
Browser configuration**, use **Auto configure**, then separately confirm
**Install reviewed Chromium** when it is missing. The project-pinned Playwright
Chromium is stored in private per-user app storage and is not a system-browser
installation.

For LG, **Settings → SDK configuration** first reviews local tools. After the
user separately confirms installation, the app installs the pinned Node/Appium
toolchain. It installs ChromeDriver only when the selected saved device exactly
matches a centrally shipped verified compatibility profile; otherwise it reports
`COMPATIBILITY_PROFILE_UNVERIFIED` and does not download a guessed driver.

The compatibility catalog is refreshable from the configured API in **SDK
configuration**. Maintainers validate new exact LG model/firmware mappings with
the repository-local `device-compatibility-check` workflow; only a passed,
explicitly confirmed result can add a new record or replace an existing pair in
`DEVICE-COMPATIBILITY.json`. Publishing that reviewed file to the API is a
separate manual maintenance action.

For an existing catalog mapping, **Settings → SDK configuration → Compatibility
catalog → Check device compatibility** provides a temporary, unsaved check. The
first confirmation creates a short-lived local CLI target only to inspect the
device identity. If the catalog has an exact mapping, select exactly one
product-gate validation and separately confirm its one-shot run. The fixed local
case signs in, opens Home and Search, searches for `VTV1 HD`, and starts the
matching search result. Its account is configured once in SDK configuration and
stored only with Electron encryption; it is not part of API-loaded test cases.
The temporary driver, CLI target, and in-memory connection values are removed afterward. An
unknown model/firmware pair stops before a driver download or test run; the app
never guesses a ChromeDriver or adds a catalog record.

LG compatibility investigation is currently paused. Maintainers resuming it
should read [LG Compatibility Pause Handoff](docs/real-tv-appium/LG-COMPATIBILITY-PAUSE-HANDOFF.md)
before any live-device work.

## Project Structure

```text
testcased.json                  Read-only local server-shaped fixture
ACTION-COMPILER.md              Server-side qaDescription-to-actions guide
app/
  main.js                       Electron main process and test-case runner IPC
  preload.js                    Safe IPC bridge
  flow-case-api.js              Flow-case API calls and timeout handling
  test-case-cache.js            Folder/campaign-keyed user-data cache
  renderer/                     Case browser, preview, logs, and settings UI
tests/
  run-test-case-mytv.spec.js    Generic Playwright entry point
  login-mytv.spec.js            Legacy login regression spec
  play-channel-mytv.spec.js     Legacy channel regression spec
  play-movie-mytv.spec.js       Legacy movie regression spec
  search-content-mytv.spec.js   Legacy search regression spec
  open-setting-mytv.spec.js     Legacy settings regression spec
  fixtures/                     Shared browser-session fixture
  lib/
    test-case-schema.js         Test-case and action validation
    test-case-source.js         Local fixture loading and case lookup
    test-case-compiler.js       Limited qaDescription fallback compiler
    test-case-action-runner.js  Validated action dispatch and step results
    mytv-helpers.js             Public helper facade
    workflows.js                Current helper workflows
    mytv-helpers.legacy.js      Retained legacy helper copy
scripts/
  run-headed.js                 Interactive terminal runner for legacy specs
  run-electron-app.js           Starts Electron in development mode
  install-playwright-browsers.js Terminal-only legacy browser-cache helper
playwright.config.js
```

## Run With the Electron Case Browser

The app restores the latest successfully loaded API test-case list at startup.
API-loaded cases are downloaded from the configured flow-case folder or a
selected running campaign, validated, and stored in the Electron user-data
cache at `<userData>/testcases-cache.json`. Folder entries use their folder ID;
campaign entries use `campaign:<campaignId>`, and a latest-entry marker records
which list the GUI should restore. Refreshing either the campaign list or the
folder list clears the restored list and its latest marker. `testcased.json` is
used only as the local fallback when no latest cached API list is available.

1. Add or update server-shaped cases in `testcased.json`.
2. Start the desktop runner:

   ```bash
   npm run app:dev
   ```

3. Open Settings and configure the API domain, API authorization/service-token value, project ID, environment (default `UI`), and Network config API timeout (default 30 seconds), then save. The Browser `APP_URL` is fixed in `app/main.js` and is not shown or editable in the GUI. The DNS host mapping is fixed in `app/hosts-file.js`; Settings retains only value-free Add host and Remove host controls. The configured API authorization value is sent verbatim in the `X-FlowTest-Service-Token` header and is redacted from Logs. Every `[API]` card in the Logs modal carries a **Copy cURL** button next to Expand that copies the exact HTTP request as a runnable `curl` command — ready to paste into Postman (Import → Raw text) or a shell — with one command per request for ordered per-case submissions. The command is built in the main process from the real request, so it carries the real `X-FlowTest-Service-Token` value and the full screenshot base64 even though the visible log keeps both redacted; treat the clipboard contents as a credential and do not paste them into shared documents or tickets. A **Get text file** button beside it opens the native save dialog and writes the same command to the chosen `.txt` file (the extension is added when missing). Both buttons stay disabled until the response supplies the request details. In **Test configuration**, choose `Test resolution` (`1280x720` by default, or `1920x1080`) and `Simultaneous devices` (`1`, `2`, `4`, or `6 devices`; default `6`) for Browser runs. The selected values are validated, persisted, and snapshotted when each Browser batch starts. The same panel also contains `Test case maximum time (minutes)` (default 30) and `Player check timeout (second)` (default 6). In **SDK configuration → Browser configuration**, review and, when needed, explicitly install the project-pinned Chromium.
4. Use the refresh icon beside **Chiến dịch** to load running campaigns or the refresh icon beside **Folders** to load folders. Selecting a campaign automatically refreshes **Folders** with only that campaign's folders; clearing the campaign refreshes the unfiltered project folders. Select a campaign and click `Get test cases` to load every campaign copy without choosing a folder. A folder is optional in that mode; when selected, the app intersects the campaign list with that folder subtree. With no campaign selected, a folder is still required and cases come only from the selected folder.
5. Search by case ID substring or name with the instant filter, then check one or more visible cases in the table.
6. Use `Detail` to review metadata, expected result, and normalized actions.
7. Choose the Browser **App environment** in the status bar (`ONLINE` by default, `PILOT`, or `STAGE`), then click `Run Selected (N)`. The Browser workspace keeps six 16:9 preview holders visible; the configured number of slots runs immediately and later selected cases refill the first slot that becomes free. Each holder shows the full testcase ID, an ellipsized name when necessary, and a white status badge. Select a holder or testcase row to view that case's redacted Playwright log in the lower workspace panel. Slots above the configured simultaneous-device limit remain `Idle`. The selector is Browser-only and is disabled while an LG target or an active run is selected.
8. Open the test report after the batch finishes. Use `Details` for any test to
   see its expected result; passed tests also show their final viewport
   screenshot. `play_row` details list every tested poster with its name,
   content ID, poster, player/error screenshot, pass/fail result, and any error;
   one failed poster makes the overall testcase fail while later posters are
   still tested.

The renderer captures checked case IDs in table order and sends one Browser batch
request containing the ordered IDs, normalized resolution, simultaneous-device
limit, player-check timeout, test-case maximum time, preview settings, the
validated `APP_ENVIRONMENT`, and the active cache key to the main process.
Folder and campaign API calls run through
main-process IPC. A selected campaign loads cases from
`GET /api/v1/projects/{projectId}/test-campaigns/{campaignId}/testcases` with
the configured value in `X-FlowTest-Service-Token`; the new request does not add
folder or environment query filters. If a folder is selected, Main also loads
that folder subtree and retains only exact testcase-copy ID matches. With no
campaign selected, the existing folder API and folder requirement remain
unchanged. A full-screen spinner blocks interaction while an API call is active;
timeout failures show an alert and leave the existing list/cache untouched. The
main process validates each ID from the selected folder or campaign cache, then
starts one owned Playwright child per active Browser slot. Every child keeps
`workers: 1`; the main-process scheduler refills slots in table order and gives
each case unique preview, result, test-results, and debug-report paths under an
opaque batch directory. Campaign loading uses each returned campaign copy's own
`id`; `sourceFlowCaseId` is never used as the execution ID. The main scheduler
continues after a pass, failure, or launch error, while the renderer records
each keyed slot/table status. Folder-filtered campaign runs continue to submit
one `PATCH /api/v1/projects/{projectId}/flow-cases/by-folder` batch with the
selected folder path and each case's `tested` lifecycle status,
`testResult`, and selected `campaignId`. Campaign-only runs submit each
completed result through `PATCH /api/v1/projects/{projectId}/flow-cases/{caseId}`
with `campaignId`, `status`, and `testResult`; confirmed successes are removed
from later Retry sync attempts. Every submitted `testResult` also carries
`screenshots`, a raw base64 WebP string holding exactly one representative
screenshot for that run, resized to 1280px on its longest edge. A run can produce
many captures - `play_row` and `play_all_contents` capture one per poster - so a
failed case is represented by a failed item's capture, which takes priority over
the completion capture because a failed run can still hold a completion or
player-check image taken before the failure. A passed case is represented by its
completion capture. Only screenshots are eligible; content poster artwork is
never submitted. Runs without any capture omit the field, and the API logs show
only its length, never the base64 body. A normally completed API batch submits all
selected cases; after a manual stop, only cases that fully completed before the
stop are submitted. Skipped, local-fixture, and failed-to-launch cases are
never included.

Player checks wait for normal playback using the value from **Settings → Test
configuration** (6 seconds by default), capture the player screen for the
report, then use the shared adaptive player/detail-close helper before the next
non-player step or test completion. It observes the destination after each
Back, sends a second Back only when the first did not close the player, and
dismisses a recognized exit-confirmation popup without issuing an extra close
press. A final player check waits two seconds after closing so watching-session
teardown API calls can finish; player-check failures retain the player-screen
capture in the compact report.

Each generic case invokes the trusted app global `window.processLogOut` after
execution, including failed cases. The cleanup is awaited and is isolated from
the shared legacy session fixture.

### Browser app environment

The status-bar selector is persisted separately from the API `ENVIRONMENT`
setting and defaults to `ONLINE`. The main process validates it again before
starting a Browser child and passes only `MYTV_APP_ENVIRONMENT` to the generic
runner. `ONLINE` keeps the normal production-mode flow. `PILOT` runs the fixed
trusted page bootstrap below after the app URL loads and before the first case
action, then waits for the reloaded app to be ready:

```js
gServerAAALink.setDomainAuthenUpdate("https://aaapilot1.mytv.vn/authen-ctl-v3", "https://aaapilot2.mytv.vn/authen-ctl-v3");
gServerAAALink.setDevMode(APP_MODE.UPDATE);
window.location = 'index.html';
```

`STAGE` runs `gServerAAALink.setDevMode(APP_MODE.ONLINE56)` followed by the
same `index.html` reload and readiness wait. LG runs do not use this setting.

If login displays the device-limit popup, the workflow monitors the asynchronous
transition to profile selection, remotely selects `Tiếp tục`, and waits for that
popup to close before continuing. The four supported dialog families
(`#dialog_confirm_v2`, `#dialog_alert_v2`, `#dialog_alert_full`, and
`#dialog_confirm_full`) report their active button with `.active`; normal
controls report focus with `.focused`.

When the account-login method opens MyTV's service-consent screen, the login
helper handles it with native remote focus: it moves up to
`#user-consent-popup-accept-all-checkbox`, moves down to
`#user-consent-popup-footer-checkbox`, activates both checkboxes, then focuses
`#user-consent-btn-submit` and confirms. Older deployments that do not show the
consent screen continue directly to the username keyboard.

Recognized `expectedResult` values are checked after all declared actions. Play
or Phát success wording waits for the configured player-check timeout (6 seconds
by default), then verifies a healthy playing player; pause wording
(`Pause player`, `Pause player/màn hình`, `Tạm dừng player thành công`) verifies
the opposite - a player that is open and paused - and reports the paused
position and whether the control bar is showing; service-screen
success wording verifies either left-menu/all-services navigation or the Home
“Thể loại” row route (`focus_row`, `focus_text`, `press_ok`) without requiring
the service name to appear on the destination screen. The same destination
check is used for a view-more poster and accepts either a row-content grid or a
service screen.

The retained terminal channel/movie/search workflows have separate post-Enter
activation-settle delays in `activateVerifiedTarget`. Those delays only give the
application time to render the destination screen; they do not replace or
perform the player-health check.

### Application update

`Settings > Application update` shows the running version and a
`Check for updates` button. The check reads a manifest from the API domain
already configured under `GUI > Connection` - no separate update host or URL
field - and reuses the same `X-FlowTest-Service-Token` header and API timeout:

```
GET {API_DOMAIN}/api/v1/app-updates/latest
```

The request carries no query parameters. The server always answers with the
same manifest describing the latest release and every build it ships; the app
compares the manifest `version` against its own, and only when the manifest is
newer does it pick the artifact matching its own platform and architecture and
show the update modal.

When the served version is not newer than the running build, a small toast
appears in the bottom corner (`Không có phiên bản mới`) and nothing else
happens. When it is newer, a modal shows the version, the release name, the
changelog, and `Cancel` / `Update`.

The server must answer with a manifest in this shape (a `data` wrapper is
accepted, `artifact` may replace `artifacts` for a single build):

```json
{
  "version": "1.1.0",
  "releaseName": "MyTV Auto Test 1.1.0",
  "changelog": ["Thêm mục Check for updates", "Sửa lỗi player khi seek"],
  "mandatory": false,
  "artifacts": [
    {
      "platform": "win32",
      "arch": "x64",
      "url": "http://172.16.240.254:30100/files/MyTV Auto Test Setup 1.1.0.exe",
      "fileName": "MyTV Auto Test Setup 1.1.0.exe",
      "size": 187695104,
      "sha256": "…64 hex characters…"
    },
    {
      "platform": "darwin",
      "arch": "arm64",
      "url": "http://172.16.240.254:30100/files/MyTV Auto Test-1.1.0-arm64-mac.zip",
      "size": 164626432,
      "sha256": "…64 hex characters…"
    }
  ]
}
```

Manifest rules the app enforces, so a published manifest that breaks one of
them is rejected rather than installed:

- `version` is compared numerically against the running build; a prerelease
  (`1.1.0-rc.1`) sorts below its release. Equal or older means no update.
- The app selects the artifact itself, so `artifacts` should list every build.
  An entry must match the running platform, and its `arch` must either match or
  be omitted (an entry naming the architecture wins over one that omits it).
  Windows artifacts must be the NSIS `.exe`; macOS artifacts must be the `.zip`.
  A manifest that is newer but ships no artifact for the running platform
  reports that instead of offering an update.
- `size` and a lowercase `sha256` are required. The download is rejected if it
  is longer than `size`, if the final length differs, or if the digest does not
  match - nothing is installed in those cases.
- The artifact `url` must use `http`/`https` **and its hostname must be the
  configured API domain's hostname** (the port may differ, so a separate file
  port on the same server is fine). This stops a spoofed manifest from pointing
  the installer at another host.
- `changelog` accepts an array or a newline-separated string; leading `-`, `*`,
  and `•` markers are stripped for display.

`Update` downloads the artifact into `app-updates/<sha256>/` under the Electron
`userData` directory, verifies it, and then installs:

- **Windows** runs the downloaded NSIS installer and quits the app.
- **macOS** extracts the `.zip` with `ditto`, then hands the bundle swap to a
  detached script that waits for the app to exit, keeps the old bundle as
  `.app.previous` until the new one is in place, restores it if the move fails,
  and reopens the app.

The install is refused while a test run is active or completed results are still
waiting to sync, because installing quits the app. Running from a source
checkout (`npm run app:dev`) never replaces anything: the verified download is
revealed in the file manager instead.

### Case execution contract

Explicit `actions` are the preferred and authoritative representation. The
initial action vocabulary is:

- `login`
- `open_home`
- `focus_row`
- `focus_row_first_item`
- `focus_text`
- `press_ok`
- `open_service`
- `open_search`
- `search_content`
- `play_content`
- `play_search_result`
- `play_row`
- `play_all_contents`
- `play_home_trailers`
- `player_seek`
- `player_toggle_play`
- `player_focus_related`
- `assert_screen`
- `press_back`
- `wait_for_ready`

`play_row` accepts a 1-based `rowIndex` or a `rowName`. An optional positive
`count` limits the run; when omitted, the Browser runner continues until the
selected carousel reaches its last reachable poster. Each poster is activated
through the remote Enter path, checked independently, and returned to the row
before the next poster is focused. A recognized playback/unsupported-device
dialog is recorded as that poster's failure and dismissed safely so the row
can continue. On Home, the single `homePage1` promotional row is excluded from
numeric counting, so public `rowIndex: 5` targets `homePage2_4_*`.

`npm run test:list:contract` covers this action's traversal loop against a
simulated list page and needs no live app.

The content noun in the description is descriptive only: `toàn bộ nội dung`,
`toàn bộ kênh`, `toàn bộ phim`, `toàn bộ poster`, and `toàn bộ short` all compile
to the same action, and the counted forms accept the same nouns.

`play_all_contents` plays every content poster of the content-list page opened
from a `Xem tất cả` poster. It is the multi-row counterpart of `play_row`: the
list page is a grid of rows, and playback follows the page's reading order -
left to right within a row, then down to the next row starting at its leftmost
poster. Pass a positive `count` to play only the first N posters in that order,
or a positive `rowCount` to play only the first N rows; the two are mutually
exclusive, and with neither the whole list is played. The action requires the
current route to be `specialModuleList`, `specialModuleListV2`, `shortHome`, or
`channel-list`, and fails closed anywhere else.

`channel-list` is a different widget: its rows and items use their own classes,
its ids are `item_<row>_<col>`, and focus is an `is_focus="1"` attribute rather
than the shared focus class. It is handled by a profile scoped to that route, so
the global focus contract - and therefore `play_row`, `play_content`,
`play_home_trailers` and the LG TV target - is unchanged. A channel carries no
name in the DOM, so it is reported by its channel number plus `content-id`, and
activation confirms focus from the grid's own marker before Enter, with one
guarded retry for the first item while the freshly opened page is still
settling. The channel list loads a whole category at once, so it has no
load-more. Because the other list pages detach rows that scroll out of view and calls its
load-more API as focus approaches the end of the grid, the runner steps with the
remote and re-reads the focused `<idName>_<row>_<col>` position instead of
collecting rows up front, retries a step that was dropped during a load-more
fetch, and treats the grid as finished only when a Down press no longer changes
rows. A view-more poster inside the list is stepped over without an Enter.
Per-poster evidence, failure handling, and the report table are the same as
`play_row`; `count`/`rowCount` are the only bound, with no implicit wall-clock
cutoff.

When `focus_text` immediately follows `focus_row` for Home `Thể loại`, it
scans the complete reachable service carousel, moving right and re-reading the
row until it finds the requested poster. It never falls back to a matching
left-menu label.

When `focus_text` immediately follows `focus_row` and its text is exactly
`Xem tất cả`, `Xem thêm`, or `View more` (accent-insensitive), it focuses the
row's trusted `.view_more[item_view_more="1"]` poster with remote horizontal
navigation. The poster may have a blank `content_name`; the marker is the
source of truth. If Enter opens a row grid or service screen, the action passes
only after a non-Home destination with visible content rows is observed. A
visible tooltip/toast or recognized no-data/error popup fails the action, and a
view-more label without a preceding `focus_row` fails closed rather than using
generic text/menu focus.

After any generic service activation (`open_service`, or `focus_row` →
`focus_text` → `press_ok` on Home `Thể loại`), the runner requires a non-Home
screen with visible content rows. A visible toast/tooltip or no-data/error
popup fails the action; an Enter press alone is not a successful service open.

`focus_row` requires a `rowName` and normally focuses its first visible item.
For a numbered poster, provide a positive 1-based `itemIndex`, for example
`{"action":"focus_row","rowName":"HTV","itemIndex":4}`. The helper uses
remote horizontal navigation to reach that position even when the poster is
initially outside the viewport.

Server responses should transpile `qaDescription` into explicit `actions`
before they reach the app. See [ACTION-COMPILER.md](ACTION-COMPILER.md) for the
grammar, normalization rules, output shapes, and failure behavior. If a case
still has no explicit actions, `test-case-compiler.js` provides the same
deterministic grammar as a migration fallback. Unsupported or ambiguous lines
fail with the case ID and original source line; it is not a general
natural-language executor.

Case login actions may contain literal test credentials because different
cases can use different accounts. Treat `testcased.json` as sensitive runtime
data and keep it out of commits when it contains private credentials. Passwords
are masked in the Electron action preview, and the main-process run log records
case metadata rather than action credentials. Playwright case attachments are
generated from the source case, so report folders also require appropriate
access control.

The local fixture remains available when no API folder has been downloaded.
Successful API responses are validated before an atomic, timestamped cache
replacement, and the generic executor uses the same action handlers for either
local or cached cases.

Playback actions use only content currently visible in the TV page's rows:

```json
{"action":"play_content","name":"VTV1 HD","type":"channel"}
{"action":"play_content","name":"Dune","type":"movie"}
{"action":"open_search"}
{"action":"search_content","name":"Căn phòng tử thần","type":"movie"}
{"action":"play_search_result","type":"movie"}
{"action":"play_row","rowIndex":2,"count":3}
{"action":"play_row","rowName":"Phim song song"}
{"action":"play_all_contents"}
{"action":"play_all_contents","count":10}
{"action":"play_all_contents","rowCount":3}
{"action":"play_home_trailers"}
{"action":"player_seek","direction":"forward","steps":5}
{"action":"player_seek","direction":"backward","steps":2}
{"action":"player_toggle_play"}
{"action":"player_focus_related"}
{"action":"player_focus_related","itemIndex":3}
```

`play_content` verifies the selected item is playing. `play_row` opens each
item, waits for playback, uses the shared adaptive player/detail-close helper to
return to the row, waits 1.5 seconds for the carousel to re-render, and
continues after individual failures. Its `rowIndex` is 1-based; omit `count` to
request all items. The row playback JSON/HTML report includes the name and
poster of each attempted item, including failed items. When failures occur, the
action error also lists them as `content ID - content name` entries.

`play_home_trailers` tests every distinct promotional trailer shown on Home. It
uses remote `Xem ngay` → player/Album-detail check → Back navigation so
returning Home lets the carousel advance. A healthy video is `playable`; an
Album detail screen with a visible content list is `album_opened`; otherwise the
item is `failed`. The local user report lists each trailer name, activation
status/type, and post-activation screenshot, including failed trailers. The
bounded run is large enough for the reported 16-trailer Home carousel and does
not cap the number of discovered trailers. This action is currently Browser-only because its trusted DOM contract uses Home's
`#promo-video-next` and trailer-title elements. It uses the same shared adaptive
player/detail-close helper as generic player checks and row playback; Home only
adds its Home-promo readiness predicate. The helper sends one remote Back at a
time, permits a second Back only when the first destination is not ready, and
dismisses a detected exit-confirmation popup without another close press.

### Player control

The VOD player answers the remote differently in each of its three screen
states, so the player actions read the state first instead of assuming one:

| State | Marker | Remote behaviour |
| --- | --- | --- |
| Detail | `#movie_leftmenu_wr` is on screen, playback runs behind it | Up/Down move between the detail buttons, OK activates the focused one, Back leaves the player |
| Control bar | `#new_player_controlbar` inside `#media_player_new` is shown | OK on `#player-button-play` toggles play/pause, Left/Right open and focus `#new-player-timeshift-bar`, Up reaches the button row, Down reaches the related-content row |
| Player | only the video is on screen | OK pauses and shows the control bar, Left/Right open the seek bar |

The state is read from geometry, not from classes: the app keeps the detail
panel mounted and slides it to `x=-1280`, and it keeps `focused` on
`#player-button-play` while the control bar is hidden. Only a full-screen video
counts as the player, so Home trailers and promo videos are never mistaken for
one.

`player_seek` seeks inside an open player. `direction` is `forward` (default) or
`backward`, and `steps` is the number of remote presses on the seek bar
(default 1, at most 60). One step is one press; the app owns the increment - the
seek bar advances in 10-second thumbnails at 1X and accelerates while presses
keep coming - so the action reports the measured start and end positions instead
of assuming a fixed jump. The first press is what opens the seek bar at the
current position. The action opens the player itself when the previous step only reached the
detail menu, waits for a player that is still opening, realigns focus onto
play/pause when it sits on the control-bar button row or the related-content
row, and verifies that the seek target - the middle thumbnail of the seek bar's
strip, which is the only position readout the app keeps in sync while seeking -
actually moved in the requested direction. A press that leaves the seek bar hidden was swallowed by a screen
transition and moved nothing, so the opening press is retried instead of
spending the remaining steps blindly.

`player_focus_related` opens the related-content row the player carries under
its control bar and focuses one of its posters (`itemIndex`, 1-based, default
1). Down from the player opens the control bar and a second Down swaps that bar
for the row - the bar auto-hides after a few idle seconds, so the action only
waits until something opened and delivers the next Down while the bar is still
up. Opening the row pauses the content playing behind it; `press_ok` then starts
the focused poster's content. Items are `#relativeContentPopup<n>_<row>_<col>`,
so the action reads its position from the focused id and walks left/right to the
requested column, failing closed when the row ends first. In a description,
`Chọn/Mở/Focus ... liên quan ...` only focuses the poster, while
`Phát/Play/Chơi ... liên quan ...` is focus plus the OK that starts it - and
that OK is dropped when the next line already spells an OK press, so the poster
is never activated twice. The app swaps the
content in place without changing the route, so OK on a related poster also
requires the media source to actually change - the same media playing again
means the poster never opened.

A seek stays pending until OK commits it. Inside the player, `press_ok` means
"commit whatever is focused", and what that must produce is derived from the
state that owns the screen rather than assumed: a pending seek, a related poster,
or a detail play button must leave the content playing, OK on a playing player
must pause it and show the control bar, and OK on the play/pause button must
flip the paused state. Focus on any other control-bar button opens that control, so nothing
about playback is required of it.
`player_toggle_play` presses OK on play/pause and verifies the paused state
flipped. The runner keeps the player open across the boundary between a seek and
the OK press that commits it, and across the last action when the
`expectedResult` is a player or paused-player check.

`npm run test:player:contract` covers the state readers and the seek loop
against a simulated player DOM and needs no live app. These actions are
Browser-only: their contract is the app's player DOM.

search_content uses the on-screen virtual keyboard, activates #callSearch,
waits three seconds, then focuses the best fuzzy match in the visible
search-result rows. play_search_result plays that focused result.

Reports created by the packaged app are written to the Electron user-data
folder, not inside the application bundle.

## Legacy Terminal Regression Specs

The older terminal specs remain available for helper and navigation regression
coverage. They retain their non-case-specific environment options and should be
run with the login spec first when a shared authenticated session is required.

Interactive terminal runner:

```bash
npm run test:headed
```

Direct legacy spec examples:

```bash
npx playwright test tests/login-mytv.spec.js tests/play-channel-mytv.spec.js --project=chromium
npx playwright test tests/login-mytv.spec.js tests/play-movie-mytv.spec.js --project=chromium
npx playwright test tests/login-mytv.spec.js tests/search-content-mytv.spec.js --project=chromium
npx playwright test tests/login-mytv.spec.js tests/open-setting-mytv.spec.js --project=chromium
```

The retained legacy options are `APP_URL`, `USERNAME`, `PASSWORD`,
`CHANNEL_NAME`, `CHANNEL_PLAY_MODE`, `CHANNEL_CATE_NAME`,
`CHANNEL_CATE_LIMIT`, `MOVIE_PLAY_MODE`, `MOVIE_NAME`, `MOVIE_CATE_NAME`,
`MOVIE_CATE_LIMIT`, and `SEARCH_KEYWORD`. These options are consumed by the
legacy terminal specs only; the Electron case browser uses the selected case's
actions instead.

Run the pure local tests with:

```bash
npm run test:unit
```

## Test Behavior Notes

- The suite uses `workers: 1` because the shared fixture intentionally reuses
  one browser session.
- MyTV interaction is keyboard-only: Arrow keys navigate, Enter activates, and
  Backspace/Escape goes back.
- Text input uses the app's virtual keyboard character by character, not normal
  browser typing.
- Vietnamese matching ignores accents and case, maps `đ` to `d`, and supports
  partial token matches.
- Readiness checks and action failures preserve screenshots, focused-element
  state, popup text, and other existing artifacts where available.

## Build the Desktop App

Browser binaries are not packaged. Each desktop user configures the
project-pinned Chromium after installation through **Settings → SDK
configuration → Browser configuration**.

### Build commands

The target platform is selected by the command. Unless an architecture is
specified explicitly, electron-builder uses the current host architecture.

Build the macOS zip (ARM64 on Apple Silicon, x64 on Intel macOS):

```bash
npm run app:build:mac
```

Build a DMG when local signing and disk-image tooling are available:

```bash
npm run app:build:mac:dmg
```

Build the Windows installer using the current host architecture:

```bash
npm install
npm run app:build:win
```

On Apple Silicon, `npm run app:build:win` produces a Windows ARM64 installer.
To build a Windows x64 installer explicitly, use:

```bash
npm run app:build:win -- --x64
```

In summary:

| Command | Output |
| --- | --- |
| `npm run app:build` | Artifacts for the host platform and architecture |
| `npm run app:build:mac` | macOS ZIP for the host architecture |
| `npm run app:build:mac:dmg` | macOS DMG for the host architecture |
| `npm run app:build:win` | Windows NSIS installer for the host architecture |
| `npm run app:build:win -- --x64` | Windows x64 NSIS installer |

Every argument after `--` is passed straight through to electron-builder, so
`npx electron-builder …` still works but skips the artifact report below.

The app obtains the host-appropriate reviewed Chromium only through the
post-install Browser configuration flow.

### Build artifact SHA-256

Each `app:build*` command runs electron-builder through `scripts/build-app.js`,
which prints the size and SHA-256 of every installer that build produced,
followed by a paste-ready manifest fragment for the update endpoint:

```
Build artifacts for version 1.0.9:

  MyTV Auto Test Setup 1.0.9.exe
    platform  win32
    arch      arm64
    size      104651931 bytes (99.8 MB)
    sha256    e2f7078ea2d2f85cde0a0159ae3dad03810b340bf3be8dbb686f1870b64b4edc

Manifest entries for GET {API_DOMAIN}/api/v1/app-updates/latest
(replace REPLACE_WITH_DOWNLOAD_BASE_URL with a download base URL on the API domain's host):

{
  "version": "1.0.9",
  "artifacts": [
    {
      "platform": "win32",
      "arch": "arm64",
      "url": "REPLACE_WITH_DOWNLOAD_BASE_URL/MyTV Auto Test Setup 1.0.9.exe",
      "fileName": "MyTV Auto Test Setup 1.0.9.exe",
      "size": 104651931,
      "sha256": "e2f7078ea2d2f85cde0a0159ae3dad03810b340bf3be8dbb686f1870b64b4edc"
    }
  ]
}
```

Fill in `url` and the `changelog`/`releaseName` fields, then serve the result
from the update endpoint - the digest and size are exactly what the app verifies
before installing, so a stale value makes the update fail rather than install
the wrong file.

Notes on the report:

- Only files this build created or rewrote are listed, so older releases left in
  `dist/` are never re-reported. Block maps and builder metadata are skipped.
- The architecture is read from electron-builder's own build log, not from the
  file name. electron-builder omits the architecture from the file name when it
  builds a single architecture, so `MyTV Auto Test Setup 1.0.9.exe` is the
  ARM64 installer on an Apple Silicon host and the x64 installer elsewhere.
  If the architecture ever has to be assumed from the build machine, the report
  says so on that line.
- A universal macOS build is reported without an `arch`, which lets one manifest
  entry serve both architectures.

## Browser Configuration Notes

Electron resolves Playwright Chromium from its private per-user storage. A
missing browser disables Browser test runs and offers **Configure Browser**;
the setup screen reviews first and installs only after a separate confirmation.
No Chromium archive is included in macOS or Windows artifacts. The
`npm run browsers:install` command remains only for legacy terminal development
and is not used by the Electron app.

Browser case runs use the selected 1280x720 or 1920x1080 logical Playwright
viewport (1280x720 by default). Both surfaces are 16:9; the maximized Electron
workspace scales them only inside the six smaller holders and does not change
the page's logical viewport or carousel behavior.

## Reports and Artifacts

Terminal runs use the Playwright HTML reporter configured in
`playwright.config.js`. Failure artifacts can include screenshots, popup text,
player state, focus state, and search or movie candidate details. Electron runs
show a compact test report from `userData/user-report/test-report.html`,
whose `Details` rows show the expected result and final viewport screenshot for
passed tests. `play_row` details also show every tested poster, content ID,
pass/fail result, and player/error screenshot. Each Browser case's full
Playwright HTML report and test-results are isolated under its
`userData/browser-runs/<batchId>/...` directory for debugging; the compact
report remains the stable user-facing summary.

Interactive Browser preview is supported for exactly one selected Browser case;
use Live or None when running multiple cases. LG selection remains a separately
confirmed serial workflow and is unaffected by Browser resolution or
simultaneous-device settings.

## Common Issues

### Electron binary failed to install

Reinstall dependencies:

```bash
npm install
```

### Playwright cannot find a browser

Open **Settings → SDK configuration → Browser configuration**, select **Auto
configure**, then confirm **Install reviewed Chromium**. The app never falls
back to a system browser.

### macOS blocks the app

Unsigned internal builds may be blocked by Gatekeeper. Open the app from
Finder with right-click > Open, or configure signing and notarization for
distribution.

### DMG creation fails

Use the zip target while `hdiutil`, signing, and notarization setup are being
stabilized:

```bash
npm run app:build:mac
```

## LG device setup status

The LG sidebar uses a device list with Add/Edit dialog. It accepts only device
name, host, and passphrase; saved connection values stay encrypted in app-owned
storage and are never returned to the renderer. **Validate and save** is
intentionally unavailable until a separately approved live-TV preflight; it
does not currently contact or alter a TV.

After a device is already saved and its webOS CLI target is already registered,
**Check connection** performs a separate read-only identity and MyTV-app
inventory check. It uses only a verified user-imported LG CLI or an explicitly
configured Advanced CLI; it does not require Appium or ChromeDriver, and never
falls back to a system CLI or changes the TV.

### LG Run Selected

LG uses the same folder, case selection, **Run Selected**, report, and result
sync workflow as Browser. Select a saved LG device, ensure the local SDK review
shows the required toolchain and verified compatibility profile, then select
one or more cases. **Run Selected** remains disabled while those local
prerequisites are unavailable and provides a **Configure SDK** shortcut.

Starting an LG batch always shows a single confirmation for the selected cases.
The confirmation explains that the run can foreground MyTV, reset only MyTV
local storage, send native remote input, enter the selected case login through
MyTV's virtual keyboard, and perform trusted logout cleanup. After confirmation
the main process performs a new read-only identity and installed-app preflight;
failure at that point sends no remote input and starts no Appium session.

The workspace displays fixed redacted progress and genuine TV frames when
available. Business failures continue to the next selected case. Technical
failures restart the current case from a clean MyTV-only reset up to three
times, then require **Keep retrying** or **Stop**; pairing always requires a
manual operator decision. Completed API-loaded cases use the same result-sync
shape as Browser. No TV artifacts are sent to the API.

This implementation has local contract coverage, but a real GUI LG batch is
not a routine smoke test: it needs fresh explicit approval and the live-TV
preflight documented in `docs/real-tv-appium/poc-runbook.md`. It never deploys,
uninstalls, pairs automatically, or changes a TV app outside an approved run's
MyTV-only local-storage reset.
