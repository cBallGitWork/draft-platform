// The scouts in the preview (src/app/preview.ts), over Scouting's preview players (../preview.ts):
// two reports on Palmer, the newer five days old, and a scout out on Salah. Sending one saves nothing
// and says so.

import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { previewSays } from "../../shared/preview";
import type { MyScouts, ScoutsSeam, ScoutTrip } from "./seam";

const PALMER = 4;
const SALAH = 6;
const now = Date.now();
const reportOn = (playerCode: number, sentAt: number, text: string): ScoutTrip => ({
  playerCode,
  sentAt,
  dueAt: sentAt + DAY_MS,
  state: "reported",
  report: { text, writtenAt: sentAt + DAY_MS },
});

const TRIPS: readonly ScoutTrip[] = [
  { playerCode: SALAH, sentAt: now - 6 * HOUR_MS, dueAt: now + 18 * HOUR_MS, state: "out", report: null },
  reportOn(
    PALMER,
    now - 6 * DAY_MS,
    "A strong fit as a Number 10 in a 4-2-3-1: he creates big chances there and the scoring pays for both. His form is rising, with returns in four of his last five. He starts every match he is fit for. Fixtures soften after the next two.",
  ),
  reportOn(PALMER, now - 27 * DAY_MS, "Plays off the right more than through the middle so far. Steady minutes, few returns. Worth another look in a month."),
];

const MINE: MyScouts = {
  scouts: 3,
  out: TRIPS.filter((trip) => trip.state === "out").map(({ playerCode, sentAt, dueAt }) => ({ playerCode, name: "Salah", sentAt, dueAt })),
  reports: TRIPS.flatMap(({ playerCode, sentAt, report }) => (report === null ? [] : [{ playerCode, name: "Palmer", sentAt, ...report }])),
};

const send = previewSays("no scout was sent");

export const previewScouts: ScoutsSeam = {
  useMyScouts: () => MINE,
  useScoutsOn: (_leagueId, playerCode) => TRIPS.filter((trip) => trip.playerCode === playerCode),
  useSendScout: () => send,
};
