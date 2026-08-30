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
          bg: '#1b1b1f',
          sidebar: '#151519',
          panel: '#1f1f24',
          card: '#2a2a31',
          border: '#32323a',
          hover: '#383842',
          accent: '#7c5cfc',
          'accent-hover': '#6947eb',
          danger: '#d94552',
          text: '#e6e6ea',
          muted: '#9a9aa3',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
