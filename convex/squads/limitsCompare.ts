import type { SquadWarning } from "./squads";

// Comparing a squad's broken limits before and after a change (spec/05): a waiver claim or free
// agent pickup (../waivers/waiverRun.ts) and a trade's warnings (../trades/tradeSquads.ts,
// ../trades/tradeScreen.ts). Pure.

/** Whether the claim's squad breaks a limit the squad before it didn't, or breaks one further:
 *  more over the squad's or a club's maximum, or fewer filling an area's minimum. A claim never
 *  shrinks a squad, so being under its minimum size is never the claim's doing. */
export function breaksLimits(before: readonly SquadWarning[], after: readonly SquadWarning[]): boolean {
  return newlyBroken(before, after).some((warning) => warning.kind !== "underMinimum");
}

/** The limits the squad after a change breaks that the squad before didn't, or breaks further:
 *  more over a maximum, or fewer filling a minimum. */
export function newlyBroken(before: readonly SquadWarning[], after: readonly SquadWarning[]): SquadWarning[] {
  const keyOf = (warning: SquadWarning) =>
    warning.kind === "overClubMaximum" ? `club ${warning.clubShortName}` : warning.kind === "underAreaMinimum" ? `area ${warning.area}` : warning.kind;
  const was = new Map(before.map((warning) => [keyOf(warning), warning.players]));
  return after.filter((warning) => {
    const players = was.get(keyOf(warning));
    if (players === undefined) return true;
    return warning.kind === "underAreaMinimum" || warning.kind === "underMinimum" ? warning.players < players : warning.players > players;
  });
}
