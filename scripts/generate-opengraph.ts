import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const screenshotPath = join(rootDir, "screenshot.png");
const screenshotBase64 = readFileSync(screenshotPath).toString("base64");

const templatePath = join(rootDir, "og.html");
const html = readFileSync(templatePath, "utf-8").replace(
  "{{SCREENSHOT_BASE64}}",
  `data:image/png;base64,${screenshotBase64}`,
);

async function generateOgImage(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });

  await page.setContent(html);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: join(rootDir, "og-image.png"),
    type: "png",
  });

  console.log("OG image saved to og-image.png");
  await browser.close();
}

generateOgImage().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
