import type { CalendarEvent } from "./calendar-adapter";

export function needsAgenda(event: CalendarEvent): boolean {
  if (event.attendeeCount < 2) return false;

  const desc = (event.description || "").trim();
  return desc.length === 0;
}
