"use client";

import { useEffect, useRef } from "react";
import { createWorld, type WorldRuntime } from "./worldRenderer";
import type { RegionId, WorldCommand } from "@/lib/world/model";
import styles from "./world.module.css";

import type { Activity, AquaticMode } from "@/lib/world/activities";
import type { TrialState } from "@/lib/world/trials";
import type { BigAirState } from "@/lib/world/bigAir";
import type { DiscGolfState,DiscShot,DiscGolfSwingStage } from "@/lib/world/discGolf";

type Props = {
  activity: Activity;
  actionSerial: number;
  challengeSerial: number;
  bigAirSerial:number;
  discGolfStartSerial:number;
  discGolfHoleIndex:number;
  discGolfShotSerial:number;
  discGolfShot:DiscShot|null;
  discGolfPreview:DiscShot|null;
  discGolfExitSerial:number;
  discGolfSwingStage:DiscGolfSwingStage;
  discGolfSwingAmount:number;
  waterAction: "dive" | "deeper" | "shallower" | "surface";
  waterActionSerial: number;
  gameTitles: string[];
  entered: boolean;
  paused: boolean;
  command: WorldCommand | null;
  onReady: () => void;
  onError: () => void;
  onAquatic: (mode: AquaticMode) => void;
  onLocation: (region: RegionId, discovery: string | null) => void;
  onInteract: (discovery: string) => void;
  onChallenge: (state:TrialState) => void;
  onBigAir: (state:BigAirState) => void;
  onDiscGolf:(game:DiscGolfState)=>void;
};
export default function WorldScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<WorldRuntime | null>(null);
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });
  useEffect(() => {
    let cancelled = false;
    // Separate Three's rendering backend from the geometry chunk. Import the
    // source modules so Turbopack can split them instead of one bundled barrel.
    import("three/src/renderers/WebGLRenderer.js").then(({ WebGLRenderer }) => {
      if (cancelled || !host.current) return;
      try {
        runtime.current = createWorld(host.current, {
          onReady: () => callbacks.current.onReady(),
          onError: () => callbacks.current.onError(),
          onAquatic: (mode) => callbacks.current.onAquatic(mode),
          onLocation: (r, d) => callbacks.current.onLocation(r, d),
          onInteract: (d) => callbacks.current.onInteract(d),
          onChallenge: (trial) => callbacks.current.onChallenge(trial),
          onBigAir: (flight) => callbacks.current.onBigAir(flight),
          onDiscGolf:(golf)=>callbacks.current.onDiscGolf(golf),
        }, WebGLRenderer, callbacks.current.gameTitles);
        runtime.current.setState(callbacks.current);
      } catch { callbacks.current.onError(); }
    }).catch(() => { if (!cancelled) callbacks.current.onError(); });
    return () => {
      cancelled = true;
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    runtime.current?.setState(props);
  }, [props]);
  return <div ref={host} className={styles.scene} />;
}
