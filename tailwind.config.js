/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          bg: '#0d1317',
          sidebar: '#090e12',
          panel: '#111a20',
          card: '#16222a',
          hover: '#1c2c36',
          border: '#1f3340',
          'border-subtle': '#15242e',
          accent: '#237d8a',
          'accent-hover': '#2d9aa9',
          'accent-muted': '#143640',
          'accent-light': '#5ecbd7',
          danger: '#c24747',
          'danger-hover': '#d95353',
          'danger-muted': '#3b1818',
          gold: '#c29b38',
          'gold-muted': '#3d3012',
          text: '#edf4f5',
          muted: '#7e9aa6',
          faint: '#415a66',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        display: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
