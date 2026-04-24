import { describe, it, expect } from "vitest";
import { needsAgenda } from "../src/detector";
import type { CalendarEvent } from "../src/calendar-adapter";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    summary: "Team Standup",
    description: null,
    start: "2026-04-25T10:00:00Z",
    end: "2026-04-25T10:30:00Z",
    organizer: "alice@example.com",
    attendeeCount: 3,
    status: "confirmed",
    htmlLink: "https://calendar.google.com/event?eid=abc",
    ...overrides,
  };
}

describe("needsAgenda", () => {
  it("flags events with 2+ attendees and no description", () => {
    expect(needsAgenda(makeEvent())).toBe(true);
  });

  it("flags events with empty-string description", () => {
    expect(needsAgenda(makeEvent({ description: "" }))).toBe(true);
  });

  it("flags events with whitespace-only description", () => {
    expect(needsAgenda(makeEvent({ description: "   \n\t  " }))).toBe(true);
  });

  it("does not flag events with a description", () => {
    expect(needsAgenda(makeEvent({ description: "Discuss Q3 roadmap" }))).toBe(false);
  });

  it("does not flag 1-on-1 meetings (< 2 attendees)", () => {
    expect(needsAgenda(makeEvent({ attendeeCount: 1 }))).toBe(false);
  });

  it("does not flag solo events (0 attendees)", () => {
    expect(needsAgenda(makeEvent({ attendeeCount: 0 }))).toBe(false);
  });

  it("flags events with exactly 2 attendees and no description", () => {
    expect(needsAgenda(makeEvent({ attendeeCount: 2 }))).toBe(true);
  });
});
