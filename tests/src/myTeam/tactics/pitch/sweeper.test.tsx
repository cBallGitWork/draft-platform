// The sweeper on the pitch (spec/05 The pitch; #989; Craig, 4 Nov 2026): a centre-back's role, with
// no sweeper cell and no drawing him deeper, so his cell stands in the line as a stopper's does.

import { describe, expect, it } from "vitest";
import { at, blockOf, openedPitch, RAYA, SALIBA, SAVED } from "../../../../support/src/tacticsScreen.harness";

const CENTRE_BACK = { area: "defence", lane: "centre" } as const;

/** Saliba alone in the defence's centre cell, on this role. */
const withSaliba = (role: string | undefined) => ({
  tactics: {
    ...SAVED,
    lineup: { ...SAVED.lineup, starters: [at(RAYA, { area: "goalkeeper", lane: "centre" }), { ...at(SALIBA, CENTRE_BACK), ...(role === undefined ? {} : { role }) }] },
  },
});

const classesOf = async (role: string | undefined) => {
  await openedPitch(withSaliba(role));
  return blockOf(SALIBA, CENTRE_BACK).parentElement!.className;
};

describe("a sweeper's cell", () => {
  it.each(["sweeper", "libero"])("stands in the line, drawn as a stopper's is, with its player on %s", async (role) => {
    const onRole = await classesOf(role);
    document.body.innerHTML = "";
    expect(onRole).toBe(await classesOf("stopper"));
  });
});
