// His match's clock on the matchup: one clock with the Premier League's pages (spec/10, The
// matchup, as a live match; #563), "HT" at half-time as they say it (#781).

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { AREA_CODES, BENCH_TITLE, lineupLabel, notCountingLabel, statusLabels } from "../../../src/matchup/words";
import { halfTime } from "../../../src/premierLeague/words";
import { liveWords } from "../../../src/shared/words";
import { headToHead, lineupRows, playing, slot, SLOT_MATCH, teamSide } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

/** Team 1's lineup, `starters` and `bench`, against an empty Team 2. */
async function openLineup(starters: Parameters<typeof teamSide>[1], bench: Parameters<typeof teamSide>[2] = []) {
  const matchup = headToHead({ kind: "scored", team: teamSide("Team 1", starters, bench), opponent: teamSide("Team 2", [], []) });
  openApp(MATCHUP_PATH, manager, { matchup: { matchup } });
  await screen.findByRole("table", { name: lineupLabel("Team 1") });
}

describe("his match's clock", () => {
  it("shows stoppage time from the Premier League's label, FPL's whole minutes without one, and Live before either", async () => {
    await openLineup(
      [slot("Phillips", { area: "goalkeeper", points: 0, status: playing(46, "45+1'30") }), slot("Coyle", { points: 2, status: playing(46) })],
      [slot("Pandur", { area: "goalkeeper", counts: false, status: playing(null) })],
    );
    expect(lineupRows("Team 1")).toEqual([
      `${AREA_CODES.goalkeeper}Phillips${statusLabels.playing} 45+1'0`,
      `${AREA_CODES.midfield}Coyle${statusLabels.playing} 46'2`,
      BENCH_TITLE,
      `${AREA_CODES.goalkeeper}Pandur${statusLabels.playing} ${liveWords}— ${notCountingLabel}`,
    ]);
  });

  it("says HT at half-time, as the Premier League's pages do, not the clock it stopped at", async () => {
    await openLineup([slot("Phillips", { area: "goalkeeper", points: 0, status: playing(47, "45+2'00", SLOT_MATCH, "halfTime") })]);
    expect(lineupRows("Team 1")).toEqual([`${AREA_CODES.goalkeeper}Phillips${halfTime.long} ${halfTime.short}0`, BENCH_TITLE]);
    // Read out in full, as full time is: the link to his match says "Half-time", not "HT".
    expect(screen.getByRole("link", { name: halfTime.long })).toBeTruthy();
  });
});
