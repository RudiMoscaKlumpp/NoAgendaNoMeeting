import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { router } from "../src/routes";
import {
  saveUserTokens,
  saveNotification,
  markEventHandled,
  resetDb,
} from "../src/db";
import { signActionToken } from "../src/action-token";
import type { CalendarEvent } from "../src/calendar-adapter";
import type { StoredTokens } from "../src/db";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const testTokens: StoredTokens = {
  access_token: "ya29.test",
  refresh_token: "1//test",
  expiry_date: Date.now() + 3600000,
};

const testEvent: CalendarEvent = {
  id: "evt-route-1",
  summary: "Weekly Sync",
  description: null,
  start: "2026-04-25T14:00:00Z",
  end: "2026-04-25T15:00:00Z",
  organizer: "boss@example.com",
  attendeeCount: 4,
  status: "confirmed",
  htmlLink: "https://calendar.google.com/event?eid=route1",
};

const USER = "user@example.com";

function seed() {
  saveUserTokens(USER, testTokens);
  saveNotification(testEvent, USER);
  markEventHandled(testEvent.id, USER, "notified");
}

describe("routes", () => {
  beforeEach(() => {
    resetDb();
  });

  describe("GET /healthz", () => {
    it("returns ok", async () => {
      const res = await request(createApp()).get("/healthz");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /api/status", () => {
    it("returns user stats", async () => {
      saveUserTokens(USER, testTokens);
      const res = await request(createApp()).get("/api/status");
      expect(res.status).toBe(200);
      expect(res.body.authenticated_users).toBeGreaterThanOrEqual(1);
      expect(res.body.users).toBeInstanceOf(Array);
    });
  });

  describe("GET /auth/google", () => {
    it("redirects to Google OAuth", async () => {
      const res = await request(createApp()).get("/auth/google");
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("accounts.google.com");
    });
  });

  describe("GET /auth/google/callback", () => {
    it("returns 400 without code parameter", async () => {
      const res = await request(createApp()).get("/auth/google/callback");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/notification/:eventId", () => {
    it("rejects missing token", async () => {
      const res = await request(createApp()).get(`/api/notification/${testEvent.id}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("malformed");
    });

    it("rejects token signed for a different event", async () => {
      seed();
      const wrongToken = signActionToken("evt-other", USER);
      const res = await request(createApp()).get(
        `/api/notification/${testEvent.id}?t=${wrongToken}`
      );
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("mismatch");
    });

    it("returns 404 with valid token but no notification", async () => {
      saveUserTokens(USER, testTokens);
      const token = signActionToken("ghost-event", USER);
      const res = await request(createApp()).get(
        `/api/notification/ghost-event?t=${token}`
      );
      expect(res.status).toBe(404);
    });

    it("returns notification for valid token", async () => {
      seed();
      const token = signActionToken(testEvent.id, USER);
      const res = await request(createApp()).get(
        `/api/notification/${testEvent.id}?t=${token}`
      );
      expect(res.status).toBe(200);
      expect(res.body.event_summary).toBe("Weekly Sync");
      expect(res.body.event_organizer).toBe("boss@example.com");
      expect(res.body.default_draft).toBeTruthy();
    });
  });

  describe("POST /api/skip/:eventId", () => {
    it("rejects missing token", async () => {
      const res = await request(createApp()).post(`/api/skip/${testEvent.id}`);
      expect(res.status).toBe(403);
    });

    it("marks event as skipped with valid token", async () => {
      seed();
      const token = signActionToken(testEvent.id, USER);
      const res = await request(createApp()).post(
        `/api/skip/${testEvent.id}?t=${token}`
      );
      expect(res.status).toBe(200);
      expect(res.body.event_summary).toBe("Weekly Sync");
    });
  });
});
