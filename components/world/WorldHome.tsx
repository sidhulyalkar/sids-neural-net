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
import { ACTIVITIES, activityConfig, type Activity } from "@/lib/world/activities";
import { COASTAL_FLORA } from "@/lib/world/ecology";
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
  waterfall: { title: "Follow the water.", text: "A trail under the falls. More places I’ve stopped to look." },
  canyon: { title: "Take the long way.", text: "Cool rock, moss, and a trail out of sight. A little more about the person behind the work." },
  cavern: { title: "One more round.", text: "Stretchicorn, uniRico, and Unicorn Stampede. Built to play." },
  grove: {
    title: "Hi, I’m Sid.",
    text: "Neuroscience, machine learning, and the infrastructure between them. Off-screen: trails with Shasta.",
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
    text: "Coastal trails, mountain days, and Shasta. A few photographs from along the way.",
  },
};

export function WorldHome({ content }: { content: WorldContent }) {
  const [enabled, setEnabled] = useState(false);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activity, setActivity] = useState<Activity>("run");
  const [actionSerial, setActionSerial] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [region, setRegion] = useState<RegionId>("grove");
  const [nearby, setNearby] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [command, setCommand] = useState<WorldCommand | null>(null);
  const worldRoot = useRef<HTMLDivElement>(null);
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
  function chooseActivity(next: Activity) {
    setActivity(next);
    // A selected mode can be activated again without a React state change.
    // Restore movement focus on every activation, including that case.
    requestAnimationFrame(() => worldRoot.current?.querySelector("canvas")?.focus({ preventScroll: true }));
    if (next === "ski" || next === "boulder") {
      setCommand(previous => ({ region: "mountain", serial: (previous?.serial ?? 0) + 1, activity: next }));
    }
  }
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
      ref={worldRoot}
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
            activity={activity}
            actionSerial={actionSerial}
            onReady={onReady}
            onError={onError}
            onLocation={onLocation}
            onInteract={open}
          />
        </SceneBoundary>
      )}
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} prefetch={false}>
          SID HULYALKAR<span> Neuroscience & engineering</span>
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
          <p className={styles.eyebrow}>CALIFORNIA, IN MIND</p>
          <h1 id="world-title">Brains, machines,<br /><em>open trails.</em></h1>
          <p className={styles.introduction}>I’m Sid. Engineer, neuroscience researcher, usually outside.</p>
          <div className={styles.actions}>
            <Link href="/atlas" prefetch={false} className={styles.primary}>
              View site <span aria-hidden="true">↗</span>
            </Link>
            {!failed && (
              <button ref={enterButton} className={styles.exploreButton} onClick={enter}>
                Explore world <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          {failed && (
            <p role="status" className={styles.fallbackText}>
              The 3D world couldn’t open on this device. All of my work is
              available in the menu.
            </p>
          )}
          <p className={styles.smallNote}>
            The work, directly. Or the scenic route.
          </p>
        </section>
      ) : (
        <>
          {!ready && (
            <div className={styles.loading} role="status">
              Loading world…{" "}
              <button onClick={() => open("menu")}>Browse the site</button>
            </div>
          )}
          <div className={styles.location}>
            <span className={styles.eyebrow}>
              {String(REGIONS.indexOf(current) + 1).padStart(2, "0")} / {String(REGIONS.length).padStart(2, "0")}
            </span>
            <p>{current.name}</p>
          </div>
          {nearby && ready && (
            <button className={styles.discovery} onClick={() => open(nearby)}>
              <span>{discoveryTitle}</span>
              <span className={styles.key}>Enter</span>
            </button>
          )}
          <div className={styles.activityDock}>
            <div className={styles.activityButtons} role="group" aria-label="Movement activity">
              {ACTIVITIES.map(item => (
                <button key={item.id} aria-label={item.name} aria-pressed={activity === item.id}
                  onClick={() => chooseActivity(item.id)}>{item.label}</button>
              ))}
              <button className={styles.actionButton} disabled={!ready || quiet} onClick={() => setActionSerial(n => n + 1)}>
                {activityConfig(activity).action}
              </button>
            </div>
            <p aria-live="polite">{activityConfig(activity).hint}</p>
          </div>
          <p className={styles.controls}>
            WASD / arrows to move <span>·</span> Drag to look <span>·</span>{" "}
            Space to {activityConfig(activity).action.toLowerCase()} <span>·</span> M for menu
          </p>
          <div className={styles.touchHelp}>
            Tap ground to move · Drag to look
          </div>
        </>
      )}
      {!entered && (
        <footer className={styles.homeFooter}>
          <span>Built by Sid. Accompanied by Shasta.</span>
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
              <p className={styles.eyebrow}>NAVIGATION</p>
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
                  <h3>Browse the site</h3>
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
                <button onClick={() => setPanel("field-notes")}>Field notes</button>
                <a href="https://github.com/sidhulyalkar">GitHub</a>
                <Link href="/atlas" prefetch={false}>
                  View site · Fractal menu
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
                Move with WASD, arrows, or a tap on the ground. Drag to look. Space jumps; Enter opens discoveries. Ski and Boulder take you to their terrain. Escape closes panels.
              </p>
            </>
          )}
          {panel === "field-notes" && (
            <>
              <p className={styles.eyebrow}>CALIFORNIA COAST</p>
              <h2 id="world-panel-title">Field notes</h2>
              <p className={styles.panelIntro}>Coastal scrub on exposed bluffs. Redwoods in the sheltered grove. The snowy ridge is a separate mountain memory, folded into this small world.</p>
              <div className={styles.projectList}>
                {COASTAL_FLORA.map(plant => <a key={plant.scientific} href={plant.source} target="_blank" rel="noreferrer">
                  <h3>{plant.common}</h3><p><i>{plant.scientific}</i> · {plant.habitat}</p><span>National Park Service ↗</span>
                </a>)}
              </div>
            </>
          )}
          {selected && (
            <>
              <p className={styles.eyebrow}>{selected.name}</p>
              <h2 id="world-panel-title">{INTRO[selected.id].title}</h2>
              <p className={styles.panelIntro}>{INTRO[selected.id].text}</p>
              {selected.id === "cavern" && <div className={styles.projectList}>
                {content.games.map((game, index) => <Link key={game.href} href={game.href} prefetch={false}>
                  {index === 0 && <span>FEATURED GAME</span>}
                  <h3>{game.title}</h3><p>{game.subtitle}</p><span>Play game ↗</span>
                </Link>)}
              </div>}
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
              <h2 id="world-panel-title">Shasta.</h2>
              <p className={styles.panelIntro}>
                Coastal trail. Last light.
              </p>
              <Image
                className={styles.secretPhoto}
                src="/visual-archive/web/photo-042.webp"
                alt="White dog sitting at a sunset overlook above dark hills and coastline."
                width={1800}
                height={1350}
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
