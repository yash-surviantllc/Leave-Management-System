import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211d",
        surface: "#f6f7f5",
        line: "#dfe5df",
        brand: {
          50: "#eefdf5",
          100: "#d8f7e8",
          600: "#187a52",
          700: "#126340"
        }
      },
      boxShadow: {
        soft: "0 12px 30px rgba(23, 33, 29, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
