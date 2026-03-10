/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-bg-base)',
        surface: 'var(--color-bg-surface)',
        elevated: 'var(--color-bg-elevated)',
        border: 'var(--color-border)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        accent: 'var(--color-accent)'
      }
    }
  },
  plugins: []
};
