// The preview's made-up people and leagues that every feature's preview shares (src/app/preview.ts
// says how the preview runs, and holds the sessions built from these). Dev server only, as that
// file is.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";

/** What each made-up person may do in a league, as the server's powersIn would send it. */
export const managerPowers = { names: false, runs: false };
export const coCommissionerPowers = { names: false, runs: true };
export const commissionerPowers = { names: true, runs: true };
/** The admin may do everything the commissioner may, in every league. */
export const adminPowers = commissionerPowers;

/** Made-up leagues, in the shape signIn/account:signedInAs sends. */
const unreachedCommissioner = "first.commissioner@example.com";
export const proLeague: LeagueSummary = {
  leagueId: "preview-pro-league" as Id<"leagues">,
  name: "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  powers: managerPowers,
  teamName: "Saka Potatoes",
  teams: 9,
  maxTeams: 12,
  unsentCommissionerLink: null,
};
export const miniBeta: LeagueSummary = {
  leagueId: "preview-mini-beta" as Id<"leagues">,
  name: "Mini beta",
  commissionerEmail: unreachedCommissioner,
  roles: [],
  // Only the admin sees a league he has no part in.
  powers: adminPowers,
  teamName: null,
  teams: 0,
  maxTeams: 4,
  unsentCommissionerLink: { email: unreachedCommissioner, reply: "paused" },
};

/** Mini beta as its one manager sees it. */
const managerInMiniBeta: LeagueSummary = { ...miniBeta, roles: ["manager"], powers: managerPowers, teamName: "Team 1", teams: 1, unsentCommissionerLink: null };

/** The preview's manager, in two leagues: a Session (src/signIn/seam.ts), which src/app/preview.ts
 *  checks, as this folder imports no feature. */
export const manager = {
  signedIn: true,
  email: "manager@example.com",
  isAdmin: false,
  inLeague: true,
  leagues: [proLeague, managerInMiniBeta],
  switchableLeagueIds: [proLeague.leagueId, miniBeta.leagueId],
  currentLeagueId: proLeague.leagueId,
} as const;

/** How many gameweeks the preview's season has: a made-up Premier League season's. The real count
 *  is the season's own, from the server (#1618). */
export const previewSeasonGameweeks = 38;

/** The gameweeks the preview's league leaves unticked: a Christmas break. */
export const previewChristmasBreak: readonly number[] = [17, 18, 19];

/** A change the preview doesn't make, saying what that left. */
export const previewSays = (outcome: string) => async () => `This is a preview: ${outcome}.`;
