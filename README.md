# No Agenda? No Meeting (NANM)

Cross-browser MV3 extension that polls Google Calendar, detects empty-agenda invites, and lets the user fire a one-click nudge to the organizer via a pre-filled Gmail compose tab.

POC scope: Chrome + Edge, single user per install, no Wooga-hosted backend.

## Repo layout

- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design specs
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — implementation plans
- [`Style-guide.md`](Style-guide.md) — visual reference, informs the popup design tokens
- `extension/` — extension source (created in plan Task 1)

## Status

Pivoted from an SHS-hosted Express + SQLite microservice to a browser extension. See:

- [Revised design](docs/superpowers/specs/2026-05-11-nanm-browser-extension-design.md)
- [Implementation plan](docs/superpowers/plans/2026-05-11-nanm-browser-extension.md)
- [Confluence: design options for Manne](https://woogagmbh.atlassian.net/wiki/spaces/AVS/pages/5392039946/)

The legacy SHS POC code has been removed. Prior commits on `main` contain the full SHS implementation if archaeology is ever needed.
