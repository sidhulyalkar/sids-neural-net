'use client';

import {
  dominantSleepStage,
  getSignal,
  type PersonaMoodSelfReport,
  type PersonaSnapshot,
} from '@/lib/physiology/schema';
import type { PersonaActivity } from '@/lib/physiology/world';

type Props = {
  snapshot: PersonaSnapshot;
  mood: PersonaMoodSelfReport;
  accent: string;
  activity: PersonaActivity;
  pointerX: number;
  pointerY: number;
};

function numericSignal(snapshot: PersonaSnapshot, key: string, fallback: number): number {
  const signal = getSignal(snapshot, key);
  return signal?.available && typeof signal.value === 'number' ? signal.value : fallback;
}

export function Persona2D({ snapshot, mood, accent, activity, pointerX, pointerY }: Props) {
  const respiration = Math.max(6, numericSignal(snapshot, 'respiration_rate', 12));
  const cardiac = Math.max(40, numericSignal(snapshot, 'cardiac_rate', 60));
  const movement = Math.max(0, numericSignal(snapshot, 'movement_intensity', 0.12));
  const sleepStage = dominantSleepStage(snapshot);
  const sleepy = mood === 'sleepy' || sleepStage === 'deep' || activity === 'rest';
  const energetic = mood === 'energized' || ['explore', 'skip-stones', 'snow-angel', 'chase-fireflies'].includes(activity);
  const lying = activity === 'snow-angel';
  const crouching = ['garden', 'collect', 'build-cairn'].includes(activity);
  const lookingUp = activity === 'stargaze';
  const fishing = activity === 'fish';
  const bodyY = lying ? 76 : crouching ? 36 : 0;
  const bodyRotate = lying ? -74 : crouching ? 7 : 0;
  const armReach = crouching ? 32 : fishing ? 18 : 0;
  const bouncePx = 2.5 + Math.min(9, movement * 18) + (energetic ? 3 : 0);
  const breathDuration = Math.max(2.4, 60 / respiration).toFixed(2);
  const pulseDuration = Math.max(0.45, 60 / cardiac).toFixed(2);
  const idleDuration = energetic ? '1.2s' : sleepy ? '4.5s' : '2.4s';
  const eyeRy = sleepy ? 2.2 : 7.5;
  const gazeX = pointerX * 2.8;
  const gazeY = pointerY * 1.6 + (lookingUp ? -3 : 0);

  return (
    <g transform={`translate(600 ${lying ? 562 : 520})`} aria-label="PhysioPersona explorer">
      <defs>
        <linearGradient id="persona-body-gradient" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#f6ffff" stopOpacity="0.92" />
          <stop offset="0.18" stopColor={accent} />
          <stop offset="1" stopColor={accent} stopOpacity="0.72" />
        </linearGradient>
        <radialGradient id="persona-heart-glow">
          <stop offset="0" stopColor="#fff3f5" />
          <stop offset="0.28" stopColor="#f6a7ad" />
          <stop offset="1" stopColor="#e76f7d" stopOpacity="0" />
        </radialGradient>
        <filter id="persona-soft-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse cx="0" cy="82" rx={lying ? 76 : 48} ry="12" fill="rgba(0,0,0,0.18)" filter="url(#persona-soft-shadow)" />

      <g transform={`translate(0 ${bodyY}) rotate(${bodyRotate})`}>
        {!lying && (
          <animateTransform
            attributeName="transform"
            additive="sum"
            type="translate"
            values={`0 0; 0 ${-bouncePx}; 0 0`}
            dur={idleDuration}
            repeatCount="indefinite"
          />
        )}

        <g transform={`translate(0 ${crouching ? 9 : 0})`}>
          <g transform="translate(0 1)">
            <ellipse cx="0" cy="-9" rx="39" ry="50" fill="url(#persona-body-gradient)">
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 1.035 1.055; 1 1"
                dur={`${breathDuration}s`}
                repeatCount="indefinite"
              />
            </ellipse>
            <ellipse cx="-12" cy="-31" rx="14" ry="7" fill="rgba(255,255,255,0.19)" transform="rotate(-20 -12 -31)" />
          </g>

          <g transform={`translate(0 -78) rotate(${lookingUp ? -8 : pointerX * 2.3})`}>
            <circle cx="0" cy="0" r="31" fill="url(#persona-body-gradient)" />
            <ellipse cx="-11" cy="-2" rx="6.3" ry={eyeRy} fill="#f2ffff" />
            <ellipse cx="11" cy="-2" rx="6.3" ry={eyeRy} fill="#f2ffff" />
            {!sleepy && (
              <>
                <circle cx={-11 + gazeX} cy={-2 + gazeY} r="2.4" fill="#24454e" />
                <circle cx={11 + gazeX} cy={-2 + gazeY} r="2.4" fill="#24454e" />
              </>
            )}
            <path d={mood === 'energized' ? 'M -9 11 Q 0 19 9 11' : mood === 'sleepy' ? 'M -7 13 Q 0 10 7 13' : 'M -8 12 Q 0 16 8 12'} fill="none" stroke="#e5fbf4" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M -19 -25 Q -28 -41 -15 -46 Q -5 -31 -6 -24" fill={accent} opacity="0.78" />
            <path d="M 19 -25 Q 28 -41 15 -46 Q 5 -31 6 -24" fill={accent} opacity="0.78" />
          </g>

          <g transform={`translate(-42 -12) rotate(${crouching ? -40 - armReach : activity === 'snow-angel' ? -78 : -13})`}>
            <rect x="-8" y="0" width="16" height="52" rx="8" fill={accent} />
            <circle cx="0" cy="52" r="8" fill={accent} />
          </g>
          <g transform={`translate(42 -12) rotate(${crouching ? 40 + armReach : activity === 'skip-stones' ? 68 : fishing ? 24 : activity === 'snow-angel' ? 78 : 13})`}>
            <rect x="-8" y="0" width="16" height="52" rx="8" fill={accent} />
            <circle cx="0" cy="52" r="8" fill={accent} />
            {activity === 'skip-stones' && (
              <animateTransform attributeName="transform" additive="sum" type="rotate" values="0; -38; 4; 0" dur="1.4s" repeatCount="indefinite" />
            )}
          </g>

          <g transform={`translate(-18 35) rotate(${lying ? -46 : crouching ? 22 : -3})`}>
            <rect x="-9" y="0" width="18" height="55" rx="9" fill={accent} />
          </g>
          <g transform={`translate(18 35) rotate(${lying ? 46 : crouching ? -22 : 3})`}>
            <rect x="-9" y="0" width="18" height="55" rx="9" fill={accent} />
          </g>

          <circle cx="0" cy="-7" r="22" fill="url(#persona-heart-glow)" opacity="0.5">
            <animate attributeName="r" values="17;22;17" dur={`${pulseDuration}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.55;0.25" dur={`${pulseDuration}s`} repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="-7" r="4.5" fill="#ffe4e8" />
        </g>
      </g>

      {activity === 'fish' && (
        <g transform="translate(54 -5) rotate(19)">
          <path d="M 0 0 Q 42 -42 73 -64" fill="none" stroke="#806044" strokeWidth="4" strokeLinecap="round" />
          <path d="M 73 -64 Q 96 -15 96 28" fill="none" stroke="rgba(235,245,240,0.55)" strokeWidth="1.5" />
          <circle cx="96" cy="31" r="4" fill="#e97972" />
        </g>
      )}

      {activity === 'chase-fireflies' && (
        <animateTransform attributeName="transform" additive="sum" type="translate" values="-15 0; 18 -3; -15 0" dur="2.8s" repeatCount="indefinite" />
      )}
    </g>
  );
}
