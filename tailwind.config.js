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
        }
      }
    }
  },
  plugins: []
};