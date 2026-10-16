import { ImageResponse } from 'next/og';

export const alt = 'Sid Neural Net';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          backgroundColor: '#050914',
          color: '#f8fbff',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          height: '100%',
          justifyContent: 'center',
          letterSpacing: '0',
          padding: '72px',
          width: '100%',
        }}
      >
        <div
          style={{
            border: '1px solid rgba(102, 227, 255, 0.34)',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            padding: '56px 64px',
            width: '100%',
          }}
        >
          <div style={{ color: '#66e3ff', fontSize: 24, letterSpacing: 6, textTransform: 'uppercase' }}>
            Sidharth Hulyalkar
          </div>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 0.96 }}>
            Sid Neural Net
          </div>
          <div style={{ color: '#b8c7d9', fontSize: 32, lineHeight: 1.35, maxWidth: 920 }}>
            Neuroscience data systems, multimodal ML, BCI infrastructure, applied AI, and creative technical work.
          </div>
        </div>
      </div>
    ),
    size
  );
}
