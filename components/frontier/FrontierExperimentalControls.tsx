'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useUIFrequencies } from './audio/useUIFrequencies';
import { FrontierReactionLoop } from './FrontierReactionLoop';
import { FrontierSensorQcControl } from './FrontierSensorQcControl';
import styles from './frontier-utility-dock.module.css';

/**
 * Explicitly opt-in FRONTIER experiments.
 *
 * Keeping this module behind next/dynamic means the cold reader does not ship
 * camera/reaction inference, Sensor QC's sampling loop, or the WebAudio engine.
 */
export function FrontierExperimentalControls({ feedActive }: { feedActive: boolean }) {
  const { muted, toggleMuted, playDockClick } = useUIFrequencies();

  const toggleAudio = () => {
    if (muted) {
      toggleMuted();
      playDockClick();
    } else {
      playDockClick();
      toggleMuted();
    }
  };

  return (
    <>
      <FrontierReactionLoop feedActive={feedActive} />
      <FrontierSensorQcControl feedActive={feedActive} />
      <button
        type="button"
        className={styles.audioToggle}
        onClick={toggleAudio}
        aria-label={muted ? 'Enable FRONTIER interface audio' : 'Mute FRONTIER interface audio'}
        aria-pressed={muted}
        title={muted ? 'Audio off' : 'Audio on'}
      >
        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>
    </>
  );
}
