import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Use CSS variables for theme-aware colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        card: "hsl(var(--card))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        // Keep existing dashboard colors for backward compatibility
        dashboard: {
          teal: "#00c4b4",
          green: "#00c67d",
          coral: "#ff8e6e",
          red: "#ff6b7d",
          navy: "#384050",
          lightGray: "#f8f9fa",
        },
        // Custom report colors
        "report-primary": "#5A67D8",
        "report-success": "#48BB78",
        "report-warning": "#F6E05E",
        "report-pending": "#ED8936",
        
        // Theme colors - Add these for dynamic theme support
        'theme-primary': 'var(--primary-color, indigo)',
        'theme-secondary': 'var(--secondary-color, sky)',
        'theme-accent': 'var(--accent-color, amber)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-in-out forwards",
        "slide-out-left": "slide-out-left 0.3s ease-in-out forwards",
      },
      transitionProperty: {
        width: "width",
        height: "height",
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  // Add safelist for dynamic color classes
  safelist: [
    'theme-aurora',
    'theme-ocean',
    'theme-slate',
    'theme-peach',
    'dark',
    'bg-gradient-mint',
    'bg-gradient-aurora',
    'bg-gradient-ocean',
    'bg-gradient-slate',
    'bg-gradient-peach',
    { pattern: /^bg-(indigo|blue|purple|pink|green|sky|teal|cyan|gray|amber|orange|red|rose)-(100|500|600|700|800|900)$/ },
    { pattern: /^text-(indigo|blue|purple|pink|green|sky|teal|cyan|gray|amber|orange|red|rose)-(100|500|600|700|800|900)$/ },
    { pattern: /^border-(indigo|blue|purple|pink|green|sky|teal|cyan|gray|amber|orange|red|rose)-(100|500|600|700|800|900)$/ },
    { pattern: /^ring-(indigo|blue|purple|pink|green|sky|teal|cyan|gray|amber|orange|red|rose)-(100|500|600|700|800|900)$/ },
  ],
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
