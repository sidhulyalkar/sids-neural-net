import Link from 'next/link';
import { Compass, Home, Search } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/portfolio/PageShell';

export default function NotFound() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="404 / Lost Signal"
        title="This node is not mapped."
        intro="The route you asked for is not mapped yet. Home, builds, publications, and contact channels are still available."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="signal-button min-h-11" href="/">
          <Home className="h-4 w-4" />
          Home
        </Link>
        <Link className="signal-button min-h-11" href="/projects">
          <Compass className="h-4 w-4" />
          Builds
        </Link>
        <Link className="signal-button min-h-11" href="/archive">
          <Search className="h-4 w-4" />
          Archive
        </Link>
      </div>
    </PageShell>
  );
}
