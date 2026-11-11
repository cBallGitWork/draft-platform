// The screens the smoke run opens on the phone (tests/smoke/smoke.spec.ts), here so
// tests/src/smokeScreens.test.ts can fail a route none of them reaches.

import { joinPath } from "../../../convex/joining/joiningShared";
import { ADMIN_AVAILABILITY_PATH, ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../../src/admin/paths";
import { ADMIN_TITLE } from "../../../src/admin/words";
import { FEEDBACK_PATH } from "../../../src/feedback/paths";
import { FEEDBACK_TITLE } from "../../../src/feedback/words";
import { DRAFT_TITLE, stateWords } from "../../../src/draft/words";
import {
  DRAFT_PATH,
  HOME_NEWS_PATH,
  HOME_PATH,
  MAIL_PATH,
  MATCHUP_PATH,
  MY_TEAM_FIXTURES_PATH,
  MY_TEAM_PATH,
  MY_TEAM_SQUAD_PATH,
  MY_TEAM_TRANSACTIONS_PATH,
  PREMIER_LEAGUE_PATH,
  SCOUTING_PATH,
  TABLE_PATH,
  TRADES_NEW_PATH,
  TRADES_PATH,
} from "../../../src/frame/menu";
import { gameweeksPath } from "../../../src/gameweeks/paths";
import { GAMEWEEKS_TITLE } from "../../../src/gameweeks/words";
import { RECAP_PATH } from "../../../src/home/paths";
import { PREVIEW_RECAP_GAMEWEEK } from "../../../src/home/preview";
import { NEWS_TITLE, recapTitle } from "../../../src/home/words";
import { invitesPath } from "../../../src/joining/paths";
import { INVITES_TITLE, joinPageWords } from "../../../src/joining/words";
import { settingsPath } from "../../../src/leagueSettings/paths";
import { SETTINGS_TITLE } from "../../../src/leagueSettings/words";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE, NEW_LEAGUE_TITLE } from "../../../src/leagues/words";
import { MAIL_TITLE } from "../../../src/mail/words";
import { MATCHUP_TITLE } from "../../../src/matchup/words";
import { otherTeamPath } from "../../../src/myTeam/paths";
import { TRANSACTIONS_TITLE } from "../../../src/myTeam/words";
import { PATCH_NOTES_PATH } from "../../../src/patches/paths";
import { PATCH_NOTES_TITLE } from "../../../src/patches/words";
import { playerCardPath } from "../../../src/playerCard/paths";
import { previewMatch } from "../../../src/premierLeague/matchPreview";
import { matchPath } from "../../../src/premierLeague/paths";
import { MATCH_TITLE, PREMIER_LEAGUE_TITLE } from "../../../src/premierLeague/words";
import { miniBeta, proLeague } from "../../../src/shared/preview";
import { scoringPath } from "../../../src/scoring/paths";
import { SCORING_TITLE } from "../../../src/scoring/words";
import { previewPlayers } from "../../../src/scouting/preview";
import { SCOUTING_TITLE } from "../../../src/scouting/words";
import { previewIdOf, previewTeams } from "../../../src/table/preview";
import { squadsPath } from "../../../src/squads/paths";
import { SQUADS_TITLE } from "../../../src/squads/words";
import { TABLE_PAGE_TITLE } from "../../../src/table/words";
import { TRADES_TITLE } from "../../../src/trades/words";

/** One built screen: the preview session that reaches it (src/app/preview.ts), its address, and its
 *  page's title. */
export type BuiltScreen = readonly [session: string, path: string, title: string];

/** The player whose card the run opens: Scouting's first preview player, in the manager's league. */
const [cardPlayer] = previewPlayers;
/** The team whose squad the run opens read-only: a preview team that isn't the manager's. */
const otherTeam = previewTeams[2];

/** Built screens past the landing page. The invite link's tokens are joining/preview.ts's: one to
 *  ask with, one asked, one switched off. */
export const BUILT_SCREENS: readonly BuiltScreen[] = [
  // League home is titled with the league's name, its gameweek beside it read once in the strip.
  ["manager", HOME_PATH, proLeague.name],
  ["manager", HOME_NEWS_PATH, NEWS_TITLE],
  // Read the recap's page names its gameweek in the address's search: the preview's recap.
  ["manager", `${RECAP_PATH}?gameweek=${PREVIEW_RECAP_GAMEWEEK}`, recapTitle(PREVIEW_RECAP_GAMEWEEK)],
  // The draft room's title carries the draft's state: the preview's is live (src/draft/preview.ts).
  ["manager", DRAFT_PATH, `${DRAFT_TITLE} ${stateWords.live}`],
  // Tactics, Squad and Fixtures are titled with the manager's team in the league he's in (the
  // header band).
  ["manager", MY_TEAM_PATH, String(proLeague.teamName)],
  ["manager", MY_TEAM_SQUAD_PATH, String(proLeague.teamName)],
  ["manager", MY_TEAM_FIXTURES_PATH, String(proLeague.teamName)],
  ["manager", MY_TEAM_TRANSACTIONS_PATH, TRANSACTIONS_TITLE],
  ["manager", MATCHUP_PATH, MATCHUP_TITLE],
  ["manager", TABLE_PATH, TABLE_PAGE_TITLE],
  ["manager", SCOUTING_PATH, SCOUTING_TITLE],
  ["manager", TRADES_PATH, TRADES_TITLE],
  ["manager", TRADES_NEW_PATH, TRADES_TITLE],
  ["manager", PREMIER_LEAGUE_PATH, PREMIER_LEAGUE_TITLE],
  ["manager", matchPath(previewMatch.fixtureCode), MATCH_TITLE],
  ["manager", MAIL_PATH, MAIL_TITLE],
  ["manager", LEAGUES_PATH, LEAGUES_TITLE],
  // A card is titled with the player's full name.
  ["manager", playerCardPath(proLeague.leagueId, cardPlayer.code), cardPlayer.fullName],
  // Another team's squad, read-only, is titled with that team's name.
  ["manager", otherTeamPath(proLeague.leagueId, previewIdOf(otherTeam)), otherTeam],
  ["manager", scoringPath(proLeague.leagueId), SCORING_TITLE],
  ["manager", PATCH_NOTES_PATH, PATCH_NOTES_TITLE],
  ["manager", FEEDBACK_PATH, FEEDBACK_TITLE],
  ["commissioner", gameweeksPath(miniBeta.leagueId), GAMEWEEKS_TITLE],
  ["commissioner", squadsPath(miniBeta.leagueId), SQUADS_TITLE],
  ["commissioner", invitesPath(miniBeta.leagueId), INVITES_TITLE],
  ["commissioner", settingsPath(miniBeta.leagueId), SETTINGS_TITLE],
  // The admin's alone: a commissioner is sent back to Your leagues.
  ["admin", NEW_LEAGUE_PATH, NEW_LEAGUE_TITLE],
  ["newcomer", joinPath("preview"), joinPageWords.title],
  ["newcomer", joinPath("waiting"), joinPageWords.title],
  ["newcomer", joinPath("gone"), joinPageWords.title],
  // The dashboard's tabs keep its title.
  ["admin", ADMIN_PATH, ADMIN_TITLE],
  ["admin", ADMIN_FEEDS_PATH, ADMIN_TITLE],
  ["admin", ADMIN_FEEDBACK_PATH, ADMIN_TITLE],
  ["admin", ADMIN_AVAILABILITY_PATH, ADMIN_TITLE],
];
