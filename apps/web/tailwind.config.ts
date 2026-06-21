import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B3A6B',
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#1D4ED8',
          700: '#1B3A6B',
          800: '#152E55',
          900: '#0F213E',
        },
        teal: {
          DEFAULT: '#0E7490',
          50: '#F0FDFA',
          100: '#CCFBF1',
          500: '#0E7490',
          600: '#0C6478',
        },
        gold: {
          DEFAULT: '#B45309',
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#B45309',
          600: '#92400E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '240px',
        'nav-height': '64px',
      },
    },
  },
  plugins: [],
};

export default config;
