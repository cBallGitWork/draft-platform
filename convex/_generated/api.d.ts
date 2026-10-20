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
import type * as feeds from "../feeds.js";
import type * as football from "../football.js";
import type * as footballSync from "../footballSync.js";
import type * as fpl from "../fpl.js";
import type * as http from "../http.js";
import type * as inviteLink from "../inviteLink.js";
import type * as invites from "../invites.js";
import type * as invitesPage from "../invitesPage.js";
import type * as joinLinks from "../joinLinks.js";
import type * as joinRequests from "../joinRequests.js";
import type * as joining from "../joining.js";
import type * as joiningEmails from "../joiningEmails.js";
import type * as leagueAccess from "../leagueAccess.js";
import type * as leagueLimits from "../leagueLimits.js";
import type * as leagues from "../leagues.js";
import type * as myLeagues from "../myLeagues.js";
import type * as signInEmail from "../signInEmail.js";
import type * as signInLinks from "../signInLinks.js";
import type * as teams from "../teams.js";

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
  feeds: typeof feeds;
  football: typeof football;
  footballSync: typeof footballSync;
  fpl: typeof fpl;
  http: typeof http;
  inviteLink: typeof inviteLink;
  invites: typeof invites;
  invitesPage: typeof invitesPage;
  joinLinks: typeof joinLinks;
  joinRequests: typeof joinRequests;
  joining: typeof joining;
  joiningEmails: typeof joiningEmails;
  leagueAccess: typeof leagueAccess;
  leagueLimits: typeof leagueLimits;
  leagues: typeof leagues;
  myLeagues: typeof myLeagues;
  signInEmail: typeof signInEmail;
  signInLinks: typeof signInLinks;
  teams: typeof teams;
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
