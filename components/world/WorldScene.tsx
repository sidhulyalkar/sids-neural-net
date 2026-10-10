"use client";

import { useEffect, useRef } from "react";
import { createWorld, type WorldRuntime } from "./worldRenderer";
import type { RegionId, WorldCommand } from "@/lib/world/model";
import styles from "./world.module.css";

import type { Activity, AquaticMode } from "@/lib/world/activities";
import type { TrialState } from "@/lib/world/trials";

type Props = {
  activity: Activity;
  actionSerial: number;
  challengeSerial: number;
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
