export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ figure: string }> };

/** Test-only, synthetic SVGs. No third-party images or actual scientific data. */
export async function GET(_request: Request, { params }: Props) {
  if (process.env.FRONTIER_INTERACTION_AUDIT !== 'enabled') {
    return new Response(null, { status: 404 });
  }
  const { figure } = await params;
  if (figure !== 'a' && figure !== 'b') return new Response(null, { status: 404 });
  const isA = figure === 'a';
  const title = isA ? 'SIMULATED METHOD A' : 'SIMULATED METHOD B';
  const accent = isA ? '#54786b' : '#947d5d';
  const y = isA ? 160 : 180;
  const lines = Array.from({ length: 6 }, (_, index) => {
    const level = 60 + index * 55;
    return '<path d="M 42 ' + level + ' H 618" stroke="#cad5cc" stroke-width="1"/>';
  }).join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 410" role="img" aria-label="Synthetic CI-only figure">'
    + '<rect width="660" height="410" fill="#f1f0e9"/>'
    + lines
    + '<rect x="43" y="44" width="574" height="325" fill="none" stroke="#b4c4b8"/>'
    + '<path d="M 52 ' + y + ' C 140 90 220 265 310 165 S 480 235 600 110" fill="none" stroke="'
    + accent + '" stroke-width="5"/>'
    + '<circle cx="312" cy="165" r="7" fill="' + accent + '"/>'
    + '<path d="M 312 171 V 338" stroke="' + accent + '" stroke-dasharray="7 5"/>'
    + '<text x="50" y="27" fill="#35483b" font-family="monospace" font-size="15" font-weight="bold">' + title + '</text>'
    + '<text x="50" y="393" fill="#697c6c" font-family="monospace" font-size="12">TEST FIXTURE · NO REAL OBSERVATIONS OR MEASUREMENTS</text>'
    + '</svg>';
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'none'; script-src 'none'",
    },
  });
}
