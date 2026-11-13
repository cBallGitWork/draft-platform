import { useState } from "react";
import { samePick } from "../../convex/draft/snakeOrder";
import type { ScreenTeam, TradePick } from "./seam";
import { pickWords } from "./words";

/** A ticked pick as the offer names it, "the Lions round 3 pick"; null for none. */
export function pickNamed(team: ScreenTeam | null, pick: TradePick | null) {
  const held =
    pick === null ? undefined : team?.picks.find((each) => samePick(each, pick));
  return held === undefined ? null : pickWords(held.round, held.teamName);
}

/** The codes of `ticked` still in `team`'s squad, in the order ticked. */
function stillIn(team: ScreenTeam | null, ticked: readonly number[]): readonly number[] {
  const held = new Set((team?.players ?? []).map(({ code }) => code));
  return ticked.filter((code) => held.has(code));
}

// What the New offer tab has ticked (#383, #1096): players on either side, or one draft pick each
// way. An offer with a pick in it is one pick each way and nothing else (spec/04, The picks), so
// ticking a pick clears the players, and ticking a player clears the picks.

export function useOfferTicks(
  start: {
    gives: readonly number[];
    gets: readonly number[];
    givePick?: TradePick | null;
    getPick?: TradePick | null;
  },
  /** Each side's squad now: a ticked player who has left it since (moved, traded, dropped) is no
   *  longer ticked, nor offered (#1437). */
  squads: { mine: ScreenTeam; theirs: ScreenTeam | null },
) {
  const [givesTicked, setGives] = useState<readonly number[]>(start.gives);
  const [getsTicked, setGets] = useState<readonly number[]>(start.gets);
  const gives = stillIn(squads.mine, givesTicked);
  const gets = stillIn(squads.theirs, getsTicked);
  const [givePick, setGivePick] = useState<TradePick | null>(start.givePick ?? null);
  const [getPick, setGetPick] = useState<TradePick | null>(start.getPick ?? null);

  const players =
    (set: (codes: readonly number[]) => void) => (codes: readonly number[]) => {
      set(codes);
      setGivePick(null);
      setGetPick(null);
    };
  const pick =
    (set: (pick: TradePick | null) => void) => (pick: TradePick | null) => {
      set(pick);
      setGives([]);
      setGets([]);
    };
  const picks =
    givePick !== null && getPick !== null
      ? { gives: givePick, gets: getPick }
      : null;
  return {
    gives,
    gets,
    givePick,
    getPick,
    tickGives: players(setGives),
    tickGets: players(setGets),
    tickGivePick: pick(setGivePick),
    tickGetPick: pick(setGetPick),
    /** The other team changed: nothing of theirs stays ticked. */
    clearTheirs: () => {
      setGets([]);
      setGetPick(null);
    },
    clear: () => {
      setGives([]);
      setGets([]);
      setGivePick(null);
      setGetPick(null);
    },
    /** The offer's players, and its picks once one is ticked each way. */
    terms: {
      gives: [...gives],
      gets: [...gets],
      ...(picks === null ? {} : { picks }),
    },
    /** Whether the offer can be sent: a player ticked, or a pick each way. */
    ready: gives.length + gets.length > 0 || picks !== null,
    /** A pick ticked on one side only. */
    onePickOnly: (givePick === null) !== (getPick === null),
  };
}
