import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export function NotFound() {
  return (
    <Layout>
      <div className="pt-12 md:pt-20">
        <Card className="text-center space-y-4">
          <p className="text-xs font-black text-subtext-0 uppercase tracking-widest">
            Not found
          </p>
          <p className="text-xl font-bold text-text">Nothing here.</p>
          <div className="pt-2">
            <Button variant="outline" onClick={() => (window.location.hash = "#/")}>
              Home
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
