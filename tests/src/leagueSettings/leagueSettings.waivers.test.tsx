// League settings' waivers (#1200; spec/03, spec/08; the waivers picture's Waivers tab): the order's
// type, each explained, and the runs as day and time rows, with Remove and Add a run, saved with
// the rest; at least one run and no time twice; the waiver order beside them.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { TeamInOrder } from "../../../src/leagueSettings/seam";
import type {
  PendingClaim,
  WaiversView,
} from "../../../src/myTeam/claims/seam";
import {
  CLAIMS_TITLE,
  everyTeamClaimsLoadingWords,
  everyTeamTableLabel,
  freePlaceWords,
  noClaimsWords,
  runShort,
  teamGroupWords,
  teamsWithoutClaimsWords,
  WAIVER_ORDER_TITLE,
  waiverOrderNote,
  waiverOrderWords,
} from "../../../src/myTeam/claims/words";
import {
  addRunWords,
  removeRunLabel,
  runDayLabel,
  runTimeLabel,
  runTwiceWords,
  SETTINGS_TITLE,
} from "../../../src/leagueSettings/words";
import { ARSENAL } from "../../support/convex/footballRows.harness";
import { NO_WAIVERS } from "../../support/src/myTeam.harness";
import { TEAMS_IN_ORDER } from "../../support/src/leagueSettings.harness";
import {
  openedSettings,
  openSettings,
  save,
  savedSettings,
  SETTINGS_PAGE,
} from "../../support/src/leagueSettingsScreen.harness";
import {
  commissioned,
  managerIn,
  openApp,
} from "../../support/src/shell.harness";

const select = (name: string) =>
  screen.getByRole("combobox", { name }) as HTMLSelectElement;
const radio = (name: string) =>
  screen.getByRole("radio", { name }) as HTMLInputElement;

describe("the waiver settings (#1200)", () => {
  it("opens on a new league's: reverse table order, Wednesday and Thursday at 18:00", async () => {
    await openedSettings();

    expect(radio(waiverOrderWords.reverseStandings).checked).toBe(true);
    expect([
      select(runDayLabel(1)).value,
      select(runTimeLabel(1)).value,
    ]).toEqual(["wednesday", "18:0"]);
    expect([
      select(runDayLabel(2)).value,
      select(runTimeLabel(2)).value,
    ]).toEqual(["thursday", "18:0"]);
  });

  it("saves rotating, a run moved, one removed and one added, with the rest of the settings", async () => {
    const app = await openedSettings();
    await userEvent.click(radio(waiverOrderWords.rotating));
    await userEvent.selectOptions(select(runTimeLabel(1)), "9:30");
    await userEvent.click(
      screen.getByRole("button", { name: removeRunLabel(2) }),
    );
    await userEvent.click(screen.getByRole("button", { name: addRunWords }));
    await save();

    expect(savedSettings(app).waivers).toEqual({
      order: "rotating",
      runs: [
        { day: "wednesday", hour: 9, minute: 30 },
        { day: "monday", hour: 18, minute: 0 },
      ],
    });
  });

  it("keeps at least one run: the last can't be removed", async () => {
    await openedSettings();
    await userEvent.click(
      screen.getByRole("button", { name: removeRunLabel(2) }),
    );

    expect(
      (
        screen.getByRole("button", {
          name: removeRunLabel(1),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("refuses two runs at the same time itself, and asks the server nothing", async () => {
    const app = await openedSettings();
    await userEvent.selectOptions(select(runDayLabel(2)), "wednesday");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(runTwiceWords);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the waiver order beside them, its note following the type chosen", async () => {
    await openedSettings({ waivers: NO_WAIVERS });
    const order = () =>
      screen.getByRole("region", { name: WAIVER_ORDER_TITLE });
    expect(
      within(order()).getByText(waiverOrderNote("reverseStandings", null)),
    ).toBeTruthy();

    await userEvent.click(radio(waiverOrderWords.rotating));
    expect(
      within(order()).getByText(waiverOrderNote("rotating", null)),
    ).toBeTruthy();
  });
});

// A commissioner with no team has no Transactions tab, so League settings shows him every team's
// pending claims, read-only, with the waiver order and the runs (Craig, 11 Nov 2026, on #1487).
describe("every team's pending claims, for a commissioner with no team (#1487)", () => {
  const player = (playerCode: number, playerName: string) => ({
    playerCode,
    playerName,
    positions: ["W" as const],
    club: ARSENAL,
    seasonPoints: 20,
  });
  const WED = Date.parse("2026-11-11T18:00:00Z");
  const [kroos, saka] = [TEAMS_IN_ORDER[1], TEAMS_IN_ORDER[0]];
  const claim = (
    id: string,
    team: TeamInOrder,
    claimed: PendingClaim["claim"],
  ): PendingClaim => ({
    claimId: id as Id<"waiverClaims">,
    teamId: team.teamId,
    teamName: team.name,
    yours: false,
    claim: claimed,
    drop: null,
    run: { at: WED, skippedIf: null },
  });
  const waivers: WaiversView = {
    ...NO_WAIVERS,
    teams: TEAMS_IN_ORDER.toReversed().map(({ teamId, name }, index) => ({
      teamId,
      name,
      yours: false,
      tablePlace: index + 1,
      points: 0,
    })),
  };
  const claims = [
    claim("c1", saka, player(1, "Semenyo")),
    claim("c2", kroos, player(2, "Eze")),
  ];
  const claimsPanel = () => screen.getByRole("region", { name: CLAIMS_TITLE });

  it("lists them team by team in the waiver order, with no handle to drag, and the teams with none", async () => {
    await openedSettings({ waivers, claims });
    const rows = within(
      within(claimsPanel()).getByRole("table", { name: everyTeamTableLabel }),
    )
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);

    expect(rows).toEqual([
      `Kroos Control ${teamGroupWords(2, 1)}`,
      `1WEzeARS${runShort(WED)}${freePlaceWords}`,
      `Saka Potatoes ${teamGroupWords(3, 1)}`,
      `1WSemenyoARS${runShort(WED)}${freePlaceWords}`,
    ]);
    expect(
      within(claimsPanel()).getByText(teamsWithoutClaimsWords(1)),
    ).toBeTruthy();
    expect(within(claimsPanel()).queryByRole("img")).toBeNull();
  });

  it("says when no team has any", async () => {
    await openedSettings({ waivers });
    expect(within(claimsPanel()).getByText(noClaimsWords)).toBeTruthy();
  });

  it("says so while they load", async () => {
    openSettings({ waivers, claimsLoading: true });
    expect(
      (await screen.findByText(everyTeamClaimsLoadingWords)).getAttribute(
        "role",
      ),
    ).toBe("status");
  });

  it("isn't there for a commissioner with a team, who sees them on his Transactions tab", async () => {
    const app = openApp(SETTINGS_PAGE, managerIn(commissioned), {
      leagueSettings: { waivers, claims },
    });
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });

    expect(screen.queryByRole("region", { name: CLAIMS_TITLE })).toBeNull();
    expect(app.leagueSettings.usePendingClaims).not.toHaveBeenCalled();
  });
});
