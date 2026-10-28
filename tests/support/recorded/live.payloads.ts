// Ipswich v Nott'm Forest (Premier League fixture 128999), read live on Fri 23 Oct 2026 by
// scripts/record-match.mjs every 30 s (#37). pl-live-match.json keeps, from its 383 reads:
// - commentary: three whole `/fixtures/{id}/textstream/EN` reads, each with when it was read;
// - teamStats: three whole `/stats/match/{id}` reads, likewise;
// - sheets: the full-time `/fixtures/{id}` read cut as pl-commentary-sheets.json's are (the first
//   read, 58 minutes before kickoff, cut the same, names the same men in the same places);
// - fplPlayers: FPL's bootstrap-static of 24 Oct 2026 cut to the 40 men the sheets name, and to
//   the fields `RawBootstrap` types.

import type { RawBootstrap } from "../../../convex/football/fpl";
import { withNoNews } from "./fpl.payloads";
import type { RawPlCommentary, RawPlFixture, RawPlTeamStats } from "../../../convex/football/premierLeague";
import live from "./pl-live-match.json";

/** The fixture id: commentary.payloads.ts's UPCOMING_MATCH, three days on. */
export const LIVE_MATCH = 128999;

/** The commentary reads kept, by what each was picked for. */
export const LIVE_COMMENTARY = {
  /** 13': nine lines, the first goal's naming only the scorer. */
  goal: "goal",
  /** 49': 42 lines, two of them (a foul and its free kick) gone by full time. */
  withVanished: "withVanished",
  /** Full time: 94 lines, the first goal's reworded to name the assister. */
  final: "final",
} as const;

/** The team stats reads kept, by what each was picked for. */
export const LIVE_TEAM_STATS = {
  /** 58 minutes before kickoff: each side's formation and nothing else. */
  beforeKickoff: "beforeKickoff",
  /** 8': the first read in which anything but the formation came. */
  firstMoved: "firstMoved",
  final: "final",
} as const;

/** One commentary read, a fresh copy. */
export function recordedLiveCommentary(read: keyof typeof LIVE_COMMENTARY): RawPlCommentary {
  return structuredClone(live.commentary[read].commentary as RawPlCommentary);
}

/** One team stats read, a fresh copy. */
export function recordedLiveTeamStats(read: keyof typeof LIVE_TEAM_STATS): RawPlTeamStats {
  return structuredClone(live.teamStats[read].teamStats as RawPlTeamStats);
}

/** The team sheets at full time, a fresh copy. */
export function recordedLiveSheets(): RawPlFixture {
  return structuredClone(live.sheets as RawPlFixture);
}

/** FPL's players the sheets name, a fresh copy. */
export function recordedLiveFplPlayers(): RawBootstrap["elements"] {
  return withNoNews(structuredClone(live.fplPlayers));
}
