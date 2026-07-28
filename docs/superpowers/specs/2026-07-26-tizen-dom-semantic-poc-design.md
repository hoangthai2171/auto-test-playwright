# Samsung Tizen DOM Semantic POC Design

## Goal

Add an explicit, Samsung-only command-line path for the remaining approved
Phase 1 semantic checks: dedicated-account login, remote-key search, playback
observation, and trusted logout. It must function when genuine visual capture
is unavailable, without creating an image or implying visual support.

## Scope and safety boundary

- The only app ID remains `PP2MTMRMs8.MyTV`; the production app ID remains
  permanently rejected.
- The semantic path is opt-in through a search title and a constrained content
  type (`channel`, `movie`, or `content`). It also requires the existing
  `--login-from-env --verify-logout` flags, so it cannot run anonymously or
  omit cleanup.
- Login and search input use the existing virtual-keyboard, one-character
  remote-key primitive. DOM reads select targets and observe results; they
  never activate an element directly.
- Evidence remains local and redacted. It records no PNG, no synthetic visual
  substitute, no credentials, and no profile information. Every semantic run
  records `visualCapture: unavailable` when the screenshot gate is skipped.
- This is a Samsung Tizen command-line POC only. It changes neither Electron
  nor LG behavior and cannot claim visual-regression coverage, Samsung-wide
  support, or a complete screenshot-gated POC.

## Design

`scripts/real-tv-appium/tizen-poc-semantic.js` is a small adapter beside the
existing login adapter. It exposes pure request validation and a remote-only
semantic workflow. The workflow creates the existing WebDriver-to-real-remote
page adapter, opens the search menu through real arrows and Enter, enters a
normalized query through the virtual keyboard, selects the best visible result
by redacted DOM metadata, and presses Enter to start it.

The adapter waits for a visible, healthy `video` element. It samples DOM media
state before and after a short playback interval, requiring no visible error
popup, a non-paused/non-ended player with usable media data, and either an
advancing media clock or rendered video dimensions. A failure includes only
redacted DOM/player diagnostics; it never calls a screenshot endpoint.

`tizen-poc.js` parses the opt-in flags, rejects an incomplete semantic request
before a session is opened, and invokes the adapter only after the existing
dedicated-account login succeeds. It writes semantic search and playback facts
to the manifest, then keeps the existing trusted logout and normal cleanup.

## Validation

Focused Node tests first prove that a semantic request is complete only with
both fields and the required account/logout flags, that result selection
prefers a matching visible candidate, and that the remote adapter uses real
keys. The full unit suite, Node syntax checks, and `git diff --check` validate
the local change. No physical-TV search or playback run is part of this code
preparation; any later live command needs an operator-provided known-playable
title and runtime-only credentials.
