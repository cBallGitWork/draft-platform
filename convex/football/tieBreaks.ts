// What splits clubs level on points, held per competition as data, not built into the table
// (spec/18, The table: "the real competition's own tie-break order, held per competition as data,
// not built in": "but remember to scale for other leagues", Craig, 1 Nov 2026; #899). A competition
// added later (SPEC.md, Later: Other leagues) is one more entry here; the table (plTable.ts) applies
// whichever order it is given and needs no change.

/** Every tie-break a real competition's table can apply, higher first in each (a draft league's
 *  own table has its own, `convex/table/standings.ts`):
 *  - `goalDifference`: goals scored less goals conceded, in every match;
 *  - `goalsScored`: goals scored, in every match;
 *  - `headToHeadPoints`: points from the matches between the clubs still level;
 *  - `headToHeadAwayGoals`: goals scored as the away club in those matches. */
export type CompetitionTieBreak = "goalDifference" | "goalsScored" | "headToHeadPoints" | "headToHeadAwayGoals";

/** The head-to-head tie-breaks, skipped, the clubs staying level on them, while any match between
 *  the clubs level is unplayed (spec/18: "if one of their matches is never played, head-to-head is
 *  skipped and they stay level"). */
export const HEAD_TO_HEAD_TIE_BREAKS: ReadonlySet<CompetitionTieBreak> = new Set(["headToHeadPoints", "headToHeadAwayGoals"]);

/** When a competition's head-to-head steps apply: all season, or once every match is played. */
export type HeadToHeadTiming = "allSeason" | "seasonOver";

/** A competition's tie-breaking: its order, and when its head-to-head steps apply. */
export type CompetitionTieBreaking = { order: readonly CompetitionTieBreak[]; headToHead: HeadToHeadTiming };

/** Each competition's order, applied after points. Clubs level after the last share a position.
 *
 *  The Premier League's is its Handbook, Section C (2024/25 wording, as the Premier League quoted
 *  it on 4 Dec 2024, premierleague.com/news/4183163; checked 25 Oct 2026), and spec/18's "rule
 *  C.17: points, goal difference, goals scored, then head-to-head between the tied clubs, then a
 *  play-off" (Craig, 1 Nov 2026: "Follow the real PL rule"):
 *    C.5     "the Club with the higher or highest Goal Difference";
 *    C.6     "the Club having scored the most goals in League Matches";
 *    C.17.1  "the total points scored by the relevant Clubs" in the league matches between them;
 *    C.17.2  "the Club scoring the higher number of goals whilst the Visiting Club in Head-to-Head
 *            Matches";
 *    C.17.3  "a play-off on a neutral ground", set by the Board: not a league match, so not in the
 *            results, and clubs level after C.17.2 share a position (C.7: "they shall be deemed to
 *            occupy the same position in the League Table"). */
export const COMPETITION_TIE_BREAKS = {
  premierLeague: {
    order: ["goalDifference", "goalsScored", "headToHeadPoints", "headToHeadAwayGoals"],
    // C.17 is the end of the season's: "Follow the real PL rule" (Craig, 1 Nov 2026; #899).
    headToHead: "seasonOver",
  },
} as const satisfies Record<string, CompetitionTieBreaking>;
