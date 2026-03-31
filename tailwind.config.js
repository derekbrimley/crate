/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        crate: {
          bg: "#0d0b09",
          surface: "#181510",
          elevated: "#211c16",
          border: "#2c2520",
          text: "#ede8df",
          muted: "#8a7d6e",
          accent: "#c8892a",
          "accent-dim": "#9a6518",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
