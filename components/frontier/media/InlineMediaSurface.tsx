'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const InlineMediaExpansionContext = createContext(false);

export function InlineMediaSurface({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  // This boundary deliberately does not clone, portal, or re-key media. The
  // exact media subtree remains mounted while the surrounding spatial card
  // changes geometry, preserving playback state and GPU registration identity.
  return (
    <InlineMediaExpansionContext.Provider value={expanded}>
      <div data-frontier-inline-media={expanded ? 'expanded' : 'compact'}>{children}</div>
    </InlineMediaExpansionContext.Provider>
  );
}

export function useInlineMediaExpansion(): boolean {
  return useContext(InlineMediaExpansionContext);
}
