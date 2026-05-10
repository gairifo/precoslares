/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0f172a",
          muted: "#475569",
          soft: "#64748b",
        },
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          500: "#0f766e",
          600: "#115e59",
          700: "#134e4a",
        },
        accent: "#f59e0b",
        rule: "#e2e8f0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Source Serif Pro", "Georgia", "serif"],
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};
