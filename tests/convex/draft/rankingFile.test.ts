import { describe, expect, test } from "vitest";
import { rankingProblems, readRankingFile } from "../../../convex/draft/rankingFile";

// The admin's ranking file read and checked (spec/04, The queue and the ranking; #1093): a CSV of
// `code,rank`, no shared players or ranks, gaps fine, every bad line listed with its number.

describe("a good file", () => {
  test("each line is read as a code and a rank, numbered as a spreadsheet numbers them", () => {
    expect(readRankingFile("1001,1\n1002,2")).toEqual({
      ranked: [
        { line: 1, code: 1001, rank: 1 },
        { line: 2, code: 1002, rank: 2 },
      ],
      problems: [],
    });
  });

  test("a first line naming the columns is the header, and blank lines, empty rows and spaces are passed over", () => {
    const { ranked, problems } = readRankingFile("\nCode,Rank\r\n 1001 , 1 \r\n,\r\n1002,2\r\n");
    expect(problems).toEqual([]);
    expect(ranked.map(({ line, code }) => [line, code])).toEqual([
      [3, 1001],
      [5, 1002],
    ]);
  });

  test("ranks may have gaps, and come in any order", () => {
    expect(readRankingFile("1001,5\n1002,1\n1003,12").problems).toEqual([]);
  });
});

describe("bad lines, each reported with its number", () => {
  test("a line that isn't a code and a rank", () => {
    expect(readRankingFile("1001,1\n1002\n1003,3,x").problems).toEqual([
      { line: 2, words: rankingProblems.notTwoColumns },
      { line: 3, words: rankingProblems.notTwoColumns },
    ]);
  });

  test("a code that isn't a whole number", () => {
    expect(readRankingFile("Saka,1\n10.5,2").problems).toEqual([
      { line: 1, words: rankingProblems.badCode("Saka") },
      { line: 2, words: rankingProblems.badCode("10.5") },
    ]);
  });

  test.each(["0", "-1", "1.5", "first", "", "99999999999999999999"])("a rank of %j", (rank) => {
    expect(readRankingFile(`1001,${rank}`).problems).toEqual([{ line: 1, words: rankingProblems.badRank(rank) }]);
  });

  test("a header anywhere but the first line is a bad line", () => {
    expect(readRankingFile("1001,1\ncode,rank").problems).toEqual([
      { line: 2, words: rankingProblems.badCode("code") },
      { line: 2, words: rankingProblems.badRank("rank") },
    ]);
  });

  test("a player ranked twice", () => {
    expect(readRankingFile("1001,1\n1002,2\n1001,3").problems).toEqual([{ line: 3, words: rankingProblems.sameCode(1001, 1) }]);
  });

  test("two players sharing a rank", () => {
    expect(readRankingFile("1001,12\n1002,12").problems).toEqual([{ line: 2, words: rankingProblems.sameRank(12, 1) }]);
  });

  test("a bad line is left out of what was read", () => {
    expect(readRankingFile("1001,1\n1001,2\nx,3").ranked).toEqual([{ line: 1, code: 1001, rank: 1 }]);
  });
});
