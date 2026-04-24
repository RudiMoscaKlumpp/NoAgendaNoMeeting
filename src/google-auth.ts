import { google } from "googleapis";
import { config } from "./config";
import {
  getUserTokens,
  updateUserTokens,
  markUserReauthRequired,
  markUserAuthValid,
  type StoredTokens,
} from "./db";
import { withRetry, isAuthError } from "./retry";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export class ReauthRequiredError extends Error {
  constructor(
    public readonly email: string,
    reason: string
  ) {
    super(`Re-authentication required for ${email}: ${reason}`);
    this.name = "ReauthRequiredError";
  }
}

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
    try {
      const { credentials } = await withRetry(
        () => client.refreshAccessToken(),
        {
          maxAttempts: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          shouldRetry: (err) => !isAuthError(err),
        }
      );
      const refreshed: StoredTokens = {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date!,
      };
      updateUserTokens(email, refreshed);
      markUserAuthValid(email);
      client.setCredentials(credentials);
    } catch (err) {
      if (isAuthError(err)) {
        const reason =
          err instanceof Error ? err.message : "Token expired or revoked";
        markUserReauthRequired(email, reason);
        throw new ReauthRequiredError(email, reason);
      }
      throw err;
    }
  }

  return client;
}
