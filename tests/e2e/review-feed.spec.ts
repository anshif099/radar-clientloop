import { expect, test } from "@playwright/test";

test("review feed stays within the viewport", async ({ page }, testInfo) => {
  await page.goto("/");

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

  await expect(page.getByRole("heading", { name: "Your review feed" })).toBeVisible();
  await expect(page.getByText("Bright Summer campaign", { exact: true })).toBeVisible();

  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  }
});

test("client can send a change request", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article").filter({ hasText: "Bright Summer campaign" });

  await card.getByRole("button", { name: "Changes" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "What should we adjust?" })).toBeVisible();

  await dialog.getByRole("button", { name: "Send change request" }).click();
  await expect(dialog.getByText(/Add a note, voice recording/)).toBeVisible();

  await dialog
    .getByRole("textbox", { name: "Feedback" })
    .fill("Please make the offer easier to notice.");
  await dialog.getByRole("button", { name: "Send change request" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Change request sent" })).toBeVisible();
  await expect(card.getByText("Changes requested", { exact: true })).toBeVisible();
});

test("manifest is installable and does not expose a portal token", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).not.toContain("token");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]),
  );
});
