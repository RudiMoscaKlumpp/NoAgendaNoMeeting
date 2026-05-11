import { describe, it, expect } from "vitest";
import {
  buildNudgeSubject,
  buildNudgeBody,
  buildGmailComposeUrl,
  renderEmail,
} from "../src/email-template";
import type { CalendarEvent } from "../src/calendar-adapter";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    summary: "Sprint Planning",
    description: null,
    start: "2026-04-25T14:00:00Z",
    end: "2026-04-25T15:00:00Z",
    organizer: "pm@example.com",
    attendeeCount: 5,
    status: "confirmed",
    htmlLink: "https://calendar.google.com/event?eid=xyz",
    ...overrides,
  };
}

describe("buildNudgeSubject", () => {
  it("includes event summary and organizer", () => {
    const subject = buildNudgeSubject(makeEvent());
    expect(subject).toContain("Sprint Planning");
    expect(subject).toContain("pm@example.com");
  });

  it("handles missing organizer", () => {
    const subject = buildNudgeSubject(makeEvent({ organizer: null }));
    expect(subject).toContain("the organizer");
  });
});

describe("buildNudgeBody", () => {
  it("returns non-empty default nudge text", () => {
    const body = buildNudgeBody(makeEvent());
    expect(body.length).toBeGreaterThan(10);
    expect(body).toContain("agenda");
  });
});

describe("buildGmailComposeUrl", () => {
  it("produces a Gmail compose URL with correct params", () => {
    const url = buildGmailComposeUrl(makeEvent());
    expect(url).toContain("https://mail.google.com/mail/");
    expect(url).toContain("view=cm");
    expect(url).toContain("pm%40example.com");
    expect(url).toContain("Sprint+Planning");
  });

  it("uses custom nudge text when provided", () => {
    const url = buildGmailComposeUrl(makeEvent(), "Custom nudge message");
    expect(url).toContain("Custom+nudge+message");
  });
});

describe("renderEmail", () => {
  it("produces valid HTML from MJML template", async () => {
    const { html, subject } = await renderEmail(makeEvent(), "user@example.com");
    expect(subject).toContain("Sprint Planning");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("No agenda detected");
    expect(html).toContain("Sprint Planning");
    expect(html).toContain("pm@example.com");
  });

  it("includes signed action URLs for edit and skip", async () => {
    const { html } = await renderEmail(makeEvent(), "user@example.com");
    expect(html).toContain("/#/edit/evt-1?t=");
    expect(html).toContain("/#/skip/evt-1?t=");
    expect(html).not.toContain("user%40example.com"); // no plain email in URL anymore
  });

  it("includes Gmail compose URL", async () => {
    const { html } = await renderEmail(makeEvent(), "user@example.com");
    expect(html).toContain("mail.google.com");
  });

  it("escapes HTML special characters in summary", async () => {
    const { html } = await renderEmail(
      makeEvent({ summary: 'Meeting <script>alert("xss")</script>' }),
      "user@example.com"
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
