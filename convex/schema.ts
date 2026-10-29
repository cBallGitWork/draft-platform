import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import { feedCheckTables, feedFailureEmailTables } from "./schema/feeds";
import { footballTables } from "./schema/football";
import { signInTables } from "./schema/signIn";
import { matchStatsTables } from "./schema/matchStats";
import { positionsTables } from "./schema/positions";
import { liveStatsTables, commentaryTables, thresholdStepTables, teamStatsTables, teamSheetTables } from "./schema/live";
import { leagueTables } from "./schema/leagues";
import { joiningTables } from "./schema/joining";
import { squadTables, shortlistTables } from "./schema/squads";
import { mailTables, feedbackTables } from "./schema/mail";
import { leagueRulesTables, playedFixtureTables, lineupTables } from "./schema/rules";

// The database, one group of tables a feature, each in its own file in convex/schema/ with the
// shapes it is made of. Everything the features read from the schema is re-exported here.
export { feedOutcome, feedCheckTrigger, feedCheckFields } from "./schema/feeds";
export { clubRecord, playerRecord, fixtureRecord, gameweekRecord, matchState, scoreFeed, scoreRead, scoreProblem, scoreWrites, tableWrites, syncTrigger, footballSyncFields } from "./schema/football";
export { matchStatsState, playerMatchRecord, lateStatChange, matchSyncOutcome, matchStatsSyncFields } from "./schema/matchStats";
export { position, startRecord, playerPositionFields, approveMode, changeThresholds, positionSettingsFields, positionsSyncFields } from "./schema/positions";
export { liveStatsTickFields, commentaryLine, sideTeamStats, teamSheetMan } from "./schema/live";
export { unemailedReason, leagueDeletion, pinnedLetter, leagueEvent } from "./schema/leagues";
export { delivery } from "./schema/joining";
export { siteScoringKind, placementShape } from "./schema/rules";

export default defineSchema({
  ...authTables,
  ...signInTables,
  ...feedCheckTables,
  ...footballTables,
  ...positionsTables,
  ...squadTables,
  ...shortlistTables,
  ...matchStatsTables,
  ...liveStatsTables,
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
  ...playedFixtureTables,
  ...lineupTables,
});
