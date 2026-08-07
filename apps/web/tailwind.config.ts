import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        auth: '0 28px 80px rgba(6, 23, 43, 0.28)',
      },
      colors: {
        "surface-container-lowest": "#ffffff",
        "on-secondary-container": "#5c647a",
        "surface-tint": "#00696e",
        "surface-variant": "#e1e3e4",
        "on-tertiary-fixed": "#161c22",
        "on-tertiary": "#ffffff",
        "surface-dim": "#d8dadb",
        "on-surface-variant": "#3c494a",
        "background": "#f8fafb",
        "surface-container-low": "#f2f4f5",
        "secondary-fixed-dim": "#bec6e0",
        "primary-fixed-dim": "#3cdae2",
        "secondary": "#565e74",
        "outline": "#6c7a7a",
        "on-error-container": "#93000a",
        "error-container": "#ffdad6",
        "on-tertiary-container": "#3e454b",
        "on-secondary": "#ffffff",
        "secondary-fixed": "#dae2fd",
        "outline-variant": "#bbc9ca",
        "tertiary-fixed-dim": "#c1c7cf",
        "on-primary-fixed-variant": "#004f53",
        "inverse-on-surface": "#eff1f2",
        "primary-container": "#00c4cc",
        "inverse-primary": "#3cdae2",
        "on-surface": "#191c1d",
        "tertiary-container": "#acb2b9",
        "surface": "#f8fafb",
        "on-secondary-fixed": "#131b2e",
        "on-primary-container": "#004c4f",
        "on-error": "#ffffff",
        "on-background": "#191c1d",
        "tertiary": "#595f66",
        "on-tertiary-fixed-variant": "#41474e",
        "on-primary": "#ffffff",
        "inverse-surface": "#2e3132",
        "secondary-container": "#dae2fd",
        "primary": "#00696e",
        "surface-container": "#eceeef",
        "on-secondary-fixed-variant": "#3f465c",
        "surface-container-high": "#e6e8e9",
        "on-primary-fixed": "#002021",
        "error": "#ba1a1a",
        "tertiary-fixed": "#dde3eb",
        "primary-fixed": "#63f7ff",
        "surface-container-highest": "#e1e3e4",
        "surface-bright": "#f8fafb"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "sm": "16px",
        "gutter": "24px",
        "margin": "32px",
        "lg": "32px",
        "base": "4px",
        "xs": "8px",
        "xl": "48px",
        "md": "24px"
      },
      fontFamily: {
        "headline-md": ["var(--font-inter)"],
        "body-md": ["var(--font-inter)"],
        "body-lg": ["var(--font-inter)"],
        "label-sm": ["var(--font-inter)"],
        "headline-xl": ["var(--font-inter)"],
        "label-md": ["var(--font-inter)"],
        "headline-lg-mobile": ["var(--font-inter)"],
        "headline-lg": ["var(--font-inter)"]
      },
      fontSize: {
        "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "body-lg": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "label-sm": ["11px", {"lineHeight": "14px", "fontWeight": "500"}],
        "headline-xl": ["36px", {"lineHeight": "44px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "label-md": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600"}],
        "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "600"}],
        "headline-lg": ["28px", {"lineHeight": "36px", "letterSpacing": "-0.01em", "fontWeight": "600"}]
      }
    }
  },
  plugins: [],
};

export default config;
