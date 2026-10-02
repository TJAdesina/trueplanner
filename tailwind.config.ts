import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        forest: "rgb(var(--color-forest) / <alpha-value>)",
        "forest-light": "rgb(var(--color-forest-light) / <alpha-value>)",
        green: "rgb(var(--color-green) / <alpha-value>)",
        peach: "rgb(var(--color-peach) / <alpha-value>)",
        charcoal: "rgb(var(--color-charcoal) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        // Dark mode surfaces (kept within brand family)
        "cream-dark": "#15201C",
        "surface-dark": "#1C2B25",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(25, 59, 50, 0.06), 0 1px 1px rgba(25, 59, 50, 0.04)",
        soft: "0 4px 16px rgba(25, 59, 50, 0.08)",
      },
      maxWidth: {
        content: "1180px",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-out both",
        slideIn: "slideIn 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
