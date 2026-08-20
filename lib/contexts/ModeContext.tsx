'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

export type ViewMode = 'recruiter' | 'researcher' | 'builder' | 'full-brain' | 'personal';

export interface ModeContextType {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  modeConfig: ModeConfig;
}

export interface ModeConfig {
  label: string;
  description: string;
  priorityTags: string[];
  priorityDomains: string[];
  showPersonal: boolean;
  emphasisColor: string;
}

const modeConfigs: Record<ViewMode, ModeConfig> = {
  recruiter: {
    label: 'Recruiter',
    description: 'Professional highlights and infrastructure work',
    priorityTags: ['DataJoint', 'AWS', 'Docker', 'infrastructure', 'publications'],
    priorityDomains: ['Neural Data Infrastructure', 'Scientific Workflow Systems', 'Applied AI Products'],
    showPersonal: false,
    emphasisColor: 'cyan',
  },
  researcher: {
    label: 'Researcher',
    description: 'Publications, neural modeling, and scientific methods',
    priorityTags: ['neuroscience', 'publications', 'LFP', 'neural-decoding', 'mechanistic-interpretability'],
    priorityDomains: ['Neural Signal Discovery', 'NEATLABs Research', 'Mechanistic Interpretability', 'Publications'],
    showPersonal: false,
    emphasisColor: 'violet',
  },
  builder: {
    label: 'Builder',
    description: 'Infrastructure, tools, and real-time systems',
    priorityTags: ['infrastructure', 'Docker', 'AWS', 'real-time', 'monitoring', 'hardware'],
    priorityDomains: ['Scientific DevOps', 'BCI & Real-Time Systems', 'Scientific Workflow Systems', 'Real-Time Creative Neurotech'],
    showPersonal: false,
    emphasisColor: 'green',
  },
  'full-brain': {
    label: 'Full Brain',
    description: 'Everything: all projects, experiments, and interests',
    priorityTags: [],
    priorityDomains: [],
    showPersonal: true,
    emphasisColor: 'amber',
  },
  personal: {
    label: 'Personal',
    description: 'Hobbies, adventures, and life outside the lab',
    priorityTags: ['Shasta', 'adventure', 'sports', 'gaming', 'food'],
    priorityDomains: ['Life Outside the Lab', 'Personal Product Experiments'],
    showPersonal: true,
    emphasisColor: 'rose',
  },
};

const STORAGE_KEY = 'snn-view-mode';
const MODE_EVENT = 'snn-view-mode-change';
const ModeContext = createContext<ModeContextType | undefined>(undefined);

function currentMode(): ViewMode {
  const stored = window.localStorage.getItem(STORAGE_KEY) as ViewMode | null;
  return stored && modeConfigs[stored] ? stored : 'full-brain';
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(MODE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(MODE_EVENT, onStoreChange);
  };
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, currentMode, () => 'full-brain');

  const setMode = (newMode: ViewMode) => {
    if (!modeConfigs[newMode]) return;
    window.localStorage.setItem(STORAGE_KEY, newMode);
    window.dispatchEvent(new Event(MODE_EVENT));
  };

  return <ModeContext.Provider value={{ mode, setMode, modeConfig: modeConfigs[mode] }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) throw new Error('useMode must be used within a ModeProvider');
  return context;
}

export { modeConfigs };
