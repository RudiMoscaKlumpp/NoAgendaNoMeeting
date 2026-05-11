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
import { createLogger } from "./logger";

const log = createLogger("poller");

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

async function pollUser(email: string, lastPollAt: string | null): Promise<void> {
  const client = await getAuthenticatedClient(email);
  if (!client) {
    log.warn("Skipping user: no valid credentials", { email });
    return;
  }

  const since = lastPollAt
    ? new Date(lastPollAt)
    : new Date(Date.now() - DEFAULT_LOOKBACK_MS);

  const events = await pollNewEvents(client, since);
  let flagged = 0;

  for (const event of events) {
    if (isEventHandled(event.id, email)) continue;

    if (needsAgenda(event, email)) {
      log.info("Event flagged: no agenda", { email, summary: event.summary, start: event.start });
      try {
        await dispatchNotification(event, email);
        flagged++;
      } catch (err) {
        log.error("Failed to dispatch notification", {
          email, summary: event.summary,
          error: err instanceof Error ? err.message : String(err),
        });
        markEventHandled(event.id, email, "dispatch_failed");
      }
    } else {
      markEventHandled(event.id, email, "ok");
    }
  }

  updateLastPollAt(email);
  resetPollFailures(email);
  log.info("Poll cycle complete for user", { email, checked: events.length, flagged });
}

async function runPollCycle(): Promise<void> {
  const users = getAllUsers();
  if (users.length === 0) {
    log.info("No users registered, skipping cycle");
    return;
  }

  log.info("Starting poll cycle", { users: users.length });

  for (const user of users) {
    if (user.auth_status === "reauth_required") {
      log.warn("Skipping user: re-authentication required", { email: user.email });
      continue;
    }

    if (user.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
      log.warn("Skipping user: too many consecutive failures", {
        email: user.email, failures: user.consecutive_failures, lastError: user.last_error,
      });
      continue;
    }

    try {
      await pollUser(user.email, user.last_poll_at);
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        log.error("Token invalid, re-auth required", { email: user.email });
      } else if (isAuthError(err)) {
        const reason = err instanceof Error ? err.message : "Authentication error";
        markUserReauthRequired(user.email, reason);
        log.error("Auth error", { email: user.email, reason });
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        recordPollFailure(user.email, errorMsg);
        log.error("Poll failed", { email: user.email, error: errorMsg });
      }
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPoller(): void {
  if (intervalHandle) return;

  log.info("Poller starting", { intervalSeconds: POLL_INTERVAL_MS / 1000 });

  runPollCycle().catch((err) =>
    log.error("Initial cycle failed", { error: err instanceof Error ? err.message : String(err) })
  );

  intervalHandle = setInterval(() => {
    runPollCycle().catch((err) =>
      log.error("Cycle failed", { error: err instanceof Error ? err.message : String(err) })
    );
  }, POLL_INTERVAL_MS);
}

export function stopPoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    log.info("Poller stopped");
  }
}
