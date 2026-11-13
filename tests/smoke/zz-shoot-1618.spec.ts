// Throwaway: shoots #1618's screens at 1440 for ui-verifier. Not committed.
import { test } from "@playwright/test";
import { previewUrl } from "../support/smoke/previewUrl";

const OUT = "/tmp/b1618/shots";

test.describe("shoot", { tag: "@dev" }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shoot", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(String(error)));
    const shot = async (path: string, name: string) => {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    };
    await shot(previewUrl("/premier-league", "manager"), "premier-league");
    await shot(previewUrl("/leagues/preview-pro-league/settings", "commissioner"), "settings");
    await shot(previewUrl("/team", "manager"), "team");
    await page.getByRole("button", { expanded: false, name: /^Off/ }).click();
    await page.screenshot({ path: `${OUT}/team-panel.png`, fullPage: true });
    const options = await page.locator("select").first().locator("option").allTextContents();
    console.log("AUTO TEAM OPTIONS:", options[0], "…", options.at(-1), options.length);
    await page.goto(previewUrl("/leagues/preview-pro-league/settings", "commissioner"));
    await page.getByRole("checkbox", { name: "A trade deadline" }).check();
    await page.getByText(/^A gameweek, 1 to/).waitFor();
    console.log("HINT:", await page.getByText(/^A gameweek, 1 to/).textContent());
    await page.getByText(/^A gameweek, 1 to/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/settings-trade-deadline.png` });
    await page.goto(previewUrl("/premier-league", "manager"));
    const next = page.getByRole("button", { name: /next gameweek/i });
    await next.waitFor();
    while (await next.isEnabled()) await next.click();
    console.log("STEPPER LAST:", await page.getByRole("heading", { name: /^Gameweek \d+$/ }).first().textContent());
    console.log("ERRORS:", JSON.stringify(errors));
  });
});
