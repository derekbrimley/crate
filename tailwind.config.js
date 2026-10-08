/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Every color resolves to a theme variable (see src/index.css), so the
        // "paper" theme can swap the palette. Opacity modifiers are scaled by
        // --tint, which the paper theme raises so faint tints stay visible.
        crate: Object.fromEntries(
          [
            "bg", "surface", "elevated", "wood", "border", "text", "muted",
            "accent", "accent-dim", "vinyl", "label", "danger",
          ].map((name) => [name, `rgb(var(--c-${name}) / calc(<alpha-value> * var(--tint)))`])
        ),
      },
      fontFamily: {
        sans:    ['"IBM Plex Mono"', "Courier New", "monospace"],
        display: ['"Bebas Neue"', "Impact", "sans-serif"],
        type:    ['"Special Elite"', "Courier New", "serif"],
        mono:    ['"IBM Plex Mono"', "Courier New", "monospace"],
      },
      keyframes: {
        neonFlicker: {
          "0%, 18%, 22%, 25%, 53%, 57%, 100%": { opacity: "1" },
          "19%, 21%, 23%, 54%, 56%":            { opacity: "0.15" },
        },
        neonFlickerSlow: {
          "0%, 45%, 49%, 100%": { opacity: "1" },
          "46%, 48%":           { opacity: "0.3" },
        },
        spinVinyl: {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        crateSlideOut: {
          from: { transform: "translateX(0)",     opacity: "1" },
          to:   { transform: "translateX(-115%)", opacity: "0" },
        },
        crateSlideIn: {
          from: { transform: "translateX(115%)", opacity: "0" },
          to:   { transform: "translateX(0)",    opacity: "1" },
        },
        slotIn: {
          "0%":   { transform: "translateY(-18px) scale(0.93)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)",        opacity: "1" },
        },
        pinDrop: {
          "0%":   { transform: "translateY(-16px) scale(0.9)",  opacity: "0" },
          "65%":  { transform: "translateY(3px)   scale(1.02)", opacity: "1" },
          "100%": { transform: "translateY(0)     scale(1)",    opacity: "1" },
        },
        flickerOn: {
          "0%":   { opacity: "0" },
          "10%":  { opacity: "1" },
          "15%":  { opacity: "0.2" },
          "20%":  { opacity: "1" },
          "100%": { opacity: "1" },
        },
        panelOpen: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "neon-flicker":      "neonFlicker 3.5s ease-in-out infinite",
        "neon-flicker-slow": "neonFlickerSlow 7s ease-in-out infinite",
        "spin-vinyl":        "spinVinyl 4s linear infinite",
        "crate-out":         "crateSlideOut 0.28s cubic-bezier(0.55, 0, 1, 0.45) forwards",
        "crate-in":          "crateSlideIn 0.36s cubic-bezier(0, 0.55, 0.45, 1) forwards",
        "slot-in":           "slotIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pin-drop":          "pinDrop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "flicker-on":        "flickerOn 0.6s ease-out forwards",
        "panel-open":        "panelOpen 0.2s cubic-bezier(0.15,0.85,0.25,1) forwards",
      },
    },
  },
  plugins: [],
};
