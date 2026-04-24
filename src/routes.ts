import { Router, type Request, type Response } from "express";
import { google } from "googleapis";
import { getAuthUrl, exchangeCode, createOAuth2Client } from "./google-auth";
import { saveUserTokens, getAllUsers, getNotification, updateEventAction, type StoredTokens } from "./db";
import { buildGmailComposeUrl, buildNudgeBody } from "./email-template";
import { shsAuth } from "./middleware";

export const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "No Agenda? No Meeting",
    version: "0.1.0",
    endpoints: {
      auth: "/auth/google",
      callback: "/auth/google/callback",
      status: "/status",
    },
  });
});

router.get("/auth/google", (_req: Request, res: Response) => {
  const url = getAuthUrl();
  res.redirect(url);
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).json({ error: "Missing authorization code" });
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
      res.status(400).json({ error: "Could not retrieve user email" });
      return;
    }

    const storedTokens: StoredTokens = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
    };
    saveUserTokens(email, storedTokens);

    res.json({
      message: "Authentication successful",
      email,
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).json({ error: "Failed to complete authentication" });
  }
});

router.get("/status", shsAuth, (_req: Request, res: Response) => {
  const users = getAllUsers();
  res.json({
    authenticated_users: users.length,
    users: users.map((u) => ({
      email: u.email,
      last_poll_at: u.last_poll_at,
    })),
  });
});

router.get("/edit/:eventId", (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const userEmail = String(req.query.user || "");
  if (!userEmail) {
    res.status(400).send("Missing user parameter");
    return;
  }

  const notification = getNotification(eventId, userEmail);
  if (!notification) {
    res.status(404).send("Notification not found");
    return;
  }

  const defaultText = buildNudgeBody({
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

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edit nudge — ${esc(notification.event_summary)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #f4f4f4; padding: 24px; color: #333; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
    textarea { width: 100%; height: 120px; border: 1px solid #ccc; border-radius: 4px; padding: 10px; font-size: 14px; font-family: inherit; resize: vertical; }
    .char-count { font-size: 12px; color: #999; margin-top: 4px; margin-bottom: 16px; }
    .char-count.warn { color: #d93025; }
    button { display: block; width: 100%; padding: 10px; font-size: 14px; border: none; border-radius: 4px; cursor: pointer; background: #1a73e8; color: #fff; }
    button:hover { background: #1557b0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Edit your nudge</h1>
    <p class="meta">
      <strong>${esc(notification.event_summary)}</strong><br>
      Organizer: ${esc(notification.event_organizer || "Unknown")}<br>
      To: ${esc(notification.event_organizer || "")}
    </p>
    <textarea id="nudge">${esc(defaultText)}</textarea>
    <div class="char-count" id="charCount"></div>
    <button id="sendBtn">Open in Gmail</button>
  </div>
  <script>
    var textarea = document.getElementById('nudge');
    var charCount = document.getElementById('charCount');
    var sendBtn = document.getElementById('sendBtn');
    var organizer = ${JSON.stringify(notification.event_organizer || "")};
    var subject = 'Re: ' + ${JSON.stringify(notification.event_summary)};
    var URL_MAX = 2000;

    function update() {
      var body = textarea.value;
      var params = new URLSearchParams({ view: 'cm', to: organizer, su: subject, body: body });
      var url = 'https://mail.google.com/mail/?' + params.toString();
      var len = url.length;
      charCount.textContent = len + ' / ' + URL_MAX + ' chars in URL';
      charCount.className = len > URL_MAX ? 'char-count warn' : 'char-count';
    }

    textarea.addEventListener('input', update);
    update();

    sendBtn.addEventListener('click', function() {
      var body = textarea.value;
      var params = new URLSearchParams({ view: 'cm', to: organizer, su: subject, body: body });
      window.location.href = 'https://mail.google.com/mail/?' + params.toString();
    });
  </script>
</body>
</html>`);
});

router.get("/skip/:eventId", (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const userEmail = String(req.query.user || "");
  if (!userEmail) {
    res.status(400).send("Missing user parameter");
    return;
  }

  const notification = getNotification(eventId, userEmail);
  if (!notification) {
    res.status(404).send("Notification not found");
    return;
  }

  updateEventAction(eventId, userEmail, "skipped");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skipped</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #333; }
    .card { background: #fff; border-radius: 8px; padding: 32px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 18px; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Skipped</h1>
    <p>"${esc(notification.event_summary)}" won't be nudged.</p>
  </div>
</body>
</html>`);
});
