// The scouts' tests' fake seam, held by the player card's fake (playerCard.harness.ts): the team's
// scouts and its trips, and the scouts sent, each answering as `refusal` says.

import { vi } from "vitest";
import { DAY_MS } from "../../../convex/shared/time";
import type { MyScouts, ScoutsSeam, ScoutTrip } from "../../../src/scouting/scouts/seam";

/** What the fake server holds: the team's scouts and its scouts' trips (null for someone running no
 *  team), or nothing yet while it loads; and the server's refusal of a scout sent, if it refuses. */
export type ScoutsData = { mine?: MyScouts | null; trips?: readonly ScoutTrip[] | null; loading?: boolean; refusal?: string };

/** Three scouts, none out, no reports: the opening state. */
export const NO_SCOUTS_OUT: MyScouts = { scouts: 3, out: [], reports: [] };

export function fakeScouts({ mine = NO_SCOUTS_OUT, trips = [], loading = false, refusal }: ScoutsData = {}) {
  const sendScout = vi.fn<ReturnType<ScoutsSeam["useSendScout"]>>(async () => refusal ?? null);
  return {
    useMyScouts: vi.fn<ScoutsSeam["useMyScouts"]>(() => (loading ? undefined : mine)),
    useScoutsOn: vi.fn<ScoutsSeam["useScoutsOn"]>((_leagueId, playerCode) => (loading ? undefined : (trips?.filter((trip) => trip.playerCode === playerCode) ?? null))),
    useSendScout: () => sendScout,
    sendScout,
  };
}

/** A trip of the team's scouts to a player: out until `dueAt`, or back with `text` written then. */
export const scoutOut = (playerCode: number, dueAt: number): ScoutTrip => ({ playerCode, sentAt: dueAt - DAY_MS, dueAt, state: "out", report: null });
export const scoutReported = (playerCode: number, writtenAt: number, text: string): ScoutTrip => ({
  playerCode,
  sentAt: writtenAt - DAY_MS,
  dueAt: writtenAt,
  state: "reported",
  report: { text, writtenAt },
});
