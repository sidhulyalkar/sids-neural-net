'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw, Youtube } from 'lucide-react';
import { applyPreferenceImportToProfile, type FrontierPreferenceImport } from '@/lib/frontier/googlePreferences';
import { mergeFrontierMemory, parseFrontierPersistedState } from '@/lib/frontier/memoryMerge';
import { frontierBackup, useFrontierStore } from '@/lib/frontier/store';
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
  const response = await fetch('/api/frontier/memory', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
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
        // Never treat a transient cloud-read failure as an empty account. Doing so
        // could overwrite a healthy remote memory snapshot with a single device's
        // local copy. Local FRONTIER remains fully usable while sync reports error.
        if (!response.ok) {
          setSyncState('error');
          return;
        }
        const local = frontierBackup(useFrontierStore.getState());
        const remote = parseFrontierPersistedState(payload.memory?.state);
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
      // Best effort only. The debounced autosave is the primary persistence path;
      // browser keepalive payload limits can reject large final snapshots.
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
    setMessage('Signed out. This browser keeps its local copy.');
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
        setMessage(payload.needsStorage ? 'Cloud memory must be configured before Google taste import.' : (payload.error ?? 'Google import failed.'));
        return;
      }
      useFrontierStore.setState((state) => ({
        profile: applyPreferenceImportToProfile(state.profile, payload.preferences!),
      }));
      const summary = payload.preferences.summary;
      setMessage(`Learned from ${summary.subscriptions} subscriptions and ${summary.likedVideos} liked videos.`);
    } catch {
      setMessage('Google import is temporarily unavailable.');
    } finally {
      setImporting(false);
    }
  };

  if (!session) return <div className={styles.placeholder} aria-hidden="true" />;

  if (!session.configured) {
    return (
      <div className={styles.account} title="Configure Google OAuth to enable cross-device FRONTIER memory">
        <CloudOff size={13} /> <span>local memory</span>
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <button type="button" className={styles.signIn} onClick={signIn}>
        <LogIn size={13} /> Sign in with Google
      </button>
    );
  }

  const syncLabel = !session.syncConfigured
    ? 'local only'
    : syncState === 'loading'
      ? 'loading memory'
      : syncState === 'saving'
        ? 'saving'
        : syncState === 'error'
          ? 'sync issue'
          : 'cloud synced';

  return (
    <div className={styles.accountWrap}>
      <div className={styles.account}>
        {session.user?.picture ? (
          // Google profile image is identity UI, not editorial feed media.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.picture} alt="" className={styles.avatar} referrerPolicy="no-referrer" />
        ) : <Cloud size={13} />}
        <span className={styles.name}>{session.user?.name ?? session.user?.email}</span>
        <span className={styles.sync}>{syncLabel}</span>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => void importGoogle()} disabled={importing || !session.syncConfigured} title="Use consented YouTube subscriptions and liked videos as private preference signals">
          {importing ? <RefreshCw size={12} className={styles.spin} /> : <Youtube size={12} />} Import YouTube taste
        </button>
        <button type="button" onClick={() => void signOut()} title="Sign out"><LogOut size={12} /></button>
      </div>
      {message ? <div className={styles.message}>{message}</div> : null}
    </div>
  );
}
