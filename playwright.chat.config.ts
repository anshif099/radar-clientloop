import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser-chat",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174", channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 320, height: 900 } } }, { name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npx vite --config tests/browser-chat/vite.config.ts", url: "http://127.0.0.1:4174", timeout: 30_000 },
});
