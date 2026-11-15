import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { draftOrderLetter, draftPickerLetter, draftStartDateLetter } from "../../../convex/mail/draftLetterWords";
import { letterAsRead, tellIn } from "../../../convex/mail/letterMoments";
import { DAY_MS } from "../../../convex/shared/time";
import { draftSteps } from "../../support/convex/draft.harness";
import { COMMISSIONER, type TestConvex, ANN, BOB, TEAM_1, TEAM_2, freshLeague } from "../../support/convex/leagues.harness";

// The commissioner's changes before the draft each send the whole league a letter (spec/04, Mail,
// S04.31): setting the draft order, each draw of it at random, setting or clearing the start date,
// and marking or unmarking a team "I'll pick for this one" (Craig, 15 Nov 2026, on #2149: "All four
// actions file a letter"). The draft's other letters are draftLetters.test.ts's.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const { as, setSquadSize } = draftSteps(() => ({ t, leagueId }));
const letters = () =>
  t.run(async (ctx) =>
    (await ctx.db.query("letters").collect()).map((row) => ({ to: row.to, ...letterAsRead(row, undefined), read: row.readAt !== undefined })),
  );
/** The letters filed since `before` of them were. */
const lettersSince = async (before: number) => (await letters()).slice(before);
/** `words` to the commissioner, read, as he made the change, then to each manager, unread. */
const toEveryone = (words: { subject: string; body: string }) => [
  { to: COMMISSIONER, ...words, read: true },
  { to: ANN, ...words, read: false },
  { to: BOB, ...words, read: false },
];

beforeEach(async () => {
  ({ t, leagueId, teams } = await freshLeague({ managers: [ANN, BOB], maxTeams: 5 }));
  // A start date needs a squad size, as the draft's rounds are its most players.
  await setSquadSize(2);
});

test("S04.31: setting the draft order files a letter to everyone in the league, naming the order", async () => {
  const before = (await letters()).length;
  await (await as(COMMISSIONER)).mutation(api.draft.draftOrder.setTeamOrder, { leagueId, teamIds: [teams[1], teams[0]] });

  expect(await lettersSince(before)).toEqual(toEveryone(draftOrderLetter(COMMISSIONER, [TEAM_2, TEAM_1], false)));
});

test("S04.31: each draw at random files its own letter, naming the order drawn", async () => {
  const before = (await letters()).length;
  const commissioner = await as(COMMISSIONER);
  await commissioner.mutation(api.draft.draftOrder.drawTeamOrder, { leagueId });
  await commissioner.mutation(api.draft.draftOrder.drawTeamOrder, { leagueId });

  const filed = await lettersSince(before);
  expect(filed).toHaveLength(6);
  const drawn = (await commissioner.query(api.draft.draftOrder.teamOrder, { leagueId })).teams.map(({ name }) => name);
  expect(filed.slice(3)).toEqual(toEveryone(draftOrderLetter(COMMISSIONER, drawn, true)));
});

test("S04.31: setting the start date, then clearing it, each files a letter to everyone in the league", async () => {
  const startsAt = Date.now() + DAY_MS;
  const before = (await letters()).length;
  const commissioner = await as(COMMISSIONER);
  await commissioner.mutation(api.draft.draftStart.setStart, { leagueId, startsAt });
  await commissioner.mutation(api.draft.draftStart.setStart, { leagueId, startsAt: null });

  expect(await lettersSince(before)).toEqual([
    ...toEveryone(draftStartDateLetter(COMMISSIONER, startsAt, tellIn(undefined))),
    ...toEveryone(draftStartDateLetter(COMMISSIONER, null, tellIn(undefined))),
  ]);
});

test("S04.31: marking a team with no manager, then unmarking it, each files a letter to everyone in the league", async () => {
  // BOB's team left with no manager, so only the commissioner and ANN are in the league to tell.
  await t.run((ctx) => ctx.db.patch("teams", teams[1], { managerEmail: undefined }));
  const before = (await letters()).length;
  const commissioner = await as(COMMISSIONER);
  await commissioner.mutation(api.draft.draftCommissioner.markForCommissioner, { leagueId, teamId: teams[1], marked: true });
  await commissioner.mutation(api.draft.draftCommissioner.markForCommissioner, { leagueId, teamId: teams[1], marked: false });

  const toBoth = (words: { subject: string; body: string }) => toEveryone(words).filter(({ to }) => to !== BOB);
  expect(await lettersSince(before)).toEqual([
    ...toBoth(draftPickerLetter(COMMISSIONER, TEAM_2, true)),
    ...toBoth(draftPickerLetter(COMMISSIONER, TEAM_2, false)),
  ]);
});
