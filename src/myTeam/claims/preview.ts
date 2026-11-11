// The Transactions tab's claims, waiver order and runs in the preview (src/app/preview.ts), as the
// waivers picture has them: Saka Potatoes' three claims over Wednesday's and Thursday's runs, the
// second dropping the player the first does, and another team's two for the commissioner's Every
// team view; the preview league's teams in reverse table order. A change says it isn't saved.

import type { Id } from "../../../convex/_generated/dataModel";
import type { Position } from "../../../convex/positions/positionTables";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { previewSays } from "../../shared/preview";
import { previewIdOf, previewTeams } from "../../table/preview";
import type { ClaimsSeam, PendingClaim, WaiversView } from "./seam";

const unsavedWords = "claims aren't saved";

/** The next Wednesday's 18:00 UTC, near enough to UK time for a preview, and Thursday's after it. */
const now = Date.now();
const WEDNESDAY = 3;
const today = new Date(now);
const daysToWednesday = (WEDNESDAY - today.getUTCDay() + 7) % 7 || 7;
const wednesday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysToWednesday, 18);
const thursday = wednesday + DAY_MS;

const club = (shortName: string, code: number) => ({ code, name: shortName, shortName });
const player = (playerCode: number, playerName: string, position: Position, clubShort: string, seasonPoints: number | null) => ({
  playerCode,
  playerName,
  positions: [position],
  club: club(clubShort, playerCode),
  seasonPoints,
});

const [yourTeam, otherTeam] = previewTeams;
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
  claimOf(1, yourTeam, semenyo, calvertLewin, wednesday),
  claimOf(2, yourTeam, eze, calvertLewin, wednesday),
  claimOf(3, yourTeam, kudus, mbeumo, thursday),
  claimOf(4, otherTeam, wissa, konsa, wednesday),
];

const points = [9, 9, 12, 12, 15];
const waivers: WaiversView = {
  type: "reverseStandings",
  teams: previewTeams
    .map((name, index) => ({ teamId: previewIdOf(name), name, yours: name === yourTeam, tablePlace: previewTeams.length - index, points: points[index] ?? 0 }))
    .toSorted((one, other) => other.tablePlace - one.tablePlace),
  drafted: true,
  runs: [wednesday, thursday].map((at) => ({ at, skippedIf: null })),
  locked: false,
  windowOpen: false,
  // Saturday 11:00, the deadline after the runs.
  windowShuts: { gameweek: 10, at: wednesday + 3 * DAY_MS - 7 * HOUR_MS },
  resetsAfter: 10,
};

export const previewWaivers = waivers;
/** How many of the preview's claims are the manager's own, which My team's Transactions tab counts. */
export const previewPendingClaims = claims.filter(({ yours }) => yours).length;

export const previewClaims: ClaimsSeam = {
  usePendingClaims: () => claims,
  useWaivers: () => waivers,
  useClaimChanges: () => ({ rank: previewSays(unsavedWords), withdraw: previewSays(unsavedWords), changeDrop: previewSays(unsavedWords) }),
};
