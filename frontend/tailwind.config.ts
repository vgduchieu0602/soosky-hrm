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
        // System-first: SF Pro on Apple hardware, Segoe on Windows.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Segoe UI",
          "Be Vietnam Pro",
          "Inter",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Soft, layered elevation scale — replaces flat border+shadow look
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        "card-hover":
          "0 4px 12px -2px rgba(16,24,40,0.08), 0 2px 6px -2px rgba(16,24,40,0.05)",
        pop: "0 12px 32px -8px rgba(16,24,40,0.14), 0 4px 12px -4px rgba(16,24,40,0.08)",
      },
      // Decorative motion (aurora blobs, fade-up cascades, shine sweeps) removed —
      // Apple-clean direction keeps only hover/focus transitions + slide-over.
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
