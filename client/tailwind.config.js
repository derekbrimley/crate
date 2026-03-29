/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        crate: {
          bg: "#0f0f0f",
          surface: "#1a1a1a",
          elevated: "#252525",
          border: "#2e2e2e",
          text: "#f0ece4",
          muted: "#888880",
          accent: "#e8a838",
          "accent-dim": "#b37f1e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
