import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brass & Ivory Ledger palette
        ivory: {
          50: '#FDFCFA',
          100: '#FAF7F2',
          200: '#F5F0E8',
          300: '#EDE5D8',
          400: '#DDD2BE',
          500: '#C4B69A',
        },
        forest: {
          50: '#E8F0ED',
          100: '#C5D9D0',
          200: '#9EBFB0',
          300: '#77A590',
          400: '#5A9178',
          500: '#3D7D60',
          600: '#2F6A4F',
          700: '#1F5640',
          800: '#1a3a2f',
          900: '#0F2920',
          950: '#071510',
        },
        brass: {
          50: '#FDF8E8',
          100: '#F9EEC5',
          200: '#F3DC8A',
          300: '#E5C54F',
          400: '#D4A843',
          500: '#C9A227',
          600: '#B8860B',
          700: '#946B09',
          800: '#705008',
          900: '#4C3605',
        },
        burgundy: {
          50: '#FCE8ED',
          100: '#F8C5D1',
          200: '#F09EB0',
          300: '#E8778F',
          400: '#D64D6A',
          500: '#B82E4D',
          600: '#8B2942',
          700: '#6E1F34',
          800: '#511626',
          900: '#340D18',
        },
        charcoal: {
          50: '#F5F4F3',
          100: '#E8E6E4',
          200: '#D4D0CC',
          300: '#B8B2AB',
          400: '#97908A',
          500: '#776F68',
          600: '#5A5450',
          700: '#3D3A38',
          800: '#2D2A26',
          900: '#1A1816',
          950: '#0D0C0B',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Newsreader', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'ledger': '0 1px 0 0 rgba(29, 29, 27, 0.05), 0 4px 12px -2px rgba(29, 29, 27, 0.08)',
        'ledger-hover': '0 2px 0 0 rgba(29, 29, 27, 0.05), 0 8px 24px -4px rgba(29, 29, 27, 0.12)',
        'emboss': 'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 2px rgba(29, 29, 27, 0.1)',
        'inset': 'inset 0 2px 4px rgba(29, 29, 27, 0.06)',
      },
      backgroundImage: {
        'paper-texture': `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        'ledger-lines': 'repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(29, 29, 27, 0.03) 31px, rgba(29, 29, 27, 0.03) 32px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(201, 162, 39, 0)' },
          '50%': { boxShadow: '0 0 20px rgba(201, 162, 39, 0.15)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
