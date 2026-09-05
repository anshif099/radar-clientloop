import { expect, test, type Page } from "@playwright/test";
import type { ChatMessage } from "../../src/domain/chat";
const companyThread = "11111111-1111-4111-8111-111111111111";
const aiThread = "22222222-2222-4222-8222-222222222222";
const postId = "33333333-3333-4333-8333-333333333333";
function message(id: number, body: string, senderId = "client-a"): ChatMessage {
  return { id, body, senderId, senderName: senderId === "admin" ? "Rainhopes Team" : "Acme Studio", senderRole: senderId === "admin" ? "ADMIN" : "COMPANY", createdAt: new Date("2026-09-05T10:00:00Z").toISOString(), metadata: {}, attachments: [] };
}
async function backend(page: Page, seed: ChatMessage[] = []) {
  const rooms: Record<string, ChatMessage[]> = { [companyThread]: seed, [aiThread]: [] };
  const prompts: Array<{ body: string; workItemId: string }> = [];
  let nextId = seed.length + 1;
  await page.route("**/api/v1/chat/**", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith("/posts")) return route.fulfill({ json: { posts: [{ id: postId, title: "Summer launch" }], next: null } });
    if (url.pathname.endsWith("/threads")) return route.fulfill({ json: { thread: { id: request.postDataJSON().kind === "AI" ? aiThread : companyThread } } });
    const thread = url.pathname.includes(aiThread) ? aiThread : companyThread;
    if (request.method() === "POST") {
      const form = await new Request(url, { method: "POST", headers: { "Content-Type": request.headers()["content-type"] }, body: new Uint8Array(request.postDataBuffer()!) }).formData();
      const item = message(nextId++, String(form.get("body") ?? ""));
      item.attachments = form.getAll("files").map((file, index) => ({ id: `file-${item.id}-${index}`, originalName: (file as File).name, mimeType: (file as File).type || "application/pdf", sizeBytes: (file as File).size }));
      rooms[thread].push(item);
      if (thread === aiThread) {
        prompts.push({ body: item.body, workItemId: String(form.get("workItemId") ?? "") });
        rooms[thread].push({ ...message(nextId++, "Result: human review is needed. The file changed, but the requested logo change is unverified."), senderRole: "ASSISTANT", senderId: "clientloop-ai-ultra", senderName: "ClientLoop AI Ultra" });
      }
      return route.fulfill({ status: 201, json: { messages: rooms[thread].filter((entry) => entry.id > Number(form.get("after") ?? 0)), hasMore: false } });
    }
    let rows = rooms[thread];
    if (url.searchParams.has("before")) rows = rows.filter((item) => item.id < Number(url.searchParams.get("before")));
    if (url.searchParams.has("after")) rows = rows.filter((item) => item.id > Number(url.searchParams.get("after")));
    return route.fulfill({ json: { messages: url.searchParams.has("after") ? rows.slice(0, 50) : rows.slice(-50), hasMore: rows.length > 50 } });
  });
  return { rooms, prompts };
}
test("text messages persist across reload and incoming messages appear automatically", async ({ page }, testInfo) => {
  const { rooms } = await backend(page);
  await page.goto("/");
  await expect(page.getByText("Start the conversation")).toBeVisible();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Please send the revised creative.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Please send the revised creative.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Please send the revised creative.", { exact: true })).toBeVisible();
  rooms[companyThread].push(message(100, "Version 2 is ready for review.", "admin"));
  await expect(page.getByText("Version 2 is ready for review.", { exact: true })).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("chat.png"), fullPage: true });
});
test("older history remains accessible without replacing recent messages", async ({ page }) => {
  await backend(page, Array.from({ length: 65 }, (_, index) => message(index + 1, `Historical message ${index + 1}`)));
  await page.goto("/");
  await expect(page.getByText("Historical message 65", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load older messages" }).click();
  await expect(page.getByText("Historical message 1", { exact: true })).toBeAttached();
  await expect(page.getByText("Historical message 65", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Load older messages" })).toHaveCount(0);
});
test("files can be attached, removed, and saved without a text body", async ({ page }) => {
  await backend(page);
  await page.goto("/");
  await expect(page.getByText("Start the conversation")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
  await expect(page.getByRole("button", { name: "Remove brief.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Remove brief.pdf" }).click();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".chat-message iframe")).toHaveAttribute("title", "brief.pdf");
  await expect(page.getByRole("link", { name: /brief.pdf/ })).toHaveAttribute("href", /download=1/);
});
test("AI conversation is separate and carries the selected post into revision checks", async ({ page }, testInfo) => {
  const { prompts } = await backend(page, [message(1, "Company-only conversation")]);
  await page.goto("/");
  await expect(page.getByText("Company-only conversation")).toBeVisible();
  await page.getByRole("button", { name: /AI Ultra/ }).click();
  await expect(page.getByText("Company-only conversation")).toHaveCount(0);
  await page.getByLabel("Post to discuss", { exact: true }).selectOption(postId);
  await page.getByRole("button", { name: "Check revision" }).click();
  await expect(page.getByText(/Result: human review is needed/)).toBeVisible();
  expect(prompts[0].workItemId).toBe(postId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath("ai-ultra.png"), fullPage: true });
  await page.getByRole("button", { name: /Company chat/ }).click();
  await expect(page.getByText("Company-only conversation")).toBeVisible();
});
test("voice recording attaches an audio clip and stops microphone tracks", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await backend(page);
  await page.goto("/");
  await expect(page.getByText("Start the conversation")).toBeVisible();
  await page.getByRole("button", { name: "Record voice message" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  // Allow a real MediaRecorder data chunk from Chromium's synthetic microphone.
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByRole("button", { name: /Remove voice-/ })).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".chat-message audio")).toBeVisible();
});
