import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        arcstone: {
          bg: "#090D16",
          surface: "#0F172A",
          elevated: "#141E33",
          border: "#1E293B",
          "border-subtle": "#172033",
          hover: "#1A2640",
          primary: "#2563EB",
          "primary-hover": "#1D4ED8",
          text: "#F8FAFC",
          muted: "#94A3B8",
          subtle: "#64748B",
          accent: "#38BDF8",
        },
      },
    },
  },
  plugins: [],
};

export default config;

