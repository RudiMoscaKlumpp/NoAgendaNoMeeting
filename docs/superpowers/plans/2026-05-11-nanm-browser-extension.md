# NANM Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing SHS server POC with a cross-browser MV3 extension that runs entirely on the user's machine — polls Google Calendar every 15 min, detects empty-agenda invites, and fires a desktop notification that opens a Gmail compose tab pre-filled with a nudge to the organizer.

**Architecture:** Cross-browser MV3 extension (Chrome + Edge for POC). Background service worker on a `chrome.alarms` cadence. Google OAuth 2.0 PKCE via `browser.identity.launchWebAuthFlow` (User type = Internal in Wooga GCP, no Google verification needed). Calendar incremental sync via `syncToken`. State in `chrome.storage.local`. Notifications via `chrome.notifications`. No server, no Wooga-hosted credentials.

**Tech Stack:**
- TypeScript (existing)
- [wxt](https://wxt.dev) — modern WebExtension framework with Vite, MV3, TS, HMR, cross-browser builds
- `webextension-polyfill` — bridges Chrome and Firefox API surfaces (used via wxt)
- vitest (existing) — for the unit-testable modules (detector, sync state)
- Vanilla TS for the popup UI (no framework — POC scope)
- Google Calendar REST API v3 (`fetch`, not the Node `googleapis` SDK)

**Spec reference:** `docs/superpowers/specs/2026-05-11-nanm-browser-extension-design.md`

**Repository hygiene:** This plan creates a new top-level directory `extension/` for the WebExtension. The legacy `src/`, `test/`, `Dockerfile`, `web/`, `setup.sh`, `nanm.db*` files belong to the superseded SHS POC and are removed in Task 12. They are not deleted incrementally — keep them until the new extension passes its smoke test, then drop them in one commit.

---

## File Structure

```
extension/
├── wxt.config.ts                  # wxt config (browsers, manifest)
├── package.json
├── tsconfig.json
├── entrypoints/
│   ├── background.ts              # service worker: alarms, lifecycle, orchestration
│   └── popup/
│       ├── index.html
│       ├── main.ts                # connect / disconnect / status
│       └── styles.css             # minimal design tokens + popup styles
├── lib/
│   ├── detector.ts                # PORTED from src/detector.ts — pure
│   ├── calendar.ts                # syncToken-based incremental fetch
│   ├── oauth.ts                   # PKCE flow + refresh
│   ├── storage.ts                 # typed wrappers for chrome.storage
│   ├── dispatcher.ts              # notification + Gmail compose URL
│   ├── template.ts                # the hardcoded nudge draft text
│   └── types.ts                   # CalendarEvent, OAuthTokens, etc.
├── public/
│   └── icon-{16,48,128}.png       # placeholder icons (use Style-guide.md later)
└── tests/
    ├── detector.test.ts           # PORTED from test/detector.test.ts
    ├── template.test.ts
    ├── storage.test.ts
    └── calendar.test.ts           # mocks fetch for syncToken protocol
docs/
├── superpowers/
│   ├── specs/
│   │   └── 2026-05-11-nanm-browser-extension-design.md   # exists
│   └── plans/
│       └── 2026-05-11-nanm-browser-extension.md          # this file
└── manual-test.md                 # written in Task 11, the Lenka demo script
```

Each file has one responsibility:
- `lib/detector.ts` — pure function: "does this event need an agenda?"
- `lib/calendar.ts` — talks to Google Calendar API
- `lib/oauth.ts` — talks to Google OAuth
- `lib/storage.ts` — typed `chrome.storage` wrappers (tokens, handled events, sync state)
- `lib/dispatcher.ts` — turns a flagged event into a notification + click handler
- `lib/template.ts` — the nudge text
- `entrypoints/background.ts` — orchestrator: alarm fires → fetch → detect → dispatch → mark handled
- `entrypoints/popup/*` — minimal UI: Connect / Disconnect / "you're set" status

---

## Task 1: Scaffold the wxt extension

**Goal:** Get a buildable, loadable empty extension that produces a Chrome and Edge artifact.

**Files:**
- Create: `extension/package.json`
- Create: `extension/wxt.config.ts`
- Create: `extension/tsconfig.json`
- Create: `extension/entrypoints/background.ts` (one-line stub)
- Create: `extension/public/icon-16.png`, `icon-48.png`, `icon-128.png` (placeholder solid-color PNGs)

- [ ] **Step 1: Initialise the extension subdirectory**

Run: `mkdir -p extension && cd extension`

- [ ] **Step 2: Create package.json**

```json
{
  "name": "nanm-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "dev:edge": "wxt -b edge",
    "build": "wxt build && wxt build -b edge",
    "zip": "wxt zip && wxt zip -b edge",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "webextension-polyfill": "^0.12.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "@types/webextension-polyfill": "^0.12.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.5",
    "wxt": "^0.20.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd extension && npm install`
Expected: successful install, `node_modules/` populated.

- [ ] **Step 4: Create wxt.config.ts**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "No Agenda? No Meeting",
    description: "Nudges meeting organizers when their invite arrives without an agenda.",
    permissions: ["alarms", "storage", "notifications", "identity"],
    host_permissions: ["https://www.googleapis.com/*"],
    oauth2: undefined,
    icons: {
      16: "icon-16.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
  },
});
```

- [ ] **Step 5: Create tsconfig.json**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 6: Create a stub background entrypoint**

`extension/entrypoints/background.ts`:

```ts
export default defineBackground(() => {
  console.log("[nanm] background loaded");
});
```

- [ ] **Step 7: Add placeholder icons**

Drop any 16x16, 48x48, 128x128 PNG into `extension/public/`. A solid colour is fine for POC — final icon work is out of scope.

- [ ] **Step 8: Build and verify the artifact**

Run: `cd extension && npm run build`
Expected: `.output/chrome-mv3/` and `.output/edge-mv3/` directories exist with `manifest.json`, `background.js`, and the icons.

- [ ] **Step 9: Load unpacked in Chrome to confirm**

Open `chrome://extensions`, enable Developer Mode, "Load unpacked" → select `extension/.output/chrome-mv3/`. Verify the extension appears with the configured name and no manifest errors.

