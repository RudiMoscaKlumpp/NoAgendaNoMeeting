import mjml2html from "mjml";
import type { CalendarEvent } from "./calendar-adapter";
import { config } from "./config";

const DEFAULT_NUDGE_TEXT =
  "Hey — I noticed the meeting invite doesn't have an agenda yet. " +
  "Could you add a quick outline of what we'll cover? " +
  "It helps everyone come prepared. Thanks!";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function gmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    view: "cm",
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function buildNudgeSubject(event: CalendarEvent): string {
  const organizer = event.organizer || "the organizer";
  return `"${event.summary}" has no agenda — nudge ${organizer}?`;
}

export function buildNudgeBody(event: CalendarEvent): string {
  return DEFAULT_NUDGE_TEXT;
}

export function buildGmailComposeUrl(event: CalendarEvent, nudgeText?: string): string {
  const to = event.organizer || "";
  const subject = `Re: ${event.summary}`;
  const body = nudgeText || DEFAULT_NUDGE_TEXT;
  return gmailComposeUrl(to, subject, body);
}

export async function renderEmail(
  event: CalendarEvent,
  userEmail: string
): Promise<{ html: string; subject: string }> {
  const subject = buildNudgeSubject(event);
  const gmailUrl = buildGmailComposeUrl(event);
  const editUrl = `${config.appUrl}/edit/${event.id}?user=${encodeURIComponent(userEmail)}`;
  const skipUrl = `${config.appUrl}/skip/${event.id}?user=${encodeURIComponent(userEmail)}`;

  const mjmlTemplate = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.5" color="#333333" />
    </mj-attributes>
    <mj-style>
      .event-detail { color: #666; font-size: 13px; }
      .nudge-preview { background: #f5f5f5; padding: 12px; border-radius: 4px; font-style: italic; color: #555; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" border-radius="8px" padding="24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" color="#1a1a1a" padding-bottom="4px">
          No agenda detected
        </mj-text>
        <mj-text padding-bottom="16px">
          This meeting invite has no description. Want to nudge the organizer?
        </mj-text>
        <mj-divider border-color="#e0e0e0" border-width="1px" />
        <mj-text padding-top="16px" padding-bottom="4px" font-weight="bold" font-size="16px">
          ${escapeHtml(event.summary)}
        </mj-text>
        <mj-text css-class="event-detail" padding-bottom="2px">
          When: ${escapeHtml(formatDate(event.start))}
        </mj-text>
        <mj-text css-class="event-detail" padding-bottom="2px">
          Organizer: ${escapeHtml(event.organizer || "Unknown")}
        </mj-text>
        <mj-text css-class="event-detail" padding-bottom="16px">
          Attendees: ${event.attendeeCount}
        </mj-text>
        <mj-divider border-color="#e0e0e0" border-width="1px" />
        <mj-text padding-top="16px" padding-bottom="4px" font-weight="bold">
          Draft nudge:
        </mj-text>
        <mj-text css-class="nudge-preview" padding-bottom="20px">
          "${escapeHtml(DEFAULT_NUDGE_TEXT)}"
        </mj-text>
        <mj-button background-color="#1a73e8" border-radius="4px" font-size="14px" href="${escapeHtml(gmailUrl)}" padding-bottom="8px" width="100%">
          Send via Gmail
        </mj-button>
        <mj-button background-color="#ffffff" border-radius="4px" font-size="14px" color="#1a73e8" border="1px solid #1a73e8" href="${escapeHtml(editUrl)}" padding-bottom="8px" width="100%">
          Edit first
        </mj-button>
        <mj-button background-color="#ffffff" border-radius="4px" font-size="14px" color="#666666" border="1px solid #cccccc" href="${escapeHtml(skipUrl)}" padding-bottom="0" width="100%">
          Skip this one
        </mj-button>
      </mj-column>
    </mj-section>
    <mj-section padding="16px">
      <mj-column>
        <mj-text font-size="11px" color="#999999" align="center">
          No Agenda? No Meeting — Sent because you're invited to a meeting with no description.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const { html, errors } = await mjml2html(mjmlTemplate);
  if (errors.length > 0) {
    console.error("[email-template] MJML errors:", errors);
  }

  return { html, subject };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
