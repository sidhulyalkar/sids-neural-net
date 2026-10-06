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
import { ACTIVITIES, activityConfig, type Activity, type AquaticMode } from "@/lib/world/activities";
import { COASTAL_FLORA, MARINE_LIFE } from "@/lib/world/ecology";
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
  waterfall: { title: "Fern falls.", text: "Water · fern · stone." },
  canyon: { title: "Moss canyon.", text: "Rock · moss · trail." },
  cavern: { title: "Arcade cavern.", text: "Playable games carved into stone." },
  grove: { title: "Redwood grove.", text: "Neuroscience · engineering · Shasta." },
  mountain: { title: "Granite ridge.", text: "Selected builds." },
  neural: { title: "Strange grove.", text: "Research questions." },
  coast: { title: "Wild coast.", text: "Cold water · trails · photographs." },
  lagoon: { title: "Lagoon reef.", text: "Bora Bora · Tahiti · Mo’orea." },
};

export function WorldHome({ content }: { content: WorldContent }) {
  const [enabled, setEnabled] = useState(false);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activity, setActivity] = useState<Activity>("run");
  const [actionSerial, setActionSerial] = useState(0);
  const [aquatic, setAquatic] = useState<AquaticMode>("land");
  const [waterAction, setWaterAction] = useState<"dive" | "deeper" | "shallower" | "surface">("dive");
  const [waterActionSerial, setWaterActionSerial] = useState(0);
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
  function waterControl(next: "dive" | "deeper" | "shallower" | "surface") {
    setWaterAction(next);
    setWaterActionSerial(n => n + 1);
    requestAnimationFrame(() => worldRoot.current?.querySelector("canvas")?.focus({ preventScroll: true }));
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
    // A world jump is not a dialog dismissal: do not return focus to the
    // menu trigger. The renderer/canvas becomes the next interaction target.
    trigger.current = null;
    close();
    requestAnimationFrame(() =>
      worldRoot.current?.querySelector("canvas")?.focus({ preventScroll: true }),
    );
  }
  const nearbyGameIndex = nearby?.startsWith("game:") ? Number(nearby.slice(5)) : -1;
  const nearbyGame = Number.isInteger(nearbyGameIndex) ? content.games[nearbyGameIndex] : undefined;
  const discoveryTitle =
    nearby === "secret"
      ? "Shasta"
      : (nearbyGame?.title ??
        content.videos.find((item) => item.id === nearby)?.title ??
        MEMORY_POINTS.find((m) => m.id === nearby)?.title ??
        REGIONS.find((r) => r.id === nearby)?.name);
  const current = REGIONS.find((r) => r.id === region)!;
  const selected = REGIONS.find((r) => r.id === panel);
  const carvedGameIndex = panel?.startsWith("game:") ? Number(panel.slice(5)) : -1;
  const carvedGame = Number.isInteger(carvedGameIndex) ? content.games[carvedGameIndex] : undefined;
  const photo = content.photos.find((p) => p.id === panel);
  const video = content.videos.find((item) => item.id === panel);
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
            waterAction={waterAction}
            waterActionSerial={waterActionSerial}
            gameTitles={content.games.map(game => game.title)}
            onAquatic={setAquatic}
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
          {aquatic === "land" && (
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
          )}
          {aquatic !== "land" && (
            <div className={styles.waterDock} role="group" aria-label="Swimming depth controls">
              <span className={styles.waterMode}>{aquatic === "surface" ? "Snorkeling" : "Diving"}</span>
              {aquatic === "surface" ? (
                <button onClick={() => waterControl("dive")}>Dive</button>
              ) : (
                <>
                  <button onClick={() => waterControl("deeper")}>Deeper</button>
                  <button onClick={() => waterControl("shallower")}>Shallower</button>
                  <button className={styles.surfaceButton} onClick={() => waterControl("surface")}>Surface</button>
                </>
              )}
            </div>
          )}
          <p className={styles.controls}>
            {aquatic === "land" ? (
              <>WASD / arrows to move <span>·</span> Drag to look <span>·</span>{" "}
                Space to {activityConfig(activity).action.toLowerCase()} <span>·</span> M for menu</>
            ) : aquatic === "surface" ? (
              <>WASD / arrows to swim <span>·</span> Drag to look <span>·</span> V to dive <span>·</span> M for menu</>
            ) : (
              <>WASD / arrows to swim <span>·</span> Q / E for depth <span>·</span> V to surface <span>·</span> M for menu</>
            )}
          </p>
          <div className={styles.touchHelp}>
            {aquatic === "land" ? "Tap ground to move · Drag to look" : "Tap water to swim · Drag to look"}
          </div>
        </>
      )}
      {!entered && (
        <footer className={styles.homeFooter}>
          <span>Sid Hulyalkar · Portfolio</span>
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
                Move with WASD, arrows, or a tap. Drag to look. Space uses the equipped land action; V dives or surfaces in the ocean. Ski and Boulder take you to their terrain. Escape closes panels.
              </p>
            </>
          )}
          {panel === "field-notes" && (
            <>
              <p className={styles.eyebrow}>CALIFORNIA COAST</p>
              <h2 id="world-panel-title">Field notes</h2>
              <p className={styles.panelIntro}>California coastal scrub and redwoods transition into an imagined alpine ridge. Offshore, the swim area is a cold-water kelp and rocky-reef composite rather than a tropical reef.</p>
              <div className={styles.projectList}>
                {COASTAL_FLORA.map(plant => <a key={plant.scientific} href={plant.source} target="_blank" rel="noreferrer">
                  <h3>{plant.common}</h3><p><i>{plant.scientific}</i> · {plant.habitat}</p><span>National Park Service ↗</span>
                </a>)}
                {MARINE_LIFE.map(animal => <a key={animal.common} href={animal.source} target="_blank" rel="noreferrer">
                  <h3>{animal.common}</h3><p>{animal.note}</p><span>Monterey Bay Aquarium ↗</span>
                </a>)}
              </div>
            </>
          )}
          {carvedGame && (
            <>
              <p className={styles.eyebrow}>ARCADE CAVERN · CARVED GAME</p>
              <h2 id="world-panel-title">{carvedGame.title}</h2>
              <p className={styles.panelIntro}>{carvedGame.subtitle}</p>
              <div className={styles.panelLinks}>
                <Link href={carvedGame.href} prefetch={false}>
                  Play {carvedGame.title}
                </Link>
                <button onClick={() => setPanel("cavern")}>All games</button>
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
                  {content.photos.map((p) => {
                    const memory = MEMORY_POINTS.find((m) => m.id === p.id);
                    return (
                      <button
                        key={p.id}
                        aria-label={memory?.title ?? p.alt}
                        onClick={() => setPanel(p.id)}
                      >
                        <Image
                          src={p.src}
                          alt={p.alt}
                          width={240}
                          height={150}
                          sizes="(max-width: 600px) 80vw, 240px"
                        />
                      </button>
                    );
                  })}
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
          {video && (
            <>
              <h2 id="world-panel-title">{video.title}</h2>
              <video
                className={styles.memoryVideo}
                src={video.src}
                poster={video.posterSrc}
                controls
                playsInline
                preload="metadata"
              />
              <p className={styles.photoCaption}>{video.detail}</p>
              <button onClick={close}>Back to reef</button>
            </>
          )}
          {photo && (
            <>
              <h2 id="world-panel-title">{caption?.title}</h2>
              <Image
                className={styles.memoryPhoto}
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes="(max-width: 900px) 92vw, 1000px"
              />
              <p className={styles.photoCaption}>{caption?.detail ?? photo.alt}</p>
              <Link prefetch={false} href="/photography">
                Photography
              </Link>
            </>
          )}
          {panel === "secret" && (
            <>
              <h2 id="world-panel-title">Shasta.</h2>
              <p className={styles.panelIntro}>Sunset overlook.</p>
              <Image
                className={styles.secretPhoto}
                src="/visual-archive/web/photo-042.webp"
                alt="White dog sitting at a sunset overlook above dark hills and coastline."
                width={1800}
                height={1350}
                sizes="(max-width: 600px) 85vw, 400px"
              />
              <Link prefetch={false} href="/photography">
                Photography
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
