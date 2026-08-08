/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./app/index.html", "./src/**/*.{js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        zinc: {
          850: "#1f1f23",
          950: "#09090b",
        },
        accent: {
          400: "var(--accent-400)",
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)",
          900: "var(--accent-900)",
        },
      },
    },
  },
  plugins: [],
};
