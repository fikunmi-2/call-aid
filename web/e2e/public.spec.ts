import { test, expect } from "@playwright/test";
test("unavailable voice fails clearly and examples remain available", async ({
  page,
}) => {
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Voice is temporarily unavailable. You can still explore the synthetic example reports.",
      }),
    }),
  );
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
for (const [label, message] of [
  ["capacity", "The demo is in use. Please try again shortly."],
  [
    "usage",
    "The demonstration usage limit has been reached. Please explore an example report.",
  ],
] as const) {
  test(`${label} exhaustion shows an accurate retry state`, async ({
    page,
  }) => {
    await page.route("**/api/sessions", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "60" },
        body: JSON.stringify({ error: message }),
      }),
    );
    await page.goto("/demo");
    await page.getByRole("button", { name: "Start Voice Session" }).click();
    await expect(page.getByRole("status")).toContainText(message);
    await expect(
      page.getByRole("button", { name: "Start Voice Session" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("link", { name: /Explore synthetic examples/ }),
    ).toBeVisible();
  });
}
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
    page.getByText(
      /A generalized SBAR draft is prepared during the conversation/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Explore synthetic examples/ }),
  ).toBeVisible();
});
test("unknown record is not exposed", async ({ page }) => {
  const response = await page.goto("/records/unpublished-case");
  expect(response?.status()).toBe(404);
});
