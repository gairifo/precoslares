/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1A1A1A",
          muted: "#6B6B6B",
          soft: "#9A9A98",
        },
        brand: {
          50: "#E8F0FA",
          100: "#C5D8F0",
          500: "#1E5BA8",
          600: "#154480",
          700: "#0F3566",
        },
        orange: {
          50: "#FCEDE2",
          100: "#F8D4B8",
          500: "#E8742C",
          600: "#C45D1C",
          700: "#9A4214",
        },
        surface: "#F7F5F0",
        rule: "#E5E2DA",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Source Serif Pro", "Georgia", "serif"],
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};
