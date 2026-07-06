/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#eff9fb',
          100: '#d7f0f5',
          200: '#b0e0ec',
          300: '#7cc9dc',
          400: '#43a9c4',
          500: '#278ca9',
          600: '#22708f',
          700: '#215b75',
          800: '#224c61',
          900: '#204053',
          950: '#0f2937',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
