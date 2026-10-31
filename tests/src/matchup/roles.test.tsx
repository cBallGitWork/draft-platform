// Each side's roles and formation on the matchup (spec/10, The matchup, as a live match: "At the
// deadline both lineups show: the starters, the bench in order, the formation and each starter's
// role"; #799): each starter's role under his name, as the Tactics pitch shows it; a bench player's
// only once he has come on; the formation on the side's plate, the shape on the pitch now.

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MatchupSide } from "../../../convex/matchup/matchupShape";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { AREA_CODES, autoSubWords, BENCH_TITLE, formationLabel, formationWords, leagueAverageWords, lineupLabel, notCountingLabel, statusLabels, statusWords } from "../../../src/matchup/words";
import { headToHead, lineupRows, roleOf, slot, SLOT_MATCH, teamSide } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const FINISHED = { kind: "finished", fixtureCode: SLOT_MATCH } as const;
const POACHER = { key: "poacher", name: "Poacher" };
const TARGET_MAN = { key: "targetMan", name: "Target man" };

/** Team 1: a keeper who didn't play and the bench keeper on for him, a poacher, a midfielder, and a
 *  bench striker not on. */
const team1 = teamSide(
  "Team 1",
  [
    slot("Phillips", { area: "goalkeeper", points: 0, counts: false, status: FINISHED, autoSub: { kind: "off", playerName: "Pandur" } }),
    slot("Coyle", { status: FINISHED, points: 2 }),
    { ...slot("Delap", { area: "attack", status: FINISHED, points: 5 }), role: POACHER },
  ],
  [
    { ...slot("Pandur", { area: "goalkeeper", points: 3, status: FINISHED, autoSub: { kind: "on", playerName: "Phillips" } }), role: roleOf("goalkeeper") },
    { ...slot("Singh", { area: "attack", points: 1, counts: false, status: FINISHED }), role: null },
  ],
);
/** Team 2: a back four, a pair in midfield and a target man. */
const team2 = teamSide("Team 2", [
  slot("Pickford", { area: "goalkeeper" }),
  ...["Tarkowski", "Keane", "O'Brien", "Mykolenko"].map((name) => slot(name, { area: "defence" })),
  ...["Gana", "Garner"].map((name) => slot(name)),
  { ...slot("Beto", { area: "attack" }), role: TARGET_MAN },
], []);

const openScored = (opponent: MatchupSide) =>
  openApp(MATCHUP_PATH, manager, { matchup: { matchup: headToHead({ kind: "scored", team: team1, opponent }) } });

/** The formation on a side's plate, as read out. */
const formationOn = (sideName: string) =>
  within(screen.getByRole("region", { name: sideName })).queryByText((_, element) => element?.tagName === "P" && element.textContent?.startsWith(formationLabel) === true)?.textContent ?? null;

describe("each man's role", () => {
  it("shows under each starter's name and a sub's once he has come on, never a bench player's not on", async () => {
    openScored(team2);
    await screen.findByRole("region", { name: "Team 1" });
    expect(lineupRows("Team 1")).toEqual([
      `${AREA_CODES.goalkeeper}Phillips${roleOf("goalkeeper").name}${autoSubWords.off("Pandur")}${statusLabels.finished} ${statusWords.finished}0 ${notCountingLabel}`,
      `${AREA_CODES.midfield}Coyle${roleOf("midfield").name}${statusLabels.finished} ${statusWords.finished}2`,
      `${AREA_CODES.attack}Delap${POACHER.name}${statusLabels.finished} ${statusWords.finished}5`,
      BENCH_TITLE,
      `${AREA_CODES.goalkeeper}Pandur${roleOf("goalkeeper").name}${autoSubWords.on("Phillips")}${statusLabels.finished} ${statusWords.finished}3`,
      `${AREA_CODES.attack}Singh${statusLabels.finished} ${statusWords.finished}1 ${notCountingLabel}`,
    ]);
    expect(within(screen.getByRole("table", { name: lineupLabel("Team 2") })).getByText(TARGET_MAN.name)).toBeTruthy();
  });
});

describe("each side's formation", () => {
  it("shows on its plate, read from where its men stand now", async () => {
    openScored(team2);
    await screen.findByRole("region", { name: "Team 2" });
    expect(formationOn("Team 2")).toBe(`${formationLabel} ${formationWords([4, 2, 1])}`);
    expect(formationOn("Team 1")).toBe(`${formationLabel} ${formationWords([1, 1])}`);
  });

  it("the league's average has none", async () => {
    openScored({ kind: "leagueAverage", points: 20, provisional: false });
    await screen.findByRole("region", { name: leagueAverageWords });
    expect(formationOn(leagueAverageWords)).toBeNull();
  });
});
