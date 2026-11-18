import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { draftOf } from "../draft/draftRow";
import { leagueDeadlinesIn, scheduledMatches } from "../gameweeks/leagueDeadlines";
import { playedGameweekTimes, type PlayedGameweekTimes } from "../gameweeks/playedGameweekTimes";
import { historyOf, type RulesRow } from "../rules/rulesHistory";
import { memberOf } from "../shared/leagueAccess";
import { firstRunFrom, ukMoment, wasRunTime } from "../waivers/waiverTimes";

// Home's Calendar tab (spec/12, S12.24): a month's league events, for FM's month grid. Each gameweek
// the league plays, when its matches start and its deadline; the draft; and the waiver runs, each
// under the rules saved by then (waiverTimes.ts's `wasRunTime`), the latest for runs still to come.
// Breaks (spec/13) join once a break's window is held (#2663, #2665). A month is the UK's, as the
// runs' times are. Takes no clock, so the same month is read once and cached.

export const calendarEvent = v.union(
  /** The first match of a gameweek the league plays kicks off: the one recorded once passed. */
  v.object({ kind: v.literal("firstKickoff"), at: v.number(), gameweek: v.number() }),
  /** The league's own deadline for a gameweek it plays, when that gameweek begins (spec/13). */
  v.object({ kind: v.literal("deadline"), at: v.number(), gameweek: v.number() }),
  /** The draft: when it started, else when the commissioner set it to start. */
  v.object({ kind: v.literal("draft"), at: v.number() }),
  v.object({ kind: v.literal("waiverRun"), at: v.number() }),
);
export type CalendarEvent = Infer<typeof calendarEvent>;

/** The moment a UK month starts, `month` 1 for January; 13 is the next year's January. */
const ukMonthStart = (year: number, month: number) => ukMoment(Date.UTC(year, month - 1, 1), 0, 0);

/** The league's events in the UK month, in time order. For anyone with a part in the league. */
export const ofMonth = query({
  args: { leagueId: v.id("leagues"), year: v.number(), month: v.number() },
  returns: v.array(calendarEvent),
  handler: async (ctx, { leagueId, year, month }) => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error(`There's no month ${month} of ${year}`);
    const { league } = await memberOf(ctx, leagueId);
    const [from, to] = [ukMonthStart(year, month), ukMonthStart(year, month + 1)];
    const matches = await scheduledMatches(ctx);
    const gameweeks = await playedGameweekTimes(ctx, league, matches, await leagueDeadlinesIn(ctx, leagueId, matches));
    const events: CalendarEvent[] = [
      ...gameweeks.flatMap(gameweekEvents),
      ...draftEvent(await draftOf(ctx, leagueId)),
      ...runsBetween(await historyOf(ctx, leagueId), from, to).map((at) => ({ kind: "waiverRun" as const, at })),
    ];
    return events.filter(({ at }) => at >= from && at < to).sort((one, other) => one.at - other.at);
  },
});

function gameweekEvents({ gameweek, firstKickoff, deadline }: PlayedGameweekTimes): CalendarEvent[] {
  return [
    ...(firstKickoff === null ? [] : [{ kind: "firstKickoff" as const, at: firstKickoff, gameweek }]),
    ...(deadline === null ? [] : [{ kind: "deadline" as const, at: deadline, gameweek }]),
  ];
}

function draftEvent(draft: Doc<"drafts"> | null): CalendarEvent[] {
  const at = draft?.started?.at ?? draft?.startsAt;
  return at === undefined ? [] : [{ kind: "draft", at }];
}

/** The league's waiver runs from `from` up to `to`: each time one of its saved rules had a run, kept
 *  where it was a run time under the rules saved by then. */
function runsBetween(history: readonly RulesRow[], from: number, to: number): number[] {
  const times = new Set<number>();
  for (const { rules } of history) {
    for (let at = firstRunFrom(rules.waivers.runs, from); at !== null && at < to; at = firstRunFrom(rules.waivers.runs, at + 1)) times.add(at);
  }
  return [...times].filter((at) => wasRunTime(history, at));
}
