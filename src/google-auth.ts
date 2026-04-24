import { google } from "googleapis";
import { config } from "./config";
import { getUserTokens, updateUserTokens, type StoredTokens } from "./db";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCode(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(email: string) {
  const tokens = getUserTokens(email);
  if (!tokens) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    const { credentials } = await client.refreshAccessToken();
    const refreshed: StoredTokens = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || tokens.refresh_token,
      expiry_date: credentials.expiry_date!,
    };
    updateUserTokens(email, refreshed);
    client.setCredentials(credentials);
  }

  return client;
}
