"use client";

import { useEffect, useRef } from "react";
import { createWorld, type WorldRuntime } from "./worldRenderer";
import type { RegionId, WorldCommand } from "@/lib/world/model";
import styles from "./world.module.css";

type Props = {
  entered: boolean;
  paused: boolean;
  command: WorldCommand | null;
  onReady: () => void;
  onError: () => void;
  onLocation: (region: RegionId, discovery: string | null) => void;
  onInteract: (discovery: string) => void;
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
          onLocation: (r, d) => callbacks.current.onLocation(r, d),
          onInteract: (d) => callbacks.current.onInteract(d),
        }, WebGLRenderer);
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
