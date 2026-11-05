import type { Page } from "playwright";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { browserFor, closeBrowser, collectPageFailures, DIST } from "./browserSession";
import { BASE_PATH, startStaticServer, type StaticServer } from "./server";

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(DIST);
});

afterAll(async () => {
  await closeBrowser();
  await server?.close();
});

type Splat = {
  position: readonly number[];
  color: readonly [number, number, number, number];
  scales?: readonly [number, number, number];
};

const NEAR: Splat = {
  position: [0, 0, 0.5],
  color: [255, 0, 0, 128],
};
const FAR: Splat = {
  position: [0, 0, -0.5],
  color: [0, 0, 255, 128],
};

const encodeSplats = (splats: readonly Splat[]): Buffer => {
  const bytes = Buffer.alloc(splats.length * 32);
  for (const [index, splat] of splats.entries()) {
    const offset = index * 32;
    for (let component = 0; component < 3; component++) {
      bytes.writeFloatLE(splat.position[component]!, offset + component * 4);
      bytes.writeFloatLE(splat.scales?.[component] ?? 0.8, offset + 12 + component * 4);
    }
    bytes.set(splat.color, offset + 24);
    bytes.set([255, 128, 128, 128], offset + 28);
  }
  return bytes;
};

const openScene = async (
  body: Buffer,
  eyeZ = 5,
  bookmark: { upY?: number; target?: readonly number[] } = {},
) => {
  const browser = await browserFor();
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const failures = collectPageFailures(page);
  await page.route(`**${BASE_PATH}data/urban.splat`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body,
    }),
  );
  await page.goto(
    `${server.origin}${BASE_PATH}?position=0,0,${eyeZ}&target=${(bookmark.target ?? [0, 0, 0]).join(",")}&up=0,${bookmark.upY ?? 1},0`,
  );
  return { page, failures };
};

const ready = async (page: Page): Promise<void> => {
  await page.locator('#loading[data-state="ready"]').waitFor();
  expect(await page.locator("#loading").textContent()).toContain("2 Gaussians");
};

const captureCenter = async (page: Page, selector = "canvas#scene, #scene canvas") => {
  const image = await page.locator(selector).screenshot();
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const centerX = Math.floor(info.width / 2);
  const centerY = Math.floor(info.height / 2);
  const channels: number[][] = [[], [], []];
  let coloredPixels = 0;
  for (let y = centerY - 48; y < centerY + 48; y++) {
    for (let x = centerX - 48; x < centerX + 48; x++) {
      const offset = (y * info.width + x) * 4;
      const red = data[offset]!;
      const green = data[offset + 1]!;
      const blue = data[offset + 2]!;
      if (red > green + 25 || blue > green + 25) coloredPixels++;
      if (Math.abs(x - centerX) <= 2 && Math.abs(y - centerY) <= 2) {
        channels[0]!.push(red);
        channels[1]!.push(green);
        channels[2]!.push(blue);
      }
    }
  }
  const center = channels.map((values) => values.sort((a, b) => a - b)[12]!);
  return { center, coloredPixels };
};

const capturePatch = async (page: Page): Promise<Buffer> => {
  const png = await page.locator("#scene canvas").screenshot();
  return sharp(png)
    .extract({ left: 400, top: 240, width: 160, height: 160 })
    .removeAlpha()
    .raw()
    .toBuffer();
};

const expectStockLink = async (page: Page, model: string): Promise<void> => {
  const link = page.getByRole("link", { name: "View this model" });
  const destination = new URL((await link.getAttribute("href"))!);
  expect(destination.origin).toBe(server.origin);
  expect(destination.pathname).toBe(`${BASE_PATH}stock/`);
  expect(destination.searchParams.get("url")).toBe(
    `${server.origin}${BASE_PATH}data/${model}.splat`,
  );
  expect(destination.hash).not.toBe("");
  expect(await link.getAttribute("target")).toBe("_blank");
  expect(await link.getAttribute("rel")).toContain("noopener");
};

