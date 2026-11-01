// The sweeper on the pitch (spec/05 The pitch; #844; Craig, 31 Oct 2026): the defence's centre cell
// is drawn a little deeper than the line only while its player is on a sweeper's role.

import { describe, expect, it } from "vitest";
import { SWEEPER_CELL } from "../../../../../convex/lineup/roles";
import { SWEEPER_DEPTH } from "../../../../../src/myTeam/tactics/pitch/Pitch";
import { at, blockOf, openedPitch, RAYA, SALIBA, SAVED } from "../../../../support/src/tacticsScreen.harness";

/** Saliba alone in the defence's centre cell, on this role. */
const withSaliba = (role: string | undefined) => ({
  tactics: {
    ...SAVED,
    lineup: { ...SAVED.lineup, starters: [at(RAYA, { area: "goalkeeper", lane: "centre" }), { ...at(SALIBA, SWEEPER_CELL), ...(role === undefined ? {} : { role }) }] },
  },
});

const cellOf = () => blockOf(SALIBA, SWEEPER_CELL).parentElement!;

describe("the sweeper's cell", () => {
  it.each(["sweeper", "libero"])("is drawn deeper with its player on %s", async (role) => {
    await openedPitch(withSaliba(role));
    expect(cellOf().classList).toContain(SWEEPER_DEPTH);
  });

  it.each(["stopper", undefined])("stays on the line with its player on a centre-back's role (%s)", async (role) => {
    await openedPitch(withSaliba(role));
    expect(cellOf().classList).not.toContain(SWEEPER_DEPTH);
  });
});
