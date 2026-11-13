import type { Doc, Id } from "../_generated/dataModel";

// The timeout count (spec/04, Auto-pick; #1136). Each time a team's clock runs out the draft picks
// for it (draftPicks.ts `autoPick`), and that counts as one of its timeouts, whether or not its
// manager is online, across the whole draft, not only in a row (Craig, 4 Nov 2026, on #1091). Once
// a team has the league's number of timeouts it goes on auto-pick; with "never" it doesn't, and the
// clock runs for every pick (Craig, 2 Nov 2026). Its first pick on auto-pick still waits its full
// clock, "incase they forgot to switch off", and each after is made at once (Craig, 4 Nov 2026, on
// #1091). A team with no manager is picked for at once anyway, so its picks aren't timeouts. Its
// manager can take control back himself, which sets his count to 0 (Craig, 4 Nov 2026: "ok"; #1094).
// He can also turn auto-pick on himself, before the draft or during it: then it is "chosen", every
// pick of his is made at once, the one on the clock too, and his count stays as it is (Craig, 5 Nov
// 2026, on #1100).

type Timeouts = NonNullable<Doc<"drafts">["timeouts"]>;

/** `teamId`'s row in the draft's timeouts, or undefined while it has none. */
const rowOf = (timeouts: Timeouts | undefined, teamId: Id<"teams">) => timeouts?.find((team) => team.teamId === teamId);

/** How many timeouts `teamId` has: 0 while it has no row. */
export const timeoutCountOf = (timeouts: Timeouts | undefined, teamId: Id<"teams">): number => rowOf(timeouts, teamId)?.count ?? 0;

/** The draft's timeouts once `teamId`'s clock has run out once more, the league allowing `limit`
 *  timeouts before auto-pick, or never with null. */
export function afterTimeout(timeouts: Timeouts | undefined, teamId: Id<"teams">, limit: number | null): Timeouts {
  const before = rowOf(timeouts, teamId);
  const count = (before?.count ?? 0) + 1;
  const autoPick: Timeouts[number]["autoPick"] = before?.autoPick !== undefined ? "atOnce" : limit !== null && count >= limit ? "fullClock" : undefined;
  return withTeam(timeouts, { teamId, count, ...(autoPick !== undefined && { autoPick }) });
}

/** The draft's timeouts with `after` in place of its team's row, or added for a team with none. */
function withTeam(timeouts: Timeouts | undefined, after: Timeouts[number]): Timeouts {
  const all = timeouts ?? [];
  return all.some(({ teamId }) => teamId === after.teamId) ? all.map((team) => (team.teamId === after.teamId ? after : team)) : [...all, after];
}

/** The draft's timeouts once `teamId`'s manager takes control back from auto-pick: off it, and his
 *  count back to 0 (Craig, 4 Nov 2026: "ok"). */
export function afterTakeBack(timeouts: Timeouts | undefined, teamId: Id<"teams">): Timeouts {
  return (timeouts ?? []).map((team) => (team.teamId === teamId ? { teamId, count: 0 } : team));
}

/** What a timeout did to its team's auto-pick, saved on the pick the draft made (schema/draft.ts
 *  `draftPicks`): whether it put the team on auto-pick, and whether it moved it from its full-clock
 *  first pick there to "at once". */
export type TimeoutEffect = { putOnAutoPick: boolean; movedToAtOnce?: true };

/** What the timeout taking the draft's timeouts from `before` to `after` did to `teamId`'s auto-pick. */
export function timeoutEffect(before: Timeouts | undefined, after: Timeouts, teamId: Id<"teams">): TimeoutEffect {
  const was = rowOf(before, teamId)?.autoPick;
  const now = rowOf(after, teamId)?.autoPick;
  return { putOnAutoPick: was === undefined && now !== undefined, ...(was === "fullClock" && now === "atOnce" && { movedToAtOnce: true as const }) };
}

/** The draft's timeouts once the commissioner undoes a pick the draft made when `teamId`'s clock ran
 *  out: that timeout off its count (Craig, 4 Nov 2026: "yes"), and the team's auto-pick back where
 *  that timeout found it: off if the timeout put it on, its full-clock pick back if the timeout
 *  moved it to "at once" (Craig, 11 Nov 2026, on #1463). Auto-pick its manager has since turned on
 *  himself stays on, and a count he has since set to 0 by taking control back stays 0. */
export function afterUndoneTimeout(timeouts: Timeouts | undefined, teamId: Id<"teams">, effect: TimeoutEffect): Timeouts {
  return (timeouts ?? []).map((team) => {
    if (team.teamId !== teamId) return team;
    const { autoPick, count } = team;
    const kept =
      autoPick === "chosen" ? autoPick : effect.putOnAutoPick ? undefined : effect.movedToAtOnce === true && autoPick === "atOnce" ? "fullClock" : autoPick;
    return { teamId, count: Math.max(0, count - 1), ...(kept !== undefined && { autoPick: kept }) };
  });
}

/** The draft's timeouts once `teamId`'s manager turns auto-pick on himself: "chosen", its count as
 *  it was (Craig, 5 Nov 2026, on #1100). */
export function afterChoosing(timeouts: Timeouts | undefined, teamId: Id<"teams">): Timeouts {
  return withTeam(timeouts, { teamId, count: timeoutCountOf(timeouts, teamId), autoPick: "chosen" });
}

/** Whether `teamId`'s manager turned auto-pick on himself, so its picks count no timeout. */
export function choseAutoPick(timeouts: Timeouts | undefined, teamId: Id<"teams">): boolean {
  return timeouts?.some((team) => team.teamId === teamId && team.autoPick === "chosen") ?? false;
}

/** Whether `teamId` is on auto-pick: its timeouts reached the league's limit, or its manager chose it. */
export function isOnAutoPick(timeouts: Timeouts | undefined, teamId: Id<"teams">): boolean {
  return timeouts?.some((team) => team.teamId === teamId && team.autoPick !== undefined) ?? false;
}

/** Whether the draft picks for `team` as its clock starts: it has no manager and the commissioner
 *  hasn't said "I'll pick for this one" (#1095), or it is on auto-pick past its first pick there or by its manager's choice. */
export function picksAtOnce(timeouts: Timeouts | undefined, team: Doc<"teams">): boolean {
  if (team.managerEmail === undefined) return team.commissionerPicks !== true;
  return timeouts?.some(({ teamId, autoPick }) => teamId === team._id && (autoPick === "atOnce" || autoPick === "chosen")) ?? false;
}
