import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "#E8FAFF",
          100: "#C8F2FF",
          200: "#9BE8FF",
          300: "#67DBFF",
          400: "#2CCBFF",
          500: "#00B8F5",
          600: "#009AD1",
          700: "#007CAA",
          800: "#005F82",
          900: "#003F57",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          50: "#EEF5FF",
          100: "#D9E8FF",
          200: "#B8D4FF",
          300: "#89B7FF",
          400: "#5D97FF",
          500: "#367BFF",
          600: "#245FE0",
          700: "#1B49B0",
          800: "#163985",
          900: "#11295C",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        'aurora-1': { 
            '0%,100%': { transform: 'translate(0,0) scale(1)' },
            '50%':     { transform: 'translate(40px,-30px) scale(1.10)' } 
          },
        'aurora-2': { 
            '0%,100%': { transform: 'translate(0,0) scale(1)' },
            '50%':     { transform: 'translate(-30px,40px) scale(1.15)' } 
          },
        'aurora-3': { 
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%':     { transform: 'translate(30px,30px) scale(0.95)' } 
        },
        'fade-up': { 
          from: { opacity: 0, transform: 'translateY(12px)' },
          to:   { opacity: 1, transform: 'translateY(0)' } 
        },
        'fade-in': { 
          from: { opacity: 0 }, to: { opacity: 1 } 
        },
        'ring-pulse': { 
          '0%': { boxShadow: '0 0 0 0 rgba(0,184,245,0.45)' },
          '100%': { boxShadow: '0 0 0 14px rgba(0,184,245,0)' } 
        },
        shine: { 
          '0%': { transform: 'translateX(-150%) skewX(-12deg)' },
          '100%': { transform: 'translateX(250%) skewX(-12deg)' } 
        },
      },
      animation: {
        'aurora-1': 'aurora-1 18s ease-in-out infinite',
        'aurora-2': 'aurora-2 22s ease-in-out infinite',
        'aurora-3': 'aurora-3 16s ease-in-out infinite',
        'fade-up': 'fade-up 0.7s ease-out both',
        'fade-in': 'fade-in 0.9s ease-out both',
        'ring-pulse':'ring-pulse 2s ease-out infinite',
        'shine': 'shine 3.6s ease-in-out infinite 1.2s',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