- [ ] **Step 10: Commit**

```bash
git add extension/ && git commit -m "feat(ext): scaffold wxt-based MV3 extension"
```

---

## Task 2: Port the detector

**Goal:** Move the pure detector function and its tests into the extension. Pure logic carries over with no changes to behaviour.

**Files:**
- Create: `extension/lib/types.ts`
- Create: `extension/lib/detector.ts` (ported from `src/detector.ts`)
- Create: `extension/tests/detector.test.ts` (ported from `test/detector.test.ts`)
- Create: `extension/vitest.config.ts`

- [ ] **Step 1: Define the shared `CalendarEvent` type**

`extension/lib/types.ts`:

```ts
export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  organizer: string;
  attendeeCount: number;
  status: string;
  htmlLink: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}
```

- [ ] **Step 2: Write the failing test**

`extension/tests/detector.test.ts` — copy the body verbatim from `test/detector.test.ts`, changing imports to `../lib/detector` and `../lib/types`.

- [ ] **Step 3: Add vitest config**

`extension/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL with `Cannot find module '../lib/detector'`.

- [ ] **Step 5: Port detector.ts**

`extension/lib/detector.ts`:

```ts
import type { CalendarEvent } from "./types";

export function needsAgenda(event: CalendarEvent, userEmail: string): boolean {
  if (event.organizer && event.organizer.toLowerCase() === userEmail.toLowerCase()) {
    return false;
  }
  if (event.attendeeCount < 2) return false;
  const desc = (event.description || "").trim();
  return desc.length === 0;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: all 9 detector tests PASS.

- [ ] **Step 7: Commit**

```bash
git add extension/lib extension/tests extension/vitest.config.ts && \
git commit -m "feat(ext): port detector and types from legacy POC"
```

---

## Task 3: Storage layer

**Goal:** Typed wrappers around `chrome.storage.local` (and `.session`) for tokens, handled-event set, and the Calendar `syncToken`. Wraps the imperative API in a small testable surface.

**Files:**
- Create: `extension/lib/storage.ts`
- Create: `extension/tests/storage.test.ts`

- [ ] **Step 1: Write the failing test**

`extension/tests/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { storage } from "../lib/storage";

// Mock chrome.storage in-memory
const memoryLocal = new Map<string, unknown>();
const memorySession = new Map<string, unknown>();

beforeEach(() => {
  memoryLocal.clear();
  memorySession.clear();
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (k: string) => ({ [k]: memoryLocal.get(k) })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) memoryLocal.set(k, v);
        }),
        remove: vi.fn(async (k: string) => { memoryLocal.delete(k); }),
      },
      session: {
        get: vi.fn(async (k: string) => ({ [k]: memorySession.get(k) })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) memorySession.set(k, v);
        }),
      },
    },
  };
});

describe("storage", () => {
  it("stores and retrieves the refresh token", async () => {
    await storage.setRefreshToken("rt-123");
    expect(await storage.getRefreshToken()).toBe("rt-123");
  });

  it("returns null when no refresh token is set", async () => {
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it("stores and retrieves the sync token", async () => {
    await storage.setSyncToken("st-abc");
    expect(await storage.getSyncToken()).toBe("st-abc");
  });

  it("marks events handled and reports them as handled", async () => {
    await storage.markHandled("evt-1");
    await storage.markHandled("evt-2");
    expect(await storage.isHandled("evt-1")).toBe(true);
    expect(await storage.isHandled("evt-3")).toBe(false);
  });

  it("stores access token in session storage", async () => {
    await storage.setAccessToken("at-456", Date.now() + 3600_000);
    const token = await storage.getAccessToken();
    expect(token?.accessToken).toBe("at-456");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL with `Cannot find module '../lib/storage'`.

- [ ] **Step 3: Implement storage.ts**

`extension/lib/storage.ts`:

```ts
const KEYS = {
  refreshToken: "nanm.refreshToken",
  accessToken: "nanm.accessToken",
  accessTokenExpiresAt: "nanm.accessTokenExpiresAt",
  syncToken: "nanm.syncToken",
  handled: "nanm.handledEventIds",
  userEmail: "nanm.userEmail",
} as const;

async function lget<T>(key: string): Promise<T | null> {
  const r = await chrome.storage.local.get(key);
  return (r[key] as T | undefined) ?? null;
}
async function lset(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export const storage = {
  async getRefreshToken(): Promise<string | null> { return lget<string>(KEYS.refreshToken); },
  async setRefreshToken(t: string): Promise<void> { await lset(KEYS.refreshToken, t); },

  async setAccessToken(t: string, expiresAt: number): Promise<void> {
    await chrome.storage.session.set({ [KEYS.accessToken]: t, [KEYS.accessTokenExpiresAt]: expiresAt });
  },
  async getAccessToken(): Promise<{ accessToken: string; expiresAt: number } | null> {
    const r = await chrome.storage.session.get([KEYS.accessToken, KEYS.accessTokenExpiresAt]);
    const at = r[KEYS.accessToken] as string | undefined;
    const exp = r[KEYS.accessTokenExpiresAt] as number | undefined;
    if (!at || !exp) return null;
    return { accessToken: at, expiresAt: exp };
  },

  async getSyncToken(): Promise<string | null> { return lget<string>(KEYS.syncToken); },
  async setSyncToken(t: string): Promise<void> { await lset(KEYS.syncToken, t); },
  async clearSyncToken(): Promise<void> { await chrome.storage.local.remove(KEYS.syncToken); },

  async markHandled(eventId: string): Promise<void> {
    const cur = (await lget<string[]>(KEYS.handled)) ?? [];
    if (!cur.includes(eventId)) await lset(KEYS.handled, [...cur, eventId]);
  },
  async isHandled(eventId: string): Promise<boolean> {
    const cur = (await lget<string[]>(KEYS.handled)) ?? [];
    return cur.includes(eventId);
  },

  async getUserEmail(): Promise<string | null> { return lget<string>(KEYS.userEmail); },
  async setUserEmail(e: string): Promise<void> { await lset(KEYS.userEmail, e); },

  async wipe(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test`
Expected: all storage tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/storage.ts extension/tests/storage.test.ts && \
git commit -m "feat(ext): typed storage wrappers for tokens, sync state, handled set"
```

---

## Task 4: Nudge template

**Goal:** Hardcoded draft text. Pure function. Trivial.

**Files:**
- Create: `extension/lib/template.ts`
- Create: `extension/tests/template.test.ts`

- [ ] **Step 1: Write the failing test**

`extension/tests/template.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderNudge } from "../lib/template";

describe("renderNudge", () => {
  it("includes the event title and the organizer's first name", () => {
    const r = renderNudge({ summary: "Q3 planning", organizer: "sean.mcallister@wooga.com" });
    expect(r.subject).toContain("Q3 planning");
    expect(r.body).toContain("Sean");
    expect(r.body.length).toBeGreaterThan(50);
  });

  it("falls back to the email local-part when the name is unclear", () => {
    const r = renderNudge({ summary: "Sync", organizer: "ops-team@wooga.com" });
    expect(r.body).toContain("ops-team");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement template.ts**

`extension/lib/template.ts`:

```ts
export function renderNudge(input: { summary: string; organizer: string }): { subject: string; body: string } {
  const localPart = input.organizer.split("@")[0] ?? input.organizer;
  const firstName = localPart.split(/[.\-_]/)[0] ?? localPart;
  const display = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const subject = `Re: ${input.summary}`;
  const body = [
    `Hi ${display},`,
    "",
    `Could you add a short agenda or expected outcome to "${input.summary}"? Even one line of context helps everyone show up prepared and decide whether they're the right person to attend.`,
    "",
    "Thanks!",
  ].join("\n");

  return { subject, body };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test`
Expected: all template tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/template.ts extension/tests/template.test.ts && \
git commit -m "feat(ext): nudge template renderer"
```

---

## Task 5: Calendar adapter with syncToken

**Goal:** A `fetchChangedEvents(accessToken)` function that performs incremental sync via `syncToken`, persists the new `nextSyncToken`, and handles HTTP 410 by falling back to a full resync.

**Files:**
- Create: `extension/lib/calendar.ts`
- Create: `extension/tests/calendar.test.ts`

**Reference:** Google Calendar incremental sync — https://developers.google.com/workspace/calendar/api/guides/sync

- [ ] **Step 1: Write the failing test**

`extension/tests/calendar.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchChangedEvents } from "../lib/calendar";
import { storage } from "../lib/storage";

const memoryLocal = new Map<string, unknown>();
const memorySession = new Map<string, unknown>();

beforeEach(() => {
  memoryLocal.clear();
  memorySession.clear();
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (k: string) => ({ [k]: memoryLocal.get(k) })),
        set: vi.fn(async (obj: Record<string, unknown>) => { for (const [k, v] of Object.entries(obj)) memoryLocal.set(k, v); }),
        remove: vi.fn(async (k: string) => { memoryLocal.delete(k); }),
      },
      session: {
        get: vi.fn(async (k: string) => ({ [k]: memorySession.get(k) })),
        set: vi.fn(async (obj: Record<string, unknown>) => { for (const [k, v] of Object.entries(obj)) memorySession.set(k, v); }),
      },
    },
  };
});

describe("fetchChangedEvents", () => {
  it("does a full initial sync when no syncToken exists, persists nextSyncToken", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "evt-1", summary: "Meeting", description: "", start: { dateTime: "2026-05-11T10:00:00Z" }, end: { dateTime: "2026-05-11T10:30:00Z" }, organizer: { email: "alice@wooga.com" }, attendees: [{}, {}], status: "confirmed", htmlLink: "https://..." }
        ],
        nextSyncToken: "sync-token-1"
      }),
    }) as any;
    const events = await fetchChangedEvents("access-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("evt-1");
    expect(await storage.getSyncToken()).toBe("sync-token-1");
  });

  it("uses the stored syncToken on subsequent calls", async () => {
    await storage.setSyncToken("prev-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ items: [], nextSyncToken: "next-token" }),
    });
    global.fetch = fetchMock as any;
    await fetchChangedEvents("access-2");
    const calledUrl = (fetchMock.mock.calls[0]?.[0] ?? "") as string;
    expect(calledUrl).toContain("syncToken=prev-token");
  });

  it("clears syncToken and retries on HTTP 410", async () => {
    await storage.setSyncToken("stale");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [], nextSyncToken: "fresh" }) });
    global.fetch = fetchMock as any;
    await fetchChangedEvents("access-3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await storage.getSyncToken()).toBe("fresh");
  });

  it("skips events the user organized themselves", async () => {
    await storage.setUserEmail("user@wooga.com");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        items: [
          { id: "evt-self", summary: "Self org", description: "", start: { dateTime: "2026-05-11T10:00:00Z" }, end: { dateTime: "2026-05-11T10:30:00Z" }, organizer: { email: "user@wooga.com" }, attendees: [{},{}], status: "confirmed", htmlLink: "" },
          { id: "evt-other", summary: "Other org", description: "", start: { dateTime: "2026-05-11T11:00:00Z" }, end: { dateTime: "2026-05-11T11:30:00Z" }, organizer: { email: "alice@wooga.com" }, attendees: [{},{}], status: "confirmed", htmlLink: "" },
        ],
        nextSyncToken: "tok",
      }),
    }) as any;
    const events = await fetchChangedEvents("access-4");
    expect(events.map(e => e.id)).toEqual(["evt-self", "evt-other"]);
    // Note: detector handles the self-organizer filter, calendar layer returns all events.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement calendar.ts**

`extension/lib/calendar.ts`:

```ts
import { storage } from "./storage";
import type { CalendarEvent } from "./types";

const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: unknown[];
  status?: string;
  htmlLink?: string;
}

function buildUrl(syncToken: string | null): string {
  const params = new URLSearchParams({ singleEvents: "true", showDeleted: "false", maxResults: "250" });
  if (syncToken) {
    params.set("syncToken", syncToken);
  } else {
    // Initial sync: fetch a small recent window. timeMin must NOT be combined with syncToken later.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    params.set("timeMin", since);
  }
  return `${BASE}?${params.toString()}`;
}

function normalise(g: GoogleEvent): CalendarEvent {
  return {
    id: g.id,
    summary: g.summary ?? "(no title)",
    description: g.description ?? null,
    start: g.start?.dateTime ?? g.start?.date ?? "",
    end: g.end?.dateTime ?? g.end?.date ?? "",
    organizer: g.organizer?.email ?? "",
    attendeeCount: g.attendees?.length ?? 0,
    status: g.status ?? "confirmed",
    htmlLink: g.htmlLink ?? "",
  };
}

export async function fetchChangedEvents(accessToken: string): Promise<CalendarEvent[]> {
  const syncToken = await storage.getSyncToken();
  let res = await fetch(buildUrl(syncToken), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 410) {
    // syncToken invalidated by Google; drop and do a full resync.
    await storage.clearSyncToken();
    res = await fetch(buildUrl(null), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  if (!res.ok) throw new Error(`Calendar API ${res.status}`);

  const data = await res.json() as { items?: GoogleEvent[]; nextSyncToken?: string };
  if (data.nextSyncToken) await storage.setSyncToken(data.nextSyncToken);

  return (data.items ?? []).map(normalise);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: all 4 calendar tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/calendar.ts extension/tests/calendar.test.ts && \
git commit -m "feat(ext): calendar adapter with syncToken incremental sync"
```

---

## Task 6: OAuth PKCE flow

**Goal:** `connect()` runs interactive OAuth (PKCE) and stores access + refresh tokens. `getAccessToken()` returns a cached token or refreshes silently using the stored refresh token.

**Not unit-testable end-to-end** (depends on the live browser identity API and Google's auth server). Unit-test the PKCE code-challenge derivation; integration-test the rest by hand in Task 11.

**Files:**
- Create: `extension/lib/oauth.ts`
- Create: `extension/tests/oauth.test.ts`

**Reference:** PKCE for Google installed apps — https://developers.google.com/identity/protocols/oauth2/native-app

- [ ] **Step 1: Write the failing test for PKCE derivation**

`extension/tests/oauth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generatePkcePair, base64UrlEncode } from "../lib/oauth";

describe("PKCE", () => {
  it("base64UrlEncode produces the URL-safe variant", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
    expect(base64UrlEncode(bytes)).toBe("__79");
  });

  it("generatePkcePair returns a 43+ char verifier and a S256-derived challenge", async () => {
    const { codeVerifier, codeChallenge } = await generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge.length).toBeGreaterThan(0);
    expect(codeChallenge).not.toBe(codeVerifier);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement oauth.ts**

`extension/lib/oauth.ts`:

```ts
import { storage } from "./storage";
import browser from "webextension-polyfill";

// Replace with the OAuth client ID minted in the Wooga GCP project (Web application type, User type = Internal).
const CLIENT_ID = "REPLACE_ME.apps.googleusercontent.com";
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "openid", "email"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const codeVerifier = base64UrlEncode(random);
  const challengeBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)));
  const codeChallenge = base64UrlEncode(challengeBytes);
  return { codeVerifier, codeChallenge };
}

function redirectUri(): string {
  return browser.identity.getRedirectURL();
}

export async function connect(): Promise<void> {
  const { codeVerifier, codeChallenge } = await generatePkcePair();

  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  const authUrl = `${AUTH_URL}?${authParams.toString()}`;

  const redirected = await browser.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  if (!redirected) throw new Error("OAuth flow returned no URL");
  const url = new URL(redirected);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("No authorization code in redirect");

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
  const tokens = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number; id_token?: string };

  await storage.setRefreshToken(tokens.refresh_token);
  await storage.setAccessToken(tokens.access_token, Date.now() + tokens.expires_in * 1000);

  // Decode id_token (no verification needed — we trust the channel) to capture user email for self-organizer filtering.
  if (tokens.id_token) {
    const payload = JSON.parse(atob(tokens.id_token.split(".")[1] ?? ""));
    if (payload.email) await storage.setUserEmail(payload.email);
  }
}

export async function getAccessToken(): Promise<string> {
  const cached = await storage.getAccessToken();
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) throw new Error("Not connected");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  const t = await res.json() as { access_token: string; expires_in: number };
  await storage.setAccessToken(t.access_token, Date.now() + t.expires_in * 1000);
  return t.access_token;
}

export async function disconnect(): Promise<void> {
  await storage.wipe();
}

export async function isConnected(): Promise<boolean> {
  return (await storage.getRefreshToken()) !== null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: PKCE tests PASS. Other oauth flow paths are not unit-tested here — they require the live browser environment.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/oauth.ts extension/tests/oauth.test.ts && \
git commit -m "feat(ext): PKCE OAuth flow with refresh-token caching"
```

---

## Task 7: Dispatcher (notification + Gmail compose URL)

**Goal:** Given a flagged event, fire a notification and wire its body-click to a Gmail compose tab.

Not unit-testable for the click side-effect — it requires the live `chrome.notifications` and `chrome.tabs` APIs. Unit-test the compose-URL builder; hand-test the rest in Task 11.

**Files:**
- Create: `extension/lib/dispatcher.ts`
- Create: `extension/tests/dispatcher.test.ts`

- [ ] **Step 1: Write the failing test for the compose URL builder**

`extension/tests/dispatcher.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildComposeUrl } from "../lib/dispatcher";

describe("buildComposeUrl", () => {
  it("URL-encodes to, subject, and body", () => {
    const url = buildComposeUrl({ to: "alice@wooga.com", subject: "Re: Sync", body: "Hi Alice,\n\nQuestion?" });
    expect(url).toContain("to=alice%40wooga.com");
    expect(url).toContain("su=Re%3A+Sync");
    expect(url).toContain("body=Hi+Alice%2C%0A%0AQuestion%3F");
    expect(url.startsWith("https://mail.google.com/mail/?view=cm")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement dispatcher.ts**

`extension/lib/dispatcher.ts`:

```ts
import { renderNudge } from "./template";
import { storage } from "./storage";
import type { CalendarEvent } from "./types";

export function buildComposeUrl(input: { to: string; subject: string; body: string }): string {
  const p = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: input.to,
    su: input.subject,
    body: input.body,
  });
  return `https://mail.google.com/mail/?${p.toString()}`;
}

const PENDING_KEY = "nanm.pendingByNotificationId";

interface PendingMap { [notificationId: string]: { eventId: string; composeUrl: string } }

async function getPending(): Promise<PendingMap> {
  const r = await chrome.storage.local.get(PENDING_KEY);
  return (r[PENDING_KEY] as PendingMap | undefined) ?? {};
}
async function setPending(p: PendingMap): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: p });
}

export async function dispatch(event: CalendarEvent): Promise<void> {
  const { subject, body } = renderNudge({ summary: event.summary, organizer: event.organizer });
  const composeUrl = buildComposeUrl({ to: event.organizer, subject, body });

  const notificationId = `nanm-${event.id}`;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "/icon-128.png",
    title: `No agenda: ${event.summary}`,
    message: `From ${event.organizer}. Click to draft a nudge in Gmail.`,
    buttons: [{ title: "Skip" }],
    requireInteraction: true,
  });

  const pending = await getPending();
  pending[notificationId] = { eventId: event.id, composeUrl };
  await setPending(pending);
}

export function registerNotificationHandlers(): void {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    const pending = await getPending();
    const item = pending[notificationId];
    if (!item) return;
    await chrome.tabs.create({ url: item.composeUrl });
    await storage.markHandled(item.eventId);
    delete pending[notificationId];
    await setPending(pending);
    await chrome.notifications.clear(notificationId);
  });

  chrome.notifications.onButtonClicked.addListener(async (notificationId, btnIdx) => {
    if (btnIdx !== 0) return; // only one button: Skip
    const pending = await getPending();
    const item = pending[notificationId];
    if (!item) return;
    await storage.markHandled(item.eventId);
    delete pending[notificationId];
    await setPending(pending);
    await chrome.notifications.clear(notificationId);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd extension && npm test`
Expected: dispatcher tests PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/lib/dispatcher.ts extension/tests/dispatcher.test.ts && \
git commit -m "feat(ext): dispatcher — notification + Gmail compose URL + handlers"
```

---

## Task 8: Service worker orchestration

**Goal:** Tie it all together in `background.ts`: alarm registration with self-healing, the poll-detect-dispatch loop, and notification handler registration.

**Files:**
- Modify: `extension/entrypoints/background.ts`

- [ ] **Step 1: Replace the stub background with the real orchestrator**

`extension/entrypoints/background.ts`:

```ts
import { getAccessToken, isConnected } from "../lib/oauth";
import { fetchChangedEvents } from "../lib/calendar";
import { needsAgenda } from "../lib/detector";
import { dispatch, registerNotificationHandlers } from "../lib/dispatcher";
import { storage } from "../lib/storage";

const ALARM_NAME = "nanm.poll";
const POLL_PERIOD_MINUTES = 15;

async function ensureAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_PERIOD_MINUTES });
    console.log("[nanm] alarm created");
  }
}

async function tick(): Promise<void> {
  if (!(await isConnected())) {
    console.log("[nanm] not connected — skipping tick");
    return;
  }
  const accessToken = await getAccessToken();
  const userEmail = (await storage.getUserEmail()) ?? "";
  const events = await fetchChangedEvents(accessToken);

  for (const event of events) {
    if (await storage.isHandled(event.id)) continue;
    if (!needsAgenda(event, userEmail)) continue;
    await dispatch(event);
  }
}

export default defineBackground(() => {
  // Register listeners at top level — required for cold-wake correctness.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      tick().catch((e) => console.error("[nanm] tick failed", e));
    }
  });

  chrome.runtime.onStartup.addListener(() => { ensureAlarm().catch(console.error); });
  chrome.runtime.onInstalled.addListener(() => { ensureAlarm().catch(console.error); });

  registerNotificationHandlers();

  // Defensive: also ensure on every cold load.
  ensureAlarm().catch(console.error);
});
```

- [ ] **Step 2: Typecheck**

Run: `cd extension && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `cd extension && npm run build`
Expected: clean build for both Chrome and Edge artifacts.

- [ ] **Step 4: Commit**

```bash
git add extension/entrypoints/background.ts && \
git commit -m "feat(ext): background orchestration with self-healing alarm"
```

---

## Task 9: Popup UI

**Goal:** Minimal, dark-mode, monospaced popup. Two states: not-connected ("Connect your calendar" button) and connected ("Connected as <email>. Polling every 15 min. [Disconnect]"). Includes design tokens up front for clean Wooga-style-guide swap later.

**Files:**
- Create: `extension/entrypoints/popup/index.html`
- Create: `extension/entrypoints/popup/main.ts`
- Create: `extension/entrypoints/popup/styles.css`

- [ ] **Step 1: Update manifest to declare the popup**

Edit `extension/wxt.config.ts`, add inside `manifest`:

```ts
action: { default_popup: "popup.html", default_title: "No Agenda? No Meeting" },
```

- [ ] **Step 2: Create the popup HTML**

`extension/entrypoints/popup/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>No Agenda? No Meeting</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main id="root">
      <h1>No Agenda? No Meeting</h1>
      <p id="status">Loading…</p>
      <button id="primary" hidden></button>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Add design tokens + popup styles**

`extension/entrypoints/popup/styles.css`:

```css
:root {
  --bg: #0e0f12;
  --fg: #e8e8ea;
  --muted: #8b8d94;
  --accent: #6ea8fe;
  --border: #2a2c33;
  --radius: 6px;
  --pad: 12px;
  --font-mono: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  width: 320px;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
}
main { padding: var(--pad); }
h1 { font-size: 14px; margin: 0 0 var(--pad); color: var(--fg); font-weight: 600; }
p { margin: 0 0 var(--pad); color: var(--muted); }
button {
  width: 100%;
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
}
button:hover { border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 4: Wire up the popup logic**

`extension/entrypoints/popup/main.ts`:

```ts
import { connect, disconnect, isConnected } from "../../lib/oauth";
import { storage } from "../../lib/storage";

const statusEl = document.getElementById("status")!;
const btn = document.getElementById("primary") as HTMLButtonElement;

async function render(): Promise<void> {
  const connected = await isConnected();
  if (connected) {
    const email = (await storage.getUserEmail()) ?? "(unknown)";
    statusEl.textContent = `Connected as ${email}. Polling every 15 min.`;
    btn.textContent = "Disconnect";
    btn.hidden = false;
    btn.onclick = async () => {
      btn.disabled = true;
      await disconnect();
      await render();
    };
  } else {
    statusEl.textContent = "Connect your Google Calendar to start.";
    btn.textContent = "Connect calendar";
    btn.hidden = false;
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await connect();
      } catch (e) {
        statusEl.textContent = `Connection failed: ${(e as Error).message}`;
      }
      btn.disabled = false;
      await render();
    };
  }
}

