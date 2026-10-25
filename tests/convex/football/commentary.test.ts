import { expect, test } from "vitest";
import type { RawBootstrap } from "../../../convex/football/fpl";
import { codesByOpta } from "../../../convex/football/feedIds";
import { UNLISTED_NAME, writeCommentary, type CommentaryInput, type MatchHeader } from "../../../convex/football/commentary";
import { commentaryLines, type CommentaryLine } from "../../../convex/football/plCommentary";
import {
  FINISHED_MATCHES,
  recordedCommentary,
  recordedFplPlayers,
  recordedSheets,
} from "../../support/recorded/commentary.payloads";
import {
  LIVE_COMMENTARY,
  recordedLiveCommentary,
  recordedLiveFplPlayers,
  recordedLiveSheets,
} from "../../support/recorded/live.payloads";

/** Ipswich 1–1 Nott'm Forest as the full-time read's header gives it. */
const LIVE_HEADER: MatchHeader = { home: "IPS", away: "NFO", homeGoals: 1, awayGoals: 1 };
/** The live match's men the tests name, by FPL code (each an FPL `web_name`). */
const LIVE_CODE = { williams: 215136, munoz: 247348, enciso: 474120 } as const;
/** Ipswich v Forest's lines the replay follows, by feed id. */
const LIVE_LINE = { firstGoal: 2878012, droppedFoul: 2878263 } as const;
/** Made-up points for the full-time line: scoring is not this file's (the caller passes them). */
const FULL_TIME_POINTS = [
  { code: LIVE_CODE.williams, points: 8 },
  { code: LIVE_CODE.enciso, points: 7 },
];

function namesOf(elements: RawBootstrap["elements"]): Map<number, string> {
  return new Map(elements.map((element) => [element.code, element.web_name]));
}

const liveInput: CommentaryInput = {
  header: LIVE_HEADER,
  nameByCode: namesOf(recordedLiveFplPlayers()),
  fullTimePoints: FULL_TIME_POINTS,
};

/** One live read of Ipswich v Forest, mapped and written. */
function writtenLive(read: keyof typeof LIVE_COMMENTARY, input: CommentaryInput = liveInput) {
  const fplPlayers = recordedLiveFplPlayers();
  const { lines } = commentaryLines(recordedLiveSheets(), recordedLiveCommentary(read).events.content, codesByOpta(fplPlayers));
  return writeCommentary(lines, input);
}

function textOf(written: ReturnType<typeof writeCommentary>, sourceId: number): string | undefined {
  return written.lines.find((line) => line.sourceId === sourceId)?.text;
}

/** One made-up line, for the kinds the recordings lack. */
function lineOf(change: Partial<CommentaryLine>): CommentaryLine {
  return { id: 1, minute: 62, addedMinute: 0, type: "goal", text: "", playerCodes: [LIVE_CODE.williams], ...change };
}

test("the live match's full-time read writes every line, kick-off to full time, as the golden file has them", async () => {
  const written = writtenLive("final");

  expect(written.unworded).toEqual([]);
  await expect(`${written.lines.map((line) => line.text).join("\n")}\n`).toMatchFileSnapshot(
    "../../support/golden/ipswich-forest.commentary.txt",
  );
});

test("the kick-off and full-time lines carry the clubs, the score and each man's points as given", () => {
  const texts = writtenLive("final").lines.map((line) => line.text);

  expect(texts[0]).toBe("FT IPS 1–1 NFO: N.Williams 8, Enciso 7");
  expect(texts.slice(-2)).toEqual(["KO IPS v NFO", "Lineups out"]);
  expect(texts).toContain("46' Second half");
  expect(texts).toContain("45+3' HT");
});

test("replayed, the first goal names only the scorer until a later read names the assister", () => {
  expect(textOf(writtenLive("goal"), LIVE_LINE.firstGoal)).toBe("13' GOAL N.Williams");
  expect(textOf(writtenLive("final"), LIVE_LINE.firstGoal)).toBe("13' GOAL N.Williams, assist Muñoz");
});

test("replayed, a line the feed drops is gone from the next read's commentary", () => {
  expect(textOf(writtenLive("withVanished"), LIVE_LINE.droppedFoul)).toBeDefined();
  expect(textOf(writtenLive("final"), LIVE_LINE.droppedFoul)).toBeUndefined();
});

test("before full time no full-time line is written", () => {
  expect(writtenLive("withVanished").lines.map((line) => line.text).filter((text) => text.startsWith("FT"))).toEqual([]);
});

test("with no points to list, the full-time line is the score alone", () => {
  expect(writtenLive("final", { ...liveInput, fullTimePoints: [] }).lines[0]?.text).toBe("FT IPS 1–1 NFO");
});

test.each(FINISHED_MATCHES)("every line of recorded match %i is worded, but the second half's end", (plId) => {
  const fplPlayers = recordedFplPlayers();
  const stream = recordedCommentary(plId).events.content;
  const { lines } = commentaryLines(recordedSheets(plId), stream, codesByOpta(fplPlayers));

  const written = writeCommentary(lines, { header: LIVE_HEADER, nameByCode: namesOf(fplPlayers), fullTimePoints: [] });

  expect(written.unworded).toEqual([]);
  expect(written.lines.map((line) => line.sourceId)).toEqual(stream.filter((line) => line.type !== "end 2").map((line) => line.id));
});

test.each([
  [{ type: "penalty goal" }, "62' GOAL N.Williams, penalty"],
  [{ type: "own goal" }, "62' OWN GOAL N.Williams"],
  [{ type: "VAR cancelled goal", playerCodes: [LIVE_CODE.williams, LIVE_CODE.munoz] }, "62' NO GOAL N.Williams, VAR"],
  [{ type: "secondyellow card", minute: 90, addedMinute: 3 }, "90+3' RED N.Williams, second yellow"],
  [{ type: "red card" }, "62' RED N.Williams"],
  [{ type: "post" }, "62' SHOT N.Williams, off the woodwork"],
  [{ type: "penalty won" }, "62' PENALTY won by N.Williams"],
  [{ type: "penalty lost" }, "62' PENALTY conceded by N.Williams"],
  [{ type: "player retired" }, "62' OFF INJURED N.Williams"],
  [{ type: "contentious referee decisions", playerCodes: [] }, "62' VAR"],
])("a %o line the live match lacks is written %j", (change, expected) => {
  expect(writeCommentary([lineOf(change)], liveInput).lines.map((line) => line.text)).toEqual([expected]);
});

test("a type with no wording is reported, not written and not dropped unseen", () => {
  const unknown = lineOf({ type: "penalty saved" });

  expect(writeCommentary([unknown], liveInput)).toEqual({ lines: [], unworded: [unknown] });
});

test("a man FPL does not list is written as unknown", () => {
  expect(writeCommentary([lineOf({ playerCodes: [null] })], liveInput).lines[0]?.text).toBe(`62' GOAL ${UNLISTED_NAME}`);
});

test("a man with no name given, or a part the line lacks, throws rather than write a wrong line", () => {
  expect(() => writeCommentary([lineOf({ playerCodes: [1] })], liveInput)).toThrow("no name given for FPL code 1");
  expect(() => writeCommentary([lineOf({ type: "substitution" })], liveInput)).toThrow("names 1 men, not a man 2");
});
