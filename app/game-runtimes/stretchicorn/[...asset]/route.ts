import { servePinnedGithubRuntimeAsset, type PinnedGithubRuntime } from '@/lib/arcade/pinnedGithubRuntime';

const STRETCHICORN_RUNTIME: PinnedGithubRuntime = {
  owner: 'sidhulyalkar',
  repo: 'stretchicorn',
  commit: '5635de71cae80a7728a45b11fd660fd87112c351',
  allowedAssets: new Set([
    'index.html',
    'src/style.css',
    'src/00-core.js',
    'src/01-combat.js',
    'src/02-update.js',
    'src/03-render.js',
    'src/04-ui-input.js',
  ]),
};

type RuntimeAssetRouteProps = {
  params: Promise<{ asset: string[] }>;
};

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RuntimeAssetRouteProps) {
  const { asset } = await params;
  return servePinnedGithubRuntimeAsset(STRETCHICORN_RUNTIME, asset);
}