describe("Gaussian scene example", () => {
  it("switches aerial models and opens the selected file in the stock viewer", async () => {
    const browser = await browserFor();
    const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
    const failures: string[][] = [];
    context.on("page", (page) => failures.push(collectPageFailures(page)));
    const modelRequests: string[] = [];
    const urban = encodeSplats([NEAR, FAR]);
    const hall = encodeSplats([
      {
        position: [-0.799408, -4.250976, -1.063691],
        scales: [3, 3, 3],
        color: [0, 0, 255, 255],
      },
      {
        position: [50, -4.250976, -1.063691],
        scales: [1, 1, 1],
        color: [255, 0, 0, 255],
      },
    ]);
    await context.route(
      (url) => url.pathname.endsWith(".splat"),
      (route) => {
        const url = route.request().url();
        modelRequests.push(url);
        const body = new URL(url).pathname.endsWith("/hall.splat") ? hall : urban;
        return route.fulfill({
          status: 200,
          contentType: "application/octet-stream",
          headers: { "content-length": String(body.byteLength) },
          body,
        });
      },
    );
    try {
      const page = await context.newPage();
      await page.goto(`${server.origin}${BASE_PATH}?position=0,0,5&target=0,0,0&up=0,1,0&dpr=1.25`);
      await ready(page);
      expect(await page.title()).toBe("Urban drone survey · VTK.js · tiled-vtkjs");
      const modelPicker = page.getByRole("combobox", { name: "Model", exact: true });
      expect(await modelPicker.inputValue()).toBe("urban");
      expect(
        await page.getByRole("link", { name: "tiled-vtkjs", exact: true }).getAttribute("href"),
      ).toBe(BASE_PATH);
      expect(await page.getByRole("button", { name: "Orbit scene" }).count()).toBe(0);
      const navigation = page.getByRole("combobox", { name: "Navigation" });
      expect(await navigation.inputValue()).toBe("orbit");
      expect(await page.locator("#scene-credit").textContent()).toContain(
        "PIX4D drone sample · Seeget3D · CC BY 4.0",
      );
      expect(await page.locator("#scene-credit").getAttribute("href")).toBe(
        "https://superspl.at/scene/e92a7e9b",
      );
      await expectStockLink(page, "urban");
      const sparkLink = page.locator("#spark-demos");
      expect(await sparkLink.getAttribute("href")).toBe(
        "https://sparkjs.dev/examples/#hello-world",
      );
      expect(await sparkLink.getAttribute("target")).toBe("_blank");
      expect(await sparkLink.getAttribute("rel")).toContain("noopener");
      expect((await captureCenter(page)).center[0]).toBeGreaterThan(120);

      await navigation.selectOption("look");
      await Promise.all([
        page.waitForURL((url) => url.searchParams.get("model") === "hall"),
        modelPicker.selectOption("hall"),
      ]);
      await ready(page);
      const url = new URL(page.url());
      expect(url.pathname).toBe(BASE_PATH);
      expect(url.searchParams.get("dpr")).toBe("1.25");
      for (const key of ["position", "target", "up"]) expect(url.searchParams.has(key)).toBe(false);
      expect(await page.title()).toBe("Knock Community Hall · VTK.js · tiled-vtkjs");
      expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe(
        "Knock Community Hall",
      );
      expect(await modelPicker.inputValue()).toBe("hall");
      expect(await navigation.inputValue()).toBe("orbit");
      expect(await page.locator("#scene-credit").textContent()).toContain(
        "Knock Community Hall · scbenoit · CC BY 4.0",
      );
      expect(await page.locator("#scene-credit").getAttribute("href")).toBe(
        "https://superspl.at/scene/0ff2e6dc",
      );
      expect(await page.locator("#render-info").textContent()).toContain("DPR 1.25");
      await expectStockLink(page, "hall");
      const image = await captureCenter(page);
      expect(image.center[2]).toBeGreaterThan(220);
      expect(image.center[0]).toBeLessThan(30);
      expect(image.coloredPixels).toBeGreaterThan(1000);

      const [stockPage] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("link", { name: "View this model" }).click(),
      ]);
      await stockPage.waitForLoadState("domcontentloaded");
      expect(new URL(stockPage.url()).pathname).toBe(`${BASE_PATH}stock/`);
      await expect
        .poll(async () => (await captureCenter(stockPage, "#canvas")).center[2])
        .toBeGreaterThan(220);
      expect((await captureCenter(stockPage, "#canvas")).coloredPixels).toBeGreaterThan(1000);
      expect(await stockPage.locator("#message").textContent()).toBe("");
      expect(modelRequests).toEqual([
        `${server.origin}${BASE_PATH}data/urban.splat`,
        `${server.origin}${BASE_PATH}data/hall.splat`,
        `${server.origin}${BASE_PATH}data/hall.splat`,
      ]);
      expect(failures.flat()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("looks in place through a diagonal drag while retaining the upright camera frame", async () => {
    const target = [-5 / Math.sqrt(2), 5 / Math.sqrt(2), 5];
    const body = encodeSplats([
      { position: [0, 0, 0], color: [255, 0, 0, 255] },
      { position: target, color: [0, 0, 255, 255], scales: [1.2, 0.18, 0.18] },
    ]);
    const actual = await openScene(body, 5, { upY: -1 });
    const expected = await openScene(body, 5, { upY: -1, target });
    try {
      await ready(actual.page);
      await ready(expected.page);
      expect(actual.failures).toEqual([]);
      expect(expected.failures).toEqual([]);
      await actual.page.getByRole("combobox", { name: "Navigation" }).selectOption("look");
      expect((await captureCenter(actual.page)).center[0]).toBeGreaterThan(220);
      await actual.page.mouse.move(480, 320);
      await actual.page.mouse.down();
      await actual.page.mouse.move(720, 400, { steps: 4 });
      await actual.page.mouse.up();
      await expect
        .poll(async () => (await captureCenter(actual.page)).center[2])
        .toBeGreaterThan(220);
      const actualPixels = await capturePatch(actual.page);
      const expectedPixels = await capturePatch(expected.page);
      const difference =
        actualPixels.reduce(
          (sum, value, index) => sum + Math.abs(value - expectedPixels[index]!),
          0,
        ) / actualPixels.length;
      // An anisotropic splat also exposes a rolled camera as a rotated footprint.
      expect(difference).toBeLessThan(1);
      expect(actual.failures).toEqual([]);
      expect(expected.failures).toEqual([]);
    } finally {
      await actual.page.close();
      await expected.page.close();
    }
  });

  it("moves with keyboard input only while the scene has focus", async () => {
    const { page, failures } = await openScene(encodeSplats([NEAR, FAR]));
    try {
      await ready(page);
      await page.getByRole("combobox", { name: "Navigation" }).selectOption("look");
      const paintedFrames = () =>
        page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            }),
        );
      await page.getByRole("combobox", { name: "Navigation" }).focus();
      const before = await capturePatch(page);
      await page.keyboard.down("w");
      await paintedFrames();
      await page.keyboard.up("w");
      expect(await capturePatch(page)).toEqual(before);

      await page.locator("#scene").focus();
      await page.keyboard.down("d");
      try {
        await expect.poll(async () => Buffer.compare(await capturePatch(page), before)).not.toBe(0);
      } finally {
        await page.keyboard.up("d");
      }
      expect(failures).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it.each([
    { name: "front", eyeZ: 5, frontChannel: 0, backChannel: 2 },
    { name: "back", eyeZ: -5, frontChannel: 2, backChannel: 0 },
  ])(
    "composites from the $name independently of file order",
    async ({ eyeZ, frontChannel, backChannel }) => {
      const images = [];
      for (const splats of [
        [NEAR, FAR],
        [FAR, NEAR],
      ]) {
        const { page, failures } = await openScene(encodeSplats(splats), eyeZ);
        try {
          await ready(page);
          expect(failures).toEqual([]);
          const image = await captureCenter(page);
          images.push(image);
          // Two half-opaque layers contribute about 1/2 front and 1/4 back.
          expect(image.center[frontChannel]).toBeGreaterThan(120);
          expect(image.center[frontChannel]).toBeLessThan(145);
          expect(image.center[1]).toBeLessThan(12);
          expect(image.center[backChannel]).toBeGreaterThan(55);
          expect(image.center[backChannel]).toBeLessThan(80);
          expect(failures).toEqual([]);
        } finally {
          await page.close();
        }
      }
      expect(images[0]).toEqual(images[1]);
    },
  );

  it("switches between filled Gaussian footprints and point centers", async () => {
    const { page, failures } = await openScene(encodeSplats([NEAR, FAR]));
    try {
      await ready(page);
      expect(failures).toEqual([]);
      const splats = await captureCenter(page);
      await page.getByRole("combobox", { name: "View" }).selectOption("points");
      await expect.poll(async () => (await captureCenter(page)).coloredPixels).toBeLessThan(20);
      const points = await captureCenter(page);
      expect(splats.coloredPixels).toBeGreaterThan(1_000);
      expect(points.coloredPixels).toBeGreaterThan(0);
      expect(points.coloredPixels).toBeLessThan(20);
      await page.getByRole("combobox", { name: "View" }).selectOption("splats");
      await expect.poll(() => captureCenter(page)).toEqual(splats);
      expect(failures).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("shows an incomplete-file error instead of a ready scene", async () => {
    const { page, failures } = await openScene(Buffer.alloc(31));
    try {
      await page.locator('#loading[data-state="error"]').waitFor();
      expect(await page.locator("#loading").textContent()).toContain(
        "A splat file must contain complete 32-byte records.",
      );
      expect(await page.locator('#loading[data-state="ready"]').count()).toBe(0);
      expect(failures).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
