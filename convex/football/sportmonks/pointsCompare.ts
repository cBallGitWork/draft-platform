// One gameweek's points from Sportmonks beside FPL's (#1422, spec/20 `S20.4`): before the switch,
// every man's points under the site's scoring from Sportmonks' stats (#1415) are put beside his
// points from the FPL and Premier League feeds, through the link to FPL's codes (#1421), and every
// man whose points differ is listed with the stats behind it, for Craig to read and say go (Craig,
// 10 Nov 2026: "You read it and say go"; no pass mark). Pure: records in, the report out. Read
// from the stored records: pointsCompareReport.ts.

import { SLOT_POSITIONS, type SlotPosition } from "../../lineup/pitch";
import { cardPositions, pointsAt } from "../../playerCard/cardPoints";
import type { Position } from "../../positions/positionTables";
import type { ScoringSet } from "../../scoring/scoringSet";
import type { MatchStats } from "../../scoring/values";
import { MINUTES_STAT } from "../../stats/matchRecords";

/** One man's record in one feed's match: his stats, null while his whole record hasn't arrived,
 *  and whether he played (false for an unused substitute). */
export type FeedRecord = { playerCode: number; played: boolean | null; stats: MatchStats | null };

/** One FPL match and what both feeds hold for it: Sportmonks' records keyed on its own player
 *  ids, null for the match when it links to no Sportmonks match yet. */
export type ComparedMatch = {
  fixtureCode: number;
  fpl: readonly FeedRecord[];
  sportmonks: { fixtureCode: number; records: readonly FeedRecord[] } | null;
};

/** A stat the scoring reads, valued by each feed: null where that feed has no whole record. */
export type StatDifference = { stat: string; fpl: number | null; sportmonks: number | null };

/** His points at one position from each feed: null where that feed has no whole record. */
export type PositionPoints = { position: SlotPosition; fpl: number | null; sportmonks: number | null };

/** One man whose points differ in one match: his FPL code (null when he links to none) and his
 *  Sportmonks id (null when Sportmonks has no record of him in the match), his points at each
 *  position he is priced at, and the stats the scoring reads that differ. */
export type PointsDifference = {
  fixtureCode: number;
  fplPlayerCode: number | null;
  sportmonksPlayerCode: number | null;
  points: PositionPoints[];
  stats: StatDifference[];
};

export type PointsComparison = {
  /** Men whose points are the same from both feeds. */
  matching: number;
  differing: PointsDifference[];
  /** FPL's matches that link to no Sportmonks match, so none of their men were compared. */
  unlinkedMatches: number[];
};

/** The stats the set's base points read: each rule's stat, an own stat's parts, and minutes,
 *  which a rule's least minutes reads. */
export function statsScored(set: ScoringSet): string[] {
  const stats = new Set<string>([MINUTES_STAT]);
  for (const { stat } of set.rules) {
    const own = set.ownStats?.find((each) => each.stat === stat);
    if (own === undefined) stats.add(stat);
    else for (const part of own.parts) stats.add(part.stat);
  }
  return [...stats].sort();
}

/** The positions he is priced at: his card's (cardPositions), or, with none priced, every slot's,
 *  so a man with no position yet is still compared. */
function pricedAt(positions: readonly Position[]): readonly SlotPosition[] {
  const card = cardPositions(positions);
  return card.length > 0 ? card : SLOT_POSITIONS;
}

/** Every man in each match compared: his points from both feeds at each position he is priced at,
 *  under `set`. A man in one feed's match and not the other's differs if he played; one who sat
 *  it out in the only feed that names him is left out. `links` gives each Sportmonks player id's
 *  FPL code, `positionsOf` each FPL code's positions. */
export function comparePoints(
  matches: readonly ComparedMatch[],
  set: ScoringSet,
  links: ReadonlyMap<number, number>,
  positionsOf: (fplCode: number) => readonly Position[],
): PointsComparison {
  const scored = statsScored(set);
  const comparison: PointsComparison = { matching: 0, differing: [], unlinkedMatches: [] };
  for (const match of matches) {
    if (match.sportmonks === null) {
      comparison.unlinkedMatches.push(match.fixtureCode);
      continue;
    }
    const fplByCode = new Map(match.fpl.map((record) => [record.playerCode, record]));
    const pairs: { fplCode: number | null; fpl: FeedRecord | null; sportmonks: FeedRecord | null }[] = [];
    for (const record of match.sportmonks.records) {
      const fplCode = links.get(record.playerCode) ?? null;
      const fpl = fplCode === null ? null : (fplByCode.get(fplCode) ?? null);
      if (fplCode !== null) fplByCode.delete(fplCode);
      pairs.push({ fplCode, fpl, sportmonks: record });
    }
    for (const fpl of fplByCode.values()) pairs.push({ fplCode: fpl.playerCode, fpl, sportmonks: null });

    for (const { fplCode, fpl, sportmonks } of pairs) {
      if ((fpl === null || sportmonks === null) && !(fpl ?? sportmonks)!.played) continue;
      const points = pricedAt(fplCode === null ? [] : positionsOf(fplCode)).map((position) => ({
        position,
        fpl: pointsOf(fpl, set, position),
        sportmonks: pointsOf(sportmonks, set, position),
      }));
      if (points.every((each) => each.fpl === each.sportmonks)) {
        comparison.matching += 1;
        continue;
      }
      comparison.differing.push({
        fixtureCode: match.fixtureCode,
        fplPlayerCode: fplCode,
        sportmonksPlayerCode: sportmonks?.playerCode ?? null,
        points,
        stats: scored.map((stat) => ({ stat, fpl: statOf(fpl, stat), sportmonks: statOf(sportmonks, stat) })).filter((each) => each.fpl !== each.sportmonks),
      });
    }
  }
  return comparison;
}

/** His points at `position` from one feed's record, null where it has none or it isn't whole. */
function pointsOf(record: FeedRecord | null, set: ScoringSet, position: SlotPosition): number | null {
  return record === null ? null : pointsAt(record.stats, set, position).total;
}

/** A stat's value in one feed's record: 0 where a whole record leaves it out, null where there
 *  is no whole record. */
function statOf(record: FeedRecord | null, stat: string): number | null {
  return record?.stats == null ? null : (record.stats[stat] ?? 0);
}
