import { Metadata } from 'next';

interface FieldNotePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FieldNotePageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Field Note: ${slug.replace(/-/g, ' ')}`,
  };
}

export default async function FieldNotePage({ params }: FieldNotePageProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="text-sm text-text-muted mb-2">Field Note</div>
          <h1 className="text-4xl font-bold text-text-primary capitalize">
            {slug.replace(/-/g, ' ')}
          </h1>
        </div>

        <div className="glass-card prose-neural">
          <p className="text-text-secondary">
            Field note content for <span className="text-green font-mono">{slug}</span> will be loaded from MDX.
          </p>
        </div>
      </div>
    </div>
  );
}
