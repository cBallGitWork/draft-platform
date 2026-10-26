import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EVENTS_SEARCHED_FOR_SAVER, rulesRefusals } from "../../../convex/rules/leagueRules";
import { leagueSettingsOf } from "../../../convex/rules/leagueSettingsPart";
import { adminByline } from "../../../convex/mail/letterWords";
import { expectRefused, holdGameweeks, rulesRevision, rulesWith, TOTAL_POINTS, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Two people editing a league's rules at once (Craig, 22 Oct 2026: the second save warns, never
// silently replaces the first). A save carries the rules row its screen loaded; if someone saved
// since, it is refused, naming them and when, and nothing is written or filed.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
});

/** League settings' change, made from the rules `revision` names: the league's teams playing
 *  `games` head-to-head games a gameweek. */
const changeGames = async (email: string, games: number, revision: Id<"leagueRules"> | null) =>
  (await actingAs(t, email)).mutation(api.rules.leagueSettings.changeSettings, {
    leagueId,
    settings: { ...leagueSettingsOf(HELD_FIRST_RULES), gamesPerGameweek: games },
    revision,
  });
const latestRules = async () => (await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId }))?.rules;
const rulesLetters = () =>
  t.run(async (ctx) =>
    (await ctx.db.query("letters").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).collect()).filter(
      (letter) => letter.to === COMMISSIONER && letter.subject.startsWith("The league's rules change"),
    ),
  );
/** When the league's last event was filed. */
const lastEventAt = () =>
  t.run(async (ctx) => (await ctx.db.query("leagueEvents").withIndex("by_leagueId_and_at", (q) => q.eq("leagueId", leagueId)).order("desc").first())!.at);

/** The co-commissioner saves 2 games a gameweek over the rules the commissioner opened: the
 *  revision opened, and the refusal a save from it gets. */
const coCommissionerSavesOver = async () => {
  const opened = await rulesRevision(t, leagueId);
  await changeGames(CO_COMMISSIONER, 2, opened);
  return { opened, refusal: rulesRefusals.changedSince(CO_COMMISSIONER, await lastEventAt(), undefined) };
};

describe("a save made from rules someone has saved over since", () => {
  test("is refused, naming who saved and when, and writes nothing and files no letter", async () => {
    const { opened, refusal } = await coCommissionerSavesOver();
    const events = await eventsIn(t, leagueId);

    await expectRefused(changeGames(COMMISSIONER, 3, opened), refusal);
    expect((await latestRules())?.gamesPerGameweek).toBe(2);
    expect(await eventsIn(t, leagueId)).toEqual(events);
    expect(await rulesLetters()).toHaveLength(1);
  });

  test("names the admin as the letters do", async () => {
    const opened = await rulesRevision(t, leagueId);
    await changeGames(ADMIN, 2, opened);

    await expectRefused(changeGames(COMMISSIONER, 3, opened), rulesRefusals.changedSince(adminByline, await lastEventAt(), undefined));
  });

  test("is refused through the whole-rules change too", async () => {
    const { opened, refusal } = await coCommissionerSavesOver();

    await expectRefused(
      (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: TOTAL_POINTS, revision: opened }),
      refusal,
    );
    expect(await latestRules()).toEqual({ ...HELD_FIRST_RULES, gamesPerGameweek: 2 });
  });

  test(`is still refused, without the name, when the letter is past the newest ${EVENTS_SEARCHED_FOR_SAVER} events`, async () => {
    const { opened } = await coCommissionerSavesOver();
    const saved = (await rulesRevision(t, leagueId))!;
    const savedAt = await t.run(async (ctx) => (await ctx.db.get("leagueRules", saved))!._creationTime);
    const after = await lastEventAt();
    await t.run(async (ctx) => {
      for (let index = 1; index <= EVENTS_SEARCHED_FOR_SAVER; index += 1) {
        await ctx.db.insert("leagueEvents", { leagueId, at: after + index, by: COMMISSIONER, event: { kind: "inviteLinkSwitchedOff" } });
      }
    });

    await expectRefused(changeGames(COMMISSIONER, 3, opened), rulesRefusals.changedSince(null, savedAt, undefined));
    expect((await latestRules())?.gamesPerGameweek).toBe(2);
  });

  test("is refused as stale, not as unsound, when its rules are unsound too", async () => {
    const { opened, refusal } = await coCommissionerSavesOver();

    await expectRefused(
      (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: rulesWith({ gamesPerGameweek: 99 }), revision: opened }),
      refusal,
    );
  });
});

test("a save made from the latest rules, the other's among them, goes through and files one letter", async () => {
  await changeGames(CO_COMMISSIONER, 2, await rulesRevision(t, leagueId));
  await changeGames(COMMISSIONER, 3, await rulesRevision(t, leagueId));

  expect((await latestRules())?.gamesPerGameweek).toBe(3);
  expect(await rulesLetters()).toHaveLength(2);
});