render().catch(console.error);
```

- [ ] **Step 5: Build and confirm the popup loads**

Run: `cd extension && npm run build`
Reload the unpacked extension in `chrome://extensions`. Click the toolbar icon. The popup should render with the dark-mode minimal UI.

- [ ] **Step 6: Commit**

```bash
git add extension/entrypoints/popup extension/wxt.config.ts && \
git commit -m "feat(ext): popup UI with design tokens and connect/disconnect"
```

---

## Task 10: OAuth client configuration handoff

**Goal:** Capture the OAuth client values from the Wooga GCP project (created by Manne or Rudi) and wire them into the extension.

**Files:**
- Modify: `extension/lib/oauth.ts`
- Create: `extension/.env.example` (documents the values)

- [ ] **Step 1: Identify or obtain a Wooga-owned GCP project**

The Internal user type exemption only applies if the GCP project is owned by the Wooga Workspace organisation. Check https://console.cloud.google.com/ for an existing project where you have Owner or Editor role and the project is under the Wooga org.

- **If you have access:** continue self-serve.
- **If you don't:** mark this task blocked. Unblock owner: **Manne** (or whoever administers the Wooga GCP org). Unblock action: grant you Owner/Editor on a Wooga-org project, or name an existing one to reuse, or sponsor creation of a new project named e.g. `wooga-nanm`.

