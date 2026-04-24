import nodemailer from "nodemailer";
import { config } from "./config";
import { renderEmail } from "./email-template";
import { markEventHandled, saveNotification } from "./db";
import type { CalendarEvent } from "./calendar-adapter";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass,
  },
});

export async function dispatchNotification(
  event: CalendarEvent,
  userEmail: string
): Promise<void> {
  const { html, subject } = await renderEmail(event, userEmail);

  await transporter.sendMail({
    from: config.emailFrom,
    to: userEmail,
    subject,
    html,
  });

  saveNotification(event, userEmail);
  markEventHandled(event.id, userEmail, "notified");

  console.log(`[dispatcher] Sent notification for "${event.summary}" to ${userEmail}`);
}
