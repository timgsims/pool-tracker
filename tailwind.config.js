/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pool: {
          bg: '#0a0a0a',
          surface: '#111111',
          elevated: '#1a1a1a',
          card: '#1e1e1e',
          border: '#2a2a2a',
          accent: '#22c55e',
          'accent-dim': '#16a34a',
          'accent-muted': '#14532d',
          win: '#22c55e',
          loss: '#ef4444',
          amber: '#f59e0b',
          muted: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
