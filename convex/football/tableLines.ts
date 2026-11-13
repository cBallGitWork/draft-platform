// The lines across a real competition's table, held per competition as data, not built into the
// table (spec/18, The table: "League table needs relegation/Europe lines", Craig, 10 Nov 2026, on
// #1032; "How many places each line marks is held per competition", `S18.5`). A competition added
// later (SPEC.md, Later: Other leagues) is one more entry here, as its tie-breaks are (tieBreaks.ts).

/** What a line marks: where the Champions League places end, where the other European places
 *  (the Europa and Conference Leagues) end, and where the relegation places start. */
export type TableLine = "championsLeague" | "otherEurope" | "relegation";

/** Each competition's lines, each the place it is drawn under. The Premier League's are its
 *  approved picture's (docs/design/approved/premier-league/, Craig, "Looks good", 10 Nov 2026):
 *  under 5th, under 7th, and under 17th, its three relegated clubs below. */
export const COMPETITION_TABLE_LINES = {
  premierLeague: { championsLeague: 5, otherEurope: 7, relegation: 17 },
} as const satisfies Record<string, Record<TableLine, number>>;
