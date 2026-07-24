# Internal TV-Lab Lease Service

## Future feature — not in the first release

No always-on internal host is currently available. This document is retained as
the approved future design; do not implement it or make it a v1 runtime
dependency. The first release uses a clearly labelled manual shared-device
acknowledgement described in [architecture.md](architecture.md).

## Future decision

The existing MyTV backend cannot add TV-reservation endpoints. Deploy a small,
separate internal service named `mytv-tv-lab-lease`.

It is a coordination service only:

- It does **not** install an app, launch Appium, hold vendor private keys, or
  communicate with a TV.
- It does **not** handle test-case data, screenshots, credentials, or reports.
- It only grants one authenticated laptop/user a short exclusive lease for a
  registered shared TV.

This keeps physical TV control local to each engineer's laptop while preventing
concurrent control of the same TV.

## Recommended future deployment

```text
Engineer laptop ── HTTPS/VPN ──> TV-Lab Lease Service ──> SQLite database
        │
        └── local LAN ──> Appium + Samsung/LG TV
```

- Run one Node.js/CommonJS service on an always-on internal VM, office server,
  or managed lab mini-PC.
- Reach it only on the corporate LAN or approved VPN. Do not expose it to the
  public internet.
- Put it behind the organization's existing HTTPS reverse proxy if available;
  otherwise provision TLS directly before multi-user use.
- Use SQLite in WAL mode for v1. One small service with a few leases per minute
  does not need a separate database server, and SQLite transactions provide
  atomic acquisition. Back up the database daily.
- Move to Postgres only if the organization needs high availability, multiple
  service replicas, or audit retention beyond the initial lab.

The service host does not need a connection to each TV. Each laptop needs the
same trusted LAN/VPN access required by the vendor developer tools.

## API

All endpoints require HTTPS and an authenticated operator token except health.
Never return raw authentication tokens in logs or user-visible diagnostics.

```text
GET    /health
GET    /v1/devices
POST   /v1/devices/:deviceId/leases
POST   /v1/leases/:leaseId/renew
DELETE /v1/leases/:leaseId
GET    /v1/audit?deviceId=...              admin only
POST   /v1/devices                         admin only
PATCH  /v1/devices/:deviceId               admin only
POST   /v1/devices/:deviceId/force-release admin only
```

### Acquire lease

`POST /v1/devices/lg-lab-01/leases`

The authenticated identity supplies the holder name; the client must not be
allowed to impersonate another person.

```json
{
  "client": {"hostName": "alice-macbook", "appVersion": "1.4.0"},
  "requestedDurationSeconds": 120
}
```

Successful response (`201`):

```json
{
  "leaseId": "lease_01J...",
  "deviceId": "lg-lab-01",
  "expiresAt": "2026-07-24T10:15:00Z",
  "renewAfterSeconds": 30,
  "leaseToken": "opaque-random-secret"
}
```

Conflict (`409`):

```json
{
  "code": "device_in_use",
  "holderDisplayName": "Alice Nguyen",
  "expiresAt": "2026-07-24T10:15:00Z"
}
```

`leaseToken` is returned only once, kept in Electron main-process memory, and
sent in an authorization header for renew/release. Persist a hash of it in the
database, never the token itself.

### Renew and release

- Renew every 30 seconds for a 120-second lease.
- Return a new `expiresAt` on every successful renew.
- Release is idempotent: completing a run twice must not produce an error.
- On two consecutive renew failures, the Electron main process stops further TV
  input, marks the run as an infrastructure failure, and attempts cleanup. This
  protects the next holder from a still-running prior test.
- The service deletes/ignores expired leases before each acquisition. A crashed
  laptop therefore blocks a TV for at most the configured lease duration.

## Data model

```text
devices
  id (primary key), label, platform, shared, enabled, maintenance_reason,
  created_at, updated_at

leases
  id (primary key), device_id (unique while active), user_id,
  holder_display_name, token_hash, client_host, issued_at, expires_at,
  released_at

audit_events
  id, timestamp, actor_user_id, device_id, lease_id, event_type, metadata_json
```

Lease acquisition runs in one database transaction: remove expired lease for
the device, reject an active lease, then insert the new lease. The service—not
the Electron client—is the concurrency authority.

## Authentication and roles

Choose the first option already supported by internal infrastructure:

1. Existing corporate OIDC/SSO through an authenticated reverse proxy.
2. The service's own operator accounts with securely hashed personal API tokens.

Never use one shared API key: it removes holder identity and auditability.

Roles:

- **operator** — list, acquire, renew, release.
- **admin** — register/disable devices, force-release, inspect audit events.

Store an operator's token in Electron `safeStorage` on their laptop. The
renderer never reads it; the Electron main process attaches it to lease-service
requests.

## Electron integration

1. On launch, request device availability from `GET /v1/devices`.
2. When the user selects a shared TV, show availability and an explicit
   **Reserve** button.
3. On Run, main process checks the local lock, acquires/validates a current
   remote lease, then starts Appium.
4. Main process emits redacted lease status to the renderer for display.
5. Main process renews while a run is active and releases in every
   completion/stop/error path.
6. If the service is unavailable, shared devices are unavailable; do not offer a
   “run anyway” bypass.

Private devices may be local-only, but using the service for every device gives
the operator one consistent availability view and is preferable once deployed.

## Operational checklist

- [ ] Name an owner and a backup owner for the service and database backup.
- [ ] Choose internal VM/server, HTTPS endpoint, and LAN/VPN access route.
- [ ] Choose SSO/reverse-proxy authentication or per-user token provisioning.
- [ ] Register pilot Samsung and LG devices with `shared`/`private` state.
- [ ] Test acquire conflict, renew, release, client crash expiry, admin force
  release, device maintenance state, and audit trail.
- [ ] Add monitoring for `/health`, database backup age, failed renewals, and
  expired/crash-recovered leases.

## Explicitly rejected alternatives

- Asking engineers to warn each other.
- A shared spreadsheet, Slack status, or physical paper sign-out sheet.
- A lock file on one laptop or network share.
- Relying on Samsung Developer Mode's configured host IP.
- Letting an Electron renderer directly decide that a lease is valid.
