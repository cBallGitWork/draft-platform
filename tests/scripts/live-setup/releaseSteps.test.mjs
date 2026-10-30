import { expect, test } from "vitest";
import { GITHUB_REPO } from "../../../scripts/live-setup/live.mjs";
import { DONE, FAILED } from "../../../scripts/live-setup/outcomes.mjs";
import { RELEASE_STEPS } from "../../../scripts/live-setup/releaseSteps.mjs";
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

const DISPATCH_STEP = RELEASE_STEPS.find((step) => step.title.includes("repository dispatch"));

test("a project that sends no repository dispatch events is set to, keeping its other git settings", async () => {
  const world = await setUpWorld();
  world.vercel.gitProviderOptions = { createDeployments: "disabled", disableRepositoryDispatchEvents: true };
  expect(await setUpLive(world.tools)).toBe(true);
  expect(world.printed).toContain(`${DISPATCH_STEP.title}: ${DONE}`);
  expect(world.changes).toEqual(["vercel git options"]);
  expect(world.vercel.gitProviderOptions).toEqual({ createDeployments: "disabled", disableRepositoryDispatchEvents: false });
});

test("a project with no git settings sends dispatch events already, and is left alone", async () => {
  const world = await setUpWorld();
  world.vercel.gitProviderOptions = {};
  expect(await setUpLive(world.tools)).toBe(true);
  expect(world.changes).toEqual([]);
  expect(world.vercel.gitProviderOptions).toEqual({});
});
