import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { router } from "../src/routes";
import { getDb, saveUserTokens, saveNotification, markEventHandled } from "../src/db";
import type { CalendarEvent } from "../src/calendar-adapter";
import type { StoredTokens } from "../src/db";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
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

describe("routes", () => {
  beforeEach(() => {
    getDb();
  });

  describe("GET /", () => {
    it("returns service info", async () => {
      const res = await request(createApp()).get("/");
      expect(res.status).toBe(200);
      expect(res.body.service).toBe("No Agenda? No Meeting");
      expect(res.body.version).toBe("0.1.0");
      expect(res.body.endpoints).toBeDefined();
    });
  });

  describe("GET /healthz", () => {
    it("returns ok", async () => {
      const res = await request(createApp()).get("/healthz");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /status", () => {
    it("rejects requests without auth header", async () => {
      const res = await request(createApp()).get("/status");
      expect(res.status).toBe(401);
    });

    it("rejects invalid bearer token", async () => {
      const res = await request(createApp())
        .get("/status")
        .set("Authorization", "Bearer wrong-token");
      expect(res.status).toBe(403);
    });

    it("returns user stats with valid SHS token", async () => {
      saveUserTokens("status-test@example.com", testTokens);
      const res = await request(createApp())
        .get("/status")
        .set("Authorization", "Bearer test-shs-secret");
      expect(res.status).toBe(200);
      expect(res.body.authenticated_users).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty("healthy");
      expect(res.body).toHaveProperty("needs_reauth");
      expect(res.body).toHaveProperty("degraded");
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
      expect(res.body.error).toContain("Missing authorization code");
    });
  });

  describe("GET /edit/:eventId", () => {
    it("returns 400 without user parameter", async () => {
      const res = await request(createApp()).get("/edit/evt-1");
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown notification", async () => {
      const res = await request(createApp()).get("/edit/nonexistent?user=test@example.com");
      expect(res.status).toBe(404);
    });

    it("renders edit form for existing notification", async () => {
      saveUserTokens("edit-test@example.com", testTokens);
      saveNotification(testEvent, "edit-test@example.com");
      markEventHandled(testEvent.id, "edit-test@example.com", "notified");

      const res = await request(createApp()).get(
        `/edit/${testEvent.id}?user=edit-test@example.com`
      );
      expect(res.status).toBe(200);
      expect(res.text).toContain("Edit your nudge");
      expect(res.text).toContain("Weekly Sync");
      expect(res.text).toContain("boss@example.com");
      expect(res.text).toContain("textarea");
      expect(res.text).toContain("Open in Gmail");
    });
  });

  describe("GET /skip/:eventId", () => {
    it("returns 400 without user parameter", async () => {
      const res = await request(createApp()).get("/skip/evt-1");
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown notification", async () => {
      const res = await request(createApp()).get("/skip/nonexistent?user=test@example.com");
      expect(res.status).toBe(404);
    });

    it("marks event as skipped and shows confirmation", async () => {
      saveUserTokens("skip-test@example.com", testTokens);
      saveNotification(testEvent, "skip-test@example.com");
      markEventHandled(testEvent.id, "skip-test@example.com", "notified");

      const res = await request(createApp()).get(
        `/skip/${testEvent.id}?user=skip-test@example.com`
      );
      expect(res.status).toBe(200);
      expect(res.text).toContain("Skipped");
      expect(res.text).toContain("Weekly Sync");
    });
  });
});
