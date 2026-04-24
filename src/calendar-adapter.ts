import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  organizer: string | null;
  attendeeCount: number;
  status: string;
  htmlLink: string | null;
}

function toCalendarEvent(item: calendar_v3.Schema$Event): CalendarEvent | null {
  if (!item.id || !item.start) return null;

  return {
    id: item.id,
    summary: item.summary || "(no title)",
    description: item.description || null,
    start: item.start.dateTime || item.start.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    organizer: item.organizer?.email || null,
    attendeeCount: item.attendees?.length || 0,
    status: item.status || "confirmed",
    htmlLink: item.htmlLink || null,
  };
}

export async function pollNewEvents(
  client: OAuth2Client,
  since: Date
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth: client });

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: since.toISOString(),
      timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
    });

    for (const item of res.data.items || []) {
      const event = toCalendarEvent(item);
      if (event && event.status === "confirmed") {
        events.push(event);
      }
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return events;
}
