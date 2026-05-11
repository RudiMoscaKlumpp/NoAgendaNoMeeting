import type { CalendarEvent } from "./calendar-adapter";

export function needsAgenda(event: CalendarEvent, userEmail: string): boolean {
  if (event.organizer && event.organizer.toLowerCase() === userEmail.toLowerCase()) {
    return false;
  }
  if (event.attendeeCount < 2) return false;

  const desc = (event.description || "").trim();
  return desc.length === 0;
}
