/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as allowedEmails from "../allowedEmails.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as deadline from "../deadline.js";
import type * as feedIds from "../feedIds.js";
import type * as feeds from "../feeds.js";
import type * as football from "../football.js";
import type * as footballSync from "../footballSync.js";
import type * as fpl from "../fpl.js";
import type * as fplLive from "../fplLive.js";
import type * as http from "../http.js";
import type * as leagueAccess from "../leagueAccess.js";
import type * as leagueLimits from "../leagueLimits.js";
import type * as leagues from "../leagues.js";
import type * as letterWords from "../letterWords.js";
import type * as letters from "../letters.js";
import type * as lineup from "../lineup.js";
import type * as liveStats from "../liveStats.js";
import type * as liveStatsSync from "../liveStatsSync.js";
import type * as mail from "../mail.js";
import type * as mailLimits from "../mailLimits.js";
import type * as matchRecords from "../matchRecords.js";
import type * as matchStats from "../matchStats.js";
import type * as matchStatsSync from "../matchStatsSync.js";
import type * as myLeagues from "../myLeagues.js";
import type * as pitch from "../pitch.js";
import type * as plCommentary from "../plCommentary.js";
import type * as plMatch from "../plMatch.js";
import type * as platformSettings from "../platformSettings.js";
import type * as playerPositions from "../playerPositions.js";
import type * as positionsSync from "../positionsSync.js";
import type * as premierLeague from "../premierLeague.js";
import type * as presets from "../presets.js";
import type * as scoring from "../scoring.js";
import type * as scoringSet from "../scoringSet.js";
import type * as signInEmail from "../signInEmail.js";
import type * as signInLinks from "../signInLinks.js";
import type * as teams from "../teams.js";
import type * as time from "../time.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  allowedEmails: typeof allowedEmails;
  auth: typeof auth;
  crons: typeof crons;
  deadline: typeof deadline;
  feedIds: typeof feedIds;
  feeds: typeof feeds;
  football: typeof football;
  footballSync: typeof footballSync;
  fpl: typeof fpl;
  fplLive: typeof fplLive;
  http: typeof http;
  leagueAccess: typeof leagueAccess;
  leagueLimits: typeof leagueLimits;
  leagues: typeof leagues;
  letterWords: typeof letterWords;
  letters: typeof letters;
  lineup: typeof lineup;
  liveStats: typeof liveStats;
  liveStatsSync: typeof liveStatsSync;
  mail: typeof mail;
  mailLimits: typeof mailLimits;
  matchRecords: typeof matchRecords;
  matchStats: typeof matchStats;
  matchStatsSync: typeof matchStatsSync;
  myLeagues: typeof myLeagues;
  pitch: typeof pitch;
  plCommentary: typeof plCommentary;
  plMatch: typeof plMatch;
  platformSettings: typeof platformSettings;
  playerPositions: typeof playerPositions;
  positionsSync: typeof positionsSync;
  premierLeague: typeof premierLeague;
  presets: typeof presets;
  scoring: typeof scoring;
  scoringSet: typeof scoringSet;
  signInEmail: typeof signInEmail;
  signInLinks: typeof signInLinks;
  teams: typeof teams;
  time: typeof time;
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
