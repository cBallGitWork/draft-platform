import { expect, test } from "vitest";
import { codesByOpta } from "../../../convex/football/feedIds";
import { commentaryLines, type CommentaryLine } from "../../../convex/football/plCommentary";
import type { RawPlCommentaryLine } from "../../../convex/football/premierLeague";
import {
  COMMENTARY_MATCH,
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
import { FULL_STATS } from "../../support/recorded/gw6.payloads";

const codeByOpta = codesByOpta(recordedFplPlayers());
/** FPL codes of the men the tests name. */
const CODE = {
  belloumi: FULL_STATS.belloumi.code,
  stroud: 608227,
  gelhardt: 462635,
  yarmoliuk: 508395,
  janelt: 204580,
} as const;

/** One recorded match's stream mapped, with FPL's players as recorded or as given. */
function mapped(plId: number, codes: ReadonlyMap<string, number> = codeByOpta, stream = recordedCommentary(plId)) {
  return commentaryLines(recordedSheets(plId), stream.events.content, codes);
}

/** The mapped line with this feed id. */
function lineOf(lines: CommentaryLine[], id: number): CommentaryLine {
  const line = lines.find((each) => each.id === id);
  if (line === undefined) throw new Error(`no line ${id}`);
  return line;
}

/** Hull v Everton's stream with one line changed, by its feed id. */
function hullEvertonWith(id: number, change: (line: RawPlCommentaryLine) => void) {
  const stream = recordedCommentary(COMMENTARY_MATCH.hullEverton);
  const line = stream.events.content.find((each) => each.id === id);
  if (line === undefined) throw new Error(`no line ${id}`);
  change(line);
  return () => mapped(COMMENTARY_MATCH.hullEverton, codeByOpta, stream);
}

/** One live read of Ipswich v Forest mapped. */
function mappedLive(read: keyof typeof LIVE_COMMENTARY) {
  return commentaryLines(recordedLiveSheets(), recordedLiveCommentary(read).events.content, codesByOpta(recordedLiveFplPlayers()));
}

/** Ipswich v Forest, read live: its first goal's line, and the foul whose line the feed later dropped. */
const LIVE_LINE = { firstGoal: 2878012, droppedFoul: 2878263 };
const LIVE_CODE = { williams: 215136, munoz: 247348 } as const;

const HULL_EVERTON_LINE = { equaliser: 2855247, belloumiOn: 2855172, firstHalfAddedMiss: 2855025, lineups: 2854691 };

test("a goal's line keeps its minute, type and words, and names the scorer then the assister by FPL code", () => {
  const { lines } = mapped(COMMENTARY_MATCH.hullEverton);

  expect(lineOf(lines, HULL_EVERTON_LINE.equaliser)).toEqual({
    id: HULL_EVERTON_LINE.equaliser,
    minute: 74,
    addedMinute: 0,
    type: "goal",
    text: expect.stringMatching(/^Goal! Hull City 2, Everton 2\. Mohamed Belloumi .* Assisted by Elliot Stroud\.$/),
    playerCodes: [CODE.belloumi, CODE.stroud],
  });
});

test("a substitution names the man coming on, then the man going off", () => {
  const { lines } = mapped(COMMENTARY_MATCH.hullEverton);
  expect(lineOf(lines, HULL_EVERTON_LINE.belloumiOn).playerCodes).toEqual([CODE.belloumi, CODE.gelhardt]);
});

test("a straight red and a second yellow each name the man sent off", () => {
  const { lines } = mapped(COMMENTARY_MATCH.brentfordLiverpool);
  const codesOf = (type: string) => lines.filter((line) => line.type === type).map((line) => line.playerCodes);

  expect(codesOf("red card")).toEqual([[CODE.yarmoliuk]]);
  expect(codesOf("secondyellow card")).toEqual([[CODE.janelt]]);
});

test("a line in added time carries the half's minute and the added minute apart", () => {
  const { lines } = mapped(COMMENTARY_MATCH.hullEverton);
  expect(lineOf(lines, HULL_EVERTON_LINE.firstHalfAddedMiss)).toMatchObject({ minute: 45, addedMinute: 2 });
});

test("the lineups' line has no minute and names no one", () => {
  const { lines } = mapped(COMMENTARY_MATCH.hullEverton);
  expect(lineOf(lines, HULL_EVERTON_LINE.lineups)).toMatchObject({ minute: null, addedMinute: null, playerCodes: [] });
});

test.each(FINISHED_MATCHES)("every line of recorded match %i comes through in the feed's order, every man an FPL code", (plId) => {
  const stream = recordedCommentary(plId).events.content;

  const { lines, unmatched } = mapped(plId);

  expect(lines.map((line) => line.id)).toEqual(stream.map((line) => line.id));
  expect(lines.map((line) => line.playerCodes.length)).toEqual(stream.map((line) => line.playerIds?.length ?? 0));
  expect(lines.flatMap((line) => line.playerCodes)).not.toContain(null);
  expect(unmatched).toEqual([]);
});

test.each(Object.values(LIVE_COMMENTARY))("every line of the live match's %s read comes through in the feed's order, every man an FPL code", (read) => {
  const stream = recordedLiveCommentary(read).events.content;

  const { lines, unmatched } = mappedLive(read);

  expect(lines.map((line) => line.id)).toEqual(stream.map((line) => line.id));
  expect(lines.flatMap((line) => line.playerCodes)).not.toContain(null);
  expect(unmatched).toEqual([]);
});

test("a live goal's line can name only the scorer at first, and a later read rewords it to name the assister", () => {
  expect(lineOf(mappedLive("goal").lines, LIVE_LINE.firstGoal)).toMatchObject({
    text: expect.not.stringContaining("Assisted"),
    playerCodes: [LIVE_CODE.williams],
  });
  expect(lineOf(mappedLive("final").lines, LIVE_LINE.firstGoal)).toMatchObject({
    text: expect.stringMatching(/Assisted by Daniel Muñoz with a cross\.$/),
    playerCodes: [LIVE_CODE.williams, LIVE_CODE.munoz],
  });
});

// A record of the feed, not of our code: `commentaryLines` maps one read at a time. It earns its keep
// at the seam of whatever shows the commentary, which must replace each read, never append it.
test("a line the feed drops mid-match is in an earlier read and missing from a later one", () => {
  expect(mappedLive("withVanished").lines.map((line) => line.id)).toContain(LIVE_LINE.droppedFoul);
  expect(mappedLive("final").lines.map((line) => line.id)).not.toContain(LIVE_LINE.droppedFoul);
});

test("a man FPL does not list keeps his place in each line as null, and is reported", () => {
  const withoutBelloumi = codesByOpta(recordedFplPlayers().filter((element) => element.code !== CODE.belloumi));

  const { lines, unmatched } = mapped(COMMENTARY_MATCH.hullEverton, withoutBelloumi);

  expect(lineOf(lines, HULL_EVERTON_LINE.equaliser).playerCodes).toEqual([null, CODE.stroud]);
  expect(unmatched).toEqual([{ plPlayerId: FULL_STATS.belloumi.pl, name: "Mohamed Belloumi", opta: `p${CODE.belloumi}` }]);
});

test("a man FPL does not list whom no line names is not reported", () => {
  const withoutPhillips = codesByOpta(recordedFplPlayers().filter((element) => element.code !== FULL_STATS.phillips.code));
  expect(mapped(COMMENTARY_MATCH.hullEverton, withoutPhillips).unmatched).toEqual([]);
});

test("a line naming a man neither team sheet names throws, naming him and the line", () => {
  const map = hullEvertonWith(HULL_EVERTON_LINE.equaliser, (line) => line.playerIds!.push(999999));
  expect(map).toThrow(`sheets do not name player 999999 (line ${HULL_EVERTON_LINE.equaliser})`);
});

test.each(["HT", "45+", "", "74'"])("a minute written %j throws, naming the line", (label) => {
  const map = hullEvertonWith(HULL_EVERTON_LINE.equaliser, (line) => (line.time!.label = label));
  expect(map).toThrow(`commentary line ${HULL_EVERTON_LINE.equaliser} has the minute ${JSON.stringify(label)}`);
});
