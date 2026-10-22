// What the positions sync reads (#22), recorded 20 Oct 2026 and cut to five matches.
// Kept, in positions.json:
// - Both seasons' Premier League fixture lists, cut to the kept matches and one unplayed one
//   (Newcastle v Man City, 26 Dec 2026). Each keeps only `id`, `altIds`, `status`, `kickoff` and
//   `teams`.
// - Five matches' team sheets, each man cut to his id, name, Opta id and label: four of Newcastle's
//   in 2025/26 (three 4-3-3s around Opta's "4-5-1" that draws a 4-3-2-1), and Man City v Coventry,
//   5 Sep 2026, whose City sheet draws Enzo Fernández, listed on the bench, and leaves out Nico
//   O'Reilly, listed as starting: the one sheet of 900 that does not draw the men it starts.
// - This season's squads (`/staff`, with `altIds`) of the three clubs in the list: Newcastle's
//   whole, the other two cut to the men the sheets name.
// - FPL's bootstrap-static players, cut to every man the sheets and squads name whom FPL lists
//   today, and to the fields read. The men it leaves out (Trippier, Krafth, gone) are unmatched.

import { PL_COMP_SEASON, PL_LAST_COMP_SEASON } from "../../../convex/football/football";
import type { RawBootstrap } from "../../../convex/football/fpl";
import type { RawPlFixture, RawPlSquad } from "../../../convex/football/premierLeague";
import recorded from "./positions.json";

export interface PositionsPayloads {
  fplElements: RawBootstrap["elements"];
  /** Each season's fixture list, by the Premier League's season id. */
  fixtureLists: Record<number, RawPlFixture[]>;
  sheets: RawPlFixture[];
  /** This season's squads, by the Premier League's team id. */
  squads: Record<number, RawPlSquad>;
}

/** The recorded matches by the Premier League's fixture id. */
export const SHEET = {
  newcastleOct: 124890,
  newcastleNov: 124892,
  newcastleFourFiveOne: 124909,
  newcastleLateNov: 124915,
  cityCoventryRefused: 128950,
} as const;

/** The unplayed match in this season's list, by the Premier League's fixture id. */
export const UNPLAYED_MATCH = 129091;

/** Newcastle's club code in FPL, its per-season id there in 2026/27, and its Premier League id. */
export const NEWCASTLE = { code: 4, fplId: 17, pl: 23 } as const;

/** Men in the recorded sheets and squads, by FPL code. */
export const PLAYER = {
  barnes: 201666, // a winger: three starts wide, one off the bench
  hall: 487838, // "Left Full Back": two starts at full back, two on the bench
  woltemade: 470313, // four starts up front; no squad lists him, so his label is a sheet's
  joelinton: 180974, // four starts in the middle three
  thiaw: 465642, // four starts at centre-back
  steur: 636852, // in Newcastle's squad, on no sheet: a new signing
  kelleher: 200720, // Brentford's keeper: one start, against Newcastle
} as const;

/** Brentford's club code in FPL. */
export const BRENTFORD_CODE = 94;

/** A fresh copy of the recorded payloads, safe to change for one test. */
export function recordedPositions(): PositionsPayloads {
  const copy = structuredClone(recorded);
  return {
    fplElements: copy.fplElements as RawBootstrap["elements"],
    fixtureLists: {
      [PL_LAST_COMP_SEASON]: copy.fixtureLists[PL_LAST_COMP_SEASON] as RawPlFixture[],
      [PL_COMP_SEASON]: copy.fixtureLists[PL_COMP_SEASON] as RawPlFixture[],
    },
    sheets: copy.sheets as RawPlFixture[],
    squads: Object.fromEntries(Object.entries(copy.squads).map(([team, squad]) => [Number(team), squad as RawPlSquad])),
  };
}
