// The admin's ranking file read and checked (spec/04, The queue and the ranking; #1093): a CSV of
// `player,rank` (or `player;rank`, S04.23), one player a line, `player` his Sportmonks player id,
// not FPL's code (S04.8; Craig, 9 Nov 2026, on #1196). No two lines may share a player or a rank;
// gaps between ranks are fine, as auto-pick needs only the order. Pure: whether each id is a player
// the site holds is draftRanking.ts's check.

/** One line of the file, read: the player's Sportmonks id and his rank. */
export type RankedLine = { line: number; player: number; rank: number };

/** A line the file can't be stored with, and why, in the words the admin is shown. */
export type RankingProblem = { line: number; words: string };

/** Why a line is bad, in the words the admin is shown. */
export const rankingProblems = {
  notTwoColumns: "isn't a player and a rank, with a comma or a semicolon between.",
  badPlayer: (player: string) => `has "${player}" as its player, which isn't a Sportmonks player id.`,
  badRank: (rank: string) => `has "${rank}" as its rank, which isn't a whole number of 1 or more.`,
  samePlayer: (player: number, line: number) => `ranks player ${player}, who is also ranked on line ${line}.`,
  sameRank: (rank: number, line: number) => `has rank ${rank}, which line ${line} has too.`,
  unknownPlayer: (player: number) => `has player ${player}, and no player has that Sportmonks id.`,
};

/** Digits a number holds exactly: past 2^53 two different ranks could read as the same. */
const isWhole = (text: string) => /^\d+$/.test(text) && Number.isSafeInteger(Number(text));

/** Excel's byte-order mark, which it writes at the start of a CSV it saves as UTF-8 (S04.23). */
export const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** What divides a line's values: ";" when the whole file uses it, as Excel saves a CSV where the
 *  decimal point is a comma, otherwise "," (S04.23). */
const separatorOf = (text: string) => (text.includes(",") || !text.includes(";") ? "," : ";");

/** A line naming the columns, which a spreadsheet writes first. */
const isHeader = (fields: string[]) => fields.length === 2 && fields[0].toLowerCase() === "player" && fields[1].toLowerCase() === "rank";

/** The file's lines, each read or its problem, numbered from 1 as a spreadsheet numbers them. A
 *  byte-order mark at the start is ignored, and ";" divides the values when the whole file uses it
 *  (S04.23). Blank lines, and a spreadsheet's empty rows (a lone separator), are passed over, and a
 *  first line naming the columns is the header. */
export function readRankingFile(text: string): { ranked: RankedLine[]; problems: RankingProblem[] } {
  const ranked: RankedLine[] = [];
  const problems: RankingProblem[] = [];
  const lineOfPlayer = new Map<number, number>();
  const lineOfRank = new Map<number, number>();
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text;
  const separator = separatorOf(body);
  const filled = body
    .split(/\r?\n/)
    .map((raw, index) => ({ line: index + 1, fields: raw.split(separator).map((field) => field.trim()) }))
    .filter(({ fields }) => fields.join("") !== "");
  if (filled.length > 0 && isHeader(filled[0].fields)) filled.shift();
  for (const { line, fields } of filled) {
    const problem = (words: string) => problems.push({ line, words });
    if (fields.length !== 2) {
      problem(rankingProblems.notTwoColumns);
      continue;
    }
    const [playerText, rankText] = fields;
    const playerOk = isWhole(playerText);
    const rankOk = isWhole(rankText) && Number(rankText) >= 1;
    if (!playerOk) problem(rankingProblems.badPlayer(playerText));
    if (!rankOk) problem(rankingProblems.badRank(rankText));
    if (!playerOk || !rankOk) continue;
    const player = Number(playerText);
    const rank = Number(rankText);
    const playerLine = lineOfPlayer.get(player);
    const rankLine = lineOfRank.get(rank);
    if (playerLine !== undefined) problem(rankingProblems.samePlayer(player, playerLine));
    if (rankLine !== undefined) problem(rankingProblems.sameRank(rank, rankLine));
    if (playerLine !== undefined || rankLine !== undefined) continue;
    lineOfPlayer.set(player, line);
    lineOfRank.set(rank, line);
    ranked.push({ line, player, rank });
  }
  return { ranked, problems };
}
