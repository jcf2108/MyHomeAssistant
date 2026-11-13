/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fluent: {
          base: 'var(--bg-flyout)',
          elevated: 'var(--bg-control)',
          hover: 'var(--bg-control-hover)',
          active: 'var(--bg-control-active)',
          ink: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
          accent: 'var(--accent-fluent)',
          accentInk: 'var(--accent-ink)',
          warm: 'var(--light-warm)',
          cool: 'var(--light-cool)',
          online: 'var(--status-online)',
          danger: 'var(--status-danger)',
        },
      },
      fontFamily: {
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      borderRadius: {
        flyout: '12px',
        card: '10px',
        control: '8px',
        pill: '9999px',
      },
      transitionTimingFunction: {
        fluent: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
