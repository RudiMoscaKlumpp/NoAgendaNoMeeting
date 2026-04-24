import { Router, type Request, type Response } from "express";
import { google } from "googleapis";
import { getAuthUrl, exchangeCode, createOAuth2Client } from "./google-auth";
import { saveUserTokens, getAllUsers, type StoredTokens } from "./db";
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
