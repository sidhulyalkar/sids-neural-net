import { notFound } from 'next/navigation';
import { FrontierEvidenceStory } from '@/components/frontier/evidence/FrontierEvidenceStory';
import { parseQualifiedStoryManifest } from '@/lib/frontier/evidence/eligibility';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'FRONTIER evidence test fixture', robots: { index: false, follow: false } };

/** CI-only synthetic fixture. It is never a research source, never linked
 * from the default feed, and returns 404 without the test-only environment flag. */
export default function FrontierEvidenceAudit() {
  if (process.env.FRONTIER_INTERACTION_AUDIT !== 'enabled') notFound();
  const source = {
    id: 'example:synthetic-reader-v1', publisher: 'Synthetic source fixture',
    url: 'https://example.org/synthetic-reader', kind: 'paper' as const,
    revision: 'test-v1', observedAt: '2026-11-14T19:13:13.373Z',
  };
  const rights = { display: 'permitted' as const, license: 'Synthetic fixture only',
    attribution: 'Synthetic visual regression data, not a research result' };
  const locator = (suffix: string) => ({
    sourceId: source.id, sourceUrl: source.url + '#' + suffix, revision: source.revision,
    section: suffix === 'figure-one' ? 'S2' : suffix === 'figure-two' ? 'S3' : suffix,
  });
  const figure = (id: string, suffix: string, caption: string, letter: string) => ({
    type: 'figure' as const, id,
    status: 'publisher-reported' as const, locator: locator(suffix),
    assetKey: 'sha256:' + letter.repeat(64),
    caption, alt: 'A synthetic visual test pattern, not an experiment.', rights,
  });
  const manifest = parseQualifiedStoryManifest({
    schemaVersion: 1, itemId: 'synthetic-evidence-audit',
    source, extractorVersion: 'synthetic-audit-only', compilerVersion: 'synthetic-audit-only',
    builtAt: '2026-11-14T19:13:13.373Z', state: 'partial',
    evidence: [
      { id: 'section-intro', type: 'quotation', status: 'publisher-reported',
        locator: locator('S1'), text: '1 Introduction' },
      { id: 'section-method', type: 'quotation', status: 'publisher-reported',
        locator: locator('S2'), text: '2 Experiment Design' },
      { id: 'section-results', type: 'quotation', status: 'publisher-reported',
        locator: locator('S3'), text: '3 Results' },
      { id: 'section-limits', type: 'quotation', status: 'publisher-reported',
        locator: locator('S4'), text: '4 Limitations and future work' },
      figure('figure-one', 'figure-one', 'Figure one: A source-shaped synthetic schematic for testing image display and provenance.', 'a'),
      figure('figure-two', 'figure-two', 'Figure two: A second synthetic schematic for testing navigation and mobile readability.', 'b'),
    ],
    scenes: [{
      id: 'inspect-figures', type: 'original-figure',
      title: 'Synthetic figure comparison controls',
      question: 'Can the reader navigate qualified source material accessibly?',
      evidenceIds: ['figure-one', 'figure-two'],
      operations: ['inspect', 'switch'],
      accessibleSummary: 'Two clearly marked synthetic browser-testing figures.',
      annotation: 'publisher-original',
    }],
  });
  return <FrontierEvidenceStory manifest={manifest}
    title="Synthetic evidence reader layout test"
    summary="This isolated browser fixture evaluates the research figure reader. The figures and captions are not experimental observations."
    syntheticFixture assets={{
      ['sha256:' + 'a'.repeat(64)]: '/api/frontier/evidence-audit-image/a',
      ['sha256:' + 'b'.repeat(64)]: '/api/frontier/evidence-audit-image/b',
    }}/>;
}
