import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep backgrounds
        'bg-deep': '#050914',
        'bg-panel': '#0b1020',
        'bg-panel-2': '#11182b',

        // Text
        'text-primary': '#f8fbff',
        'text-secondary': '#b8c7d9',
        'text-muted': '#7d8da3',

        // Accent colors
        cyan: {
          DEFAULT: '#66e3ff',
          50: '#e6fbff',
          100: '#b3f3ff',
          200: '#80ebff',
          300: '#66e3ff',
          400: '#4dd9ff',
          500: '#33cfff',
          600: '#1ac5ff',
          700: '#00bbff',
          800: '#009cd6',
          900: '#007dad',
        },
        violet: {
          DEFAULT: '#a78bfa',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        amber: {
          DEFAULT: '#f7c66b',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#f7c66b',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        green: {
          DEFAULT: '#66f0c2',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#66f0c2',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        rose: {
          DEFAULT: '#ff7aa2',
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#ff7aa2',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(102, 227, 255, 0.3)',
        'glow-violet': '0 0 20px rgba(167, 139, 250, 0.3)',
        'glow-amber': '0 0 20px rgba(247, 198, 107, 0.3)',
        'glow-green': '0 0 20px rgba(102, 240, 194, 0.3)',
        'glow-rose': '0 0 20px rgba(255, 122, 162, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
