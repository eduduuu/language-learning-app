/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        jp: ['"Noto Sans JP"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 6px 24px -8px rgba(251, 191, 36, 0.4)',
      },
    },
  },
  plugins: [],
};