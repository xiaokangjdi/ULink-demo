/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7FAFF",
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          900: "#1E3A8A"
        }
      },
      boxShadow: {
        soft: "0 4px 20px rgba(37, 99, 235, 0.08)"
      }
    }
  },
  plugins: []
};
