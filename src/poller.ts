import {
  getAllUsers,
  updateLastPollAt,
  isEventHandled,
  markEventHandled,
  recordPollFailure,
  resetPollFailures,
  markUserReauthRequired,
} from "./db";
import { getAuthenticatedClient, ReauthRequiredError } from "./google-auth";
import { pollNewEvents } from "./calendar-adapter";
import { needsAgenda } from "./detector";
import { dispatchNotification } from "./dispatcher";
import { isAuthError } from "./retry";

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

async function pollUser(email: string, lastPollAt: string | null): Promise<void> {
  const client = await getAuthenticatedClient(email);
  if (!client) {
    console.warn(`[poller] Skipping ${email}: no valid credentials`);
    return;
  }

  const since = lastPollAt
    ? new Date(lastPollAt)
    : new Date(Date.now() - DEFAULT_LOOKBACK_MS);

  const events = await pollNewEvents(client, since);
  let flagged = 0;

  for (const event of events) {
    if (isEventHandled(event.id, email)) continue;

    if (needsAgenda(event)) {
      console.log(
        `[poller] Flagged: "${event.summary}" (${event.start}) for ${email}`
      );
      try {
        await dispatchNotification(event, email);
        flagged++;
      } catch (err) {
        console.error(
          `[poller] Failed to dispatch notification for "${event.summary}":`,
          err
        );
        markEventHandled(event.id, email, "dispatch_failed");
      }
    } else {
      markEventHandled(event.id, email, "ok");
    }
  }

  updateLastPollAt(email);
  resetPollFailures(email);
  console.log(
    `[poller] ${email}: checked ${events.length} events, flagged ${flagged}`
  );
}

async function runPollCycle(): Promise<void> {
  const users = getAllUsers();
  if (users.length === 0) {
    console.log("[poller] No users registered, skipping cycle");
    return;
  }

  console.log(`[poller] Starting poll cycle for ${users.length} user(s)`);

  for (const user of users) {
    if (user.auth_status === "reauth_required") {
      console.warn(
        `[poller] Skipping ${user.email}: re-authentication required`
      );
      continue;
    }

    if (user.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(
        `[poller] Skipping ${user.email}: ${user.consecutive_failures} consecutive failures (last: ${user.last_error})`
      );
      continue;
    }

    try {
      await pollUser(user.email, user.last_poll_at);
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        console.error(
          `[poller] ${user.email}: token invalid, re-auth required`
        );
      } else if (isAuthError(err)) {
        const reason =
          err instanceof Error ? err.message : "Authentication error";
        markUserReauthRequired(user.email, reason);
        console.error(`[poller] ${user.email}: auth error — ${reason}`);
      } else {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        recordPollFailure(user.email, errorMsg);
        console.error(`[poller] Error polling ${user.email}:`, err);
      }
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPoller(): void {
  if (intervalHandle) return;

  console.log(`[poller] Starting with ${POLL_INTERVAL_MS / 1000}s interval`);

  runPollCycle().catch((err) =>
    console.error("[poller] Initial cycle failed:", err)
  );

  intervalHandle = setInterval(() => {
    runPollCycle().catch((err) =>
      console.error("[poller] Cycle failed:", err)
    );
  }, POLL_INTERVAL_MS);
}

export function stopPoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[poller] Stopped");
  }
}
