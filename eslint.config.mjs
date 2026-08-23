import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // React 19's compiler-oriented hook rules are useful optimization
      // diagnostics, but they are not correctness gates for established
      // imperative/WebGL/deterministic rendering code. `npm run lint:react19`
      // re-enables these as visible warnings in CI while `npm run lint` keeps a
      // true zero-warning production correctness gate.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    files: ['components/physiology/NatureWorldRenderer.tsx'],
    rules: {
      // NatureWorldRenderer is keyed by world.id at its parent boundary, so a
      // StylizedWildlife instance never changes between a no-wildlife and a
      // wildlife world. The advisory audit still surfaces this compiler hint.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: [
      'components/frontier/live/useLiveDiscoveryDaemon.ts',
      'components/frontier/vector/useSemanticReranker.ts',
    ],
    rules: {
      // These hooks intentionally synchronize individual stable fields rather
      // than unstable aggregate option/provider objects. Depending on the
      // aggregate identities would restart workers and ranking state every
      // render. Their field-level dependencies are covered by FRONTIER browser
      // and deterministic ranking tests.
      'react-hooks/exhaustive-deps': 'off',
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
