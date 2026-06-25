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
      fontFamily: {
        'brand': ['"Averia Gruesa Libre"', 'cursive'],
        'sans': [
          'PingFang SC',
          '-apple-system',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Ubuntu',
          'Cantarell',
          'Noto Sans',
          'sans-serif',
          'BlinkMacSystemFont',
          'Helvetica Neue',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Arial',
        ],
      },
      colors: {
        'theme': 'rgb(var(--theme-rgb) / <alpha-value>)',
        'theme-hover': 'rgb(var(--theme-hover-rgb) / <alpha-value>)',
        'theme-active': 'rgb(var(--theme-active-rgb) / <alpha-value>)',
        'brand': 'var(--theme-brand)',
        'brand-secondary': 'var(--theme-brand-secondary)',
        'primary': 'var(--theme-primary)',
        'secondary': 'var(--theme-secondary)',
        'card': 'var(--theme-card)',
        'article': 'var(--theme-article)',
        'bg': 'var(--theme-bg)',
        'border': 'var(--theme-border)',
        'background': {
          'light': '#f5f5f5',
          'dark': '#1c1c1e',
        },
        'dark': "#333333"
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
