import { expect, test } from "@playwright/test";

import { openAuthenticatedWorkspace } from "./helpers";

test("shows the 280px conversation sidebar at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openAuthenticatedWorkspace(page);

  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "280px");
  await expect(page.getByRole("button", { name: "Open conversations" })).toBeHidden();
});

test("widens the conversation sidebar to 304px at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAuthenticatedWorkspace(page);

  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "304px");
});


test("opens the conversation drawer on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedWorkspace(page);
  await page.getByRole("button", { name: "Open conversations" }).click();
  await expect(page.getByRole("list", { name: "Conversations" })).toBeVisible();
});


test("opens the documents panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAuthenticatedWorkspace(page);
  await page.getByRole("button", { name: "Open documents" }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Add document" })).toBeVisible();
});
