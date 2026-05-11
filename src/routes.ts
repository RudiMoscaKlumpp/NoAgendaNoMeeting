import { Router, type Request, type Response } from "express";
import express from "express";
import { google } from "googleapis";
import { resolve } from "path";
import { existsSync } from "fs";
import { getAuthUrl, exchangeCode, createOAuth2Client } from "./google-auth";
import {
  saveUserTokens,
  getAllUsers,
  getNotification,
  updateEventAction,
  markUserAuthValid,
  type StoredTokens,
} from "./db";
import { buildNudgeBody } from "./email-template";
import { verifyActionToken } from "./action-token";
import { createLogger } from "./logger";

const log = createLogger("routes");

export const router = Router();

router.get("/auth/google", (_req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send("Missing authorization code");
    return;
  }
  try {
    const tokens = await exchangeCode(code);
    const client = createOAuth2Client();
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    if (!email) {
      res.status(400).send("Could not retrieve user email");
      return;
    }
    const stored: StoredTokens = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
    };
    saveUserTokens(email, stored);
    markUserAuthValid(email);
    res.redirect("/#/status");
  } catch (err) {
    log.error("OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).send("Failed to complete authentication");
  }
});

router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

router.get("/api/status", (_req: Request, res: Response) => {
  const users = getAllUsers();
  const healthy = users.filter(
    (u) => u.auth_status === "valid" && u.consecutive_failures === 0
  );
  const needsReauth = users.filter((u) => u.auth_status === "reauth_required");
  const degraded = users.filter(
    (u) => u.auth_status === "valid" && u.consecutive_failures > 0
  );
  res.json({
    authenticated_users: users.length,
    healthy: healthy.length,
    needs_reauth: needsReauth.length,
    degraded: degraded.length,
    users: users.map((u) => ({
      email: u.email,
      last_poll_at: u.last_poll_at,
      auth_status: u.auth_status,
      consecutive_failures: u.consecutive_failures,
      last_error: u.last_error,
    })),
  });
});

router.get("/api/notification/:eventId", (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const token = String(req.query.t || "");
  const result = verifyActionToken(token, eventId);
  if (!result.ok) {
    res.status(403).json({ error: `Invalid token (${result.reason})` });
    return;
  }
  const userEmail = result.payload!.user;

  const notification = getNotification(eventId, userEmail);
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const defaultDraft = buildNudgeBody({
    id: notification.event_id,
    summary: notification.event_summary,
    description: null,
    start: notification.event_start,
    end: "",
    organizer: notification.event_organizer,
    attendeeCount: notification.event_attendee_count,
    status: "confirmed",
    htmlLink: notification.event_html_link,
  });

  res.json({
    event_id: notification.event_id,
    event_summary: notification.event_summary,
    event_organizer: notification.event_organizer || "",
    event_attendee_count: notification.event_attendee_count,
    event_start: notification.event_start,
    default_draft: defaultDraft,
  });
});

router.post("/api/skip/:eventId", (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const token = String(req.query.t || "");
  const result = verifyActionToken(token, eventId);
  if (!result.ok) {
    res.status(403).json({ error: `Invalid token (${result.reason})` });
    return;
  }
  const userEmail = result.payload!.user;

  const notification = getNotification(eventId, userEmail);
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  updateEventAction(eventId, userEmail, "skipped");
  res.json({ event_summary: notification.event_summary });
});

const SPA_DIST = resolve(process.cwd(), "dist/web");
if (existsSync(SPA_DIST)) {
  router.use(express.static(SPA_DIST));
  router.get(/^\/(?!api|auth|healthz).*/, (_req: Request, res: Response) => {
    res.sendFile(resolve(SPA_DIST, "index.html"));
  });
} else {
  router.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "No Agenda? No Meeting",
      version: "0.1.0",
      note: "SPA bundle not built. Run `cd web && npm run build`.",
    });
  });
}
