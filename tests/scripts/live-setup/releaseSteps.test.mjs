import { expect, test } from "vitest";
import { GITHUB_REPO } from "../../../scripts/live-setup/live.mjs";
import { FAILED } from "../../../scripts/live-setup/outcomes.mjs";
import { setUpLive } from "../../../scripts/live-setup/steps.mjs";
import { setUpWorld } from "../../support/scripts/liveSetup.harness.mjs";

const OTHER_REPO = "someone/their-fork";

test("a Vercel project connected to another repo is refused, and its connection is left alone", async () => {
  const world = await setUpWorld();
  world.vercel.repo = OTHER_REPO;
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toContain(`${FAILED}: the Vercel project is connected to ${OTHER_REPO}, not ${GITHUB_REPO}`);
  expect(world.changes).toEqual([]);
  expect(world.vercel.repo).toBe(OTHER_REPO);
});
