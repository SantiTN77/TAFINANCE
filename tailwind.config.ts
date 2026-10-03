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
