// The site's own settings on the admin's dashboard (#1555; spec/15, The admin): the stat-correction
// window (spec/07), each team's scouts (spec/19) and matchday mode's hours (spec/12), saved together.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIRST_PLATFORM_SETTINGS, settingRefusals } from "../../../convex/admin/platformSettings";
import { ADMIN_PATH } from "../../../src/admin/paths";
import { saveSiteSettingsWords, siteSettingLabels, siteSettingsLoadingWords, siteSettingsTitle } from "../../../src/admin/words";
import type { AdminData } from "../../support/src/admin.harness";
import { admin, openApp } from "../../support/src/shell.harness";

const openDashboard = (data: AdminData = {}) => openApp(ADMIN_PATH, admin, { admin: data });

async function settingsPanel() {
  const panel = await screen.findByRole("region", { name: siteSettingsTitle });
  const input = (name: keyof typeof siteSettingLabels) => within(panel).getByRole("spinbutton", { name: siteSettingLabels[name] }) as HTMLInputElement;
  return { panel, input };
}

describe("the site's settings", () => {
  it("shows the stat-correction window, each team's scouts and matchday mode's hours", async () => {
    openDashboard({ platformSettings: { statCorrectionWindowMinutes: 45, scoutsPerTeam: 4, matchdayHoursBefore: 5, matchdayHoursAfter: 1 } });
    const { input } = await settingsPanel();
    const shown = (["statCorrectionWindowMinutes", "scoutsPerTeam", "matchdayHoursBefore", "matchdayHoursAfter"] as const).map((name) => input(name).value);
    expect(shown).toEqual(["45", "4", "5", "1"]);
  });

  it("saves them together, with what was typed", async () => {
    const app = openDashboard();
    const { panel, input } = await settingsPanel();
    await userEvent.clear(input("statCorrectionWindowMinutes"));
    await userEvent.type(input("statCorrectionWindowMinutes"), "90");
    await userEvent.clear(input("scoutsPerTeam"));
    await userEvent.type(input("scoutsPerTeam"), "2");
    await userEvent.click(within(panel).getByRole("button", { name: saveSiteSettingsWords }));

    expect(app.admin.savePlatformSettings).toHaveBeenCalledExactlyOnceWith({ ...FIRST_PLATFORM_SETTINGS, statCorrectionWindowMinutes: 90, scoutsPerTeam: 2 });
  });

  it("shows why a setting was refused", async () => {
    const app = openDashboard();
    const refused = settingRefusals.scoutsPerTeam(-1);
    app.admin.savePlatformSettings.mockResolvedValueOnce(refused);
    await userEvent.click(await screen.findByRole("button", { name: saveSiteSettingsWords }));
    expect((await screen.findByRole("alert")).textContent).toBe(refused);
  });

  it("says so while they load", async () => {
    openDashboard({ settingsLoading: true });
    const panel = await screen.findByRole("region", { name: siteSettingsTitle });
    expect(within(panel).getByRole("status").textContent).toBe(siteSettingsLoadingWords);
  });
});
