import { normalizeWatchIntentLabel } from './intentEngine';

export type FrontierPaletteCommand =
  | { kind: 'watch'; query: string }
  | { kind: 'unwatch'; query: string }
  | { kind: 'list' }
  | { kind: 'help' }
  | { kind: 'invalid'; message: string };

export type FrontierPaletteKeyboardIntent =
  | 'open-focus-input'
  | 'close-restore-focus'
  | 'none';

export function parseFrontierPaletteCommand(raw: string): FrontierPaletteCommand {
  const value = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!value) return { kind: 'invalid', message: 'Type “Watch: …” to create a radar lock.' };
  if (/^(list\s+watches|watches)$/i.test(value)) return { kind: 'list' };
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

  return { kind: 'invalid', message: 'Use “Watch: topic”, “Unwatch: topic”, or “List watches”.' };
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
