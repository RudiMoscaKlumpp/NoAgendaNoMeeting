import Database from "better-sqlite3";
import { resolve } from "path";
import { encrypt, decrypt } from "./crypto";

const DB_PATH = resolve(process.cwd(), "nanm.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      encrypted_google_tokens TEXT NOT NULL,
      last_poll_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handled_events (
      event_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      handled_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, user_email),
      FOREIGN KEY (user_email) REFERENCES users(email)
    );
  `);
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export function saveUserTokens(email: string, tokens: StoredTokens): void {
  const encrypted = encrypt(JSON.stringify(tokens));
  getDb()
    .prepare(
      `INSERT INTO users (email, encrypted_google_tokens)
       VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET encrypted_google_tokens = excluded.encrypted_google_tokens`
    )
    .run(email, encrypted);
}

export function getUserTokens(email: string): StoredTokens | null {
  const row = getDb()
    .prepare("SELECT encrypted_google_tokens FROM users WHERE email = ?")
    .get(email) as { encrypted_google_tokens: string } | undefined;
  if (!row) return null;
  return JSON.parse(decrypt(row.encrypted_google_tokens));
}

export function updateUserTokens(email: string, tokens: StoredTokens): void {
  const encrypted = encrypt(JSON.stringify(tokens));
  getDb()
    .prepare("UPDATE users SET encrypted_google_tokens = ? WHERE email = ?")
    .run(encrypted, email);
}

export function updateLastPollAt(email: string): void {
  getDb()
    .prepare("UPDATE users SET last_poll_at = datetime('now') WHERE email = ?")
    .run(email);
}

export function getAllUsers(): Array<{ email: string; last_poll_at: string | null }> {
  return getDb()
    .prepare("SELECT email, last_poll_at FROM users")
    .all() as Array<{ email: string; last_poll_at: string | null }>;
}
