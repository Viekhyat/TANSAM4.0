/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#edf8ff",
          100: "#d6edff",
          200: "#a8daff",
          300: "#79c6ff",
          400: "#4bb3ff",
          500: "#1da0ff",
          600: "#0085e6",
          700: "#0066b4",
          800: "#004982",
          900: "#002f51"
        },
        glass: {
          border: "rgba(255, 255, 255, 0.12)",
          borderDark: "rgba(226, 232, 240, 0.25)",
          bg: "rgba(255, 255, 255, 0.06)",
          bgDark: "rgba(15, 23, 42, 0.4)",
          shadow: "rgba(29, 160, 255, 0.18)"
        }
      },
      boxShadow: {
        glass: "0 12px 40px rgba(15, 23, 42, 0.22)"
      },
      keyframes: {
        blobFloat: {
          "0%": { transform: "translate3d(-10%, -6%, 0) scale(1)" },
          "50%": { transform: "translate3d(6%, 8%, 0) scale(1.08)" },
          "100%": { transform: "translate3d(-10%, -6%, 0) scale(1)" }
        },
        ripple: {
          "0%": { width: "0", height: "0", opacity: "0.28" },
          "100%": { width: "140%", height: "140%", opacity: "0" }
        }
      },
      animation: {
        blob: "blobFloat 28s ease-in-out infinite",
        "blob-slow": "blobFloat 42s ease-in-out infinite",
        ripple: "ripple 0.9s ease-out forwards"
      }
    }
  },
  plugins: []
};
