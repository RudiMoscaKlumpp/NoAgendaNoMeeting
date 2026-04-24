import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { resolve } from "path";
import { unlinkSync, existsSync } from "fs";

const TEST_DB_PATH = resolve(process.cwd(), "nanm-test.db");

import {
  saveUserTokens,
  getUserTokens,
  updateUserTokens,
  getAllUsers,
  markUserReauthRequired,
  markUserAuthValid,
  recordPollFailure,
  resetPollFailures,
  isEventHandled,
  markEventHandled,
  updateEventAction,
  saveNotification,
  getNotification,
  updateLastPollAt,
  type StoredTokens,
} from "../src/db";
import type { CalendarEvent } from "../src/calendar-adapter";

function cleanupTestDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    const path = TEST_DB_PATH + suffix;
    if (existsSync(path)) unlinkSync(path);
  }
}

describe("database layer", () => {
  beforeEach(() => {
    cleanupTestDb();
    // Reset the db module singleton by overriding DB_PATH via cwd
    // We'll use the default path since getDb() uses process.cwd()
  });

  afterEach(() => {
    cleanupTestDb();
  });

  const testTokens: StoredTokens = {
    access_token: "ya29.test",
    refresh_token: "1//test",
    expiry_date: Date.now() + 3600000,
  };

  it("saves and retrieves user tokens", () => {
    saveUserTokens("test@example.com", testTokens);
    const retrieved = getUserTokens("test@example.com");
    expect(retrieved).toEqual(testTokens);
  });

  it("returns null for non-existent user", () => {
    expect(getUserTokens("nonexistent@example.com")).toBeNull();
  });

  it("updates tokens in place", () => {
    saveUserTokens("test@example.com", testTokens);
    const newTokens = { ...testTokens, access_token: "ya29.updated" };
    updateUserTokens("test@example.com", newTokens);
    expect(getUserTokens("test@example.com")?.access_token).toBe("ya29.updated");
  });

  it("upserts on save (same email)", () => {
    saveUserTokens("test@example.com", testTokens);
    const newTokens = { ...testTokens, access_token: "ya29.second" };
    saveUserTokens("test@example.com", newTokens);
    const all = getAllUsers();
    expect(all.filter((u) => u.email === "test@example.com")).toHaveLength(1);
    expect(getUserTokens("test@example.com")?.access_token).toBe("ya29.second");
  });

  it("tracks auth status transitions", () => {
    saveUserTokens("test@example.com", testTokens);
    expect(getAllUsers()[0].auth_status).toBe("valid");

    markUserReauthRequired("test@example.com", "token revoked");
    expect(getAllUsers()[0].auth_status).toBe("reauth_required");
    expect(getAllUsers()[0].last_error).toBe("token revoked");

    markUserAuthValid("test@example.com");
    const user = getAllUsers()[0];
    expect(user.auth_status).toBe("valid");
    expect(user.consecutive_failures).toBe(0);
    expect(user.last_error).toBeNull();
  });

  it("tracks consecutive failures", () => {
    saveUserTokens("test@example.com", testTokens);
    recordPollFailure("test@example.com", "timeout");
    recordPollFailure("test@example.com", "timeout again");
    expect(getAllUsers()[0].consecutive_failures).toBe(2);

    resetPollFailures("test@example.com");
    expect(getAllUsers()[0].consecutive_failures).toBe(0);
  });

  it("tracks handled events", () => {
    saveUserTokens("test@example.com", testTokens);
    expect(isEventHandled("evt-1", "test@example.com")).toBe(false);

    markEventHandled("evt-1", "test@example.com", "notified");
    expect(isEventHandled("evt-1", "test@example.com")).toBe(true);
  });

  it("updates event action (notified -> skipped)", () => {
    saveUserTokens("test@example.com", testTokens);
    markEventHandled("evt-1", "test@example.com", "notified");
    updateEventAction("evt-1", "test@example.com", "skipped");
    expect(isEventHandled("evt-1", "test@example.com")).toBe(true);
  });

  it("saves and retrieves notifications", () => {
    saveUserTokens("test@example.com", testTokens);
    const event: CalendarEvent = {
      id: "evt-1",
      summary: "Team Standup",
      description: null,
      start: "2026-04-25T10:00:00Z",
      end: "2026-04-25T10:30:00Z",
      organizer: "alice@example.com",
      attendeeCount: 3,
      status: "confirmed",
      htmlLink: "https://calendar.google.com/event?eid=abc",
    };
    saveNotification(event, "test@example.com");
    const notif = getNotification("evt-1", "test@example.com");
    expect(notif).not.toBeNull();
    expect(notif!.event_summary).toBe("Team Standup");
    expect(notif!.event_organizer).toBe("alice@example.com");
    expect(notif!.event_attendee_count).toBe(3);
  });

  it("returns null for non-existent notification", () => {
    expect(getNotification("nonexistent", "nobody@example.com")).toBeNull();
  });

  it("updates last_poll_at", () => {
    saveUserTokens("test@example.com", testTokens);
    expect(getAllUsers()[0].last_poll_at).toBeNull();
    updateLastPollAt("test@example.com");
    expect(getAllUsers()[0].last_poll_at).not.toBeNull();
  });
});
