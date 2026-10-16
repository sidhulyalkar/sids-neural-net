'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/portfolio/PageShell';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Runtime Fallback"
        title="One experimental layer failed to render."
        intro="The rest of the portfolio is still available. You can retry this route, return to the atlas, or use the site map from the header."
        meta={
          <span>
            Error signal: <span className="font-mono text-text-primary">{error.digest ?? error.name}</span>
          </span>
        }
      />
      <button type="button" onClick={reset} className="signal-button min-h-11">
        <RotateCcw className="h-4 w-4" />
        Retry route
      </button>
      <div className="mt-8 flex items-start gap-3 text-sm leading-6 text-text-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        <p>
          This fallback is intentionally quiet so a visual experiment never makes the whole site feel broken.
        </p>
      </div>
    </PageShell>
  );
}
