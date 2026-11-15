import { beforeEach, expect, test, vi } from "vitest";
import { anyApi } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Feed } from "../../../convex/shared/feedSchedule";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { feedAt, recordRun, asAdmin } from "../../support/convex/feeds.harness";
import { actingAs, ANN } from "../../support/convex/leagues.harness";
import { nameOf, PALMER, STARTERS } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// Regression BG-223 to BG-227 (#2300): player news (spec/21), its notes on the player card, its
// Mail letters, the admin's Hide and the news job on the feeds page.
//
// Player news isn't built yet (spec/21, "After the mini beta"), so every test here is marked
// expected to fail: once its build lands, each fails as passing and is unmarked then. Where a note
// is kept, what the news feed is called and how the admin hides one are the build's to choose, so
// the guesses each sit in one place below, `NEWS`, `writeNote` and `hideNote`, for it to change.
// BG-223 and BG-224 belong in a browser (E2E), which waits on `npm run e2e` (#2288), so they read
// the card's own query here; BG-223's Sportmonks injury waits on the injuries feed (spec/20's
// trial), so only its notes are checked.

const NEWS = "news" as Feed;
/** Ann's player, the catalogue's Saka. */
const SAKA = STARTERS[0];

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
  await w.t.run(async (ctx) => {
    await ctx.db.insert("squadPlayers", { leagueId: w.leagueId, teamId: w.bobsTeam, playerCode: PALMER });
    // The held fixtures' away club, which the card names among his next matches.
    await ctx.db.insert("clubs", { code: 2, name: "Chelsea", shortName: "CHE" });
  });
});

type Note = { playerCode: number; kind: "match" | "news"; at: number; source: string; text: string };
/** A note on `playerCode`, `hoursAgo` old, as the news job writes it. */
const writeNote = (playerCode: number, hoursAgo: number, kind: Note["kind"] = "news") =>
  w.t.run((ctx) =>
    ctx.db.insert("playerNotes" as never, { playerCode, kind, at: Date.now() - hoursAgo * HOUR_MS, source: `https://news.example.com/${playerCode}/${hoursAgo}`, text: `Note ${hoursAgo}` } as never),
  );
/** `person` presses Hide on the note. */
const hideNote = (person: Awaited<ReturnType<typeof actingAs>>, noteId: string) => person.mutation(anyApi.playerNews.notes.hide, { noteId });

/** `playerCode`'s card as `email` reads it now, with the notes its build adds. */
const cardOf = async (email: string, playerCode: number) => {
  const card = await (await actingAs(w.t, email)).query(api.playerCard.playerCard.card, { leagueId: w.leagueId, playerCode, now: Date.now() });
  return card as typeof card & { notes?: Note[] };
};

test.fails("BG-223 S21.1 S21.2: the card's News holds his three latest notes, newest first, each with its date and link", async () => {
  for (const hoursAgo of [5, 1, 4, 2, 3]) await writeNote(SAKA, hoursAgo);

  const notes = (await cardOf(ANN, SAKA))?.notes;
  expect(notes?.map(({ text }) => text)).toEqual(["Note 1", "Note 2", "Note 3"]);
  for (const note of notes ?? []) expect(note).toEqual(expect.objectContaining({ at: expect.any(Number), source: expect.stringMatching(/^https:/) }));
});

test.fails("BG-224 S21.5: only the admin hides a note, and a hidden note is gone from the card", async () => {
  const noteId = await writeNote(SAKA, 1);

  await expectRefused(hideNote(await actingAs(w.t, ANN), noteId), refusals.notAdmin);
  await hideNote(await asAdmin(w.t), noteId);
  expect((await cardOf(ANN, SAKA))?.notes).toEqual([]);
});

test.fails("BG-225 S21.3: one Mail letter for real news about a player in your squad; none for another squad's or for a match note", async () => {
  await writeNote(SAKA, 1);
  await writeNote(PALMER, 1);
  await writeNote(SAKA, 2, "match");

  const letters = (await w.lettersTo(ANN)).filter(({ subject, body }) => `${subject} ${body}`.includes(nameOf(SAKA)) || `${subject} ${body}`.includes(nameOf(PALMER)));
  expect(letters).toHaveLength(1);
  expect(letters[0].subject).toContain(nameOf(SAKA));
});

test.fails("BG-227 S21.4: a news job stalled three hours shows late on the feeds page, and the card keeps its last notes", async () => {
  const now = Date.now();
  await writeNote(SAKA, 4);
  await recordRun(w.t, NEWS, now - 3 * HOUR_MS);
  vi.setSystemTime(now);

  expect((await feedAt(w.t, NEWS, now)).state).toBe("late");
  expect((await cardOf(ANN, SAKA))?.notes).toHaveLength(1);
});
