import { defineTable } from "convex/server";
import { v } from "convex/values";
import { POSITIONS } from "../positions/positionTables";
import { failure, syncTrigger } from "./football";

// Positions (#22). Kept apart from `players`, which the football sync rewrites every six hours, so
// no feed read touches the admin's say. Each row is keyed on FPL's season-stable `code`.

export const position = v.union(...POSITIONS.map((each) => v.literal(each)));

/** One match a player started, where he lined up: `Start` in positions.ts. */
export const startRecord = v.object({
  fixtureCode: v.number(),
  kickoff: v.number(),
  formation: v.union(v.string(), v.null()),
  line: v.union(v.number(), v.null()),
  place: v.union(v.number(), v.null()),
});

/** What a player's positions are worked out from (`positionsOf` in positions.ts): his row without
 *  the code it is keyed on. Scouting keeps a copy on his list row (schema/scouting.ts, #1559). */
export const positionInputs = v.object({
  /** The Premier League's `positionInfo` for him, his squad's or else his newest sheet's; absent
   *  until one names him. */
  plLabel: v.optional(v.string()),
  /** His newest starts, at most `START_WINDOW`, newest first. */
  starts: v.array(startRecord),
  // The admin's say (`AdminPositions` in positions.ts): only his actions write these.
  approved: v.array(position),
  confirmedLabel: v.optional(v.string()),
  set: v.array(position),
  removed: v.array(position),
});

const playerPositionFields = { code: v.number(), ...positionInputs.fields };

export const approveMode = v.union(v.literal("proposals"), v.literal("countAtOnce"));

/** How many starts in a row elsewhere flag a position from starts, then remove it (spec/06):
 *  `ChangeThresholds` in positionChanges.ts. */
export const changeThresholds = v.object({ flagAfter: v.number(), removeAfter: v.number() });

/** How positions from starts count, and change: a single row, absent until the admin first sets
 *  one. A threshold is absent until he tunes it (`FIRST_THRESHOLDS` in positionChanges.ts). */
const positionSettingsFields = { approveMode, ...changeThresholds.partial().fields };

// One row per run of positionsSync.run, so a failed read is on record, never silent.
export const positionsSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      /** Matches whose sheets were read this run, and those played but left for the next. */
      matchesRead: v.number(),
      matchesLeft: v.number(),
      /** Matches whose sheets do not draw the men they start, each with why: not filed, so read
       *  again next run. */
      matchesRefused: v.array(v.string()),
      startsAdded: v.number(),
      /** Men a squad or a sheet names whom FPL does not list (gone abroad, say): not held. */
      unmatchedPlayers: v.number(),
      labelsReceived: v.number(),
      labelsChanged: v.number(),
      /** Club numbers new, changed or gone this run (#13, `clubNumbers`); absent on runs before it. */
      clubNumbersChanged: v.optional(v.number()),
      /** What the tables in positionTables.ts do not know: each needs a row before it counts. */
      unknownFormations: v.array(v.string()),
      unknownLabels: v.array(v.string()),
    }),
    failure,
  ),
};

/** A warning Mail has sent a team's manager about one of his players' positions (#23; spec/06, When
 *  positions change): flagged, then lost to a run elsewhere. Kept while it stands, so each step is
 *  told once; gone once it no longer does, or he has left the team, so it can be told again. */
const positionWarningFields = {
  teamId: v.id("teams"),
  playerCode: v.number(),
  position,
  step: v.union(v.literal("flagged"), v.literal("lost")),
};

export const positionsTables = {
  playerPositions: defineTable(playerPositionFields).index("by_code", ["code"]),
  /** Each match whose sheets the positions sync has filed, so none is filed twice. */
  positionSheets: defineTable({ fixtureCode: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
  positionSettings: defineTable(positionSettingsFields),
  positionsSyncs: defineTable(positionsSyncFields),
  positionWarnings: defineTable(positionWarningFields).index("by_teamId", ["teamId"]),
};
