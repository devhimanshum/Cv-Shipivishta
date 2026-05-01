/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Maritime Blue — primary brand colour
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bdd7fe',
          300: '#90b8fc',
          400: '#5b94f8',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e2f6b',
          950: '#0f1f4d',
        },
        // Deep Navy — sidebar / dark surfaces
        navy: {
          50:  '#f0f4fa',
          100: '#dde6f2',
          200: '#b8cde4',
          300: '#87abd1',
          400: '#4f82b6',
          500: '#2e609a',
          600: '#1f4a7e',
          700: '#163863',
          800: '#0d254a',
          900: '#071730',
          950: '#040e1e',
        },
        // Maritime Red — accent / logo chevron colour
        maritime: {
          50:  '#fff1f0',
          100: '#ffddd9',
          200: '#ffbab3',
          300: '#ff8b80',
          400: '#ff5c4d',
          500: '#f03022',
          600: '#c0392b',
          700: '#9e2215',
          800: '#7e1c10',
          900: '#5e1508',
          950: '#3a0a03',
        },
        // Surface — background / card tones (blue-tinted slate)
        surface: {
          50:  '#f5f8fc',
          100: '#eaf0f8',
          200: '#d5e3f0',
          300: '#b0cae2',
          400: '#80a8cc',
          800: '#1a2d45',
          900: '#0f1e30',
          950: '#080f1a',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
      animation: {
        'fade-in':     'fadeIn 0.3s ease-in-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-in':    'slideIn 0.3s ease-out',
        'pulse-soft':  'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':     'shimmer 1.5s infinite',
        'wave':        'wave 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        slideIn: {
          '0%':   { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',      opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        wave: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },
      boxShadow: {
        card:         '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 24px -4px rgba(14,37,98,0.12), 0 4px 8px -2px rgba(14,37,98,0.06)',
        glow:         '0 0 24px rgba(37,99,235,0.25)',
        'glow-red':   '0 0 20px rgba(192,57,43,0.3)',
        navy:         '0 4px 20px rgba(7,23,48,0.25)',
      },
      backgroundImage: {
        'gradient-maritime': 'linear-gradient(135deg, #071730 0%, #0d254a 50%, #163863 100%)',
        'gradient-ocean':    'linear-gradient(180deg, #071730 0%, #0e3a6e 60%, #1565C0 100%)',
        'gradient-card':     'linear-gradient(135deg, #ffffff 0%, #f5f8fc 100%)',
        'gradient-accent':   'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
      },
    },
  },
  plugins: [],
};
