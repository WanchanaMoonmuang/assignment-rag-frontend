import { CssBaseline, IconButton, ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { theme } from "./theme";

describe("theme", () => {
  it("bumps icon buttons to at least 44x44px on mobile viewports (DESIGN.md touch-target requirement)", () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <IconButton aria-label="Example">x</IconButton>
      </ThemeProvider>,
    );
    const css = Array.from(document.querySelectorAll("style"))
      .map((tag) => tag.textContent ?? "")
      .join("\n");
    const mobileRule = css.match(/@media[^{]*max-width:\s*599\.95px[^{]*\{[^}]*44px[^}]*44px[^}]*\}/);
    expect(mobileRule).not.toBeNull();
  });
});
