import { expect, test } from "@playwright/test";

test("login page renders the primary form", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Vítej zpět" }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Přihlásit se" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Zapomenuté heslo?" }),
  ).toHaveAttribute("href", "/forgot-password");
});

test("login page validates empty credentials before auth request", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Přihlásit se" }).click();

  await expect(page.getByText("Neplatný e-mail")).toBeVisible();
  await expect(page.getByText("Heslo je povinné")).toBeVisible();
});
