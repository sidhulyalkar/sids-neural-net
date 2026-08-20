import Link from 'next/link';

const horizons = [
  { label: '4 weeks', width: '42%', tone: 'bg-green/70' },
  { label: '6 months', width: '68%', tone: 'bg-cyan/70' },
  { label: '1 year', width: '88%', tone: 'bg-violet/70' },
];

export function RotationSignalCard() {
  return (
    <section aria-labelledby="rotation-signal-title">
      <p className="technical-label mb-8">Personal Signal</p>

      <Link
        href="/rotation"
        className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-[#060b14]/75 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-green/35 hover:bg-[#07110f]/85 hover:shadow-[0_28px_90px_rgba(102,240,194,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/55 sm:p-7"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(102,240,194,0.09),transparent_28%),radial-gradient(circle_at_70%_80%,rgba(167,139,250,0.08),transparent_34%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-green/10 transition-transform duration-700 group-hover:scale-110" />
        <div className="pointer-events-none absolute -right-4 -top-12 h-44 w-44 rounded-full border border-cyan/10 transition-transform duration-700 group-hover:scale-105" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-green/20 bg-green/[0.06] px-2.5 py-1 font-mono text-[0.56rem] uppercase tracking-[0.18em] text-green/75">
                Listening fingerprint
              </span>
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-white/30">
                Spotify top items
              </span>
            </div>

            <h2 id="rotation-signal-title" className="mt-5 text-2xl font-medium tracking-[-0.025em] text-text-primary sm:text-3xl">
              Sid&apos;s Rotation
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary/80">
              A living view of the music that keeps finding its way back: current rotation, persistent favorites, artist gravity, and how those signals shift across time.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-white/45">
              <span className="border border-white/10 bg-white/[0.025] px-2 py-1">4 week signal</span>
              <span className="border border-white/10 bg-white/[0.025] px-2 py-1">6 month signal</span>
              <span className="border border-white/10 bg-white/[0.025] px-2 py-1">1 year signal</span>
            </div>

            <div className="mt-6 inline-flex items-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-green/80 transition-colors group-hover:text-green">
              Explore listening map
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 p-4 backdrop-blur-sm sm:p-5"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <span className="font-mono text-[0.52rem] uppercase tracking-[0.2em] text-white/30">affinity / horizons</span>
              <span className="flex items-center gap-1.5 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-green/55">
                <span className="h-1.5 w-1.5 rounded-full bg-green/70 shadow-[0_0_10px_rgba(102,240,194,0.7)]" />
                live snapshot
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {horizons.map((horizon, index) => (
                <div key={horizon.label} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/38">{horizon.label}</span>
                  <span className="h-px overflow-visible bg-white/10">
                    <span
                      className={`block h-px origin-left ${horizon.tone} transition-transform duration-500 group-hover:scale-x-[1.04]`}
                      style={{ width: horizon.width }}
                    />
                  </span>
                  <span className="font-mono text-[0.52rem] text-white/24">0{index + 1}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4">
              {['core tracks', 'fresh entries', 'artist gravity'].map((label) => (
                <div key={label} className="min-w-0">
                  <div className="mb-2 h-1 w-5 rounded-full bg-white/10 transition-all duration-300 group-hover:w-8 group-hover:bg-green/25" />
                  <p className="truncate font-mono text-[0.48rem] uppercase tracking-[0.1em] text-white/24">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
