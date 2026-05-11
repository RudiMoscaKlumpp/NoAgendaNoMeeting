import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export function Skip() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/skip/${eventId}?t=${encodeURIComponent(token)}`, {
      method: "POST",
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body as { event_summary: string };
      })
      .then((b) => {
        setSummary(b.event_summary);
        setState("done");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      });
  }, [eventId, token]);

  return (
    <Layout>
      <div className="pt-12 md:pt-20">
        <Card className="text-center space-y-4">
          {state === "working" && (
            <>
              <p className="text-xs font-black text-subtext-0 uppercase tracking-widest">
                Skipping…
              </p>
              <p className="text-base text-subtext-0 font-medium">One moment.</p>
            </>
          )}
          {state === "done" && (
            <>
              <p className="text-xs font-black text-green uppercase tracking-widest">
                Skipped
              </p>
              <p className="text-xl font-bold text-text">"{summary}"</p>
              <p className="text-base text-subtext-0 font-medium">
                Won't be nudged.
              </p>
              <div className="pt-2">
                <Button variant="outline" onClick={() => (window.location.hash = "#/status")}>
                  Done
                </Button>
              </div>
            </>
          )}
          {state === "error" && (
            <>
              <p className="text-xs font-black text-red uppercase tracking-widest">
                Couldn't skip
              </p>
              <p className="text-base text-subtext-0 font-medium">{error}</p>
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}
