// The Transactions tab's claims, waiver order and runs in the preview (src/app/preview.ts), as the
// waivers picture has them: Saka Potatoes' three claims over the gameweek's two runs, the
// second dropping the player the first does, and another team's two for the commissioner's Every
// team view; the preview league's teams in reverse table order. A change says it isn't saved.

import type { Id } from "../../../convex/_generated/dataModel";
import type { Position } from "../../../convex/positions/positionTables";
import { clockHourOf } from "../../../convex/home/homeAt";
import { HOUR_MS } from "../../../convex/shared/time";
import { previewSays, previewTeamNames } from "../../shared/preview";
import { previewLeagueTable } from "../../table/preview";
import { previewIdOf, previewSeason } from "../../shared/previewDraw";
import { PREVIEW_GAMEWEEK } from "../tactics/preview";
import type { ClaimsSeam, PendingClaim, WaiversView } from "./seam";

const unsavedWords = "claims aren't saved";

/** The gameweek My team sets and its deadline, from the one preview season (#2697), about a day
 *  ahead; both runs fall on the hour between now and it, so the window they open shuts after
 *  them (#2733). */
const deadline = previewSeason.deadlineOf(PREVIEW_GAMEWEEK);
const firstRun = clockHourOf(deadline - 18 * HOUR_MS);
const secondRun = clockHourOf(deadline - 6 * HOUR_MS);

const club = (shortName: string, code: number) => ({ code, name: shortName, shortName });
const player = (playerCode: number, playerName: string, position: Position, clubShort: string, seasonPoints: number | null) => ({
  playerCode,
  playerName,
  positions: [position],
  club: club(clubShort, playerCode),
  seasonPoints,
});

const [yourTeam, otherTeam] = previewTeamNames;
const semenyo = player(501, "Semenyo", "W", "BOU", 40);
const eze = player(502, "Eze", "CAM", "ARS", 33);
const kudus = player(503, "Kudus", "W", "TOT", 27);
const calvertLewin = player(504, "Calvert-Lewin", "ST", "LEE", 18);
const mbeumo = player(505, "Mbeumo", "W", "MUN", 30);
const wissa = player(506, "Wissa", "ST", "NEW", 12);
const konsa = player(507, "Konsa", "CB", "AVL", 22);

const claimOf = (id: number, team: string, claim: ReturnType<typeof player>, drop: ReturnType<typeof player> | null, runAt: number): PendingClaim => ({
  claimId: `preview-claim-${id}` as Id<"waiverClaims">,
  teamId: previewIdOf(team),
  teamName: team,
  yours: team === yourTeam,
  claim,
  drop,
  run: { at: runAt, skippedIf: null },
});

const claims: PendingClaim[] = [
  claimOf(1, yourTeam, semenyo, calvertLewin, firstRun),
  claimOf(2, yourTeam, eze, calvertLewin, firstRun),
  claimOf(3, yourTeam, kudus, mbeumo, secondRun),
  claimOf(4, otherTeam, wissa, konsa, firstRun),
];

const waivers: WaiversView = {
  type: "reverseStandings",
  // The table preview's places and points, bottom first, so the order agrees with the table (#1969).
  teams: previewLeagueTable.table
    .map(({ teamName: name, points }, index) => ({ teamId: previewIdOf(name), name, yours: name === yourTeam, tablePlace: index + 1, points }))
    .toReversed(),
  drafted: true,
  runs: [firstRun, secondRun].map((at) => ({ at, skippedIf: null })),
  locked: false,
  windowOpen: false,
  windowShuts: { gameweek: PREVIEW_GAMEWEEK, at: deadline },
  resetsAfter: PREVIEW_GAMEWEEK,
  delayed: false,
};

export const previewWaivers = waivers;
/** How many of the preview's claims are the manager's own, which My team's Transactions tab counts. */
export const previewPendingClaims = claims.filter(({ yours }) => yours).length;

export const previewClaims: ClaimsSeam = {
  usePendingClaims: () => claims,
  useWaivers: () => waivers,
  useClaimChanges: () => ({ rank: previewSays(unsavedWords), withdraw: previewSays(unsavedWords), changeDrop: previewSays(unsavedWords) }),
};
