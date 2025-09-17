/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  // Scope utilities to the root of each page to avoid leakage
  important: '#root',
}
