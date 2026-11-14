// The server's time, as an open tab reads it (S04.22, S05.50): Ann's laptop clock 2 minutes slow,
// her draft clock and deadline countdown still show the time left everyone else sees. The tab asks
// the server for its time once (convex/release/serverTime.ts) and keeps how far its own clock is
// from it; every countdown reads `serverNow`. Until the server answers, the tab's own clock stands.

let offset = 0;
const listeners = new Set<() => void>();

/** The time now by the server's clock. */
export const serverNow = () => Date.now() + offset;

/** Takes the server's time, `serverAt`, asked for at `sentAt` and answered at `receivedAt` by this
 *  tab's clock: the server read it about halfway between, so the tab's clock is behind it by the
 *  difference. Every countdown watching redraws. */
function setServerTime(serverAt: number, sentAt: number, receivedAt: number) {
  offset = serverAt - (sentAt + receivedAt) / 2;
  for (const listener of listeners) listener();
}

/** Hears each time the server's time is taken; returns the way to stop. */
export function onServerTime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks the server for its time, with `ask`, and takes it; a failed ask leaves the tab's own clock
 *  and logs why. */
export async function syncServerTime(ask: () => Promise<number>): Promise<void> {
  const sentAt = Date.now();
  try {
    const serverAt = await ask();
    setServerTime(serverAt, sentAt, Date.now());
  } catch (error) {
    console.error(SERVER_TIME_FAILED_LOG, error);
  }
}

/** What the log says, before the error, when the server's time couldn't be read. */
const SERVER_TIME_FAILED_LOG = "Reading the server's time failed; countdowns go by this device's clock";

/** For tests: back to the tab's own clock, as a reload does before the server answers. */
export function forgetServerTime() {
  offset = 0;
}
