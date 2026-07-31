# LG Compatibility Catalog Design

## Purpose

Let an LG operator refresh a maintainer-reviewed ChromeDriver compatibility
catalog from the existing API domain. The app can then select and install the
correct ChromeDriver automatically for a saved LG device whose exact model and
firmware are listed. The catalog does not use a MyTV app ID, so a future
package-installation feature can support different application IDs independently.

Maintain a project-owned `DEVICE-COMPATIBILITY.json` as the source catalog.
Maintainers validate a new device/driver combination through the project-only
`device-compatibility-check` skill, then explicitly record a successful entry
in that file. Publishing the file to the API remains a maintainer action outside
the skill and desktop app.

## Normal-user flow

Settings → SDK configuration gains a **Compatibility catalog** card. It shows
whether a bundled or locally refreshed catalog is available, the local time of
the last successful refresh, and an **Update compatibility catalog** button.

The button is the only network action for this feature. It sends an authenticated
`GET /api/v1/device-compatibility` request to the existing configured API domain,
reusing the existing Authorization setting. It adds no Settings fields and no
new credentials. The endpoint returns the raw `DEVICE-COMPATIBILITY.json` body.

The main process validates the complete response before atomically replacing its
per-user cached catalog. Invalid data, a network failure, or an unavailable API
leaves the prior valid cached catalog untouched. The renderer receives only a
fixed outcome and local refresh time; it never receives the Authorization value,
paths, raw response, hosts, or hashes.

Compatibility resolution prefers the locally refreshed catalog and otherwise
uses the bundled project catalog. It matches only exact `model` and `firmware`
facts from the selected saved device. A match authorizes only the current
desktop platform's pinned ChromeDriver record. No match returns
`COMPATIBILITY_PROFILE_UNVERIFIED`, downloads nothing, and directs the user to
ask a maintainer to add compatibility support. Users never select a ChromeDriver
version or archive.

## Catalog format

`DEVICE-COMPATIBILITY.json` is a JSON object with a `profiles` array. Every
profile has one non-empty `model`, one non-empty `firmware`, and a `chromedriver`
object containing a non-empty version plus both `darwin` and `win32` artifacts.
Each artifact has an HTTPS official vendor URL, archive filename, and a lowercase
64-character SHA-256 value. The stored catalog rejects duplicate
model-and-firmware pairs. When a maintainer validates a candidate for an
existing pair, the candidate is presented as a replacement and requires a
separate explicit **Update this compatibility** confirmation before it replaces
the existing profile.

The catalog contains no credentials, device labels, IP addresses, pairing data,
screenshots, or archive paths. The app accepts only approved ChromeDriver vendor
hosts, downloads only the platform-specific artifact selected by a matching
profile, rejects redirects, verifies the SHA-256 before extraction, and verifies
the resulting executable version before activation.

The packaged application includes the project catalog as its baseline. A local
cache belongs in per-user application storage and is never written into the
project checkout. The root project file remains the latest maintainer-reviewed
list to upload to the API.

## Maintainer validation skill

Create `.codex/skills/device-compatibility-check/SKILL.md` as a project-only
skill. It applies when a maintainer asks to validate a new LG device and
ChromeDriver combination or to add a catalog record.

The skill must:

1. Read the existing project catalog and identify whether the candidate is a
   new model-and-firmware entry or a proposed replacement for an existing pair.
2. Require candidate model, firmware, and audited macOS and Windows artifact
   records.
3. Validate the candidate schema and official HTTPS artifact URLs before live
   work begins.
4. Require a fresh explicit live-TV approval and the existing LG preflight
   before it reads or contacts a TV.
5. Read the selected device's identity facts and require an exact match with the
   candidate model and firmware.
6. Use only the current host platform's candidate ChromeDriver in isolated
   temporary managed storage, leaving the active managed toolchain unchanged.
7. Run the approved LG product-gate validation without deployment, uninstall,
   reset outside MyTV-only approved reset behavior, `appium:rcMode "js"`, or
   `webos: clearApp`.
8. Present a redacted result. On failure, preserve the project catalog unchanged.
9. On success, require a final explicit **Record this compatibility**
   confirmation before appending a new fully audited candidate, or a final
   explicit **Update this compatibility** confirmation before replacing an
   existing matching profile in `DEVICE-COMPATIBILITY.json`.

The skill never uploads the file, stores connection secrets, records pairing
data, or converts an unapproved device into a compatibility profile.

## Components

- `DEVICE-COMPATIBILITY.json`: bundled maintainer-owned baseline catalog.
- Catalog service: validates the bundled, cached, and downloaded catalog; reads
  and atomically updates the per-user cache.
- SDK IPC: exposes redacted catalog status and one explicit refresh operation.
- Managed installer: obtains ChromeDriver solely from the selected matching
  catalog artifact; the existing no-profile behavior remains unchanged.
- SDK renderer: shows the compact catalog status/card and fixed safe refresh
  outcomes.
- `device-compatibility-check` skill: a maintainer-only guided validation and
  explicit record workflow.

## Failure behavior

- No configured API domain or Authorization value: report a fixed catalog-refresh
  unavailable status; do not make a request.
- HTTP/network/schema/duplicate/vendor-host failure: retain the last valid
  catalog and report a fixed failure status without response details.
- Selected device facts are absent or not listed: return
  `COMPATIBILITY_PROFILE_UNVERIFIED`; do not install ChromeDriver.
- Candidate driver download, hash, extraction, executable-version, or product
  gate failure: retain both the active managed toolchain and project catalog.

## Tests and verification

Unit coverage must prove catalog schema validation, cache atomicity, exact
model-and-firmware matching, platform artifact selection, cache fallback,
redacted IPC, Authorization forwarding without renderer exposure, and all
failure paths preserving the prior cache/toolchain. Renderer tests cover the
catalog card and fixed outcomes. The project skill is validated with its skill
validator. No live-TV validation is run while implementing this feature; a
future maintainer invocation requires fresh approval and its own preflight.
