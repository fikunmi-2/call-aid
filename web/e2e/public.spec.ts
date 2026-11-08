import { test, expect } from "@playwright/test";
test("unconfigured voice fails clearly and examples remain available", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Voice is temporarily unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Start Voice Session" }),
  ).toBeEnabled();
  await page.getByRole("link", { name: /Explore synthetic examples/ }).click();
  await expect(
    page.getByText("Preloaded synthetic examples", { exact: true }),
  ).toBeVisible();
});
test("microphone denial is recoverable", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start Voice Session" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Microphone permission was denied",
  );
  await expect(
    page.getByRole("button", { name: "Start Voice Session" }),
  ).toBeEnabled();
});
test("landing layout screenshot", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.screenshot({
    path: `../.tools/screenshots/${testInfo.project.name}-home.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("public landing to recognizable synthetic SBAR without login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Not for medical use", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: /Explore example records/ }).click();
  await expect(
    page.getByText("Preloaded synthetic examples", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Demo Case A7K2/ }).click();
  for (const name of [
    "Situation",
    "Background",
    "Assessment",
    "Recommendation",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(page.getByText(/curated example/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("voice page has controls and no scenario or login gate", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("button", { name: "Start Voice Session" }),
  ).toBeVisible();
  await expect(
    page.getByText(/New SBAR generation and saving are not enabled yet/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Explore synthetic examples/ }),
  ).toBeVisible();
});
test("unknown record is not exposed", async ({ page }) => {
  const response = await page.goto("/records/unpublished-case");
  expect(response?.status()).toBe(404);
});
