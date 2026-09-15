import type { Config } from "tailwindcss";

// RichyKicks "Royal Midnight" design tokens (PRD section 9).
// Gold is an accent color only - it should never dominate the UI.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#0B0B10",
        "royal-purple": "#5B21B6",
        "royal-purple-hover": "#4C1D95",
        gold: "#D4AF37",
        ivory: "#F5F5F0",
        "soft-gray": "#A1A1AA",
        charcoal: "#15151C",
        success: "#10B981",
        error: "#DC2626",
      },
    },
  },
  plugins: [],
};

export default config;
