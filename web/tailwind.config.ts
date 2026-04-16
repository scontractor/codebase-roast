import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fire: {
          red: '#ff2200',
          orange: '#ff4500',
          amber: '#ff8c00',
          dim: '#7a2000',
        },
        ash: {
          DEFAULT: '#0a0a0a',
          card: '#111111',
          border: '#1e1e1e',
          text: '#c8b8a8',
          dim: '#5a4a3e',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'glitch': 'glitch 8s infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'fire-pulse': 'fire-pulse 2s ease-in-out infinite',
        'flicker': 'flicker 5s linear infinite',
        'scan': 'scan 8s linear infinite',
      },
      keyframes: {
        glitch: {
          '0%, 90%, 100%': { transform: 'translate(0)' },
          '91%': { transform: 'translate(3px, 0)' },
          '92%': { transform: 'translate(-3px, 0)' },
          '93%': { transform: 'translate(0)' },
          '94%': { transform: 'translate(2px, 1px)' },
          '95%': { transform: 'translate(-2px, -1px)' },
          '96%': { transform: 'translate(0)' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'fire-pulse': {
          '0%, 100%': { textShadow: '0 0 8px #ff4500, 0 0 20px #ff2200' },
          '50%': { textShadow: '0 0 16px #ff6b00, 0 0 40px #ff4500, 0 0 60px #ff2200' },
        },
        flicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.8' },
        },
        scan: {
          '0%': { backgroundPosition: '0 -100vh' },
          '100%': { backgroundPosition: '0 100vh' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
