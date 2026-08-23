import { normalizeAvoidLabel } from './avoidEngine';
import { normalizeWatchIntentLabel } from './intentEngine';

export type FrontierPaletteCommand =
  | { kind: 'watch'; query: string }
  | { kind: 'unwatch'; query: string }
  | { kind: 'avoid'; query: string }
  | { kind: 'unavoid'; query: string }
  | { kind: 'list' }
  | { kind: 'list-avoids' }
  | { kind: 'help' }
  | { kind: 'invalid'; message: string };

export type FrontierPaletteKeyboardIntent =
  | 'open-focus-input'
  | 'close-restore-focus'
  | 'none';

export function parseFrontierPaletteCommand(raw: string): FrontierPaletteCommand {
  const value = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!value) return { kind: 'invalid', message: 'Type “Watch: …” or “Avoid: …”.' };
  if (/^(list\s+watches|watches)$/i.test(value)) return { kind: 'list' };
  if (/^(list\s+avoids|avoids)$/i.test(value)) return { kind: 'list-avoids' };
  if (/^(help|\?)$/i.test(value)) return { kind: 'help' };

  const watch = value.match(/^watch\s*:?\s+(.+)$/i);
  if (watch?.[1]) {
    const query = normalizeWatchIntentLabel(watch[1]);
    return query ? { kind: 'watch', query } : { kind: 'invalid', message: 'Watch intent cannot be empty.' };
  }

  const unwatch = value.match(/^(?:unwatch|stop\s+watching)\s*:?\s+(.+)$/i);
  if (unwatch?.[1]) {
    const query = normalizeWatchIntentLabel(unwatch[1]);
    return query ? { kind: 'unwatch', query } : { kind: 'invalid', message: 'Name the watch intent to remove.' };
  }

  const avoid = value.match(/^(?:avoid|suppress)\s*:?\s+(.+)$/i);
  if (avoid?.[1]) {
    const query = normalizeAvoidLabel(avoid[1]);
    return query ? { kind: 'avoid', query } : { kind: 'invalid', message: 'Avoid anchor cannot be empty.' };
  }

  const unavoid = value.match(/^(?:unavoid|allow|stop\s+avoiding)\s*:?\s+(.+)$/i);
  if (unavoid?.[1]) {
    const query = normalizeAvoidLabel(unavoid[1]);
    return query ? { kind: 'unavoid', query } : { kind: 'invalid', message: 'Name the avoid anchor to remove.' };
  }

  return { kind: 'invalid', message: 'Use “Watch: topic”, “Avoid: topic”, or list/remove commands.' };
}

export function resolveFrontierPaletteKeyboardIntent(input: {
  open: boolean;
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): FrontierPaletteKeyboardIntent {
  const key = input.key.toLowerCase();
  if ((input.metaKey || input.ctrlKey) && key === 'k') return input.open ? 'close-restore-focus' : 'open-focus-input';
  if (input.open && input.key === 'Escape') return 'close-restore-focus';
  return 'none';
}
