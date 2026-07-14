import { expect, type Page } from "@playwright/test";

export async function openAuthenticatedWorkspace(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("knowledge-assistant.access-token", "visual-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin" }) }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No conversation selected" })).toBeVisible();
}
