# Revised Design: No Agenda? No Meeting — Browser Extension

**Date:** 2026-05-11
**Status:** Draft — supersedes the SHS microservice design at Confluence page 5338267660
**Author:** Rudi
**Motivation:** Manne flagged that a Wooga-hosted service holding OAuth credentials for many employees has an unacceptable blast radius. A compromise of the host would expose every connected user's Gmail/Calendar. Moving the entire system into the user's browser eliminates the centralised credential store and the service we would otherwise have to harden, audit, and operate.

## Summary

Cross-browser WebExtension (MV3). Runs entirely on the user's machine. No Wooga-hosted backend, no server-side credentials, no SHS deployment. A background service worker polls the user's Google Calendar every 15 minutes via `chrome.alarms`, detects empty-agenda invites, fires a desktop notification, and on click opens a Gmail compose tab pre-filled with a nudge to the organizer. OAuth tokens are minted and stored entirely on the user's device.

## Deployment target

**Local browser extension.** Not SHS, not RunPod, not FAL.

- POC distribution: unpacked dev install for Rudi and Lenka.
- Lenka rollout: zipped artifact with a 5-minute screen-share walkthrough, or an unlisted Chrome Web Store entry.
- Future org rollout: Workspace admin force-install via Chrome Browser Cloud Management (covers Chrome and Edge from the same artifact).
- Cross-browser by default: Chrome, Edge, and Firefox consume the same MV3 manifest. The Chrome and Firefox `browser.*` API differences are bridged with `webextension-polyfill`.

## Architecture

Three modules, same shape as the previous SHS design, but native to the extension runtime:

