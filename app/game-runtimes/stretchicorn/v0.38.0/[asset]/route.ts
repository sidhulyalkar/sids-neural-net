import { NextResponse } from 'next/server';

type LegacyStretchicornRouteProps = {
  params: Promise<{ asset: string }>;
};

export const dynamic = 'force-dynamic';

/** Legacy versioned path → canonical live-main Stretchicorn runtime. */
export async function GET(request: Request, { params }: LegacyStretchicornRouteProps) {
  const { asset } = await params;
  if (asset !== 'index.html') {
    return new NextResponse('Unknown Stretchicorn runtime asset.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const target = new URL('/game-runtimes/stretchicorn/index.html', request.url);
  const response = NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}
