import type { Config } from 'tailwindcss';

/**
 * SEE CAFM Sync design tokens.
 * Enterprise SaaS palette: light surfaces, navy/slate typography,
 * restrained semantic colours for sync outcomes.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // SEE brand navy/indigo (matched to the SEE Services logo wordmark)
        navy: {
          DEFAULT: '#262a63',
          50: '#f1f2f9',
          100: '#e0e2f1',
          600: '#33377a',
          700: '#2c3068',
          800: '#262a63',
          900: '#1b1e49',
        },
        // Semantic sync outcomes
        success: {
          DEFAULT: '#15803d',
          soft: '#dcfce7',
          text: '#166534',
        },
        warning: {
          DEFAULT: '#b45309',
          soft: '#fef3c7',
          text: '#92400e',
        },
        danger: {
          DEFAULT: '#b91c1c',
          soft: '#fee2e2',
          text: '#991b1b',
        },
        info: {
          DEFAULT: '#1d4ed8',
          soft: '#dbeafe',
          text: '#1e40af',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-soft': 'pulse-soft 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