1. **Calendar adapter.** Uses `fetch` against the Google Calendar REST API (`/calendar/v3/calendars/primary/events`) on a 15-minute `chrome.alarms` cadence. Replaces the `googleapis` Node SDK and `src/poller.ts`. **Polling pattern: incremental sync via `syncToken`** (Google's documented best practice for change polling). First request omits `syncToken` to fetch a small initial window and capture `nextSyncToken`; subsequent requests pass `syncToken` and receive only deltas. On HTTP 410 from Google (token invalidated), fall back to a full resync and store the new `nextSyncToken`. Per-user quota is trivial at 4 requests/hour.
2. **Detector.** Pure function, ports directly from `src/detector.ts`. Empty or whitespace-only `description` flags the event. Same exemptions as before: non-first recurring instances, invites organized by the user.
3. **Dispatcher.** On a flagged event, fires `chrome.notifications.create()` with the event title and organizer. **Primary action: clicking the notification body itself** opens `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…` in a new tab, with the draft text URL-encoded. A secondary **Skip** button marks the event handled without opening compose. **macOS caveat:** native macOS notifications hide extension action buttons behind a "More" hover menu, so we cannot rely on prominent button display. The design accommodates this by making the body click the primary path — Skip is the only button and is accessed via the More menu on macOS, directly on Windows/Linux. Replaces nodemailer and the MJML templating.

**State.**
- `chrome.storage.local` for the set of handled event IDs. Replaces SQLite.
- `chrome.storage.local` for the OAuth refresh token.
- `chrome.storage.session` for the short-lived access token.

**Auth.** OAuth 2.0 PKCE via `browser.identity.launchWebAuthFlow`. Scope: `calendar.readonly` only. Token never touches any server we own. The redirect URL is resolved at runtime via `browser.identity.getRedirectURL()` — different browsers use different patterns (`<id>.chromiumapp.org` in Chrome/Edge, an extension-specific scheme in Firefox), so the Google OAuth client must have **both** redirect URIs registered.

**OAuth client type (decided): "Web application," not "Chrome extension."** Google's "Chrome extension" client type only supports the Chrome-only `chrome.identity.getAuthToken()` flow and does not accept `chromiumapp.org` redirect URIs. For `launchWebAuthFlow` (which we need for cross-browser support) we register a "Web application" client in the Wooga GCP project with the `chromiumapp.org` redirect URI(s) as Authorized redirect URIs.

**OAuth consent screen: User type = Internal.** `calendar.readonly` is classified by Google as a **sensitive scope**, which normally requires full OAuth app verification (multi-week process). Setting the consent screen User type to **Internal** in the Wooga GCP project waives this verification entirely for sensitive and restricted scopes, because the app is restricted to users within the Wooga Workspace domain. This is the supported and documented path; no exception or special approval is needed. (Source: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification.)

**Refresh token durability.** With User type = Internal (or any app in Production publishing status), refresh tokens do not expire on a fixed schedule. The 7-day expiry only applies to apps in "Testing" status with External user type. The only practical invalidation paths for our setup are: (a) user revokes access in their Google Account, (b) refresh token unused for 6 months. Neither matters for a daily-use tool. The extension can store and rely on the refresh token indefinitely.

**Service worker lifecycle.** Alarms can be cleared on browser restart, so the service worker re-creates the 15-minute alarm at the top of its lifecycle on every startup. All `chrome.alarms.onAlarm` listeners are registered synchronously at the top level of the worker script, so a cold-wake from an alarm fires correctly. As a defensive measure against the documented "alarms enter a stuck state" failure mode, the worker also performs a self-healing check on every cold-start: if the expected alarm is missing from `chrome.alarms.getAll()`, it re-creates it.

**Polling cadence reality.** Chrome's `chrome.alarms` minimum is 30 seconds (since Chrome 120), but Chrome may delay alarm fires under load — anecdotally up to 30 minutes beyond the scheduled time. For a 15-minute target cadence this means worst-case nudge latency of roughly 45 minutes. Acceptable for the POC; we do not engineer around it.

## User flow

**Setup, once per user:**
1. Install extension (unpacked dev install for POC; Workspace admin push later).
2. Click the toolbar icon → "Connect your calendar" → Google consent screen → done.
3. Confirmation: "You're set. We'll nudge you when an invite arrives without an agenda."

**Steady state:**
1. A new invite lands without an agenda.
2. Within 15 minutes the service worker wakes, polls, and fires a desktop notification: "No agenda: '<event title>' from <organizer>. Nudge?" with **Send** and **Skip** buttons.
3. User clicks **Send** → a new Gmail compose tab opens, pre-filled to the organizer with the draft text.
4. User reviews, sends. (Reply is not threaded on the invite, accepted tradeoff for POC.)

## What carries over from the current POC code

- `src/detector.ts` — pure function, ports as-is.
- The detector test suite.
- The hardcoded draft template strings.
- The product concept and demo script.

## What gets thrown away

- Express server, routes, cookie sessions (`src/routes.ts`, `src/google-auth.ts`, `src/action-token.ts`).
- SQLite and `better-sqlite3` (`src/db.ts`).
- nodemailer and MJML templates (`src/email-template.ts`).
- Dockerfile and the SHS deployment plan.
- Server-side polling (`src/poller.ts`).

## Scope for POC

- **Chrome and Edge only**, from the same MV3 artifact. Firefox dropped from POC scope: Firefox's MV3 background model uses event pages, not Chromium-style service workers, so non-trivial divergence applies despite the API polyfill. Revisit Firefox for MVP if there is demand.
- `calendar.readonly` only.
- Empty-description detection, no LLM.
- One hardcoded draft template.
- Desktop notifications and Gmail compose URL.
- Handled-event memory in `chrome.storage.local`.
- Unpacked dev install.

## Out of scope for POC

- Firefox and Safari support entirely (Firefox revisited for MVP, Safari deferred indefinitely).
- Calendar push notifications via `events.watch` — requires an HTTPS callback endpoint, which is incompatible with a server-less extension. Polling stays as the only mechanism.
- Gmail API write scope (threaded replies stay unsupported).
- Chrome Web Store and Workspace Marketplace listings.
- LLM agenda detection.
- Slack notifications.
- Multi-user infra (each user installs their own copy).
- **Content script in `calendar.google.com`** for in-page nudge UI. Considered for MVP, defer to keep POC simple.

## Success criterion

Rudi creates a test invite to himself with no description. Within 15 minutes, a desktop notification fires. He clicks **Send** → a Gmail compose tab opens with the pre-filled nudge addressed to himself. He sends. That is the Lenka demo.

## Prior art note

No existing browser extension or Workspace add-on solves this specific shape (agenda-absence detection + organizer nudge). Closest neighbours — Checker Plus, Reminders for GCalendar, Talking Calendar Reminder, Calendar Reminders — are all generic time-based reminder tools. We are not competing with an existing tool, and there is no fork to shortcut from. This is a small positive (novel niche) and a small negative (no battle-tested pattern to copy).

## Open items

- **GCP project ownership:** the OAuth client and consent screen must live in a GCP project **owned by the Wooga Workspace organization** for the Internal user type exemption to apply. Confirm with Manne which project to use, or create a new one.
- **Redirect URIs:** register both Chrome/Edge (`<id>.chromiumapp.org`) and Firefox redirect URIs on the OAuth client.
- **Distribution for Lenka:** unpacked + screen-share, or unlisted Web Store entry? Recommend unpacked for POC speed.
- **Branding:** name and icon pulled from existing `Style-guide.md`.
- **Manne sign-off:** confirm the "no Wooga-hosted credentials, no Wooga-hosted service, Internal-user-type Workspace OAuth" framing meets his security bar.

## Timeline

3 to 5 focused days, down from 1 to 1.5 weeks for the SHS version:

- Manifest, service worker skeleton, OAuth PKCE flow: ~1 day
- Port detector and Calendar REST fetch: ~0.5 day
- Notification and Gmail compose URL wiring: ~0.5 day
- Handled-event storage and re-auth UX: ~0.5 day
- Cross-browser smoke test (Chrome and Edge) and Lenka demo prep: ~1 day

## Next steps

1. Rudi confirms OAuth client decision (new PKCE client vs reuse).
2. Manne sign-off on the security framing.
3. Sean: any UX feedback on the notification-driven flow.
4. Start build.

## References

- Chrome alarms minimum interval and service worker wake behaviour: https://developer.chrome.com/docs/extensions/reference/api/alarms
- Service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- `chrome.identity` (Chrome): https://developer.chrome.com/docs/extensions/reference/api/identity
- `browser.identity.launchWebAuthFlow` (Firefox): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow
- Gmail compose URL parameters: https://til.simonwillison.net/google/gmail-compose-url
- Calendar API incremental sync (syncToken pattern): https://developers.google.com/workspace/calendar/api/guides/sync
- Calendar API quota and rate limits: https://developers.google.com/workspace/calendar/api/guides/quota
- chrome.notifications macOS button limitations: https://developer.chrome.com/blog/native-mac-os-notifications
- Firefox MV3 background model divergence: https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/
- Sensitive scope verification (and Internal-user-type exemption): https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Configure the OAuth consent screen and choose scopes: https://developers.google.com/workspace/guides/configure-oauth-consent
- Enterprise extension force-install (ExtensionInstallForcelist): https://learn.microsoft.com/en-us/deployedge/microsoft-edge-manage-extensions-policies
- Previous design (superseded): https://woogagmbh.atlassian.net/wiki/spaces/AVS/pages/5338267660/Proposed+Design+No+Agenda+No+Meeting
