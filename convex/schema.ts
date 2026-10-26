import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import { feedCheckTables, feedFailureEmailTables } from "./tables/feeds";
import { footballTables } from "./tables/football";
import { signInTables } from "./tables/signIn";
import { matchStatsTables } from "./tables/matchStats";
import { positionsTables } from "./tables/positions";
import { liveStatsTables, commentaryTables, thresholdStepTables } from "./tables/live";
import { leagueTables } from "./tables/leagues";
import { joiningTables } from "./tables/joining";
import { squadTables, shortlistTables } from "./tables/squads";
import { mailTables, feedbackTables } from "./tables/mail";
import { leagueRulesTables, playedFixtureTables, lineupTables } from "./tables/rules";

// The database, one group of tables a feature, each in its own file in convex/tables/ with the
// shapes it is made of. Everything the features read from the schema is re-exported here.
export { feedOutcome, feedCheckTrigger, feedCheckFields } from "./tables/feeds";
export { clubRecord, playerRecord, fixtureRecord, gameweekRecord, matchState, scoreFeed, scoreRead, scoreProblem, scoreWrites, tableWrites, syncTrigger, footballSyncFields } from "./tables/football";
export { matchStatsState, playerMatchRecord, lateStatChange, matchSyncOutcome, matchStatsSyncFields } from "./tables/matchStats";
export { position, startRecord, playerPositionFields, approveMode, changeThresholds, positionSettingsFields, positionsSyncFields } from "./tables/positions";
export { liveStatsTickFields, commentaryLine } from "./tables/live";
export { unemailedReason, leagueDeletion, pinnedLetter, leagueEvent } from "./tables/leagues";
export { delivery } from "./tables/joining";
export { siteScoringKind, placementShape } from "./tables/rules";

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
  ...feedFailureEmailTables,
  ...leagueTables,
  ...joiningTables,
  ...mailTables,
  ...feedbackTables,
  ...leagueRulesTables,
  ...playedFixtureTables,
  ...lineupTables,
});
