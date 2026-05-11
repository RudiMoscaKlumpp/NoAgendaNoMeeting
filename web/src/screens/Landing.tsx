import { Layout } from "../components/Layout";
import { Button } from "../components/Button";

export function Landing() {
  return (
    <Layout>
      <div className="pt-12 md:pt-24 space-y-10">
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-black text-text tracking-tight">
            Nudge organisers
            <br />
            for an agenda.
          </h1>
          <p className="text-lg text-subtext-0 font-medium leading-relaxed max-w-lg">
            We watch your calendar. When an invite arrives without a description,
            we email you a pre-drafted nudge to the organiser. You stay in control
            of every send.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => (window.location.href = "/auth/google")}>
            Connect Google Calendar
          </Button>
          <Button variant="outline" onClick={() => (window.location.hash = "#/status")}>
            Status
          </Button>
        </div>

        <div className="pt-10 border-t-2 border-surface-2 space-y-3">
          <p className="text-xs font-black text-text uppercase tracking-widest">
            What we read
          </p>
          <p className="text-sm text-subtext-0 font-medium">
            Read-only access to your calendar. We never modify events.
          </p>
        </div>
      </div>
    </Layout>
  );
}
