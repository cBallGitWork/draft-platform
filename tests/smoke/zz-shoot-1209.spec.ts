// Throwaway: shoots #1209's screens at 1440 for ui-verifier. Not committed.
import { test } from "@playwright/test";

const OUT = "/tmp/b1209/shots";

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
    await shot("/team?preview=manager", "team");
    await page.getByRole("button", { expanded: false, name: /^Off/ }).click();
    await page.screenshot({ path: `${OUT}/team-panel.png`, fullPage: true });
    await shot("/leagues/preview-pro-league/squads?preview=commissioner", "squads");
    await shot("/table?preview=manager", "table");
    await shot("/table?preview=commissioner", "table-commissioner");
    await page.getByRole("region", { name: /^Fixtures/ }).getByRole("listitem").nth(0).getByRole("button", { name: /^Swap / }).first().click();
    await page.screenshot({ path: `${OUT}/fixture-swap.png`, fullPage: true });
    await shot("/admin/availability?preview=admin", "availability");
    await shot("/matchup?preview=manager", "matchup");
    console.log("ERRORS:", JSON.stringify(errors));
  });
});
