'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    priorityDomains: [
      'Neural Data Infrastructure',
      'Scientific Workflow Systems',
      'Applied AI Products',
    ],
    showPersonal: false,
    emphasisColor: 'cyan',
  },
  researcher: {
    label: 'Researcher',
    description: 'Publications, neural modeling, and scientific methods',
    priorityTags: [
      'neuroscience',
      'publications',
      'LFP',
      'neural-decoding',
      'mechanistic-interpretability',
    ],
    priorityDomains: [
      'Neural Signal Discovery',
      'NEATLABs Research',
      'Mechanistic Interpretability',
      'Publications',
    ],
    showPersonal: false,
    emphasisColor: 'violet',
  },
  builder: {
    label: 'Builder',
    description: 'Infrastructure, tools, and real-time systems',
    priorityTags: [
      'infrastructure',
      'Docker',
      'AWS',
      'real-time',
      'monitoring',
      'hardware',
    ],
    priorityDomains: [
      'Scientific DevOps',
      'BCI & Real-Time Systems',
      'Scientific Workflow Systems',
      'Real-Time Creative Neurotech',
    ],
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

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('full-brain');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('snn-view-mode') as ViewMode | null;
    if (stored && modeConfigs[stored]) {
      setModeState(stored);
    }
    setIsHydrated(true);
  }, []);

  const setMode = (newMode: ViewMode) => {
    setModeState(newMode);
    localStorage.setItem('snn-view-mode', newMode);
  };

  const modeConfig = modeConfigs[mode];

  // Prevent hydration mismatch
  if (!isHydrated) {
    return (
      <ModeContext.Provider
        value={{ mode: 'full-brain', setMode, modeConfig: modeConfigs['full-brain'] }}
      >
        {children}
      </ModeContext.Provider>
    );
  }

  return (
    <ModeContext.Provider value={{ mode, setMode, modeConfig }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

export { modeConfigs };
