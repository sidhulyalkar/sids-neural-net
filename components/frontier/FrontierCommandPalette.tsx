'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Radar, X } from 'lucide-react';
import {
  parseFrontierPaletteCommand,
  resolveFrontierPaletteKeyboardIntent,
} from '@/lib/frontier/watch/commandPalette';
import type { FrontierAvoidAnchor } from '@/lib/frontier/watch/avoidEngine';
import type { FrontierWatchIntent } from '@/lib/frontier/watch/intentEngine';
import styles from './frontier-command-palette.module.css';

type Props = {
  intents: FrontierWatchIntent[];
  avoids: FrontierAvoidAnchor[];
  onCreate: (query: string) => Promise<FrontierWatchIntent>;
  onRemove: (id: string) => Promise<void>;
  onSetActive: (id: string, active: boolean) => Promise<void>;
  onCreateAvoid: (query: string) => Promise<FrontierAvoidAnchor>;
  onRemoveAvoid: (id: string) => Promise<void>;
  onSetAvoidActive: (id: string, active: boolean) => Promise<void>;
};

function fuzzyLabelMatch<T extends { label: string }>(items: T[], query: string): T | undefined {
  const normalized = query.toLowerCase();
  return items.find((item) => item.label.toLowerCase() === normalized)
    ?? items.find((item) => item.label.toLowerCase().includes(normalized));
}

export function FrontierCommandPalette({
  intents,
  avoids,
  onCreate,
  onRemove,
  onSetActive,
  onCreateAvoid,
  onRemoveAvoid,
  onSetAvoidActive,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('Watch: state-space neural models · Avoid: generic AI hype');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus({ preventScroll: true }));
  }, []);

  const show = useCallback(() => {
    const active = document.activeElement;
    previousFocusRef.current = active instanceof HTMLElement ? active : null;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = resolveFrontierPaletteKeyboardIntent({
        open,
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
      });
      if (action === 'open-focus-input') {
        event.preventDefault();
        show();
      } else if (action === 'close-restore-focus') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, open, show]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const submit = async () => {
    const command = parseFrontierPaletteCommand(draft);
    if (command.kind === 'invalid') {
      setMessage(command.message);
      return;
    }
    if (command.kind === 'help') {
      setMessage('Watch: topic · Avoid: topic · Unwatch/Unavoid · List watches/avoids');
      return;
    }
    if (command.kind === 'list') {
      const active = intents.filter((intent) => intent.active).length;
      setMessage(`${active} active watch${active === 1 ? '' : 'es'} · ${intents.length} stored`);
      return;
    }
    if (command.kind === 'list-avoids') {
      const active = avoids.filter((anchor) => anchor.active).length;
      setMessage(`${active} active avoid${active === 1 ? '' : 's'} · ${avoids.length} stored`);
      return;
    }
    if (command.kind === 'unwatch') {
      const match = fuzzyLabelMatch(intents, command.query);
      if (!match) {
        setMessage(`No watch matches “${command.query}”.`);
        return;
      }
      setBusy(true);
      try {
        await onRemove(match.id);
        setDraft('');
        setMessage(`Stopped watching ${match.label}.`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (command.kind === 'unavoid') {
      const match = fuzzyLabelMatch(avoids, command.query);
      if (!match) {
        setMessage(`No avoid anchor matches “${command.query}”.`);
        return;
      }
      setBusy(true);
      try {
        await onRemoveAvoid(match.id);
        setDraft('');
        setMessage(`Allowed ${match.label} again.`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (command.kind === 'avoid') {
      setBusy(true);
      try {
        const created = await onCreateAvoid(command.query);
        setDraft('');
        setMessage(`Avoiding ${created.label}.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not create Avoid anchor.');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const created = await onCreate(command.query);
      setDraft('');
      setMessage(`Watching ${created.label}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create Watch Intent.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <section className={styles.palette} role="dialog" aria-modal="true" aria-label="FRONTIER command palette">
        <div className={styles.inputRow}>
          <Radar size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Watch: 13kb physics engines · Avoid: generic crypto news"
            aria-label="FRONTIER command"
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" onClick={close} aria-label="Close command palette"><X size={14} /></button>
        </div>

        <div className={styles.status} aria-live="polite">
          <span>{busy ? 'encoding local semantic target…' : message}</span>
          <kbd>⌘K</kbd>
        </div>

        {intents.length ? (
          <div className={styles.watchList} aria-label="Stored Watch Intents">
            {intents.slice(0, 8).map((intent) => (
              <div className={styles.watchRow} key={intent.id} data-active={intent.active ? 'true' : 'false'} data-kind="watch">
                <button
                  type="button"
                  className={styles.watchToggle}
                  onClick={() => void onSetActive(intent.id, !intent.active)}
                  aria-pressed={intent.active}
                  title={intent.active ? 'Pause watch' : 'Resume watch'}
                >
                  <span className={styles.watchDot} aria-hidden="true" />
                  <span>watch · {intent.label}</span>
                </button>
                <button type="button" className={styles.removeWatch} onClick={() => void onRemove(intent.id)} aria-label={`Remove watch ${intent.label}`}>×</button>
              </div>
            ))}
          </div>
        ) : null}

        {avoids.length ? (
          <div className={styles.watchList} aria-label="Stored Avoid anchors">
            {avoids.slice(0, 8).map((anchor) => (
              <div className={styles.watchRow} key={anchor.id} data-active={anchor.active ? 'true' : 'false'} data-kind="avoid">
                <button
                  type="button"
                  className={styles.watchToggle}
                  onClick={() => void onSetAvoidActive(anchor.id, !anchor.active)}
                  aria-pressed={anchor.active}
                  title={anchor.active ? 'Pause avoid anchor' : 'Resume avoid anchor'}
                >
                  <span className={styles.watchDot} aria-hidden="true" />
                  <span>avoid · {anchor.label}</span>
                </button>
                <button type="button" className={styles.removeWatch} onClick={() => void onRemoveAvoid(anchor.id)} aria-label={`Remove avoid ${anchor.label}`}>×</button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
