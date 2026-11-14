// Where a letter's one link goes on screen (S16.2, S16.8): the path for each place a letter names
// (convex/mail/letterShape.ts, `LetterLink`). Its words are in words.ts (`letterLinkWords`).

import type { Id } from "../../convex/_generated/dataModel";
import type { LetterLink, LetterPlace } from "../../convex/mail/letterShape";
import {
  DRAFT_PATH,
  MY_TEAM_PATH,
  MY_TEAM_SQUAD_PATH,
  MY_TEAM_TRANSACTIONS_PATH,
  SCOUTING_PATH,
  TABLE_PATH,
  TRADES_PATH,
} from "../frame/menu";
import { recapLink } from "../home/paths";
import { settingsPath } from "../leagueSettings/paths";
import { PATCH_NOTES_PATH } from "../patches/paths";

const placePaths = {
  trades: TRADES_PATH,
  transactions: MY_TEAM_TRANSACTIONS_PATH,
  tactics: MY_TEAM_PATH,
  squad: MY_TEAM_SQUAD_PATH,
  scouting: SCOUTING_PATH,
  table: TABLE_PATH,
  draft: DRAFT_PATH,
  patchNotes: PATCH_NOTES_PATH,
} as const satisfies Record<LetterPlace, string>;

/** A link's `to` and `search` for where the letter's link goes, or null when the reader can't open
 *  it: a league's settings, for someone who doesn't run that league (S16.8: a change that shows
 *  nowhere they can reach has no link). */
export function letterLinkTarget(link: LetterLink, runs: (leagueId: Id<"leagues">) => boolean): { to: string; search?: object } | null {
  switch (link.to) {
    case "recap":
      return recapLink(link.gameweek);
    case "settings":
      return runs(link.leagueId) ? { to: settingsPath(link.leagueId) } : null;
    default:
      return { to: placePaths[link.to] };
  }
}
