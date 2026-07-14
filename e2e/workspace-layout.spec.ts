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

test("keeps the composer within the viewport after New conversation, even with a long sidebar list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const manyConversations = Array.from({ length: 40 }, (_, index) => ({
    conversation_id: `c${index}`,
    title: `Conversation ${index}`,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:05:00Z",
  }));
  await page.route("**/api/conversations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ conversations: manyConversations }),
  }));
  await page.route("**/api/conversations/c0", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      conversation_id: "c0",
      title: "Conversation 0",
      messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there." }],
    }),
  }));
  await openAuthenticatedWorkspace(page);

  await page.getByText("Conversation 0").click();
  await expect(page.getByText("Hi there.")).toBeVisible();
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(page.getByText("No conversation selected")).toBeVisible();

  const composerBox = await page.getByRole("button", { name: "Send message" }).boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(900);
});
