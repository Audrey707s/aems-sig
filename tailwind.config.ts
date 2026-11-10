import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1A3263",
          hover: "#122347",
          light: "#E8EEF7",
        },
        navy: {
          DEFAULT: "#1A3263",
          dark: "#122347",
          light: "#E8EEF7",
        },
        steel: {
          DEFAULT: "#547792",
          dark: "#3F5B71",
          light: "#EDF2F6",
        },
        amber: {
          DEFAULT: "#FAB95B",
          dark: "#E09B35",
          light: "#FEF6E7",
        },
        cream: {
          DEFAULT: "#E8E2DB",
          light: "#F7F5F2",
          dark: "#D6CEC3",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "Plus Jakarta Sans",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Consolas",
          "Monaco",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
