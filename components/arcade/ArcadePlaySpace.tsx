'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Expand, ExternalLink, Maximize2, Minimize2, RefreshCw, Zap } from 'lucide-react';
import type { ArcadeGame } from '@/src/data/arcadeGames';
import { ArcadeNeuralField } from './ArcadeNeuralField';

export function ArcadePlaySpace({ game }: { game: ArcadeGame }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const leaveFocus = useCallback(() => {
    setFocused(false);
    shellRef.current?.focus();
  }, []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === shellRef.current);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && focused && !document.fullscreenElement) leaveFocus();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [focused, leaveFocus]);

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      setFocused(true);
    }
  };

  return (
    <main
      ref={shellRef}
      tabIndex={-1}
      className={`relative isolate min-h-screen overflow-hidden bg-[#020306] text-white outline-none ${focused ? 'arcade-focus-mode' : ''}`}
      data-arcade-focus={focused ? 'true' : 'false'}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(68,180,206,0.11),transparent_42%),linear-gradient(180deg,#04070b_0%,#010203_100%)]" />
      <ArcadeNeuralField />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,transparent_18%,black_80%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-4 pb-8 pt-5 sm:px-7 lg:px-10">
        <header className={`flex items-center justify-between gap-4 transition-opacity ${focused ? 'pointer-events-none opacity-20' : 'opacity-100'}`}>
          <div>
            <Link href="/arcade" className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan/70 transition hover:text-cyan">
              ← game arcade
            </Link>
            <p className="mt-2 text-xl font-light tracking-tight text-white sm:text-2xl">{game.title}</p>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35 sm:flex">
            <span>{game.version}</span><span>·</span><span>{game.sourceVisibility} source</span>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-6 sm:py-9">
          <div className="relative w-full max-w-[1160px]">
            <div aria-hidden="true" className="absolute -inset-7 hidden [transform:perspective(900px)_rotateX(1deg)] sm:block">
              <div className="absolute left-0 top-8 h-[72%] w-px bg-gradient-to-b from-transparent via-cyan/50 to-transparent shadow-[0_0_22px_rgba(112,220,255,0.3)]" />
              <div className="absolute right-0 top-[14%] h-[64%] w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
              <div className="absolute left-[6%] right-[2%] top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
              <div className="absolute bottom-0 left-[1%] right-[8%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute left-0 top-0 h-10 w-10 border-l border-t border-cyan/80" />
              <div className="absolute right-0 top-0 h-14 w-14 border-r border-t border-white/30" />
              <div className="absolute bottom-0 left-0 h-14 w-14 border-b border-l border-white/25" />
              <div className="absolute bottom-0 right-0 h-10 w-10 border-b border-r border-cyan/70" />
            </div>

            <div className="relative [transform:perspective(1400px)_rotateX(0.8deg)]">
              <div aria-hidden="true" className="absolute -inset-3 translate-y-4 bg-black/75 blur-xl" />
              <div aria-hidden="true" className="absolute -inset-[2px] bg-[conic-gradient(from_200deg,rgba(104,225,255,.7),rgba(255,255,255,.12),rgba(255,92,179,.42),rgba(255,224,108,.3),rgba(104,225,255,.7))] opacity-65 shadow-[0_0_50px_rgba(77,205,242,0.16)]" />
              <div className="relative border border-white/15 bg-[#05080d] p-2 shadow-[0_32px_90px_rgba(0,0,0,.7)] sm:p-3">
                <div className="mb-2 flex items-center justify-between gap-3 px-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/35 sm:text-[9px]">
                  <span className="flex items-center gap-2"><Zap className="h-3 w-3 text-cyan/65" /> neural play chamber</span>
                  <span>{game.nativeSize ? `${game.nativeSize.width}×${game.nativeSize.height}` : game.aspectRatio.replace(' / ', ':')}</span>
                </div>

                <div
                  className="relative mx-auto w-full overflow-hidden border border-white/10 bg-black shadow-[inset_0_0_60px_rgba(0,0,0,.75)]"
                  style={{ aspectRatio: game.aspectRatio }}
                  onClick={() => game.launchUrl && setFocused(true)}
                >
                  {game.launchUrl ? (
                    <iframe
                      key={frameKey}
                      title={`${game.title} game runtime`}
                      src={game.launchUrl}
                      className="absolute inset-0 h-full w-full border-0 bg-black"
                      allow="autoplay; fullscreen; gamepad"
                      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_42%,rgba(79,198,228,0.13),transparent_32%),#020305] p-6 text-center">
                      <div className="max-w-lg">
                        <div className="mx-auto mb-5 h-16 w-16 rotate-45 border border-cyan/35 bg-cyan/5 shadow-[0_0_40px_rgba(89,220,255,.12)]" />
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan/75">runtime docking port</p>
                        <h2 className="mt-3 text-2xl font-light text-white">{game.title} is staged for launch.</h2>
                        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/45">
                          The arcade shell is live, but this game has not been given a public HTTPS runtime endpoint yet. Its source stays isolated from the website repository.
                        </p>
                        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
                          configure {game.slug === 'stretchicorn' ? 'NEXT_PUBLIC_ARCADE_STRETCHICORN_URL' : 'NEXT_PUBLIC_ARCADE_UNIRICO_URL'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/30">
                    {focused ? 'input focus engaged · escape releases shell focus' : game.launchUrl ? 'click game to capture keyboard focus' : 'runtime endpoint pending'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {game.launchUrl && (
                      <>
                        <button type="button" onClick={() => setFrameKey((value) => value + 1)} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.025] px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan" aria-label="Reload game">
                          <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">reload</span>
                        </button>
                        <button type="button" onClick={() => setFocused((value) => !value)} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.025] px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan">
                          {focused ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />} <span className="hidden sm:inline">{focused ? 'release' : 'focus'}</span>
                        </button>
                        <button type="button" onClick={toggleFullscreen} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.025] px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan">
                          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />} <span className="hidden sm:inline">screen</span>
                        </button>
                        <a href={game.launchUrl} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.025] px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/55 transition hover:border-cyan/35 hover:text-cyan">
                          <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">standalone</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className={`grid gap-5 transition-opacity lg:grid-cols-[1.3fr_1fr] ${focused ? 'pointer-events-none opacity-15' : 'opacity-100'}`}>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan/60">{game.subtitle}</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">{game.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-l border-white/10 pl-4 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
            {game.controls.map((control) => (
              <div className="contents" key={`${control.input}-${control.action}`}><span className="text-white/60">{control.input}</span><span>{control.action}</span></div>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
