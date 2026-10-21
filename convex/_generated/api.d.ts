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
import type * as plCommentary from "../plCommentary.js";
import type * as plMatch from "../plMatch.js";
import type * as premierLeague from "../premierLeague.js";
import type * as signInEmail from "../signInEmail.js";
import type * as signInLinks from "../signInLinks.js";

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
  plCommentary: typeof plCommentary;
  plMatch: typeof plMatch;
  premierLeague: typeof premierLeague;
  signInEmail: typeof signInEmail;
  signInLinks: typeof signInLinks;
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
