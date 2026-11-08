// My team's Tactics tab, Quick Pick (spec/05, Moving players; #849): the button fills the formation
// with the best eleven by stars, saved and undone as any other move. How it ranks is in
// quickPick.test.ts.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { quickPickWords } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { OPEN_PICKED, TACTICS_GAMEWEEK, openTactics } from "../../../support/src/tactics.harness";
import { ARRIZABALAGA, RAYA, SQUAD, STARTERS, WHITE, at, openedPitch, undo } from "../../../support/src/tacticsScreen.harness";

const STAR_KEEPER = { ...ARRIZABALAGA, stars: [{ area: "goalkeeper" as const, role: "sweeperKeeper", stars: 5 }] };
const RATED = openTactics({
  squad: SQUAD.map((member) => (member === ARRIZABALAGA ? STAR_KEEPER : member)),
  lineup: { fromGameweek: TACTICS_GAMEWEEK, starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], leftSquad: [], joinedBench: [], vacated: [] },
});

it("puts the best-starred player in each slot of the formation, on his best role, and saves it; Undo takes it back", async () => {
  const app = await openedPitch({ tactics: RATED });
  await userEvent.click(screen.getByRole("button", { name: quickPickWords }));

  expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, {
    // Arrizabalaga's five stars beat Raya's none; Saliba, Rice and Havertz have nobody better.
    starters: expect.arrayContaining([{ ...at(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" }), role: "sweeperKeeper" }, ...STARTERS.slice(1)]),
    bench: [RAYA.playerCode, WHITE.playerCode],
    instructions: OPEN_PICKED,
  });
  expect(app.myTeam.lineupChanges.save.mock.lastCall?.[1].starters).toHaveLength(STARTERS.length);

  await userEvent.click(undo());
  expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, { starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], instructions: OPEN_PICKED });
});
