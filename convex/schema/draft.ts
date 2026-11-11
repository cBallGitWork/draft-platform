import { defineTable } from "convex/server";
import { v } from "convex/values";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { position } from "./positions";
import { tradePick } from "./trades";

/** A player in the admin's ranking: his FPL code, and his rank, 1 the best. */
export const rankedPlayer = v.object({ code: v.number(), rank: v.number() });

export const draftRankingTables = {
  /** One row at most: the admin's ranking, one for the whole platform, which auto-pick takes from
   *  when a manager's queue is out (spec/04, The queue and the ranking; #1093). Each upload replaces
   *  it whole. Its players are best first; a player not in it is unranked. */
  draftRanking: defineTable({ players: v.array(rankedPlayer), uploadedAt: v.number() }),
};

/** A started draft: when it started, its teams in the draft order then, first pick first, its
 *  rounds, the league's squad maximum then, and the squad rules every pick is checked against, the
 *  league's then (spec/04, Starting it and The picks; Craig, 4 Nov 2026, on #1090). `squad` is
 *  absent only from drafts started before #1090, whose picks read the rules in force at `at`
 *  (../draft/draftPicks.ts): optional, so those rows need no migration. */
const startedDraft = v.object({
  at: v.number(),
  teamIds: v.array(v.id("teams")),
  rounds: v.number(),
  squad: v.optional(leagueRulesShape.fields.squad),
});

