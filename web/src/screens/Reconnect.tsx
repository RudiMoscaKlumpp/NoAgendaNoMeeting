import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export function Reconnect() {
  return (
    <Layout>
      <div className="pt-12 md:pt-20">
        <Card className="text-center space-y-4">
          <p className="text-xs font-black text-yellow uppercase tracking-widest">
            Reconnect needed
          </p>
          <p className="text-xl font-bold text-text">
            Your calendar access expired.
          </p>
          <p className="text-base text-subtext-0 font-medium">
            Sign in again to keep getting nudges.
          </p>
          <div className="pt-2">
            <Button onClick={() => (window.location.href = "/auth/google")}>
              Reconnect Google Calendar
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
