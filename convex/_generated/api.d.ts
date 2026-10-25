/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_feedFailureEmails from "../admin/feedFailureEmails.js";
import type * as admin_feedState from "../admin/feedState.js";
import type * as admin_feeds from "../admin/feeds.js";
import type * as admin_platformSettings from "../admin/platformSettings.js";
import type * as admin_runLogs from "../admin/runLogs.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as feedback_feedback from "../feedback/feedback.js";
import type * as feedback_feedbackLimits from "../feedback/feedbackLimits.js";
import type * as football_feedIds from "../football/feedIds.js";
import type * as football_feeds from "../football/feeds.js";
import type * as football_football from "../football/football.js";
import type * as football_footballSync from "../football/footballSync.js";
import type * as football_fpl from "../football/fpl.js";
import type * as football_fplLive from "../football/fplLive.js";
import type * as football_matchScores from "../football/matchScores.js";
import type * as football_plCommentary from "../football/plCommentary.js";
import type * as football_plMatch from "../football/plMatch.js";
import type * as football_premierLeague from "../football/premierLeague.js";
import type * as football_scoreReads from "../football/scoreReads.js";
import type * as gameweeks_deadline from "../gameweeks/deadline.js";
import type * as gameweeks_deadlineRecorder from "../gameweeks/deadlineRecorder.js";
import type * as gameweeks_leagueGameweeks from "../gameweeks/leagueGameweeks.js";
import type * as gameweeks_nextGameweek from "../gameweeks/nextGameweek.js";
import type * as gameweeks_passedDeadlines from "../gameweeks/passedDeadlines.js";
import type * as gameweeks_usedGameweeks from "../gameweeks/usedGameweeks.js";
import type * as home_glance from "../home/glance.js";
import type * as home_leagueHome from "../home/leagueHome.js";
import type * as http from "../http.js";
import type * as joining_endedInvite from "../joining/endedInvite.js";
import type * as joining_inviteLink from "../joining/inviteLink.js";
import type * as joining_invites from "../joining/invites.js";
import type * as joining_invitesPage from "../joining/invitesPage.js";
import type * as joining_joinRequests from "../joining/joinRequests.js";
import type * as joining_joining from "../joining/joining.js";
import type * as joining_joiningEmails from "../joining/joiningEmails.js";
import type * as joining_joiningShared from "../joining/joiningShared.js";
import type * as joining_liveInvites from "../joining/liveInvites.js";
import type * as leagues_deletionNotices from "../leagues/deletionNotices.js";
import type * as leagues_lastLeague from "../leagues/lastLeague.js";
import type * as leagues_leagueDeletion from "../leagues/leagueDeletion.js";
import type * as leagues_leagueLimits from "../leagues/leagueLimits.js";
import type * as leagues_leagues from "../leagues/leagues.js";
import type * as leagues_myLeagues from "../leagues/myLeagues.js";
import type * as leagues_teams from "../leagues/teams.js";
import type * as lineup_lineup from "../lineup/lineup.js";
import type * as lineup_lineupWords from "../lineup/lineupWords.js";
import type * as lineup_lineups from "../lineup/lineups.js";
import type * as lineup_pitch from "../lineup/pitch.js";
import type * as lineup_pitchWords from "../lineup/pitchWords.js";
import type * as lineup_presets from "../lineup/presets.js";
import type * as mail_letterWords from "../mail/letterWords.js";
import type * as mail_letters from "../mail/letters.js";
import type * as mail_mail from "../mail/mail.js";
import type * as mail_mailLimits from "../mail/mailLimits.js";
import type * as outbound_email from "../outbound/email.js";
import type * as outbound_emailLimit from "../outbound/emailLimit.js";
import type * as playerCard_cardPoints from "../playerCard/cardPoints.js";
import type * as playerCard_playerCard from "../playerCard/playerCard.js";
import type * as positions_playerPositions from "../positions/playerPositions.js";
import type * as positions_positionChanges from "../positions/positionChanges.js";
import type * as positions_positionSettings from "../positions/positionSettings.js";
import type * as positions_positionTables from "../positions/positionTables.js";
import type * as positions_positions from "../positions/positions.js";
import type * as positions_positionsSync from "../positions/positionsSync.js";
import type * as rules_firstRules from "../rules/firstRules.js";
import type * as rules_leagueRules from "../rules/leagueRules.js";
import type * as rules_leagueRulesCheck from "../rules/leagueRulesCheck.js";
import type * as rules_leagueRulesShape from "../rules/leagueRulesShape.js";
import type * as rules_leagueSettings from "../rules/leagueSettings.js";
import type * as scoring_categories from "../scoring/categories.js";
import type * as scoring_firstScoring from "../scoring/firstScoring.js";
import type * as scoring_ownStats from "../scoring/ownStats.js";
import type * as scoring_patchChanges from "../scoring/patchChanges.js";
import type * as scoring_patchNotes from "../scoring/patchNotes.js";
import type * as scoring_scoring from "../scoring/scoring.js";
import type * as scoring_scoringSet from "../scoring/scoringSet.js";
import type * as scoring_siteScoring from "../scoring/siteScoring.js";
import type * as scoring_statCatalogue from "../scoring/statCatalogue.js";
import type * as scouting_compare from "../scouting/compare.js";
import type * as scouting_comparedPlayers from "../scouting/comparedPlayers.js";
import type * as scouting_playersList from "../scouting/playersList.js";
import type * as scouting_shortlist from "../scouting/shortlist.js";
import type * as shared_errors from "../shared/errors.js";
import type * as shared_feedSchedule from "../shared/feedSchedule.js";
import type * as shared_leagueAccess from "../shared/leagueAccess.js";
import type * as shared_londonTime from "../shared/londonTime.js";
import type * as shared_players from "../shared/players.js";
import type * as shared_product from "../shared/product.js";
import type * as shared_sortedJson from "../shared/sortedJson.js";
import type * as shared_syncRuns from "../shared/syncRuns.js";
import type * as shared_time from "../shared/time.js";
import type * as signIn_account from "../signIn/account.js";
import type * as signIn_allowedEmails from "../signIn/allowedEmails.js";
import type * as signIn_signInEmail from "../signIn/signInEmail.js";
import type * as signIn_signInLinks from "../signIn/signInLinks.js";
import type * as squads_squads from "../squads/squads.js";
import type * as stats_liveStats from "../stats/liveStats.js";
import type * as stats_liveStatsSync from "../stats/liveStatsSync.js";
import type * as stats_matchRecords from "../stats/matchRecords.js";
import type * as stats_matchStats from "../stats/matchStats.js";
import type * as stats_matchStatsSync from "../stats/matchStatsSync.js";
import type * as stats_seasonStats from "../stats/seasonStats.js";
import type * as stats_statTotals from "../stats/statTotals.js";
import type * as table_leagueTable from "../table/leagueTable.js";
import type * as table_roundRobin from "../table/roundRobin.js";
import type * as table_standings from "../table/standings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/feedFailureEmails": typeof admin_feedFailureEmails;
  "admin/feedState": typeof admin_feedState;
  "admin/feeds": typeof admin_feeds;
  "admin/platformSettings": typeof admin_platformSettings;
  "admin/runLogs": typeof admin_runLogs;
  auth: typeof auth;
  crons: typeof crons;
  "feedback/feedback": typeof feedback_feedback;
  "feedback/feedbackLimits": typeof feedback_feedbackLimits;
  "football/feedIds": typeof football_feedIds;
  "football/feeds": typeof football_feeds;
  "football/football": typeof football_football;
  "football/footballSync": typeof football_footballSync;
  "football/fpl": typeof football_fpl;
  "football/fplLive": typeof football_fplLive;
  "football/matchScores": typeof football_matchScores;
  "football/plCommentary": typeof football_plCommentary;
  "football/plMatch": typeof football_plMatch;
  "football/premierLeague": typeof football_premierLeague;
  "football/scoreReads": typeof football_scoreReads;
  "gameweeks/deadline": typeof gameweeks_deadline;
  "gameweeks/deadlineRecorder": typeof gameweeks_deadlineRecorder;
  "gameweeks/leagueGameweeks": typeof gameweeks_leagueGameweeks;
  "gameweeks/nextGameweek": typeof gameweeks_nextGameweek;
  "gameweeks/passedDeadlines": typeof gameweeks_passedDeadlines;
  "gameweeks/usedGameweeks": typeof gameweeks_usedGameweeks;
  "home/glance": typeof home_glance;
  "home/leagueHome": typeof home_leagueHome;
  http: typeof http;
  "joining/endedInvite": typeof joining_endedInvite;
  "joining/inviteLink": typeof joining_inviteLink;
  "joining/invites": typeof joining_invites;
  "joining/invitesPage": typeof joining_invitesPage;
  "joining/joinRequests": typeof joining_joinRequests;
  "joining/joining": typeof joining_joining;
  "joining/joiningEmails": typeof joining_joiningEmails;
  "joining/joiningShared": typeof joining_joiningShared;
  "joining/liveInvites": typeof joining_liveInvites;
  "leagues/deletionNotices": typeof leagues_deletionNotices;
  "leagues/lastLeague": typeof leagues_lastLeague;
  "leagues/leagueDeletion": typeof leagues_leagueDeletion;
  "leagues/leagueLimits": typeof leagues_leagueLimits;
  "leagues/leagues": typeof leagues_leagues;
  "leagues/myLeagues": typeof leagues_myLeagues;
  "leagues/teams": typeof leagues_teams;
  "lineup/lineup": typeof lineup_lineup;
  "lineup/lineupWords": typeof lineup_lineupWords;
  "lineup/lineups": typeof lineup_lineups;
  "lineup/pitch": typeof lineup_pitch;
  "lineup/pitchWords": typeof lineup_pitchWords;
  "lineup/presets": typeof lineup_presets;
  "mail/letterWords": typeof mail_letterWords;
  "mail/letters": typeof mail_letters;
  "mail/mail": typeof mail_mail;
  "mail/mailLimits": typeof mail_mailLimits;
  "outbound/email": typeof outbound_email;
  "outbound/emailLimit": typeof outbound_emailLimit;
  "playerCard/cardPoints": typeof playerCard_cardPoints;
  "playerCard/playerCard": typeof playerCard_playerCard;
  "positions/playerPositions": typeof positions_playerPositions;
  "positions/positionChanges": typeof positions_positionChanges;
  "positions/positionSettings": typeof positions_positionSettings;
  "positions/positionTables": typeof positions_positionTables;
  "positions/positions": typeof positions_positions;
  "positions/positionsSync": typeof positions_positionsSync;
  "rules/firstRules": typeof rules_firstRules;
  "rules/leagueRules": typeof rules_leagueRules;
  "rules/leagueRulesCheck": typeof rules_leagueRulesCheck;
  "rules/leagueRulesShape": typeof rules_leagueRulesShape;
  "rules/leagueSettings": typeof rules_leagueSettings;
  "scoring/categories": typeof scoring_categories;
  "scoring/firstScoring": typeof scoring_firstScoring;
  "scoring/ownStats": typeof scoring_ownStats;
  "scoring/patchChanges": typeof scoring_patchChanges;
  "scoring/patchNotes": typeof scoring_patchNotes;
  "scoring/scoring": typeof scoring_scoring;
  "scoring/scoringSet": typeof scoring_scoringSet;
  "scoring/siteScoring": typeof scoring_siteScoring;
  "scoring/statCatalogue": typeof scoring_statCatalogue;
  "scouting/compare": typeof scouting_compare;
  "scouting/comparedPlayers": typeof scouting_comparedPlayers;
  "scouting/playersList": typeof scouting_playersList;
  "scouting/shortlist": typeof scouting_shortlist;
  "shared/errors": typeof shared_errors;
  "shared/feedSchedule": typeof shared_feedSchedule;
  "shared/leagueAccess": typeof shared_leagueAccess;
  "shared/londonTime": typeof shared_londonTime;
  "shared/players": typeof shared_players;
  "shared/product": typeof shared_product;
  "shared/sortedJson": typeof shared_sortedJson;
  "shared/syncRuns": typeof shared_syncRuns;
  "shared/time": typeof shared_time;
  "signIn/account": typeof signIn_account;
  "signIn/allowedEmails": typeof signIn_allowedEmails;
  "signIn/signInEmail": typeof signIn_signInEmail;
  "signIn/signInLinks": typeof signIn_signInLinks;
  "squads/squads": typeof squads_squads;
  "stats/liveStats": typeof stats_liveStats;
  "stats/liveStatsSync": typeof stats_liveStatsSync;
  "stats/matchRecords": typeof stats_matchRecords;
  "stats/matchStats": typeof stats_matchStats;
  "stats/matchStatsSync": typeof stats_matchStatsSync;
  "stats/seasonStats": typeof stats_seasonStats;
  "stats/statTotals": typeof stats_statTotals;
  "table/leagueTable": typeof table_leagueTable;
  "table/roundRobin": typeof table_roundRobin;
  "table/standings": typeof table_standings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
