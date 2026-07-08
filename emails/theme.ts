/**
 * Email-safe brand tokens, kept in sync with the frontend theme.
 *
 * These mirror the `@theme` tokens in frontend/src/index.css, converted from
 * oklch() to hex because most email clients (Outlook, Gmail) don't support
 * oklch. If you change a color in index.css, update the matching value here.
 */
export const emailTheme = {
  colors: {
    primary: '#c96442', // --primary
    'primary-foreground': '#ffffff', // --primary-foreground
    background: '#faf9f5', // --background
    foreground: '#3d3929', // --foreground
    card: '#f5f4ef', // --card
    'muted-foreground': '#6e6d68', // --muted-foreground
    border: '#dad9d4', // --border
    destructive: '#ef4444', // --destructive
  },
  fontFamily: {
    sans: ['DM Sans', 'sans-serif'], // --font-sans
  },
} as const;
