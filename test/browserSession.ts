import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

export const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

let browser: Browser | undefined;

export const browserFor = async (): Promise<Browser> => {
  browser ??= await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  return browser;
};

export const closeBrowser = async (): Promise<void> => {
  await browser?.close();
  browser = undefined;
};

export const collectPageFailures = (page: Page): string[] => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  return failures;
};
