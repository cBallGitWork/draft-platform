/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as feeds from "../feeds.js";
import type * as football from "../football.js";
import type * as footballSync from "../footballSync.js";
import type * as fpl from "../fpl.js";
import type * as liveStats from "../liveStats.js";
import type * as liveStatsSync from "../liveStatsSync.js";
import type * as matchStats from "../matchStats.js";
import type * as matchStatsSync from "../matchStatsSync.js";
import type * as platformSettings from "../platformSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  feeds: typeof feeds;
  football: typeof football;
  footballSync: typeof footballSync;
  fpl: typeof fpl;
  liveStats: typeof liveStats;
  liveStatsSync: typeof liveStatsSync;
  matchStats: typeof matchStats;
  matchStatsSync: typeof matchStatsSync;
  platformSettings: typeof platformSettings;
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
