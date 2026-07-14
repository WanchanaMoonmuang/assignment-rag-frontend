import { createTheme } from "@mui/material/styles";

const bodyFont = '"Source Sans 3", Inter, Roboto, Arial, sans-serif';
const headingFont = 'Lexend, "Source Sans 3", Inter, Roboto, Arial, sans-serif';

export const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#F7F8FA",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#18212F",
      secondary: "#526071",
    },
    divider: "#DDE2E8",
    primary: {
      main: "#2563EB",
      dark: "#1D4ED8",
      contrastText: "#FFFFFF",
    },
    success: { main: "#16835D" },
    warning: { main: "#B76E00" },
    error: { main: "#C9362B" },
  },
  shape: { borderRadius: 8 },
  spacing: 4,
  typography: {
    fontFamily: bodyFont,
    fontSize: 16,
    h1: { fontFamily: headingFont, fontSize: "2rem", fontWeight: 600, letterSpacing: 0 },
    h2: { fontFamily: headingFont, fontSize: "1.5rem", fontWeight: 600, letterSpacing: 0 },
    h3: { fontFamily: headingFont, fontSize: "1.125rem", fontWeight: 600, letterSpacing: 0 },
    button: { fontWeight: 600, letterSpacing: 0, textTransform: "none" },
    body1: { lineHeight: 1.5, letterSpacing: 0 },
    body2: { fontSize: "0.875rem", lineHeight: 1.45, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": { minHeight: "100%" },
        body: { margin: 0, minWidth: 320 },
        "*": { boxSizing: "border-box" },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
            scrollBehavior: "auto !important",
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 40 } },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          width: 40,
          height: 40,
          [theme.breakpoints.down("sm")]: { width: 44, height: 44 },
        }),
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});
