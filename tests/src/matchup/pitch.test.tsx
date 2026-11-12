// Each side's pitch on the matchup (spec/10, The matchup, as a live match: "each starter shows his
// slot's position label and his role's run, as on the Tactics pitch"; #850): every starter at his
// slot with its label and his role, a sub who came on in the slot he came on in, with its label and
// his own role's run, the man he replaced off it (Craig, 6 Nov 2026); each moving role's run drawn,
// and each side's switch hiding them, runs shown at first (the approved picture).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { namedRole, roleIn } from "../../../convex/lineup/roles";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { RUN_MARK } from "../../../src/myTeam/tactics/pitch/runs";
import { runsWords } from "../../../src/myTeam/tactics/words";
import {
  autoSubWords,
  benchLabel,
  figureWords,
  noFigureWords,
  notCountingLabel,
  openBreakdownLabel,
  pitchPlayerLabel,
  sidePitchLabel,
  statusLabels,
  statusWords,
} from "../../../src/matchup/words";
import { headToHead, roleOf, slot, SLOT_MATCH, subbed, teamSide } from "../../support/src/matchup.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const FINISHED = { kind: "finished", fixtureCode: SLOT_MATCH } as const;
/** A finished man's match, as his tile reads it out. */
const FINISHED_WORDS = `${statusLabels.finished} ${statusWords.finished}`;
const POACHER = namedRole(roleIn({ area: "attack", lane: "centre" }, "poacher"));
const RIGHT_MIDFIELD = { area: "midfield", lane: "right" } as const;
const WIDE_LABEL = positionOfSlot(RIGHT_MIDFIELD);
const WIDE_ROLE = namedRole(roleIn(RIGHT_MIDFIELD, undefined));

/** Team 1: a keeper (a shot-stopper, who holds his place), a midfielder in the centre, a poacher,
 *  and a right midfielder who didn't play, Rice on from the bench in his slot; a bench striker not
 *  on. */
const keeper = slot("Raya", { area: "goalkeeper", status: FINISHED, points: 6 });
const centre = slot("Coyle", { status: FINISHED, points: 2 });
const striker = { ...slot("Delap", { area: "attack", status: FINISHED, points: 5 }), role: POACHER };
const off = { ...slot("Saka", { points: 0, counts: false, status: FINISHED, autoSub: subbed("off", "Rice") }), place: { lane: "right", label: WIDE_LABEL } } as const;
const sub = {
  ...slot("Rice", { status: FINISHED, points: 3, autoSub: subbed("on", "Saka") }),
  role: WIDE_ROLE,
  place: { lane: "right", label: WIDE_LABEL },
} as const;
const benched = slot("Singh", { area: "attack", counts: false, status: FINISHED, points: 1 });
const team1 = teamSide("Team 1", [keeper, centre, striker, off], [sub, benched]);
const team2 = teamSide("Team 2", [{ ...slot("Beto", { area: "attack" }), role: POACHER }], []);

async function opened(team = team1) {
  openApp(MATCHUP_PATH, manager, { matchup: { matchup: headToHead({ kind: "scored", team, opponent: team2 }) } });
  return screen.findByRole("list", { name: sidePitchLabel("Team 1") });
}

/** Each man on a pitch, as his tile is read out, top to bottom. */
const tilesOn = (pitch: HTMLElement) => within(pitch).getAllByRole("listitem", { name: (name) => name !== "" }).map((tile) => tile.getAttribute("aria-label"));

/** The players whose runs are drawn on a side's panel, by code. */
const runsOn = (teamName: string) =>
  Array.from(screen.getByRole("region", { name: teamName }).querySelectorAll(`[${RUN_MARK}]`))
    .map((run) => Number(run.getAttribute(RUN_MARK)))
    .toSorted();

