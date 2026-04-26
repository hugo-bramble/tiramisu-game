/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#fdf6e8',
        bg2: '#fff8e7',
        surface: '#ffffff',
        surface2: '#fef3d9',
        ink: '#1f1108',
        ink2: '#7a614a',
        ink3: '#b8a48a',
        gold: '#c97b1a',
        goldsoft: '#f4c771',
        cocoa: '#4a2818',
        savoiardi: '#e8c897',
        mascarpone: '#fffaeb',
        successgreen: '#10b981',
        errorred: '#ef4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 16px rgba(74, 40, 24, 0.08)',
        large: '0 12px 40px rgba(74, 40, 24, 0.18)',
      },
    },
  },
  plugins: [],
};
