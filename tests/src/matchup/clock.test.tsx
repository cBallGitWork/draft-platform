// His match's clock on the matchup: one clock with the Premier League's pages (spec/10, The
// matchup, as a live match; #563), "HT" at half-time as they say it (#781); before he plays, the
// day alone on his shirt, and on the bench no badge for his match (the approved picture; #1494).

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { notCountingLabel, sidePitchLabel, statusLabels } from "../../../src/matchup/words";
import { halfTime, liveWords, weekdayTimeWords, weekdayWords } from "../../../src/shared/words";
import { headToHead, lineupRows, playing, roleOf, slot, SLOT_MATCH, teamSide } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

/** The team whose lineup each test reads. */
const TEAM = "Team 1";

/** TEAM's lineup, `starters` and `bench`, against an empty Team 2. */
async function openLineup(starters: Parameters<typeof teamSide>[1], bench: Parameters<typeof teamSide>[2] = []) {
  const matchup = headToHead({ kind: "scored", team: teamSide(TEAM, starters, bench), opponent: teamSide("Team 2", [], []) });
  openApp(MATCHUP_PATH, manager, { matchup: { matchup } });
  await screen.findByRole("list", { name: sidePitchLabel(TEAM) });
}

describe("his match's clock", () => {
  it("shows stoppage time from the Premier League's label, FPL's whole minutes without one, and Live before either", async () => {
    await openLineup(
      [slot("Phillips", { area: "goalkeeper", points: 0, status: playing(46, "45+1'30") }), slot("Coyle", { points: 2, status: playing(46) })],
      [slot("Pandur", { area: "goalkeeper", counts: false, status: playing(null) })],
    );
    expect(lineupRows(TEAM)).toEqual([
      `Coyle, CM ${roleOf("midfield").name}, 2, ${statusLabels.playing} 46'`,
      `Phillips, GK ${roleOf("goalkeeper").name}, 0, ${statusLabels.playing} 45+1'`,
      `Pandur, —, ${statusLabels.playing} ${liveWords}, ${notCountingLabel}`,
    ]);
    // On his shirt, the clock alone.
    expect(screen.getByText("45+1'")).toBeTruthy();
  });

  it("says HT at half-time, as the Premier League's pages do, not the clock it stopped at", async () => {
    await openLineup([slot("Phillips", { area: "goalkeeper", points: 0, status: playing(47, "45+2'00", SLOT_MATCH, "halfTime") })]);
    // Read out in full, as full time is: "Half-time", then the "HT" his shirt shows.
    expect(lineupRows(TEAM)).toEqual([`Phillips, GK ${roleOf("goalkeeper").name}, 0, ${halfTime.long} ${halfTime.short}`]);
    expect(screen.getByText(halfTime.short)).toBeTruthy();
  });

  it("shows the day alone before he plays, his kickoff's time read out, and no badge for his match on the bench", async () => {
    const kickoff = Date.UTC(2026, 10, 15, 16, 30);
    const yetToPlay = { kind: "yetToPlay", fixtureCode: SLOT_MATCH, kickoff } as const;
    await openLineup([slot("Coyle", { status: yetToPlay })], [slot("Pandur", { area: "goalkeeper", counts: false, status: yetToPlay })]);
    expect(lineupRows(TEAM)[0]).toContain(`${statusLabels.yetToPlay} ${weekdayTimeWords(kickoff)}`);
    // Only Coyle's shirt says the day; the bench's tiles carry no badge for their match.
    expect(screen.getAllByText(weekdayWords(kickoff))).toHaveLength(1);
    expect(screen.queryByText(weekdayTimeWords(kickoff))).toBeNull();
  });
});