Manne is **not** required to do the steps below — only to provide access if missing.

- [ ] **Step 2: Configure the OAuth consent screen**

In the chosen project:
1. **APIs & Services → OAuth consent screen.**
2. User type: **Internal**.
3. App name: `No Agenda? No Meeting`.
4. User support email + developer contact: your Wooga email.
5. Save.
6. **Scopes** step: add `https://www.googleapis.com/auth/calendar.readonly`. (Internal user type means no Google verification is needed for this sensitive scope.)

- [ ] **Step 3: Enable the Google Calendar API**

**APIs & Services → Library → "Google Calendar API" → Enable.** If it's already enabled at the org level, this is a no-op.

- [ ] **Step 4: Create the OAuth client**

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID.**
2. Application type: **Web application** (NOT "Chrome extension" — that one only supports the Chrome-only `getAuthToken()` flow).
3. Name: `NANM extension (POC)`.
4. Leave Authorized redirect URIs empty for now — you'll fill it in Step 6.
5. Save. Copy the **Client ID**.

- [ ] **Step 5: Capture your extension's redirect URI**

Load `extension/.output/chrome-mv3/` unpacked in Chrome. From the service-worker console (chrome://extensions → service worker link), run:

```js
console.log(chrome.identity.getRedirectURL());
```

Copy the value — it will be `https://<your-extension-id>.chromiumapp.org/`.

- [ ] **Step 6: Register the redirect URI on the OAuth client**

In GCP → Credentials → your client → **Authorized redirect URIs** → add the value from Step 5. Save.

(Repeat for the Edge unpacked install if/when you test there — same extension ID generation rule, different value.)

- [ ] **Step 7: Manne sign-off (optional, parallel)**

Security framing is documented in the spec. Manne's sign-off is **advisory** for POC, not gating. You can ship to Lenka while it's pending. If you want it before Lenka: share `docs/superpowers/specs/2026-05-11-nanm-browser-extension-design.md`.

- [ ] **Step 8: Replace the CLIENT_ID placeholder**

Edit `extension/lib/oauth.ts`, replace `REPLACE_ME.apps.googleusercontent.com` with the actual client ID from the GCP console.

- [ ] **Step 9: Document the value for future contributors**

`extension/.env.example`:

```
# OAuth client ID from the Wooga GCP project (User type = Internal, App type = Web application).
# Hardcoded into lib/oauth.ts because the extension cannot read .env files at runtime.
# Documented here for handoff between maintainers.
NANM_OAUTH_CLIENT_ID=...apps.googleusercontent.com
```

- [ ] **Step 10: Commit**

```bash
git add extension/lib/oauth.ts extension/.env.example && \
git commit -m "feat(ext): wire OAuth client ID from Wooga GCP project"
```

---

## Task 11: Manual end-to-end smoke test

**Goal:** Validate the success criterion from the spec. No automation here — this is wet-finger testing, with a written script so Lenka can reproduce.

**Files:**
- Create: `docs/manual-test.md`

- [ ] **Step 1: Connect**

Load the unpacked extension from `extension/.output/chrome-mv3/`. Click the toolbar icon, click **Connect calendar**, complete the Google consent flow. Verify the popup now shows your email and "Polling every 15 min."

- [ ] **Step 2: Create a no-agenda test invite**

In Google Calendar, create an event:
- Title: "NANM smoke test"
- Time: ~10 min from now
- Invitee: yourself (add a second attendee to satisfy the 2+ rule — your personal Gmail works)
- **No description**
- Save.

- [ ] **Step 3: Wait for the alarm — or trigger manually**

To skip the 15-min wait, open the service worker console (`chrome://extensions` → click "service worker" link on the extension card) and run:
```js
chrome.alarms.create("nanm.poll", { delayInMinutes: 0.5 });
```

- [ ] **Step 4: Observe the notification**

Within ~30 seconds, a desktop notification should appear: "No agenda: NANM smoke test — From <your email>. Click to draft a nudge in Gmail."

- [ ] **Step 5: Click the notification body**

A new tab should open at `mail.google.com` with a compose window pre-filled: To = your email, Subject = "Re: NANM smoke test", Body = the nudge text from `template.ts`.

- [ ] **Step 6: Verify Skip works**

Trigger another notification (create another no-agenda invite, or clear `nanm.handledEventIds` in DevTools and re-tick). On macOS, hover the notification, click "More", click **Skip**. Verify the notification clears and a re-poll does not re-fire for the same event.

- [ ] **Step 7: Verify the same artifact loads in Edge**

Open `edge://extensions`, load unpacked from `extension/.output/edge-mv3/`. Repeat steps 1, 3, 4 in Edge.

- [ ] **Step 8: Capture the script for Lenka**

Write `docs/manual-test.md` with the steps above, calibrated for a non-technical user (no DevTools instructions — just install, connect, wait, observe).

- [ ] **Step 9: Commit**

```bash
git add docs/manual-test.md && git commit -m "docs: manual e2e smoke test + Lenka demo script"
```

---

## Task 12: Remove the superseded SHS POC

**Goal:** Drop the legacy server code now that the extension passes its smoke test. One commit, clean removal.

**Files:**
- Delete: `src/` (entire directory)
- Delete: `test/` (entire directory)
- Delete: `Dockerfile`, `setup.sh`, `web/`, `nanm.db`, `nanm.db-shm`, `nanm.db-wal`
- Modify: `package.json` (drop nodemailer, mjml, better-sqlite3, express, googleapis, cookie-parser, and their @types)
- Modify: `tsconfig.json` (root) — drop legacy settings or move config under `extension/`

- [ ] **Step 1: Verify the smoke test from Task 11 has been completed and passed**

Do NOT do this task unless Task 11 was completed successfully. The legacy code is a known-working fallback until we've verified the extension end to end.

- [ ] **Step 2: Delete legacy directories and binary files**

```bash
rm -rf src test web Dockerfile setup.sh nanm.db nanm.db-shm nanm.db-wal
```

- [ ] **Step 3: Trim root package.json**

Edit the root `package.json` and remove all dependencies and scripts related to the SHS server. The repo now only has `extension/` as its build target. Either point root scripts at the extension subdir or delete them and document `cd extension && npm <script>` in the README.

- [ ] **Step 4: Confirm no broken references**

Run: `git grep "from \"\\.\\.\\/src\\/"` and `git grep "nanm\\.db"` — both should return empty.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: remove superseded SHS POC (server, SQLite, MJML, Docker)"
```

---

## Out-of-scope reminders

These are deliberately NOT in this plan:
- LLM-based agenda detection
- Slack notifications
- Threaded Gmail replies (requires `gmail.compose` scope + verification)
- Firefox or Safari packaging
- Chrome Web Store or Workspace Marketplace listing
- A content script that injects nudge UI into `calendar.google.com`
- Per-user template customisation
- More than one user (each user installs their own)

Defer to MVP. If you find yourself reaching for any of these mid-implementation, stop and add them as follow-up issues instead.

---

## Risks and unblock paths

Per the CEO/issue protocol: anything not green below is a blocker, with the unblock owner named.

| Risk | Mitigation | Unblock owner |
|---|---|---|
| GCP project access | Cannot create the OAuth client | **Self-serve if you already have Owner/Editor on a Wooga-org GCP project.** Only blocked on **Manne** if you need access provisioned. |
| `chrome.identity.getRedirectURL()` value differs per machine for unpacked installs | Log it once from the service worker console and feed it into the GCP redirect URIs | Rudi (after Task 1 build) |
| Manne security sign-off | Advisory, not gating for POC | **Sean / Manne** — review spec at `docs/superpowers/specs/2026-05-11-nanm-browser-extension-design.md`. Lenka demo can proceed in parallel. |
