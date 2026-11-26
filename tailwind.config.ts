import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#EFF5FF", 100: "#DBE8FE", 200: "#BFDBFE", 300: "#93C5FD", 400: "#4F8DFF", 500: "#2F6BFF", 600: "#2563EB", 700: "#1D4ED8", 800: "#123A8C", 900: "#0B1F4D" },
        ink: { DEFAULT: "#0F172A", soft: "#334155", mute: "#5B6B88", line: "#E2E8F0", wash: "#F4F7FC" },
        tick: { DEFAULT: "#22D3EE", dark: "#0891B2" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter Display", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(24,23,43,.04), 0 1px 3px rgba(24,23,43,.06)" },
    },
  },
  plugins: [],
} satisfies Config;
