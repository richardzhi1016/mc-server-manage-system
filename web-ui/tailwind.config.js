/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        mrinth: {
          bg:        '#17181c',
          surface:   '#1e1f23',
          high:      '#26272b',
          border:    '#2c2d31',
          green:     '#1bd96a',
          'green-h': '#18c45e',
          text:      '#e4e4e7',
          muted:     '#a1a1aa',
          overlay:   '#0d0e11',
        },
      },
    },
  },
  plugins: [],
}
