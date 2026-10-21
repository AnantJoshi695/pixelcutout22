/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Professional green palette — user specified
        green: {
          50:  '#e7f5ec',
          100: '#c5ebd5',
          200: '#8fd9b0',
          300: '#59c688',
          400: '#2dbe7f',
          500: '#21834a',
          600: '#1a6d3d',
          700: '#145730',
          800: '#0e4123',
          900: '#092b18',
          950: '#041a0d',
        },
        // Light-mode neutrals
        surface: '#f7faf8',
        paper:   '#ffffff',
        ink:     '#17251c',
        mute:    '#53665a',
        muted:   '#8a9e8f',
        frame:   '#dce8df',
        // Dark-mode surfaces
        'dark-surface': '#19231d',
        'dark-elevated': '#202d25',
        'dark-workspace': '#0B1711',
        'dark-sidebar': '#10231A',
        'dark-card': '#172D21',
        'dark-border': '#244532',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'floatSlow 12s ease-in-out infinite',
        'float-medium': 'floatMedium 18s ease-in-out infinite',
        'float-fast': 'floatFast 8s ease-in-out infinite',
        'drift': 'drift 20s linear infinite',
        'drift-reverse': 'drift 25s linear infinite reverse',
        'soft-pulse': 'softPulse 4s ease-in-out infinite',
        'morph': 'morph 16s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -20px) scale(1.05)' },
          '66%': { transform: 'translate(-20px, 15px) scale(0.95)' },
        },
        floatMedium: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '50%': { transform: 'translate(-40px, 25px) rotate(5deg)' },
        },
        floatFast: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(15px, -10px)' },
          '50%': { transform: 'translate(-5px, 15px)' },
          '75%': { transform: 'translate(-15px, -5px)' },
        },
        drift: {
          '0%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(60px, -30px)' },
          '50%': { transform: 'translate(30px, 40px)' },
          '75%': { transform: 'translate(-40px, 20px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        softPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.08)' },
        },
        morph: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70%/60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40%/50% 60% 30% 60%' },
        },
      },
    },
  },
  plugins: [],
}
