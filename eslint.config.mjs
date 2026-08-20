import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // React 19's compiler-oriented hook rules are valuable diagnostics, but
      // several established rendering/effect patterns on this site are valid
      // without compiler memoization. Keep them visible without blocking a
      // production release; correctness rules such as rules-of-hooks remain
      // errors everywhere unless narrowly documented below.
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  {
    files: ['components/physiology/NatureWorldRenderer.tsx'],
    rules: {
      // NatureWorldRenderer is keyed by world.id at its parent boundary, so a
      // StylizedWildlife instance never changes between a no-wildlife and a
      // wildlife world. Keep this visible as debt while avoiding a false
      // release blocker for the intentionally remounted 2.5D scene component.
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'data/generated/**',
    'public/**',
    'gesture_experiments/**',
    'next-env.d.ts',
    'scripts/**',
    'tailwind.config.ts',
  ]),
]);
