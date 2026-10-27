/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['Silkscreen', 'Courier New', 'monospace'],
        hud: ['Orbitron', 'Rajdhani', 'Segoe UI', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['Inter', 'Segoe UI', 'sans-serif'],
        ar: ['Cairo', 'Tajawal', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
