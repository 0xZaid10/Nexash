import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './providers/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          200: '#c7c7fe',
          400: '#9090e0',
          500: '#6C6AF6',
          600: '#4f46e5',
          700: '#3730a3',
          900: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#fafafa',
          tertiary: '#f5f5f5',
        },
        border: {
          DEFAULT: '#ebebeb',
          strong: '#d4d4d4',
        },
        text: {
          primary: '#0a0a0b',
          secondary: '#555555',
          tertiary: '#888888',
          muted: '#bbbbbb',
        },
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:   ['11px', '16px'],
        sm:   ['12px', '18px'],
        base: ['13px', '20px'],
        md:   ['14px', '22px'],
        lg:   ['15px', '24px'],
        xl:   ['16px', '26px'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        sm:   '0 1px 2px rgba(0,0,0,0.05)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}

export default config
