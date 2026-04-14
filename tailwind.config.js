/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pitch: {
          900: '#07110e',
          800: '#0b1d17',
          700: '#103024',
        },
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
};
