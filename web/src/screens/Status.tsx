import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

interface User {
  email: string;
  last_poll_at: string | null;
  auth_status: string;
  consecutive_failures: number;
  last_error: string | null;
}

interface StatusResponse {
  authenticated_users: number;
  healthy: number;
  needs_reauth: number;
  degraded: number;
  users: User[];
}

export function Status() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <Layout>
      <div className="pt-8 space-y-8">
        <h1 className="text-4xl md:text-5xl font-black text-text tracking-tight">
          Status
        </h1>

        {error && (
          <Card className="border-red bg-red/10">
            <p className="text-sm text-red font-bold">{error}</p>
          </Card>
        )}

        {!data && !error && (
          <p className="text-sm text-overlay-1 font-bold">Loading…</p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Connected" value={data.authenticated_users} />
              <Stat label="Healthy" value={data.healthy} accent="green" />
              <Stat
                label="Needs Re-auth"
                value={data.needs_reauth}
                accent={data.needs_reauth > 0 ? "yellow" : undefined}
              />
            </div>

            {data.users.length === 0 && (
              <Card>
                <p className="text-sm text-subtext-0 font-medium">
                  Nobody connected yet.
                </p>
                <div className="pt-4">
                  <Button onClick={() => (window.location.href = "/auth/google")}>
                    Connect Calendar
                  </Button>
                </div>
              </Card>
            )}

            {data.users.map((u) => (
              <Card key={u.email} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-base font-bold text-text">{u.email}</p>
                  <Pill auth={u.auth_status} />
                </div>
                <div className="text-sm text-subtext-0 font-medium">
                  Last poll:{" "}
                  {u.last_poll_at
                    ? new Date(u.last_poll_at + "Z").toLocaleString()
                    : "—"}
                </div>
                {u.last_error && (
                  <div className="text-sm text-red font-medium">
                    {u.last_error}
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </Layout>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "green" | "yellow" | "red";
}) {
  const accentClass =
    accent === "green"
      ? "text-green"
      : accent === "yellow"
      ? "text-yellow"
      : accent === "red"
      ? "text-red"
      : "text-text";
  return (
    <Card className="text-center">
      <div className={`text-3xl font-black ${accentClass}`}>{value}</div>
      <div className="mt-2 text-xs font-black text-subtext-0 uppercase tracking-widest">
        {label}
      </div>
    </Card>
  );
}

function Pill({ auth }: { auth: string }) {
  const map: Record<string, string> = {
    valid: "bg-green text-on-accent",
    reauth_required: "bg-yellow text-on-accent",
  };
  const cls = map[auth] || "bg-surface-1 text-text";
  return (
    <span
      className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${cls}`}
    >
      {auth.replace("_", " ")}
    </span>
  );
}
