import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
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
