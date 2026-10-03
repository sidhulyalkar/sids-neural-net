"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MEMORY_POINTS,
  REGIONS,
  type RegionId,
  type WorldCommand,
  type WorldContent,
} from "@/lib/world/model";
import styles from "./world.module.css";

const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false });
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const LINKS = [
  ["About", "/about"],
  ["Projects", "/projects"],
  ["Research", "/ideas"],
  ["Photography", "/photography"],
  ["Games", "/arcade"],
  ["Frontier", "/frontier"],
  ["Publications", "/publications"],
  ["Resume", "/resume"],
  ["Contact", "/contact"],
];
const INTRO: Record<RegionId, { title: string; text: string }> = {
  grove: {
    title: "Hi, I’m Sid.",
    text: "I build systems for understanding brains, behavior, and the world around us. My work connects neuroscience, machine learning, and scientific infrastructure. Away from the screen, you’ll often find me on a trail with Shasta.",
  },
  mountain: {
    title: "Things I build.",
    text: "From raw measurements to useful systems. A few projects from my work in neuroscience, data infrastructure, and machine learning.",
  },
  neural: {
    title: "Things I explore.",
    text: "How do neural systems represent the world? How can we understand what a model has learned? These questions connect much of my research.",
  },
  coast: {
    title: "Outside the screen.",
    text: "Mountains, coastal trails, small adventures, and a husky named Shasta. Find the three viewpoint stones to see a few photographs from my archive.",
  },
};

