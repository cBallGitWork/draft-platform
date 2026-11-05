// The admin's ranking file read and checked (spec/04, The queue and the ranking; #1093): a CSV of
// `code,rank`, one player a line, `code` his FPL code (Craig, 4 Nov 2026, on #1093). No two lines
// may share a player or a rank; gaps between ranks are fine, as auto-pick needs only the order.
// Pure: whether each code is a player the football sync holds is draftRanking.ts's check.

/** One line of the file, read: the player's FPL code and his rank. */
export type RankedLine = { line: number; code: number; rank: number };

/** A line the file can't be stored with, and why, in the words the admin is shown. */
export type RankingProblem = { line: number; words: string };

/** Why a line is bad, in the words the admin is shown. */
export const rankingProblems = {
  notTwoColumns: "isn't a code and a rank, with a comma between.",
  badCode: (code: string) => `has "${code}" as its code, which isn't an FPL player code.`,
  badRank: (rank: string) => `has "${rank}" as its rank, which isn't a whole number of 1 or more.`,
  sameCode: (code: number, line: number) => `ranks player ${code}, who is also ranked on line ${line}.`,
  sameRank: (rank: number, line: number) => `has rank ${rank}, which line ${line} has too.`,
  unknownCode: (code: number) => `has code ${code}, and no player has that code.`,
};

/** Digits a number holds exactly: past 2^53 two different ranks could read as the same. */
const isWhole = (text: string) => /^\d+$/.test(text) && Number.isSafeInteger(Number(text));

/** A line naming the columns, which a spreadsheet writes first. */
const isHeader = (fields: string[]) => fields.length === 2 && fields[0].toLowerCase() === "code" && fields[1].toLowerCase() === "rank";

/** The file's lines, each read or its problem, numbered from 1 as a spreadsheet numbers them. Blank
 *  lines, and a spreadsheet's empty rows (a lone comma), are passed over, and a first line naming
 *  the columns is the header. */
export function readRankingFile(text: string): { ranked: RankedLine[]; problems: RankingProblem[] } {
  const ranked: RankedLine[] = [];
  const problems: RankingProblem[] = [];
  const lineOfCode = new Map<number, number>();
  const lineOfRank = new Map<number, number>();
  const filled = text
    .split(/\r?\n/)
    .map((raw, index) => ({ line: index + 1, fields: raw.split(",").map((field) => field.trim()) }))
    .filter(({ fields }) => fields.join("") !== "");
  if (filled.length > 0 && isHeader(filled[0].fields)) filled.shift();
  for (const { line, fields } of filled) {
    const problem = (words: string) => problems.push({ line, words });
    if (fields.length !== 2) {
      problem(rankingProblems.notTwoColumns);
      continue;
    }
    const [codeText, rankText] = fields;
    const codeOk = isWhole(codeText);
    const rankOk = isWhole(rankText) && Number(rankText) >= 1;
    if (!codeOk) problem(rankingProblems.badCode(codeText));
    if (!rankOk) problem(rankingProblems.badRank(rankText));
    if (!codeOk || !rankOk) continue;
    const code = Number(codeText);
    const rank = Number(rankText);
    const codeLine = lineOfCode.get(code);
    const rankLine = lineOfRank.get(rank);
    if (codeLine !== undefined) problem(rankingProblems.sameCode(code, codeLine));
    if (rankLine !== undefined) problem(rankingProblems.sameRank(rank, rankLine));
    if (codeLine !== undefined || rankLine !== undefined) continue;
    lineOfCode.set(code, line);
    lineOfRank.set(rank, line);
    ranked.push({ line, code, rank });
  }
  return { ranked, problems };
}
