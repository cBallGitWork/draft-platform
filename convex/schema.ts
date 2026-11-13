import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import { feedCheckTables, feedFailureEmailTables } from "./schema/feeds";
import { footballTables } from "./schema/football";
import { signInTables } from "./schema/signIn";
import { matchStatsTables } from "./schema/matchStats";
import { platformTables } from "./schema/platform";
import { positionsTables } from "./schema/positions";
import { liveStatsTables, sideRunTables, commentaryTables, thresholdStepTables, teamStatsTables, teamSheetTables } from "./schema/live";
import { leagueTables } from "./schema/leagues";
import { joiningTables } from "./schema/joining";
import { squadTables, shortlistTables } from "./schema/squads";
import { mailTables } from "./schema/mail";
import { feedbackTables } from "./schema/feedback";
import { outboundTables } from "./schema/outbound";
import { leagueRulesTables, squadMaximumTables } from "./schema/rules";
import { siteScoringTables } from "./schema/scoring";
import { gameweekTables } from "./schema/gameweeks";
import { tableTables } from "./schema/table";
import { lineupTables } from "./schema/lineup";
import { starsTables } from "./schema/stars";
import { draftRankingTables, draftTables } from "./schema/draft";
import { pastSeasonTables } from "./schema/pastSeasons";
import { availabilityTables } from "./schema/availability";
import { waiverTables } from "./schema/waivers";
import { scoutTables } from "./schema/scouting";
import { tradeTables } from "./schema/trades";
import { recapTables } from "./schema/recaps";
import { sportmonksTables } from "./schema/sportmonks";

// The database, one group of tables a feature, each in its own file in convex/schema/ with the
// shapes it is made of. Everything the features read from the schema is re-exported here.
export { feedOutcome, feedCheckTrigger, feedCheckFields } from "./schema/feeds";
export { availability, clubRecord, clubRow, clubColoursRecord, shirtPattern, playerRecord, fixtureRecord, gameweekRecord, matchState, scoreFeed, scoreRead, scoreProblem, scoreWrites, tableWrites, syncTrigger, footballSyncFields } from "./schema/football";
export { matchStatsState, playerMatchRecord, lateStatChange, matchSyncOutcome, matchStatsSyncFields } from "./schema/matchStats";
export { position, startRecord, approveMode, changeThresholds, positionsSyncFields } from "./schema/positions";
export { liveStatsTickFields, sideMatchOutcome, sideRunFields, commentaryLine, sideTeamStats, teamSheetMan } from "./schema/live";
export { leagueDeletion, pinnedLetter, leagueEvent } from "./schema/leagues";
export type { LeagueEvent } from "./schema/leagues";
export { delivery } from "./schema/joining";
export { namedPlayer, tradedSide } from "./schema/squads";
export type { TradedSide } from "./schema/squads";
export { siteScoringKind } from "./schema/scoring";
export { placementShape, planSlotShape } from "./schema/lineup";
export { rankedPlayer, tradedPick } from "./schema/draft";
export { pastSeasonRow } from "./schema/pastSeasons";
export { platformSettingName } from "./schema/platform";
export { recapTeamPoints } from "./schema/recaps";
export { scoutState } from "./schema/scouting";
export { tradePick, closedWhy } from "./schema/trades";
export { sportmonksCompetition, sportmonksLineupMan, sportmonksEvent, sportmonksSyncFields, sportmonksTickFields, sportmonksStart, sportmonksPositionsSyncFields, sportmonksReader, sportmonksPlayerMatchRecord } from "./schema/sportmonks";

export default defineSchema({
  ...authTables,
  ...signInTables,
  ...outboundTables,
  ...feedCheckTables,
  ...footballTables,
  ...positionsTables,
  ...squadTables,
  ...shortlistTables,
  ...matchStatsTables,
  ...platformTables,
  ...liveStatsTables,
  ...sideRunTables,
  ...commentaryTables,
  ...thresholdStepTables,
  ...teamStatsTables,
  ...teamSheetTables,
  ...feedFailureEmailTables,
  ...leagueTables,
  ...joiningTables,
  ...mailTables,
  ...feedbackTables,
  ...leagueRulesTables,
  ...siteScoringTables,
  ...squadMaximumTables,
  ...gameweekTables,
  ...tableTables,
  ...lineupTables,
  ...starsTables,
  ...draftRankingTables,
  ...draftTables,
  ...pastSeasonTables,
  ...availabilityTables,
  ...waiverTables,
  ...scoutTables,
  ...tradeTables,
  ...recapTables,
  ...sportmonksTables,
});
