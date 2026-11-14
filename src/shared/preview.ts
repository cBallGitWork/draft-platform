// The preview's made-up people and leagues that every feature's preview shares (src/app/preview.ts
// says how the preview runs, and holds the sessions built from these), and the switch that puts
// them at the league limits. Dev server only, as that file is.

import type { Id } from "../../convex/_generated/dataModel";
import { MOST_TEAMS } from "../../convex/leagues/leagueLimits";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { FIRST_RULES } from "../../convex/rules/firstRules";
import { gameModeOf } from "../../convex/rules/gameMode";

/** The address's search key that puts the preview at the league limits (#2136): `?preview=manager&limits`. */
export const PREVIEW_LIMITS_KEY = "limits";

/** Whether the preview is at the league limits: its league at the most teams, each name, the
 *  league's too, at the longest, and a manager's squad at the most players (leagueLimits.ts). Read
 *  once, as the preview loads, so the whole visit stays at the limits. */
export const previewAtLimits = typeof window !== "undefined" && new URLSearchParams(window.location.search).has(PREVIEW_LIMITS_KEY);

/** The Pro League's name at the limits: as long as a league's name may be. */
export const limitsLeagueName = "Tim Hortons Premier Pro League";
/** Its teams at the limits: as many as a league may hold, each name as long as a team's may be. */
export const limitsTeamNames: readonly string[] = [
  "Saka Potatoes and the Mashers!",
  "Kroos Control Football Club XI",
  "Lingard Franca Athletic Wolves",
  "Neville Wears Prada Wonderwall",
  "Team 5 With A Much Longer Name",
  "Murder on Zidane's Dancefloors",
  "Dinamo Kiev Leave Before Lunch",
  "Haaland Oates Private Eyes AFC",
  "Expected Toulouse Dirty Bodies",
  "Real Sociedad of Gentlemen AFC",
  "Bayer Neverlusen Again Rangers",
  "Inter Mi Familia Wolverhampton",
  "Borussia Teeth Mönchengladbach",
  "Obi-Wan Kenobi Wednesday Wings",
  "Ctrl Alt Defeat Wanderers Town",
  "Lord of the Wings Wanderers XI",
  "Fantasy Island Galácticos Town",
  "Hakuna Matip Wanderers Wombles",
  "Agüero Nights Long Weekend AFC",
  "The Wrong Trousers Thursday XI",
];

/** What each made-up person may do in a league, as the server's powersIn would send it. */
export const managerPowers = { names: false, runs: false };
export const coCommissionerPowers = { names: false, runs: true };
export const commissionerPowers = { names: true, runs: true };
/** The admin may do everything the commissioner may, in every league. */
export const adminPowers = commissionerPowers;

/** The Pro League's teams, the preview manager's first: every preview screen of the league draws
 *  these nine, so one plays the league's average each gameweek; at the limits, the twenty above. */
export const previewTeamNames: readonly string[] = previewAtLimits
  ? limitsTeamNames
  : ["Saka Potatoes", "Kroos Control", "Lingard Franca", "Neville Wears Prada", "Team 5", "Murder on Zidane's Floor", "Dinamo Kiev Leave", "Haaland Oates", "Expected Toulouse"];

/** The preview's twenty Premier League clubs, each by its real FPL `code`, so its crest and colours
 *  are its own (#840): the Premier League section plays them, and every other preview's men are
 *  theirs. */
const CLUB_ROWS = [
  [3, "Arsenal", "ARS"],
  [7, "Aston Villa", "AVL"],
  [91, "Bournemouth", "BOU"],
  [94, "Brentford", "BRE"],
  [36, "Brighton", "BHA"],
  [8, "Chelsea", "CHE"],
  [9, "Coventry City", "COV"],
  [31, "Crystal Palace", "CRY"],
  [11, "Everton", "EVE"],
  [54, "Fulham", "FUL"],
  [40, "Ipswich Town", "IPS"],
  [2, "Leeds United", "LEE"],
  [14, "Liverpool", "LIV"],
  [43, "Man City", "MCI"],
  [1, "Man Utd", "MUN"],
  [4, "Newcastle", "NEW"],
  [17, "Nottingham Forest", "NFO"],
  [6, "Spurs", "TOT"],
  [21, "West Ham", "WHU"],
  [39, "Wolves", "WOL"],
] as const;
type PreviewClubShortName = (typeof CLUB_ROWS)[number][2];
export const previewClubs = CLUB_ROWS.map(([code, name, shortName]) => ({ code, name, shortName }));
/** A preview club by its three letters: `previewClub("ARS")`. */
export const previewClub = (shortName: PreviewClubShortName) => {
  const club = previewClubs.find((each) => each.shortName === shortName);
  if (club === undefined) throw new Error(`No preview club ${shortName}`);
  return club;
};

/** The Pro League's gameweek in every preview screen: begun, its matches under way. */
export const previewGameweek = 9;

/** What the Pro League plays in every preview screen: the first rules' mode, as every league's today (#1582). */
export const previewGameMode = gameModeOf(FIRST_RULES);

/** Made-up leagues, in the shape signIn/account:signedInAs sends. */
const unreachedCommissioner = "first.commissioner@example.com";
export const proLeague: LeagueSummary = {
  leagueId: "preview-pro-league" as Id<"leagues">,
  name: previewAtLimits ? limitsLeagueName : "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  powers: managerPowers,
  teamName: previewTeamNames[0],
  teams: previewTeamNames.length,
  maxTeams: previewAtLimits ? MOST_TEAMS : 12,
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

/** What the preview says of a change it doesn't make: what that left. */
export const previewSaid = (outcome: string) => `This is a preview: ${outcome}.`;
/** A change the preview doesn't make, saying what that left. */
export const previewSays = (outcome: string) => async () => previewSaid(outcome);