export function WorldHome({ content }: { content: WorldContent }) {
  const [enabled, setEnabled] = useState(false);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [region, setRegion] = useState<RegionId>("grove");
  const [nearby, setNearby] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [command, setCommand] = useState<WorldCommand | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const onError = useCallback(() => {
    setFailed(true);
    setEnabled(false);
    setReady(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onLocation = useCallback((r: RegionId, discovery: string | null) => {
    setRegion(r);
    setNearby(discovery);
  }, []);
  const open = useCallback((value: string) => {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanel(value);
  }, []);
  const close = useCallback(() => {
    setPanel(null);
    // Return keyboard users to the action that opened the dialog.
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const frame = requestAnimationFrame(() => {
      if (!motion.matches && !small.matches && !connection?.saveData)
        setEnabled(true);
    });
    const change = () => {
      if (motion.matches) {
        setEnabled(false);
        setEntered(false);
        setReady(false);
      }
    };
    motion.addEventListener("change", change);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", change);
    };
  }, []);
  useEffect(() => {
    if (!enabled || ready || failed) return;
    const timeout = window.setTimeout(onError, 15000);
    return () => window.clearTimeout(timeout);
  }, [enabled, ready, failed, onError]);
  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal();
    if (!panel && dialog.current?.open) dialog.current?.close();
    if (panel) dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [panel]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
        return;
      if (event.key.toLowerCase() === "m" && !panel) {
        event.preventDefault();
        open("menu");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, panel]);
  function enter() {
    setEnabled(true);
    setEntered(true);
    setFailed(false);
  }
  function jump(id: RegionId) {
    setEnabled(true);
    setEntered(true);
    setQuiet(false);
    setFailed(false);
    setCommand((previous) => ({
      region: id,
      serial: (previous?.serial ?? 0) + 1,
    }));
    close();
  }
  const discoveryTitle =
    nearby === "secret"
      ? "Shasta found something"
      : (MEMORY_POINTS.find((m) => m.id === nearby)?.title ??
        REGIONS.find((r) => r.id === nearby)?.meaning);
  const current = REGIONS.find((r) => r.id === region)!;
  const selected = REGIONS.find((r) => r.id === panel);
  const photo = content.photos.find((p) => p.id === panel);
  const caption = MEMORY_POINTS.find((m) => m.id === panel);

  return (
    <div
      className={styles.world}
      data-world-state={failed ? "fallback" : entered ? "exploring" : "welcome"}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      {enabled && !failed && (
        <SceneBoundary key={failed ? "retry" : "scene"} onError={onError}>
          <WorldScene
            entered={entered}
            paused={!!panel || quiet}
            command={command}
            onReady={onReady}
            onError={onError}
            onLocation={onLocation}
            onInteract={open}
          />
        </SceneBoundary>
      )}
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} prefetch={false}>
          SID HULYALKAR<span> A small world, by Sid.</span>
        </Link>
        <button
          className={styles.menuButton}
          onClick={() => open("menu")}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <span>Menu</span>
          <span aria-hidden="true">☰</span>
        </button>
      </header>
      {!entered || failed ? (
        <section className={styles.welcome} aria-labelledby="world-title">
          <p className={styles.eyebrow}>
            NEUROSCIENCE · ENGINEERING · THE OUTDOORS
          </p>
          <h1 id="world-title">
            A little world.
            <br />
            <em>A curious mind.</em>
          </h1>
          <p className={styles.introduction}>
            I’m Sid. I build systems to understand brains,
            <br className={styles.desktopBreak} /> explore ideas, and make
            things that work.
          </p>
          <div className={styles.actions}>
            {!failed && (
              <button
                ref={enterButton}
                className={styles.primary}
                onClick={enter}
              >
                Enter world <span aria-hidden="true">↗</span>
              </button>
            )}
            <Link href="/projects" prefetch={false} className={styles.workLink}>
              View my work
            </Link>
          </div>
          {failed && (
            <p role="status" className={styles.fallbackText}>
              The 3D world couldn’t open on this device. All of my work is
              available in the menu.
            </p>
          )}
          <p className={styles.smallNote}>
            A grove, a mountain, a strange forest, and the sea.
          </p>
        </section>
      ) : (
        <>
          {!ready && (
            <div className={styles.loading} role="status">
              Finding the clearing…{" "}
              <button onClick={() => open("menu")}>Browse the site</button>
            </div>
          )}
          <div className={styles.location}>
            <span className={styles.eyebrow}>
              {String(REGIONS.indexOf(current) + 1).padStart(2, "0")} / 04
            </span>
            <p>{current.name}</p>
          </div>
          {nearby && ready && (
            <button className={styles.discovery} onClick={() => open(nearby)}>
              <span>{discoveryTitle}</span>
              <span className={styles.key}>Enter</span>
            </button>
          )}
          <p className={styles.controls}>
            WASD / arrows to walk <span>·</span> Drag to look <span>·</span>{" "}
            Click to move <span>·</span> M for menu
          </p>
          <div className={styles.touchHelp}>
            Tap the ground to walk · Drag to look · Menu to jump
          </div>
        </>
      )}
      {!entered && (
        <footer className={styles.homeFooter}>
          <span>Scientist at heart. Builder by nature.</span>
          <Link href="/about" prefetch={false}>
            Get to know me
          </Link>
        </footer>
      )}
      <dialog
        ref={dialog}
        className={`${styles.dialog} ${photo ? styles.photoDialog : ""}`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        aria-labelledby="world-panel-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button, a[href]",
            ),
          ).filter((el) => el.offsetParent !== null);
          const first = items[0],
            last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className={styles.dialogBody}>
          <button
            className={styles.close}
            onClick={close}
            aria-label="Close panel"
          >
            ×
          </button>
          {panel === "menu" && (
            <>
              <p className={styles.eyebrow}>TAKE YOUR OWN PATH</p>
              <h2 id="world-panel-title">Where to?</h2>
              <div className={styles.menuColumns}>
                <section>
                  <h3>Explore the world</h3>
                  <div className={styles.destinations}>
                    {REGIONS.map((r, i) => (
                      <button key={r.id} onClick={() => jump(r.id)}>
                        <span className={styles.destinationNumber}>
                          0{i + 1}
                        </span>
                        <span>
                          {r.name}
                          <small>{r.meaning}</small>
                        </span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </section>
                <nav aria-label="Portfolio">
                  <h3>Go straight there</h3>
                  <div className={styles.siteLinks}>
                    {LINKS.map(([label, href]) => (
                      <Link prefetch={false} key={href} href={href}>
                        {label}
                      </Link>
                    ))}
                  </div>
                </nav>
              </div>
              <div className={styles.menuFooter}>
                <a href="https://github.com/sidhulyalkar">GitHub</a>
                <Link href="/atlas" prefetch={false}>
                  Neural atlas
                </Link>
                {enabled && (
                  <button
                    onClick={() => {
                      setQuiet(!quiet);
                      close();
                    }}
                  >
                    {quiet ? "Resume world" : "Pause world"}
                  </button>
                )}
              </div>
              <p className={styles.menuHint}>
                Walk with WASD or the arrow keys. Drag to look around. Click the
                ground to walk there. Enter opens a nearby discovery. Escape
                closes a panel.
              </p>
            </>
          )}
          {selected && (
            <>
              <p className={styles.eyebrow}>{selected.name}</p>
              <h2 id="world-panel-title">{INTRO[selected.id].title}</h2>
              <p className={styles.panelIntro}>{INTRO[selected.id].text}</p>
              <div className={styles.projectList}>
                {content.projects
                  .filter((p) => p.region === selected.id)
                  .map((p) => (
                    <Link prefetch={false} href={p.href} key={p.href}>
                      <h3>{p.title}</h3>
                      <p>{p.summary}</p>
                      <span>View project ↗</span>
                    </Link>
                  ))}
              </div>
              {selected.id === "coast" && (
                <div className={styles.memoryList}>
                  {content.photos.map((p) => (
                    <button key={p.id} onClick={() => setPanel(p.id)}>
                      <Image
                        src={p.src}
                        alt={p.alt}
                        width={240}
                        height={150}
                        sizes="(max-width: 600px) 80vw, 240px"
                      />
                      <span>
                        {MEMORY_POINTS.find((m) => m.id === p.id)?.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.panelLinks}>
                <Link href={selected.href} prefetch={false}>
                  {selected.id === "grove"
                    ? "More about me"
                    : selected.id === "coast"
                      ? "All photography"
                      : selected.id === "mountain"
                        ? "All projects"
                        : "Research & ideas"}
                </Link>
                {selected.id === "neural" && (
                  <Link prefetch={false} href="/frontier">
                    Beyond the horizon · Frontier
                  </Link>
                )}
                {selected.id === "coast" && (
                  <Link prefetch={false} href="/arcade">
                    Play my games
                  </Link>
                )}
                {selected.id === "grove" && (
                  <Link prefetch={false} href="/resume">
                    Resume
                  </Link>
                )}
              </div>
            </>
          )}
          {photo && (
            <>
              <p className={styles.eyebrow}>A MEMORY FROM MY PHOTO ARCHIVE</p>
              <h2 id="world-panel-title">{caption?.title}</h2>
              <Image
                className={styles.memoryPhoto}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes="(max-width: 900px) 92vw, 1000px"
              />
              <p className={styles.photoCaption}>{photo.alt}</p>
              <Link prefetch={false} href="/photography">
                Explore the photographs
              </Link>
            </>
          )}
          {panel === "secret" && (
            <>
              <p className={styles.eyebrow}>A GOOD GUIDE</p>
              <h2 id="world-panel-title">Shasta’s favorite detour.</h2>
              <p className={styles.panelIntro}>
                Sometimes the best thing to find is a reason to stay outside a
                little longer.
              </p>
              <Image
                className={styles.secretPhoto}
                src="/visual-archive/web/photo-042.webp"
                alt="White dog sitting at a sunset overlook above dark hills and coastline."
                width={1800}
                height={2400}
                sizes="(max-width: 600px) 85vw, 400px"
              />
              <Link prefetch={false} href="/photography">
                More days outside
              </Link>
            </>
          )}
        </div>
      </dialog>
      <noscript>
        <nav className={styles.noScript} aria-label="Browse without JavaScript">
          <p>
            Sidharth Hulyalkar · neuroscience, engineering, and the outdoors.
          </p>
          {LINKS.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </noscript>
    </div>
  );
}
