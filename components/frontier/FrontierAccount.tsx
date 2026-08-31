'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw, Youtube } from 'lucide-react';
import { applyPreferenceImportToProfile, type FrontierPreferenceImport } from '@/lib/frontier/googlePreferences';
import { mergeFrontierMemory, parseFrontierPersistedState } from '@/lib/frontier/memoryMerge';
import { frontierBackup, sanitizeFrontierCloudMemory, useFrontierStore } from '@/lib/frontier/store';
import type { FrontierPersistedState } from '@/lib/frontier/types';
import styles from './frontier-account.module.css';

type SessionState = {
  configured: boolean;
  authenticated: boolean;
  syncConfigured: boolean;
  user?: {
    email: string;
    name?: string;
    picture?: string;
  };
};

type MemoryResponse = {
  configured?: boolean;
  memory?: {
    state?: unknown;
    updatedAt?: string;
  } | null;
  error?: string;
};

type ImportResponse = {
  ok?: boolean;
  needsConsent?: boolean;
  needsStorage?: boolean;
  error?: string;
  preferences?: FrontierPreferenceImport;
};

type SyncState = 'idle' | 'loading' | 'synced' | 'saving' | 'error';

async function pushMemory(state: FrontierPersistedState, keepalive = false): Promise<boolean> {
  // Cloud memory is an explicit projection of non-camera preference state. Any
  // ambient reaction fields from older clients are removed before transmission.
  const safeState = sanitizeFrontierCloudMemory(state);
  const response = await fetch('/api/frontier/memory', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: safeState }),
    cache: 'no-store',
    keepalive,
  });
  return response.ok;
}

export function FrontierAccount() {
  const hydrated = useFrontierStore((state) => state.hydrated);
  const [session, setSession] = useState<SessionState>();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string>();
  const timer = useRef<number | undefined>(undefined);
  const syncing = useRef(false);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      const payload = await response.json() as SessionState;
      setSession(payload);
    } catch {
      setSession({ configured: false, authenticated: false, syncConfigured: false });
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!hydrated || !session?.authenticated || !session.syncConfigured) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const saveSnapshot = async (state: FrontierPersistedState): Promise<boolean> => {
      syncing.current = true;
      try {
        return await pushMemory(state);
      } catch {
        return false;
      } finally {
        syncing.current = false;
      }
    };

    const begin = async () => {
      setSyncState('loading');
      try {
        const response = await fetch('/api/frontier/memory', { cache: 'no-store' });
        const payload = await response.json() as MemoryResponse;
        if (cancelled) return;
        if (!response.ok) {
          setSyncState('error');
          return;
        }
        const local = frontierBackup(useFrontierStore.getState());
        const parsedRemote = parseFrontierPersistedState(payload.memory?.state);
        // Strip ambient fields that may have reached cloud memory from a legacy
        // client before merging. Local ambient evidence remains in `local` and is
        // preserved by the merge, while the next save purges the remote copy.
        const remote = parsedRemote ? sanitizeFrontierCloudMemory(parsedRemote) : null;
        const merged = mergeFrontierMemory(remote, local);
        useFrontierStore.getState().importBackup(merged);
        const saved = await saveSnapshot(merged);
        if (cancelled) return;
        setSyncState(saved ? 'synced' : 'error');
        if (!saved) return;

        unsubscribe = useFrontierStore.subscribe((state) => {
          if (syncing.current) return;
          if (timer.current !== undefined) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(async () => {
            setSyncState('saving');
            const ok = await saveSnapshot(frontierBackup(state));
            if (!cancelled) setSyncState(ok ? 'synced' : 'error');
          }, 1_400);
        });
      } catch {
        syncing.current = false;
        if (!cancelled) setSyncState('error');
      }
    };

    void begin();
    const flush = () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      void pushMemory(frontierBackup(useFrontierStore.getState()), true).catch(() => false);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      cancelled = true;
      unsubscribe?.();
      window.removeEventListener('pagehide', flush);
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      syncing.current = false;
    };
  }, [hydrated, session?.authenticated, session?.syncConfigured]);

  const signIn = () => {
    window.location.assign('/api/auth/google/start?returnTo=/frontier');
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    setSession((current) => current ? { ...current, authenticated: false, user: undefined } : current);
    setSyncState('idle');
    setMessage(undefined);
  };

  const importGoogle = async () => {
    setImporting(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/frontier/google/import', { method: 'POST', cache: 'no-store' });
      const payload = await response.json() as ImportResponse;
      if (payload.needsConsent) {
        window.location.assign('/api/auth/google/start?intent=youtube&returnTo=/frontier');
        return;
      }
      if (!response.ok || !payload.preferences) {
        setMessage(payload.needsStorage ? 'Cloud memory is required first.' : (payload.error ?? 'Import failed.'));
        return;
      }
      useFrontierStore.setState((state) => ({
        profile: applyPreferenceImportToProfile(state.profile, payload.preferences!),
      }));
      const summary = payload.preferences.summary;
      setMessage(`${summary.subscriptions} subscriptions · ${summary.likedVideos} likes learned`);
    } catch {
      setMessage('Import unavailable.');
    } finally {
      setImporting(false);
    }
  };

  if (!session) return <div className={styles.placeholder} aria-hidden="true" />;

  if (!session.configured) {
    return (
      <div className={styles.localOnly} title="Local memory. Configure Google OAuth for cross-device sync.">
        <CloudOff size={12} /> local
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <button type="button" className={styles.signIn} onClick={signIn} title="Sign in with Google">
        <LogIn size={12} /> Sign in
      </button>
    );
  }

  const syncLabel = !session.syncConfigured
    ? 'local only'
    : syncState === 'loading'
      ? 'loading'
      : syncState === 'saving'
        ? 'saving'
        : syncState === 'error'
          ? 'sync issue'
          : 'synced';
  const shortName = session.user?.name?.split(/\s+/)[0] ?? session.user?.email.split('@')[0] ?? 'Account';

  return (
    <details className={styles.accountMenu}>
      <summary className={styles.account} title={`${session.user?.email ?? shortName} · ${syncLabel}`}>
        {session.user?.picture ? (
          // Google profile image is identity UI, not editorial feed media.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.picture} alt="" className={styles.avatar} referrerPolicy="no-referrer" />
        ) : <Cloud size={12} />}
        <span className={styles.name}>{shortName}</span>
        <span className={`${styles.syncDot} ${syncState === 'error' ? styles.syncError : ''}`} aria-label={syncLabel} />
      </summary>
      <div className={styles.menuPanel}>
        <div className={styles.menuMeta}>
          <span>{session.user?.email}</span>
          <strong>{syncLabel}</strong>
        </div>
        <button type="button" onClick={() => void importGoogle()} disabled={importing || !session.syncConfigured} title="Learn from consented YouTube subscriptions and liked videos">
          {importing ? <RefreshCw size={12} className={styles.spin} /> : <Youtube size={12} />} YouTube taste
        </button>
        <button type="button" onClick={() => void signOut()}><LogOut size={12} /> Sign out</button>
        {message ? <div className={styles.message}>{message}</div> : null}
      </div>
    </details>
  );
}
