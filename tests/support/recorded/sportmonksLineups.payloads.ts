// Sportmonks' lineups for positions (#1419). NOT YET RECORDED, as sportmonks.payloads.ts's aren't:
// no token reached the build that wrote it, so it is shaped from Sportmonks' v3 docs, one
// `fixtures/multi` body with `formations;lineups.detailedPosition`: a played Celtic v Rangers, Celtic
// in a 4-3-3 and Rangers in a 4-2-3-1, each side's eleven and one man on the bench. Once
// SPORTMONKS_API_TOKEN reads one on the dev deployment, swap it for the read.

import type { RawFixture } from "../../../convex/football/sportmonks/sportmonksRaw";
import lineupsRead from "./sportmonks-lineups.json";

/** The ids the tests name. */
export const LINEUPS = {
  match: 19100001,
  celtic: 53,
  rangers: 62,
  /** Celtic's eleven, the keeper first, then by formation field. */
  celtic433: [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011],
  /** Rangers' eleven, the keeper first, then by formation field. */
  rangers4231: [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011],
  celticBench: 1012,
  rangersBench: 2012,
} as const;

/** The played match, a fresh copy each call. */
export function sportmonksLineupsMatch(): RawFixture {
  return structuredClone(lineupsRead.data[0]) as unknown as RawFixture;
}
