import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#070A11",
        // Tokens de tema: cambian con html.light / html.oled (ver globals.css)
        app: "rgb(var(--c-app) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        inset: "rgb(var(--c-inset) / <alpha-value>)",
        white: "rgb(var(--c-ink) / <alpha-value>)",
        "on-accent": "#ffffff",
        mint: "rgb(var(--c-mint) / <alpha-value>)",
        sky2: "rgb(var(--c-sky) / <alpha-value>)",
        indigo2: "rgb(var(--c-indigo) / <alpha-value>)",
        slate: {
          100: "rgb(var(--s-100) / <alpha-value>)",
          200: "rgb(var(--s-200) / <alpha-value>)",
          300: "rgb(var(--s-300) / <alpha-value>)",
          400: "rgb(var(--s-400) / <alpha-value>)",
          500: "rgb(var(--s-500) / <alpha-value>)",
          600: "rgb(var(--s-600) / <alpha-value>)",
          700: "rgb(var(--s-700) / <alpha-value>)",
          800: "rgb(var(--s-800) / <alpha-value>)",
          900: "rgb(var(--s-900) / <alpha-value>)",
        },
        emerald: { 300: "rgb(var(--a-emerald-300) / <alpha-value>)", 400: "rgb(var(--a-emerald-400) / <alpha-value>)" },
        teal: { 300: "rgb(var(--a-teal-300) / <alpha-value>)", 400: "rgb(var(--a-teal-400) / <alpha-value>)" },
        cyan: { 300: "rgb(var(--a-cyan-300) / <alpha-value>)", 400: "rgb(var(--a-cyan-400) / <alpha-value>)" },
        rose: { 300: "rgb(var(--a-rose-300) / <alpha-value>)", 400: "rgb(var(--a-rose-400) / <alpha-value>)" },
        amber: { 300: "rgb(var(--a-amber-300) / <alpha-value>)", 400: "rgb(var(--a-amber-400) / <alpha-value>)" },
        violet: { 300: "rgb(var(--a-violet-300) / <alpha-value>)", 400: "rgb(var(--a-violet-400) / <alpha-value>)" },
        surface: {
          50: "#1A2234",
          100: "#141B2D",
          200: "#0F1626",
          300: "#0B101D",
          DEFAULT: "#0D1322",
        },
        brand: {
          emerald: "#10B981",
          cyan: "#06B6D4",
          violet: "#8B5CF6",
          rose: "#F43F5E",
          amber: "#F59E0B",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "orb-float": "orbFloat 6s ease-in-out infinite",
        "spin-slow": "spin 12s linear infinite",
      },
      keyframes: {
        orbFloat: {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%": { transform: "translateY(-8px) scale(1.03)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
