import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArcadePlaySpace } from '@/components/arcade/ArcadePlaySpace';
import { arcadeGames, getArcadeGame } from '@/src/data/arcadeGames';

type ArcadeGamePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return arcadeGames.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: ArcadeGamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getArcadeGame(slug);
  if (!game) return {};
  return {
    title: `${game.title} | Game Network`,
    description: game.description,
    alternates: { canonical: `/arcade/${game.slug}` },
  };
}

export default async function ArcadeGamePage({ params }: ArcadeGamePageProps) {
  const { slug } = await params;
  const game = getArcadeGame(slug);
  if (!game) notFound();
  return <ArcadePlaySpace game={game} />;
}
