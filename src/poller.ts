import { getAllUsers, updateLastPollAt, isEventHandled, markEventHandled } from "./db";
import { getAuthenticatedClient } from "./google-auth";
import { pollNewEvents } from "./calendar-adapter";
import { needsAgenda } from "./detector";
import { dispatchNotification } from "./dispatcher";

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

async function pollUser(email: string, lastPollAt: string | null): Promise<void> {
  const client = await getAuthenticatedClient(email);
  if (!client) {
    console.warn(`[poller] Skipping ${email}: no valid credentials`);
    return;
  }

  const since = lastPollAt ? new Date(lastPollAt) : new Date(Date.now() - DEFAULT_LOOKBACK_MS);

  const events = await pollNewEvents(client, since);
  let flagged = 0;

  for (const event of events) {
    if (isEventHandled(event.id, email)) continue;

    if (needsAgenda(event)) {
      console.log(`[poller] Flagged: "${event.summary}" (${event.start}) for ${email}`);
      try {
        await dispatchNotification(event, email);
        flagged++;
      } catch (err) {
        console.error(`[poller] Failed to dispatch notification for "${event.summary}":`, err);
        markEventHandled(event.id, email, "dispatch_failed");
      }
    } else {
      markEventHandled(event.id, email, "ok");
    }
  }

  updateLastPollAt(email);
  console.log(`[poller] ${email}: checked ${events.length} events, flagged ${flagged}`);
}

async function runPollCycle(): Promise<void> {
  const users = getAllUsers();
  if (users.length === 0) {
    console.log("[poller] No users registered, skipping cycle");
    return;
  }

  console.log(`[poller] Starting poll cycle for ${users.length} user(s)`);

  for (const user of users) {
    try {
      await pollUser(user.email, user.last_poll_at);
    } catch (err) {
      console.error(`[poller] Error polling ${user.email}:`, err);
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPoller(): void {
  if (intervalHandle) return;

  console.log(`[poller] Starting with ${POLL_INTERVAL_MS / 1000}s interval`);

  runPollCycle().catch((err) => console.error("[poller] Initial cycle failed:", err));

  intervalHandle = setInterval(() => {
    runPollCycle().catch((err) => console.error("[poller] Cycle failed:", err));
  }, POLL_INTERVAL_MS);
}

export function stopPoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[poller] Stopped");
  }
}