describe("each side's pitch", () => {
  it("shows each man on it with his slot's label and his role, a sub in the slot he came on in, never the man he replaced or a bench player not on", async () => {
    const pitch = await opened();
    expect(tilesOn(pitch)).toEqual([
      `${pitchPlayerLabel("Delap", "ST", POACHER.name, figureWords(5))}, ${FINISHED_WORDS}`,
      `${pitchPlayerLabel("Coyle", "CM", roleOf("midfield").name, figureWords(2))}, ${FINISHED_WORDS}`,
      // Saka's slot and its label, with Rice's role.
      `${pitchPlayerLabel("Rice", WIDE_LABEL, WIDE_ROLE.name, figureWords(3))}, ${FINISHED_WORDS}, ${autoSubWords.on("Saka")}`,
      `${pitchPlayerLabel("Raya", "GK", roleOf("goalkeeper").name, figureWords(6))}, ${FINISHED_WORDS}`,
    ]);
    expect(tilesOn(screen.getByRole("list", { name: sidePitchLabel("Team 2") }))).toEqual([
      `${pitchPlayerLabel("Beto", "ST", POACHER.name, noFigureWords)}, ${statusLabels.yetToPlay} ${statusWords.yetToPlay(null)}`,
    ]);
    // Saka on the bench in Rice's place, "Off", then Singh, not on.
    expect(tilesOn(screen.getByRole("list", { name: benchLabel("Team 1") }))).toEqual([
      `${pitchPlayerLabel("Saka", WIDE_LABEL, roleOf("midfield").name, figureWords(0))}, ${FINISHED_WORDS}, ${notCountingLabel}, ${autoSubWords.off("Rice")}`,
      `Singh, ${figureWords(1)}, ${FINISHED_WORDS}, ${notCountingLabel}`,
    ]);
  });

  it("puts each replaced starter on the bench once, in his sub's place, when two share a name (#1778)", async () => {
    // Two men called Martinez, neither playing: Rice on for the striker, then Singh for the wide man.
    const [wideCode, strikerCode] = [1, 2];
    const wide = { ...off, playerCode: wideCode, name: "Martinez", autoSub: subbed("off", "Singh") };
    const upFront = { ...slot("Martinez", { area: "attack", points: 0, counts: false, status: FINISHED, autoSub: subbed("off", "Rice") }), playerCode: strikerCode };
    const riceOn = { ...sub, area: "attack", role: POACHER, place: { lane: "centre", label: "ST" }, autoSub: subbed("on", "Martinez", strikerCode) } as const;
    const singhOn = { ...benched, counts: true, role: WIDE_ROLE, place: { lane: "right", label: WIDE_LABEL }, autoSub: subbed("on", "Martinez", wideCode) } as const;
    await opened(teamSide("Team 1", [keeper, wide, upFront], [riceOn, singhOn]));
    expect(tilesOn(screen.getByRole("list", { name: benchLabel("Team 1") }))).toEqual([
      `${pitchPlayerLabel("Martinez", "ST", roleOf("attack").name, figureWords(0))}, ${FINISHED_WORDS}, ${notCountingLabel}, ${autoSubWords.off("Rice")}`,
      `${pitchPlayerLabel("Martinez", WIDE_LABEL, roleOf("midfield").name, figureWords(0))}, ${FINISHED_WORDS}, ${notCountingLabel}, ${autoSubWords.off("Singh")}`,
    ]);
  });

  it("greys a starter no one could replace, who keeps his slot", async () => {
    const unreplaced = { ...centre, counts: false, points: 0, autoSub: { kind: "unreplaced" } } as const;
    const pitch = await opened(teamSide("Team 1", [unreplaced], []));
    expect(tilesOn(pitch)).toEqual([`${pitchPlayerLabel("Coyle", "CM", roleOf("midfield").name, figureWords(0))}, ${FINISHED_WORDS}, ${notCountingLabel}, ${autoSubWords.unreplaced}`]);
  });

  it("draws each moving role's run, the sub's in the slot he came on in, none for a role that holds or the man he replaced", async () => {
    await opened();
    expect(runsOn("Team 1")).toEqual([centre, striker, sub].map(({ playerCode }) => playerCode).toSorted());
    expect(runsOn("Team 2")).toHaveLength(1);
  });

  it("each side's switch hides its own runs and shows them again", async () => {
    await opened();
    const runsSwitch = within(screen.getByRole("region", { name: "Team 1" })).getByRole("checkbox", { name: runsWords });
    expect((runsSwitch as HTMLInputElement).checked).toBe(true);
    await userEvent.click(runsSwitch);
    expect(runsOn("Team 1")).toEqual([]);
    expect(runsOn("Team 2")).toHaveLength(1);
    await userEvent.click(runsSwitch);
    expect(runsOn("Team 1")).toHaveLength(3);
  });

  it("marks the man whose breakdown is open", async () => {
    const pitch = await opened();
    await userEvent.click(within(screen.getByRole("region", { name: "Team 1" })).getByRole("button", { name: openBreakdownLabel("Delap") }));
    expect(within(pitch).getByRole("listitem", { current: true }).getAttribute("aria-label")).toBe(`${pitchPlayerLabel("Delap", "ST", POACHER.name, figureWords(5))}, ${FINISHED_WORDS}`);
  });
});
