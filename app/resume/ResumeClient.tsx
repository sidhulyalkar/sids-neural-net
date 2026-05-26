'use client';

import { useState, useEffect } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { BackToAtlasButton, ExternalLinkChip, PageHeader, PageShell, SectionShell } from '@/components/portfolio/PageShell';

const resumeUrl = '/resume/SidharthHulyalkar_Resume.pdf';

const resumeHighlights = [
  'Neuroscience data infrastructure and DataJoint workflows',
  'Multimodal ML, neural time series, and behavioral analysis systems',
  'BCI, real-time streaming, and scientific software engineering',
  'Applied AI tools, cloud infrastructure, and researcher-facing interfaces',
];

const resumeSkills = [
  'Python',
  'PyTorch',
  'React / TypeScript',
  'FastAPI',
  'Docker',
  'Kubernetes',
  'AWS',
  'DataJoint',
  'NWB',
  'Zarr',
  'DeepLabCut',
  'electrophysiology',
  'calcium imaging',
  'foundation models',
  'mechanistic interpretability',
];

function PDFViewer({ url }: { url: string }) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fallback UI when PDF embed isn't supported
  const FallbackView = () => (
    <div className="relative z-10 flex h-[72vh] min-h-[34rem] w-full flex-col items-center justify-center gap-6 border border-white/10 bg-bg-panel/50 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10">
        <FileText className="h-8 w-8 text-cyan" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-medium text-text-primary">Resume PDF</p>
        <p className="max-w-sm text-sm text-text-secondary">
          PDF preview unavailable in this browser. Use the buttons below to view or download.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan/30 bg-cyan/10 px-5 py-2.5 text-sm font-medium text-cyan transition-colors hover:border-cyan/50 hover:bg-cyan/20"
        >
          Open in New Tab
          <ExternalLink className="h-4 w-4" />
        </a>
        <a
          href={url}
          download
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-cyan/35 hover:text-cyan"
        >
          Download PDF
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );

  if (!isClient) {
    return <FallbackView />;
  }

  if (embedFailed) {
    return <FallbackView />;
  }

  return (
    <object
      data={url}
      type="application/pdf"
      className="relative z-10 h-[72vh] min-h-[34rem] w-full border border-white/10 bg-black"
      onError={() => setEmbedFailed(true)}
    >
      {/* Fallback for browsers that can't render object */}
      <embed
        src={url}
        type="application/pdf"
        className="h-full w-full"
        onError={() => setEmbedFailed(true)}
      />
      {/* Ultimate fallback */}
      <FallbackView />
    </object>
  );
}

export default function ResumeClient() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="resume"
        title="current resume"
        actions={
          <>
            <BackToAtlasButton />
            <ExternalLinkChip href={resumeUrl}>Open PDF</ExternalLinkChip>
            <a
              href={resumeUrl}
              download
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-cyan/35 hover:text-cyan"
            >
              Download
              <Download className="h-4 w-4" />
            </a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <SectionShell title="Highlights" eyebrow="resume context" className="my-0">
          <div className="node-shell p-5">
            <div className="mb-5 flex items-center gap-3">
              <FileText className="h-5 w-5 text-cyan" />
              <p className="technical-label">current PDF</p>
            </div>
            <ul className="space-y-3 text-sm leading-6 text-text-secondary">
              {resumeHighlights.map((highlight) => (
                <li key={highlight} className="border-l border-cyan/25 pl-3">
                  {highlight}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
              {resumeSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-sm border border-cyan/20 bg-cyan/[0.06] px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-cyan/80"
                >
                  {skill}
                </span>
              ))}
            </div>
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-cyan hover:text-cyan-100"
            >
              View in new tab
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </SectionShell>

        <section className="pdf-dendrite-frame min-h-[36rem] overflow-hidden p-3">
          <PDFViewer url={resumeUrl} />
        </section>
      </div>
    </PageShell>
  );
}
