// The sweeper on the pitch (spec/05 The pitch; #844; Craig, 31 Oct 2026): the defence's centre cell
// is drawn a little deeper than the line only while its player is on a sweeper's role.

import { describe, expect, it } from "vitest";
import type { Cell } from "../../../../convex/lineup/pitch";
import { at, blockOf, openedPitch, RAYA, SALIBA, SAVED } from "../../../support/src/tacticsScreen.harness";

const CENTRE: Cell = { area: "defence", lane: "centre" };
/** The pitch's CSS utility that draws a cell deeper (pitch.css). */
const DEEPER = "pitch-sweeper";

/** Saliba alone in the defence's centre cell, on this role. */
const withSaliba = (role: string | undefined) => ({
  tactics: {
    ...SAVED,
    lineup: { ...SAVED.lineup, starters: [at(RAYA, { area: "goalkeeper", lane: "centre" }), { ...at(SALIBA, CENTRE), ...(role === undefined ? {} : { role }) }] },
  },
});

const cellOf = () => blockOf(SALIBA, CENTRE).parentElement!;

describe("the sweeper's cell", () => {
  it.each(["sweeper", "libero"])("is drawn deeper with its player on %s", async (role) => {
    await openedPitch(withSaliba(role));
    expect(cellOf().classList).toContain(DEEPER);
  });

  it.each(["stopper", undefined])("stays on the line with its player on a centre-back's role (%s)", async (role) => {
    await openedPitch(withSaliba(role));
    expect(cellOf().classList).not.toContain(DEEPER);
  });
});
