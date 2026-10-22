import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { rulesRefusals } from "../../../convex/rules/leagueRules";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { adminByline } from "../../../convex/mail/letterWords";
import { expectRefused, holdGameweeks, rulesRevision, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Two people editing a league's rules at once (Craig, 22 Oct 2026: the second save warns, never
// silently replaces the first). A save carries the rules row its screen loaded; if someone saved
// since, it is refused, naming them and when, and nothing is written or filed.

type Scoring = LeagueRules["scoring"];

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: 9 });
  leagueId = await adminCreatesLeague(t);
  await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
});

/** The first scoring set with assists paying `points`. */
const assistsPaying = (points: number): Scoring => ({
  ...structuredClone(FIRST_RULES.scoring),
  rules: FIRST_RULES.scoring.rules.map((rule) => (rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: points } } : structuredClone(rule))),
});
const changeScoring = async (email: string, scoring: Scoring, revision: Id<"leagueRules"> | null) =>
  (await actingAs(t, email)).mutation(api.rules.leagueRules.changeScoring, { leagueId, scoring, revision });
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

describe("a save made from rules someone has saved over since", () => {
  test("is refused, naming who saved and when, and writes nothing and files no letter", async () => {
    const opened = await rulesRevision(t, leagueId);
    await changeScoring(CO_COMMISSIONER, assistsPaying(4), opened);
    const savedAt = await lastEventAt();
    const events = await eventsIn(t, leagueId);

    await expectRefused(changeScoring(COMMISSIONER, assistsPaying(5), opened), rulesRefusals.changedSince(CO_COMMISSIONER, savedAt));
    expect((await latestRules())?.scoring).toEqual(assistsPaying(4));
    expect(await eventsIn(t, leagueId)).toEqual(events);
    expect(await rulesLetters()).toHaveLength(1);
  });

  test("names the admin as the letters do", async () => {
    const opened = await rulesRevision(t, leagueId);
    await changeScoring(ADMIN, assistsPaying(4), opened);

    await expectRefused(changeScoring(COMMISSIONER, assistsPaying(5), opened), rulesRefusals.changedSince(adminByline, await lastEventAt()));
  });

  test("is refused through the whole-rules change too", async () => {
    const opened = await rulesRevision(t, leagueId);
    await changeScoring(CO_COMMISSIONER, assistsPaying(4), opened);
    const savedAt = await lastEventAt();

    await expectRefused(
      (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: TOTAL_POINTS, revision: opened }),
      rulesRefusals.changedSince(CO_COMMISSIONER, savedAt),
    );
    expect(await latestRules()).toEqual({ ...FIRST_RULES, scoring: assistsPaying(4) });
  });
});

test("a save made from the latest rules, the other's among them, goes through and files one letter", async () => {
  await changeScoring(CO_COMMISSIONER, assistsPaying(4), await rulesRevision(t, leagueId));
  await changeScoring(COMMISSIONER, assistsPaying(5), await rulesRevision(t, leagueId));

  expect((await latestRules())?.scoring).toEqual(assistsPaying(5));
  expect(await rulesLetters()).toHaveLength(2);
});
