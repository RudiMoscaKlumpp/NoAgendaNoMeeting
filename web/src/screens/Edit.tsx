import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";

interface Notification {
  event_id: string;
  event_summary: string;
  event_organizer: string;
  event_attendee_count: number;
  event_start: string;
  default_draft: string;
}

const URL_MAX = 2000;

export function Edit() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [notif, setNotif] = useState<Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    fetch(`/api/notification/${eventId}?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        return r.json();
      })
      .then((n: Notification) => {
        setNotif(n);
        setDraft(n.default_draft);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [eventId, token]);

  const gmailUrl = useMemo(() => {
    if (!notif) return "";
    const params = new URLSearchParams({
      view: "cm",
      to: notif.event_organizer,
      su: `Re: ${notif.event_summary}`,
      body: draft,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }, [notif, draft]);

  return (
    <Layout>
      <div className="pt-8 space-y-8">
        <h1 className="text-4xl md:text-5xl font-black text-text tracking-tight">
          Edit nudge
        </h1>

        {error && (
          <Card className="border-red bg-red/10">
            <p className="text-sm text-red font-bold">{error}</p>
          </Card>
        )}

        {!notif && !error && (
          <p className="text-sm text-overlay-1 font-bold">Loading…</p>
        )}

        {notif && (
          <Card className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-black text-subtext-0 uppercase tracking-widest">
                Meeting
              </p>
              <p className="text-xl font-bold text-text">{notif.event_summary}</p>
              <p className="text-sm text-subtext-0 font-medium">
                Organiser: {notif.event_organizer}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-text uppercase tracking-widest">
                Your message
              </p>
              <Textarea
                rows={6}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <CharCount value={gmailUrl.length} max={URL_MAX} />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                disabled={gmailUrl.length > URL_MAX || draft.trim().length === 0}
                onClick={() => (window.location.href = gmailUrl)}
              >
                Open in Gmail
              </Button>
              <Button
                variant="outline"
                onClick={() => setDraft(notif.default_draft)}
              >
                Reset
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function CharCount({ value, max }: { value: number; max: number }) {
  const warn = value > max;
  return (
    <p
      className={`text-xs font-bold uppercase tracking-widest ${
        warn ? "text-red" : "text-overlay-1"
      }`}
    >
      {value} / {max} chars in Gmail URL
    </p>
  );
}
