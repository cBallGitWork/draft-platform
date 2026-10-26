// My team's Tactics tab (#14; spec/05, The pitch; spec/12, My team): where a manager lands; the
// lineup held for the next gameweek on a pitch of six areas by five lanes, the squad beside it with
// the bench in order; a player picked up (a click, a tap, Enter) or dragged, then put in a free cell
// he plays or on the bench; the save, with the server's refusal in its words; and the countdown to
// the league's deadline.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Cell } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import type { Tactics } from "../../../src/myTeam/tacticsSeam";
import {
  BENCH_TITLE,
  discardWords,
  emptyBenchWords,
  joinedBenchWords,
  locksWords,
  moveLabel,
  movingHintWords,
  noDeadlineWords,
  pickHintWords,
  pitchLabel,
  playerOnPitchLabel,
  putHereLabel,
  saveFailedWords,
  saveWords,
  savedWords,
  seasonOverWords,
  squadTableLabel,
  startingWords,
  tacticsLoadingWords,
  tacticsNoRulesWords,
  toBenchWords,
} from "../../../src/myTeam/tacticsWords";
import { noTeamWords } from "../../../src/myTeam/words";
import type { MyTeamData } from "../../support/src/myTeam.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "../../support/src/tactics.harness";

type Member = Extract<Tactics, { kind: "open" }>["squad"][number];
const member = (playerCode: number, name: string, positions: Position[]): Member => ({ playerCode, name, clubShortName: "ARS", positions });

const RAYA = member(1, "Raya", ["GK"]);
const SALIBA = member(2, "Saliba", ["CB"]);
const RICE = member(3, "Rice", ["CDM", "CM"]);
const HAVERTZ = member(4, "Havertz", ["ST"]);
const ARRIZABALAGA = member(5, "Arrizabalaga", ["GK"]);
const WHITE = member(6, "White", ["FB", "WB"]);
const SQUAD = [RAYA, SALIBA, RICE, HAVERTZ, ARRIZABALAGA, WHITE];

const at = (player: Member, cell: Cell) => ({ playerCode: player.playerCode, ...cell });
/** Four starters and two on the bench: the screen never judges whether eleven stand. */
const STARTERS = [
  at(RAYA, { area: "goalkeeper", lane: "centre" }),
  at(SALIBA, { area: "defence", lane: "leftCentre" }),
  at(RICE, { area: "midfield", lane: "centre" }),
  at(HAVERTZ, { area: "attack", lane: "centre" }),
];
const SAVED = openTactics({
  squad: SQUAD,
  lineup: { kind: "saved", fromGameweek: TACTICS_GAMEWEEK, starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], leftSquad: [], joinedBench: [] },
});

const openTacticsTab = (myTeam: MyTeamData = { tactics: SAVED }, session = manager) => openApp(MY_TEAM_PATH, session, { myTeam });
const pitch = () => screen.getByRole("group", { name: pitchLabel });
const squadRows = () =>
  within(screen.getByRole("table", { name: squadTableLabel }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);
const blockOf = (player: Member, cell: Cell) => within(pitch()).getByRole("button", { name: playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane) });
const targets = () => within(pitch()).queryAllByRole("button", { name: /^Put / }).map((target) => target.getAttribute("aria-label"));
const save = () => screen.getByRole("button", { name: saveWords });
/** The tab opened on the lineup held, once its pitch is up. */
async function openedPitch(myTeam?: MyTeamData) {
  const app = openTacticsTab(myTeam);
  await screen.findByRole("group", { name: pitchLabel });
  return app;
}

