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

const WHOLE = /^\d+$/;

/** A line naming the columns, which a spreadsheet writes first. */
const isHeader = (fields: string[]) => fields.length === 2 && fields[0].toLowerCase() === "code" && fields[1].toLowerCase() === "rank";

/** The file's lines, each read or its problem, numbered from 1 as a spreadsheet numbers them. Blank
 *  lines are passed over, and a first line naming the columns is the header. */
export function readRankingFile(text: string): { ranked: RankedLine[]; problems: RankingProblem[] } {
  const ranked: RankedLine[] = [];
  const problems: RankingProblem[] = [];
  const lineOfCode = new Map<number, number>();
  const lineOfRank = new Map<number, number>();
  let seenAny = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "") return;
    const fields = raw.split(",").map((field) => field.trim());
    const first = !seenAny;
    seenAny = true;
    if (first && isHeader(fields)) return;
    const problem = (words: string) => problems.push({ line, words });
    if (fields.length !== 2) return problem(rankingProblems.notTwoColumns);
    const [codeText, rankText] = fields;
    const codeOk = WHOLE.test(codeText);
    const rankOk = WHOLE.test(rankText) && Number(rankText) >= 1;
    if (!codeOk) problem(rankingProblems.badCode(codeText));
    if (!rankOk) problem(rankingProblems.badRank(rankText));
    if (!codeOk || !rankOk) return;
    const code = Number(codeText);
    const rank = Number(rankText);
    const codeLine = lineOfCode.get(code);
    const rankLine = lineOfRank.get(rank);
    if (codeLine !== undefined) problem(rankingProblems.sameCode(code, codeLine));
    if (rankLine !== undefined) problem(rankingProblems.sameRank(rank, rankLine));
    if (codeLine !== undefined || rankLine !== undefined) return;
    lineOfCode.set(code, line);
    lineOfRank.set(rank, line);
    ranked.push({ line, code, rank });
  });
  return { ranked, problems };
}
