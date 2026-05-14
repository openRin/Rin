/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector','[data-color-mode="dark"]'],
  theme: {
    extend: {
      colors: {
        'theme': 'rgb(var(--theme-rgb) / <alpha-value>)',
        'theme-hover': 'rgb(var(--theme-hover-rgb) / <alpha-value>)',
        'theme-active': 'rgb(var(--theme-active-rgb) / <alpha-value>)',
        'background': {
          'light': '#fffcf0',
          'dark': '#100f0f',
        },
        'dark': "#343331"
      },
      transitionProperty: {
        'height': 'height',
        'width': 'width',
        'spacing': 'margin, padding',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
