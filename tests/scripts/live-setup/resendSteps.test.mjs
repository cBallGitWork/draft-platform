import { expect, test } from "vitest";
import { LIVE_DOMAIN } from "../../../scripts/live-setup/live.mjs";
import { FAILED } from "../../../scripts/live-setup/outcomes.mjs";
import { setUpLive } from "../../../scripts/live-setup/steps.mjs";
import { setUpWorld } from "../../support/scripts/liveSetup.harness.mjs";

test("a domain Resend doesn't list after it was made is refused, and no DNS record is added", async () => {
  const world = await setUpWorld();
  world.resend.domains.length = 0;
  world.vercel.dns.length = 0;
  world.tools.resend.createDomain = async () => {}; // Resend answers, but never lists the domain
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toContain(`${FAILED}: Resend has no ${LIVE_DOMAIN}`);
  expect(world.changes).toEqual([]);
  expect(world.vercel.dns).toEqual([]);
});
