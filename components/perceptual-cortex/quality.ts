export type QualityTier = 'high' | 'balanced' | 'low';
export const qualityConfig = { high: { dpr: 1.75, pulses: 96 }, balanced: { dpr: 1.5, pulses: 72 }, low: { dpr: 1, pulses: 36 } } as const;
export function initialQuality(width: number, deviceMemory?: number): QualityTier { return width < 720 || (deviceMemory !== undefined && deviceMemory <= 4) ? 'low' : 'balanced'; }
export function adaptQuality(current: QualityTier, averageFrameMs: number): QualityTier { if (averageFrameMs > 28) return current === 'high' ? 'balanced' : 'low'; if (averageFrameMs < 15 && current === 'balanced') return 'high'; return current; }
