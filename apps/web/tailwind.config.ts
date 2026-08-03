import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: { extend: { boxShadow: { auth: '0 28px 80px rgba(6, 23, 43, 0.28)' } } },
  plugins: [],
};

export default config;