describe("reaching it", () => {
  it("is where a manager lands, titled by his team, reading his lineup for the league the app is in", async () => {
    const app = openApp("/", manager, { myTeam: { tactics: SAVED } });
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
    expect(app.myTeam.useTactics).toHaveBeenCalledWith(league.leagueId, expect.any(Number));
  });

  it("says so while it loads", async () => {
    openTacticsTab({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(tacticsLoadingWords);
  });

  it.each([
    ["a league made before rules", { kind: "noRules" } as const, tacticsNoRulesWords],
    ["a season whose every gameweek has begun", { kind: "seasonOver" } as const, seasonOverWords],
  ])("says why there's no lineup to set, for %s", async (_, tactics, words) => {
    openTacticsTab({ tactics });
    expect(await screen.findByText(words)).toBeTruthy();
    expect(screen.queryByRole("group", { name: pitchLabel })).toBeNull();
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openTacticsTab({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTactics).not.toHaveBeenCalled();
  });
});

describe("the deadline", () => {
  it("says when the gameweek locks and counts down to it", async () => {
    const minute = Date.now() - (Date.now() % MINUTE_MS);
    const deadline = minute + DAY_MS + 17 * HOUR_MS;
    openTacticsTab({ tactics: { ...SAVED, deadline } });
    expect(await screen.findByText(locksWords(TACTICS_GAMEWEEK, deadline), { exact: false })).toBeTruthy();
    expect(screen.getByText("in 1d 17h")).toBeTruthy();
  });

  it("says a gameweek with no kickoff time held has no deadline yet", async () => {
    openTacticsTab({ tactics: { ...SAVED, deadline: null } });
    expect(await screen.findByText(noDeadlineWords(TACTICS_GAMEWEEK))).toBeTruthy();
  });
});

describe("the lineup held", () => {
  it("stands on the pitch, each starter in his cell with his positions", async () => {
    openTacticsTab();
    await screen.findByRole("group", { name: pitchLabel });
    for (const { playerCode, area, lane } of STARTERS) expect(blockOf(SQUAD.find((each) => each.playerCode === playerCode)!, { area, lane })).toBeTruthy();
    expect(screen.getByText(startingWords(STARTERS.length))).toBeTruthy();
  });

  it("is listed beside it: the eleven back to front, then the bench in order", async () => {
    openTacticsTab();
    await screen.findByRole("table", { name: squadTableLabel });
    expect(squadRows()).toEqual(["GKRaya ARSMove", "CBSaliba ARSMove", "CDM, CMRice ARSMove", "STHavertz ARSMove", BENCH_TITLE, "GKArrizabalaga ARSMove", "FB, WBWhite ARSMove"]);
  });

  it("for a team that has never saved one, is the whole squad on the bench", async () => {
    openTacticsTab({ tactics: openTactics({ squad: SQUAD }) });
    await screen.findByRole("table", { name: squadTableLabel });
    expect(squadRows()[0]).toBe(BENCH_TITLE);
    expect(squadRows()).toHaveLength(SQUAD.length + 1);
    expect(screen.getByText(startingWords(0))).toBeTruthy();
  });

  it("says who joined the squad since and sits at the end of the bench", async () => {
    const lineup = { kind: "saved" as const, fromGameweek: TACTICS_GAMEWEEK, starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], leftSquad: [], joinedBench: [WHITE.playerCode] };
    openTacticsTab({ tactics: openTactics({ squad: SQUAD, lineup }) });
    expect(await screen.findByText(joinedBenchWords([WHITE.name]))).toBeTruthy();
  });

  it("says when the bench is empty", async () => {
    openTacticsTab({ tactics: openTactics({ squad: [RAYA], lineup: { kind: "saved", fromGameweek: 1, starters: [STARTERS[0]], bench: [], leftSquad: [], joinedBench: [] } }) });
    expect(await screen.findByText(emptyBenchWords)).toBeTruthy();
  });
});

describe("moving a player", () => {
  it("picked up from the bench, is offered only the free cells he plays, and put in one", async () => {
    openTacticsTab();
    await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));

    expect(screen.getByText(movingHintWords(WHITE.name, WHITE.positions))).toBeTruthy();
    // A wing back plays all of defence but Saliba's cell, and the wide lanes of both midfield rows.
    expect(targets()).toEqual([
      putHereLabel(WHITE.name, "midfield", "left"),
      putHereLabel(WHITE.name, "midfield", "right"),
      putHereLabel(WHITE.name, "defensiveMidfield", "left"),
      putHereLabel(WHITE.name, "defensiveMidfield", "right"),
      putHereLabel(WHITE.name, "defence", "left"),
      putHereLabel(WHITE.name, "defence", "centre"),
      putHereLabel(WHITE.name, "defence", "rightCentre"),
      putHereLabel(WHITE.name, "defence", "right"),
    ]);

    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "right") }));
    const placed = blockOf(WHITE, { area: "defence", lane: "right" });
    expect(document.activeElement).toBe(placed);
    expect(targets()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
    expect(screen.getByText(startingWords(STARTERS.length + 1))).toBeTruthy();
  });

  it("moves a starter to another free cell in his area, picked up by a tap on him", async () => {
    await openedPitch();
    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "rightCentre") }));
    expect(blockOf(SALIBA, { area: "defence", lane: "rightCentre" })).toBeTruthy();
  });

  it("offers a keeper only goal's free cells, and an outfield player never goal", async () => {
    await openedPitch();
    await userEvent.click(screen.getByRole("button", { name: moveLabel(ARRIZABALAGA.name) }));
    // How many may stand in goal is the league's limit, told on saving (lineup.ts).
    const freeGoalLanes: Cell["lane"][] = ["left", "leftCentre", "rightCentre", "right"];
    expect(targets()).toEqual(freeGoalLanes.map((lane) => putHereLabel(ARRIZABALAGA.name, "goalkeeper", lane)));

    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    expect(targets().some((label) => label?.includes("Goalkeeper"))).toBe(false);
  });

  it("works from the keyboard: Enter picks a player up, Escape puts him back", async () => {
    await openedPitch();
    blockOf(SALIBA, { area: "defence", lane: "leftCentre" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(targets().length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(targets()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
  });

  it("puts a picked-up starter on the bench, at its end", async () => {
    await openedPitch();
    await userEvent.click(blockOf(RICE, { area: "midfield", lane: "centre" }));
    await userEvent.click(screen.getByRole("button", { name: toBenchWords(RICE.name) }));
    expect(squadRows().at(-1)).toBe("CDM, CMRice ARSMove");
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${RICE.name},`) })).toBeNull();
  });

  it("drags from the bench onto a free cell he plays", async () => {
    openTacticsTab();
    const row = (await screen.findByRole("button", { name: moveLabel(WHITE.name) })).closest("tr")!;
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(row, { dataTransfer });
    const cell = screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }).parentElement!;
    fireEvent.dragOver(cell, { dataTransfer });
    fireEvent.drop(cell, { dataTransfer });
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("drags a starter onto the bench", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(HAVERTZ, { area: "attack", lane: "centre" }), { dataTransfer });
    fireEvent.drop(screen.getByText(BENCH_TITLE), { dataTransfer });
    expect(squadRows().at(-1)).toBe("STHavertz ARSMove");
  });
});

describe("saving", () => {
  it("has nothing to save until something moves, then saves the lineup as it stands", async () => {
    const app = openTacticsTab();
    expect((await screen.findByRole("button", { name: saveWords })).hasAttribute("disabled")).toBe(true);

    await userEvent.click(blockOf(HAVERTZ, { area: "attack", lane: "centre" }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(HAVERTZ.name, "attack", "left") }));
    await userEvent.click(save());

    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, {
      starters: [...STARTERS.slice(0, 3), at(HAVERTZ, { area: "attack", lane: "left" })],
      bench: [ARRIZABALAGA.playerCode, WHITE.playerCode],
    });
    expect(await screen.findByText(savedWords(TACTICS_GAMEWEEK))).toBeTruthy();
  });

  it("shows the server's refusal in its words, keeping the edit", async () => {
    const refusal = "A lineup starts 11 players; this one starts 4.";
    openTacticsTab({ tactics: SAVED, saveAnswer: refusal });
    await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }));
    await userEvent.click(save());

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("says a save that failed for another reason plainly", async () => {
    openTacticsTab({ tactics: SAVED, saveAnswer: saveFailedWords });
    await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }));
    await userEvent.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(saveFailedWords);
  });

  it("discards an edit, back to the lineup held", async () => {
    openTacticsTab();
    await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }));
    await userEvent.click(screen.getByRole("button", { name: discardWords }));

    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${WHITE.name},`) })).toBeNull();
    expect(save().hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: discardWords })).toBeNull();
  });
});
