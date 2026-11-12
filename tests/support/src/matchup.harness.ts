// The matchup's tests' fake seam (shell.harness.tsx hands it to the app).

import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlayingState } from "../../../convex/football/matchScores";
import type { Area } from "../../../convex/lineup/pitch";
import { centreSlotOf } from "../../../src/matchup/preview";
import type { TeamsCommentary, MatchupSide, MatchupBenchSlot, MatchupSlot, MatchupStarter } from "../../../convex/matchup/matchupShape";
import type { Matchup, MatchupSeam } from "../../../src/matchup/seam";
import { benchLabel, sidePitchLabel } from "../../../src/matchup/words";
import { serverStore } from "./serverStore";
import { MY_TEAM_NAME, THEIR_TEAM_NAME } from "./teams.harness";

/** Each tile of a team's lineup on screen, as it is read out: the pitch's top to bottom, then the
 *  bench's in order. */
export const lineupRows = (teamName: string) =>
  [sidePitchLabel(teamName), benchLabel(teamName)].flatMap((list) =>
    within(screen.getByRole("list", { name: list }))
      .queryAllByRole("listitem", { name: (name) => name !== "" })
      .map((tile) => tile.getAttribute("aria-label")),
  );

/** A matchup the test moves on, as Convex's live query would: each `play` re-renders the screen. */
export function liveMatchup(first: Matchup | undefined) {
  const store = serverStore(first);
  return { use: () => store.use((held) => held), play: store.set };
}

/** What the fake server holds: the matchup, null for a league with no rules, nothing yet while it
 *  loads, or a `live` one the test moves on. A league in total points by default. And what it says
 *  to a team override or its removal: null when it makes it. */
export type MatchupData = { matchup?: Matchup; loading?: boolean; live?: ReturnType<typeof liveMatchup>; overrideRefusal?: string | null };

export function fakeMatchup({ matchup = { kind: "totalPoints" }, loading = false, live, overrideRefusal = null }: MatchupData = {}) {
  const overrideTeam = vi.fn<ReturnType<MatchupSeam["useOverrideTeam"]>>(() => Promise.resolve(overrideRefusal));
  const removeTeamOverride = vi.fn<ReturnType<MatchupSeam["useRemoveTeamOverride"]>>(() => Promise.resolve(overrideRefusal));
  return {
    overrideTeam,
    useOverrideTeam: () => overrideTeam,
    removeTeamOverride,
    useRemoveTeamOverride: () => removeTeamOverride,
    useMatchup: vi.fn<MatchupSeam["useMatchup"]>(() =>
      // `live` is fixed for the fake's life, so each render calls the same hooks.
      live === undefined ? (loading ? undefined : matchup) : live.use(),
    ),
  };
}

type HeadToHead = Extract<Matchup, { kind: "headToHead" }>;
type Side = Extract<MatchupSide, { kind: "team" }>;
type Slot = MatchupSlot;

/** FPL's code for the match a made-up man plays in, unless his status names another. */
export const SLOT_MATCH = 101;

/** A man's match being played: its whole minutes and the Premier League's label, as the newest
 *  read gives them, live unless `state` says half-time. */
export const playing = (minute: number | null, clockLabel: string | null = null, fixtureCode = SLOT_MATCH, state: PlayingState = "live"): Slot["status"] => ({
  kind: "playing",
  fixtureCode,
  state,
  minute,
  clockLabel,
});

/** A made-up man's code, from his name. */
const codeOf = (name: string) => [...name].reduce((code, letter) => code * 31 + letter.charCodeAt(0), 7);

/** A made-up man's auto-sub: off for, or on for, the man named `name`, or the man `code` when two
 *  share that name. */
export const subbed = <Kind extends "off" | "on">(kind: Kind, name: string, code = codeOf(name)) => ({ kind, playerCode: code, playerName: name });

/** A man in a lineup, yet to play and counting unless `rest` says. */
export const slot = (name: string, rest: Partial<Slot> = {}): Slot => ({
  playerCode: codeOf(name),
  name,
  area: "midfield",
  clubCode: null,
  number: null,
  points: null,
  counts: true,
  provisional: true,
  status: { kind: "yetToPlay", fixtureCode: SLOT_MATCH, kickoff: null },
  autoSub: null,
  breakdown: [],
  ...rest,
});

/** The role a made-up starter plays unless his test gives one: his area's centre slot's first, as
 *  made-up men stand in areas, not cells. */
export const roleOf = (area: Area) => centreSlotOf(area).role;

/** A team's side: its starters, each in his area's centre slot and role (roleOf) unless he has
 *  one, and bench, none with a role or place unless he has one, its total and whether that is
 *  provisional. */
export const teamSide = (
  teamName: string,
  starters: (Slot & Partial<Pick<MatchupStarter, "role" | "place">>)[],
  bench: (Slot & Partial<Pick<MatchupBenchSlot, "role" | "place">>)[],
  points = 0,
  provisional = true,
): Side => ({
  kind: "team",
  teamId: `team-${teamName}` as Id<"teams">,
  teamName,
  points,
  provisional,
  overridden: false,
  autoTeam: false,
  lineup: { starters: starters.map((starter) => ({ ...centreSlotOf(starter.area), ...starter })), bench: bench.map((slot) => ({ role: null, place: null, ...(slot.autoSub?.kind === "on" ? centreSlotOf(slot.area) : {}), ...slot })) },
  formation: null,
});

type Game = HeadToHead["game"];
type Scored = Extract<Game, { kind: "scored" }>;

/** Commentary with no lines yet, keeping up: what a scored game holds unless a test says. */
const NO_COMMENTARY: TeamsCommentary = { kind: "read", lines: [], delayed: false };

type TeamsLine = Extract<TeamsCommentary, { kind: "read" }>["lines"][number];

/** A matchup's commentary line, about nobody and moving neither team's score unless `rest` says. */
export const commentaryLine = (key: string, text: string, rest: Partial<Omit<TeamsLine, "key" | "text">> = {}): TeamsLine => ({
  key,
  text,
  points: null,
  about: [],
  columns: [null, null],
  ...rest,
});

/** Team 1's matchup in `gameweek`, of the gameweeks it plays, holding `game`; a scored one with no
 *  commentary, scored under the first set, unless it gives some. */
export const headToHead = (
  game: Exclude<Game, Scored> | (Omit<Scored, "commentary" | "version"> & Partial<Pick<Scored, "commentary" | "version">>),
  {
    gameweek = 6,
    gameweeks = [5, 6, 7],
    deadline = null as number | null,
    gameNumber = 1,
    games = [{ kind: "team", teamName: THEIR_TEAM_NAME }] as HeadToHead["games"],
  } = {},
): HeadToHead => ({
  kind: "headToHead",
  teamId: `team-${MY_TEAM_NAME}` as Id<"teams">,
  teamName: MY_TEAM_NAME,
  gameweeks,
  gameweek,
  deadline,
  gameNumber,
  games,
  game: game.kind === "scored" ? { commentary: NO_COMMENTARY, version: null, ...game } : game,
});
