import { NextResponse } from 'next/server';
import { NATURE_WORLDS, NATURE_WORLD_PALETTES } from '@/lib/physiology/natureWorldsExpanded';

export const dynamic = 'force-static';

const scenes = NATURE_WORLDS.map((world) => ({
  id: world.id,
  index: world.index,
  name: world.name,
  icon: world.icon,
  collection: world.collection,
  collectionLabel: world.scene.collectionLabel,
  theme: world.theme,
  terrain: world.terrain,
  wildlife: world.wildlife,
  seed: world.seed,
  palette: NATURE_WORLD_PALETTES[world.palette],
  scene: {
    atmosphere: world.scene.atmosphere,
    depth: world.scene.depth,
    focalSubject: world.scene.focalSubject,
    renderCues: world.scene.renderCues,
    density: world.scene.density,
    sparkle: world.scene.sparkle,
  },
}));

if (scenes.length !== 1000) {
  throw new Error(`Mosslight atlas feed invariant failed: expected 1000 scenes, got ${scenes.length}`);
}

const body = `window.MosslightAtlas=${JSON.stringify({ schemaVersion: 1, count: scenes.length, scenes })};`;

export async function GET() {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
