import { servePinnedGithubRuntimeAsset, type PinnedGithubRuntime } from '@/lib/arcade/pinnedGithubRuntime';

const UNIRICO_RUNTIME: PinnedGithubRuntime = {
  owner: 'sidhulyalkar',
  repo: 'uniRico',
  commit: '8dfe88461dd3644d234300ba2e586f46491548a5',
  allowedAssets: new Set([
    'index.html',
    'src/style.css',
    'src/levels.js',
    'src/runtime/core.js',
    'src/runtime/audio.js',
    'src/runtime/physics.js',
    'src/runtime/render-world.js',
    'src/runtime/render-entities.js',
    'src/runtime/render-hud.js',
    'src/runtime/ui.js',
  ]),
};

type RuntimeAssetRouteProps = {
  params: Promise<{ asset: string[] }>;
};

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  return servePinnedGithubRuntimeAsset(UNIRICO_RUNTIME, asset);
}