export const draftTables = {
  /** A league's draft (spec/04, Starting it; #1089), one row at most, made the first time its
   *  commissioner sets a start or starts it, a manager chooses auto-pick or a pick is traded: a
   *  league with none waits for him to press start.
   *  ../draft/draftStart.ts writes it. */
  drafts: defineTable({
    leagueId: v.id("leagues"),
    /** When it starts, the commissioner's date; absent while it waits for him to press start. */
    startsAt: v.optional(v.number()),
    /** The scheduled start at `startsAt`, which a new date, a cleared one or pressing start cancels. */
    startJob: v.optional(v.id("_scheduled_functions")),
    /** Present once it has started. */
    started: v.optional(startedDraft),
    /** Each pick that has changed hands in a trade before the draft started (#1096): `teamId`'s pick
     *  in `round`, which `ownerId` holds now and makes. A pick back with its own team has no entry.
     *  Absent until a pick is traded, which makes this row if the league has none yet.
     *  ../trades/tradePicks.ts writes it, and it can't change once the draft starts. */
    tradedPicks: v.optional(v.array(v.object({ round: v.number(), teamId: v.id("teams"), ownerId: v.id("teams") }))),
    /** Each pick trade that went through before the draft started (#1457), first made first: the
     *  team that offered it, the team it was to, and the pick each gave. When the draft starts, a
     *  trade with a pick in a round a squad-size cut removed is undone, as is a later one trading on
     *  a pick that went back, and `tradedPicks` is played again from the rest (Craig, 11 Nov 2026,
     *  on #1457). Absent until a pick is traded, and from drafts whose trades went through before
     *  #1457. ../trades/tradePicks.ts writes it. */
    pickTrades: v.optional(v.array(v.object({ fromTeamId: v.id("teams"), toTeamId: v.id("teams"), picks: v.object({ gives: tradePick, gets: tradePick }) }))),
    /** The pick on the clock (spec/04, The picks; #1091): its number, when its clock starts, 10
     *  seconds after the pick before it, and when it runs out, and the scheduled job that makes the
     *  pick for its team then, or as its clock starts for a team with no manager. Absent before the
     *  draft starts and once it is over, and from a draft started before #1091 until its next pick.
     *  ../draft/draftClock.ts writes it. While the commissioner has the draft paused (#1135), `paused`
     *  holds when he paused it and the league's pick time then, and the job is cancelled, so absent.
     *  `fullClock` marks a pick the commissioner's undo put back (#1095): the draft picks for its team
     *  only when its clock runs out, even for a team it would pick for at once (Craig, 5 Nov 2026).
     *  `upNext` marks a clock after a manager's own pick, whose job tells its manager he is up next
     *  as it starts, once the 10 seconds to undo are up (Craig, 11 Nov 2026, on #1458), and then
     *  schedules the pick the draft makes. `closing` marks the 10 seconds after the last pick: its
     *  `pick` is one past the last, it starts and runs out as the draft ends, and its job ends it. */
    clock: v.optional(
      v.object({
        pick: v.number(),
        startsAt: v.number(),
        endsAt: v.number(),
        job: v.optional(v.id("_scheduled_functions")),
        paused: v.optional(v.object({ at: v.number(), pickSeconds: v.number() })),
        fullClock: v.optional(v.literal(true)),
        upNext: v.optional(v.literal(true)),
        closing: v.optional(v.literal(true)),
      }),
    ),
    /** The pick time this draft runs on, in seconds: the league's latest when it started (#1439), or
     *  the one the commissioner set since while it was paused (#1095), which it runs on at once, not
     *  waiting for the league's rules change to reach a gameweek (Craig, 5 Nov 2026). Absent before
     *  the start, and from a draft started before #1439 until he sets one. ../draft/draftStart.ts
     *  and ../draft/draftPickTime.ts write it. */
    pickSeconds: v.optional(v.number()),
    /** Each team whose clock has run out (spec/04, Auto-pick; #1136): its timeouts across the whole
     *  draft, and, once they reach the league's limit, `autoPick`: "fullClock" while its first pick
     *  on auto-pick still waits its full clock, then "atOnce"; or "chosen" once its manager turns
     *  auto-pick on himself (#1100), its count as it was. Absent until a clock runs out on a team
     *  with a manager, or a manager chooses auto-pick. ../draft/draftTimeouts.ts writes it. */
    timeouts: v.optional(
      v.array(
        v.object({
          teamId: v.id("teams"),
          count: v.number(),
          autoPick: v.optional(v.union(v.literal("fullClock"), v.literal("atOnce"), v.literal("chosen"))),
        }),
      ),
    ),
  }).index("by_leagueId", ["leagueId"]),
  /** A team's draft queue and do-not-draft list (spec/04, The queue and the ranking; #1092), one row
   *  at most, made the first time its manager adds to either: a team with none has both empty. They
   *  are the team's, not one draft's (Craig, 4 Nov 2026). ../draft/draftLists.ts writes it. */
  draftLists: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    /** The queue, by FPL code, first choice first. */
    queue: v.array(v.number()),
    /** The do-not-draft list, by FPL code, in the order they were added. */
    doNotDraft: v.array(v.number()),
  })
    .index("by_teamId", ["teamId"])
    .index("by_leagueId", ["leagueId"]),
  /** A pick made in a league's draft (spec/04, The picks; #1090): its number, from 1, the team that
   *  made it and the player it took. ../draft/draftPicks.ts writes it, with his squad row. `timeout`
   *  marks a pick the draft made when a managed team's clock ran out, whether that timeout put the
   *  team on auto-pick, and `movedToAtOnce` when it moved the team from its full-clock pick there to
   *  "at once" (#1463), so the commissioner's undo (#1095) can put both back. `auto`
   *  marks every pick the draft made for a team (#1100), which the board shows; picks made before
   *  #1100 lack it, and there `timeout` alone marks one. `positions` are the player's when he was
   *  drafted, which the rest of the draft counts him at, a change since showing only after it
   *  (Craig, 11 Nov 2026, on #1484); picks made before #1484 lack them, and there his positions now
   *  count. `own` marks a pick its manager made himself, which he can undo for 10 seconds, with the
   *  time his clock had left when he made it, which his undo gives back (Craig, 11 Nov 2026, on
   *  #1458). */
  draftPicks: defineTable({
    leagueId: v.id("leagues"),
    pick: v.number(),
    teamId: v.id("teams"),
    playerCode: v.number(),
    at: v.number(),
    timeout: v.optional(v.object({ putOnAutoPick: v.boolean(), movedToAtOnce: v.optional(v.literal(true)) })),
    auto: v.optional(v.literal(true)),
    positions: v.optional(v.array(position)),
    own: v.optional(v.object({ leftMs: v.number() })),
  }).index("by_leagueId_and_pick", ["leagueId", "pick"]),
};
