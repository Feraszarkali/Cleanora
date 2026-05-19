
import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 900: '#1e3a8a' },
        dark: { 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        emerald: { 450: '#10b981' }
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-cleanora': 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #10b981 100%)',
      },
      boxShadow: { 'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }
    },
  },
  plugins: [],
}
export default config
