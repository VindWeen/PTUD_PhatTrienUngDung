/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        soft: {
          bg: '#f1f4f9',
          card: '#ffffff',
          darkBg: '#19202b',
          darkCard: '#252d3a',
          darkCardHover: '#2a3342',
          darkBorder: '#303a4b',
          sidebar: '#18202c',
          sidebarDark: '#141a24',
          banner: '#ebd9c3',
          bannerDark: '#8b6f50',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#6366f1',
          500: '#4318ff',
          600: '#3311db',
          700: '#2b0ebc',
        },
      },
      boxShadow: {
        'soft-sm': '0 4px 14px rgba(0, 0, 0, 0.03), 0 0 1px rgba(0, 0, 0, 0.08)',
        'soft-md': '0 10px 30px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 20px 40px rgba(0, 0, 0, 0.08)',
        'soft-dark': '0 10px 30px rgba(0, 0, 0, 0.35)',
      },
      borderRadius: {
        'soft-sm': '14px',
        'soft': '20px',
        'soft-lg': '28px',
        'soft-xl': '36px',
      },
    },
  },
  plugins: [],
};
