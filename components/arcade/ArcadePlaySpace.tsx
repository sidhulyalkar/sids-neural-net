'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Expand, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import type { ArcadeGame } from '@/src/data/arcadeGames';

const GAME_NETWORK_BRIDGE_SOURCE = 'sids-game-network-runtime';

type GameNetworkBridgeMessage = {
  source?: string;
  kind?: 'focus' | 'escape';
};

export function ArcadePlaySpace({ game }: { game: ArcadeGame }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const trustedSameOriginRuntime = Boolean(game.launchUrl?.startsWith('/'));

  const engageFocus = useCallback(() => {
    document.documentElement.classList.add('game-runtime-focused');
    setFocused(true);
  }, []);

  const leaveFocus = useCallback(() => {
    document.documentElement.classList.remove('game-runtime-focused');
    setFocused(false);
    shellRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => document.documentElement.classList.remove('game-runtime-focused');
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      const active = document.fullscreenElement === shellRef.current;
      setFullscreen(active);
      if (active) {
        engageFocus();
        window.requestAnimationFrame(() => iframeRef.current?.focus());
      }
    };
    const onParentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && focused && !document.fullscreenElement) leaveFocus();
    };
    const onWindowBlur = () => {
      window.requestAnimationFrame(() => {
        if (document.activeElement === iframeRef.current) engageFocus();
      });
    };
    const onRuntimeMessage = (event: MessageEvent<GameNetworkBridgeMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.source !== GAME_NETWORK_BRIDGE_SOURCE) return;

      if (event.data.kind === 'escape' && !document.fullscreenElement) leaveFocus();
      else engageFocus();
    };

    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('keydown', onParentKeyDown);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('message', onRuntimeMessage);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('keydown', onParentKeyDown);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('message', onRuntimeMessage);
    };
  }, [engageFocus, focused, leaveFocus]);

  const connectFrameFocus = useCallback(() => {
    if (!trustedSameOriginRuntime) return;
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return;

    try {
      const frameDocument = frameWindow.document;

      // Create the listener inside the runtime's own JavaScript realm. Parent-realm
      // callbacks attached directly to iframe documents are handled differently by
      // Firefox/WebKit. postMessage is the browser-native cross-realm contract.
      // The child-window flag makes this injection idempotent without mutating a
      // DOM object derived from the React ref.
      const bridge = frameDocument.createElement('script');
      bridge.textContent = `(() => {
        if (window.__SIDS_GAME_NETWORK_BRIDGE__) return;
        window.__SIDS_GAME_NETWORK_BRIDGE__ = true;
        const notify = (kind = 'focus') => {
          try {
            window.parent.postMessage({ source: '${GAME_NETWORK_BRIDGE_SOURCE}', kind }, window.location.origin);
          } catch (_) {}
        };
        window.addEventListener('pointerdown', () => notify('focus'), true);
        window.addEventListener('mousedown', () => notify('focus'), true);
        window.addEventListener('touchstart', () => notify('focus'), { capture: true, passive: true });
        window.addEventListener('focusin', () => notify('focus'), true);
        window.addEventListener('keydown', (event) => notify(event.key === 'Escape' ? 'escape' : 'focus'), true);
      })();`;
      frameDocument.documentElement.appendChild(bridge);
      bridge.remove();
    } catch {
      // Optional external runtime overrides stay isolated from the host document.
    }
  }, [trustedSameOriginRuntime]);

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;

    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await shell.requestFullscreen({ navigationUI: 'hide' });
        engageFocus();
        window.requestAnimationFrame(() => iframeRef.current?.focus());
      }
    } catch {
      engageFocus();
    }
  };

  const toggleFocus = () => {
    if (focused) leaveFocus();
    else engageFocus();
  };

  return (
    <main
      ref={shellRef}
      tabIndex={-1}
      className={`bg-[#020306] text-white outline-none ${fullscreen ? 'h-screen w-screen overflow-hidden' : 'min-h-screen'}`}
      data-arcade-focus={focused ? 'true' : 'false'}
      data-arcade-fullscreen={fullscreen ? 'true' : 'false'}
    >
      <style>{`.game-runtime-focused .neuron-cursor-overlay{display:none!important}`}</style>
      <div
        className={
          fullscreen
            ? 'relative h-screen w-screen overflow-hidden'
            : 'mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 pb-8 pt-5 sm:px-7 lg:px-10'
        }
      >
        <header
          className={
            fullscreen
              ? 'hidden'
              : `flex items-center justify-between gap-4 transition-opacity ${
                  focused ? 'pointer-events-none opacity-20' : 'opacity-100'
                }`
          }
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/arcade"
              aria-label="Back to Game Network"
              title="Back to Game Network"
              data-arcade-back-control="hex"
              className="group grid h-11 w-11 shrink-0 place-items-center text-white/45 transition-all duration-150 hover:-translate-y-px hover:text-cyan focus-visible:outline-none focus-visible:text-cyan"
            >
              <svg
                viewBox="0 0 44 48"
                className="h-10 w-9 overflow-visible"
                aria-hidden="true"
                focusable="false"
              >
                <polygon
                  points="22 2 40 12.5 40 35.5 22 46 4 35.5 4 12.5"
                  className="fill-[#020306] stroke-current"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M25 15.5 17 24l8 8.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </Link>
            <p className="truncate text-lg font-light tracking-tight text-white sm:text-xl">{game.title}</p>
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/20">
            {game.version}
          </span>
        </header>

        <section
          className={
            fullscreen
              ? 'absolute inset-0 flex items-stretch justify-stretch p-0'
              : 'flex flex-1 items-center justify-center py-6 sm:py-8'
          }
        >
          <div className={fullscreen ? 'h-full w-full max-w-none' : 'w-full max-w-[1160px]'}>
            <div className={fullscreen ? 'h-full w-full bg-black' : 'border border-white/10 bg-black p-1.5 sm:p-2'}>
              <div
                className={
                  fullscreen
                    ? 'relative h-full w-full overflow-hidden bg-black'
                    : 'relative mx-auto w-full overflow-hidden bg-black'
                }
                style={fullscreen ? undefined : { aspectRatio: game.aspectRatio }}
              >
                {game.launchUrl ? (
                  <iframe
                    key={frameKey}
                    ref={iframeRef}
                    title={`${game.title} game runtime`}
                    src={game.launchUrl}
                    className="absolute inset-0 h-full w-full border-0 bg-black"
                    allow="autoplay; fullscreen; gamepad"
                    sandbox={
                      trustedSameOriginRuntime
                        ? undefined
                        : 'allow-scripts allow-same-origin allow-pointer-lock allow-popups'
                    }
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={connectFrameFocus}
                    onFocus={engageFocus}
                    tabIndex={0}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-6 text-center">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                        runtime unavailable
                      </p>
                      <p className="mt-2 text-lg font-light text-white/60">{game.title}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={fullscreen ? 'hidden' : 'mt-2 flex flex-wrap items-center justify-between gap-2'}>
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
                {focused ? 'game focus · escape releases' : 'click inside the game to focus'}
              </p>

              <div className="flex items-center gap-1">
                {game.launchUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFrameKey((value) => value + 1)}
                      className="flex h-8 items-center gap-2 border border-white/10 px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35 transition-colors hover:border-white/25 hover:text-white/65"
                      aria-label="Reload game"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span className="hidden sm:inline">reload</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleFocus}
                      className="flex h-8 items-center gap-2 border border-white/10 px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35 transition-colors hover:border-white/25 hover:text-white/65"
                    >
                      {focused ? <Minimize2 className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
                      <span className="hidden sm:inline">{focused ? 'release' : 'focus'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex h-8 items-center gap-2 border border-white/10 px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35 transition-colors hover:border-white/25 hover:text-white/65"
                      aria-label={fullscreen ? 'Exit fullscreen game' : 'Open fullscreen game'}
                    >
                      {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                      <span className="hidden sm:inline">fullscreen</span>
                    </button>
                    <a
                      href={game.launchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 items-center gap-2 border border-white/10 px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35 transition-colors hover:border-white/25 hover:text-white/65"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="hidden sm:inline">standalone</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer
          className={
            fullscreen
              ? 'hidden'
              : `grid gap-4 border-t border-white/8 pt-4 transition-opacity lg:grid-cols-[1.3fr_1fr] ${
                  focused ? 'pointer-events-none opacity-15' : 'opacity-100'
                }`
          }
        >
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">{game.subtitle}</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-white/30">{game.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[8px] uppercase tracking-[0.1em] text-white/25">
            {game.controls.map((control) => (
              <div className="contents" key={`${control.input}-${control.action}`}>
                <span className="text-white/45">{control.input}</span>
                <span>{control.action}</span>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
