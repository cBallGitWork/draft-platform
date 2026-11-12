// Each man's role on the matchup (spec/10, The matchup, as a live match: "At the deadline both
// lineups show: the starters, the bench in order, the formation and each starter's role"; #799):
// each starter's role under his name, as the Tactics pitch shows it; a bench player's only once he
// has come on. The formation waits on Craig (#878).

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { namedRole, roleIn } from "../../../convex/lineup/roles";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { autoSubWords, notCountingLabel, sidePitchLabel, statusLabels, statusWords } from "../../../src/matchup/words";
import { headToHead, lineupRows, roleOf, slot, SLOT_MATCH, subbed, teamSide } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const FINISHED = { kind: "finished", fixtureCode: SLOT_MATCH } as const;
/** A striker's slot, and two of its roles. */
const STRIKER_SLOT = { area: "attack", lane: "centre" } as const;
const POACHER = namedRole(roleIn(STRIKER_SLOT, "poacher"));
const TARGET_MAN = namedRole(roleIn(STRIKER_SLOT, "targetMan"));

/** Team 1: a keeper who didn't play and the bench keeper on for him, a poacher, a midfielder, and a
 *  bench striker not on. */
const team1 = teamSide(
  "Team 1",
  [
    slot("Phillips", { area: "goalkeeper", points: 0, counts: false, status: FINISHED, autoSub: subbed("off", "Pandur") }),
    slot("Coyle", { status: FINISHED, points: 2 }),
    { ...slot("Delap", { area: "attack", status: FINISHED, points: 5 }), role: POACHER },
  ],
  [
    { ...slot("Pandur", { area: "goalkeeper", points: 3, status: FINISHED, autoSub: subbed("on", "Phillips") }), role: roleOf("goalkeeper") },
    { ...slot("Singh", { area: "attack", points: 1, counts: false, status: FINISHED }), role: null },
  ],
);
/** Team 2: a target man up front. */
const team2 = teamSide("Team 2", [{ ...slot("Beto", { area: "attack" }), role: TARGET_MAN }], []);

describe("each man's role", () => {
  it("shows under each starter's name and a sub's once he has come on, never a bench player's not on", async () => {
    openApp(MATCHUP_PATH, manager, { matchup: { matchup: headToHead({ kind: "scored", team: team1, opponent: team2 }) } });
    await screen.findByRole("region", { name: "Team 1" });
    const finished = `${statusLabels.finished} ${statusWords.finished}`;
    // The pitch top to bottom, Pandur on in Phillips' slot; then the bench, Phillips in Pandur's place.
    expect(lineupRows("Team 1")).toEqual([
      `Delap, ST ${POACHER.name}, 5, ${finished}`,
      `Coyle, CM ${roleOf("midfield").name}, 2, ${finished}`,
      `Pandur, GK ${roleOf("goalkeeper").name}, 3, ${finished}, ${autoSubWords.on("Phillips")}`,
      `Phillips, GK ${roleOf("goalkeeper").name}, 0, ${finished}, ${notCountingLabel}, ${autoSubWords.off("Pandur")}`,
      `Singh, 1, ${finished}, ${notCountingLabel}`,
    ]);
    expect(within(screen.getByRole("list", { name: sidePitchLabel("Team 2") })).getByText(TARGET_MAN.name)).toBeTruthy();
  });
});
