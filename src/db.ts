import Database from "better-sqlite3";
import { resolve } from "path";
import { encrypt, decrypt } from "./crypto";
import type { CalendarEvent } from "./calendar-adapter";

const DB_PATH = resolve(process.cwd(), "nanm.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    migrateSchema(db);
  }
  return db;
}

function migrateSchema(db: Database.Database): void {
  const cols = db
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  if (cols.length > 0 && !colNames.has("auth_status")) {
    db.exec(`
      ALTER TABLE users ADD COLUMN auth_status TEXT NOT NULL DEFAULT 'valid';
      ALTER TABLE users ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN last_error TEXT;
    `);
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      encrypted_google_tokens TEXT NOT NULL,
      last_poll_at TEXT,
      auth_status TEXT NOT NULL DEFAULT 'valid',
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
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

    CREATE TABLE IF NOT EXISTS notifications (
      event_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      event_summary TEXT NOT NULL,
      event_start TEXT NOT NULL,
      event_organizer TEXT,
      event_attendee_count INTEGER NOT NULL DEFAULT 0,
      event_html_link TEXT,
      notified_at TEXT NOT NULL DEFAULT (datetime('now')),
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

export function getAllUsers(): Array<{
  email: string;
  last_poll_at: string | null;
  auth_status: string;
  consecutive_failures: number;
  last_error: string | null;
}> {
  return getDb()
    .prepare("SELECT email, last_poll_at, auth_status, consecutive_failures, last_error FROM users")
    .all() as Array<{
    email: string;
    last_poll_at: string | null;
    auth_status: string;
    consecutive_failures: number;
    last_error: string | null;
  }>;
}

export function markUserReauthRequired(email: string, reason: string): void {
  getDb()
    .prepare(
      "UPDATE users SET auth_status = 'reauth_required', last_error = ? WHERE email = ?"
    )
    .run(reason, email);
}

export function markUserAuthValid(email: string): void {
  getDb()
    .prepare(
      "UPDATE users SET auth_status = 'valid', consecutive_failures = 0, last_error = NULL WHERE email = ?"
    )
    .run(email);
}

export function recordPollFailure(email: string, error: string): void {
  getDb()
    .prepare(
      "UPDATE users SET consecutive_failures = consecutive_failures + 1, last_error = ? WHERE email = ?"
    )
    .run(error, email);
}

export function resetPollFailures(email: string): void {
  getDb()
    .prepare(
      "UPDATE users SET consecutive_failures = 0, last_error = NULL WHERE email = ?"
    )
    .run(email);
}

export function isEventHandled(eventId: string, userEmail: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM handled_events WHERE event_id = ? AND user_email = ?")
    .get(eventId, userEmail);
  return !!row;
}

export function markEventHandled(eventId: string, userEmail: string, action: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO handled_events (event_id, user_email, action)
       VALUES (?, ?, ?)`
    )
    .run(eventId, userEmail, action);
}

export function updateEventAction(eventId: string, userEmail: string, action: string): void {
  getDb()
    .prepare("UPDATE handled_events SET action = ? WHERE event_id = ? AND user_email = ?")
    .run(action, eventId, userEmail);
}

export function saveNotification(event: CalendarEvent, userEmail: string): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO notifications
       (event_id, user_email, event_summary, event_start, event_organizer, event_attendee_count, event_html_link)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      event.id,
      userEmail,
      event.summary,
      event.start,
      event.organizer,
      event.attendeeCount,
      event.htmlLink
    );
}

export interface NotificationRow {
  event_id: string;
  user_email: string;
  event_summary: string;
  event_start: string;
  event_organizer: string | null;
  event_attendee_count: number;
  event_html_link: string | null;
}

export function getNotification(eventId: string, userEmail: string): NotificationRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM notifications WHERE event_id = ? AND user_email = ?")
      .get(eventId, userEmail) as NotificationRow | undefined) || null
  );
}
