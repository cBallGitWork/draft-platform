// The random clicker (#2138): each built screen (tests/support/smoke/builtScreens.ts) as its preview
// person, on preview data with no Convex, pressed at random from a seed, its own seed the run's
// and the screen's together so one screen replays alone. After every step the smoke run's checks:
// no error page, no sideways scroll, no console or page error and nothing asked of another site
// (pageChecks.ts, errorsTest.ts). Each screen runs under the chaos its seed picks: saves as they
// are, slow or failing (src/shared/preview.ts). `npm run clicker`; the seed and steps:
// playwright.clicker.config.ts. The steps: tests/support/smoke/clicker.ts.

import { expect } from "@playwright/test";
import { seededRandom } from "../../convex/table/roundRobin";
import { DESK } from "../../scripts/viewports.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { CLICKER_SEED_KEY, CLICKER_STEPS_KEY, DEFAULT_STEPS, chaosOf, openScreen, takeStep, textsOf, type ClickerRun } from "../support/smoke/clicker";
import { test } from "../support/smoke/errorsTest";
import { expectPageSound } from "../support/smoke/pageChecks";

const runSeed = process.env[CLICKER_SEED_KEY] ?? "";
const steps = Number(process.env[CLICKER_STEPS_KEY] ?? DEFAULT_STEPS);

test.describe("random clicker on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  for (const [session, start] of BUILT_SCREENS) {
    test(`?preview=${session} from ${start}`, async ({ page, errors, outsideRequests }) => {
      expect(runSeed, `${CLICKER_SEED_KEY}, which playwright.clicker.config.ts sets`).not.toBe("");
      const seed = `${runSeed}:${session}:${start}`;
      const random = seededRandom(seed);
      const run: ClickerRun = { page, session, start, chaos: chaosOf(random), random, texts: textsOf(seed) };
      const said = [`open ${start} as ${session}, chaos ${run.chaos ?? "off"}`];
      test.info().annotations.push({ type: "seed", description: `${CLICKER_SEED_KEY}=${runSeed}` });
      // A window a press opens is shut at once: the run stays on its one page.
      page.context().on("page", (opened) => void opened.close());

      const checked = async () => {
        expect(errors, "console or page errors").toEqual([]);
        expect(outsideRequests, "requests outside the app").toEqual([]);
        await expectPageSound(page);
      };

      // The steps taken, the last the one a failure followed.
      const stepsSaid = () => said.map((line, index) => `${index}. ${line}`).join("\n");
      try {
        await openScreen(run, start);
        await checked();
        for (let step = 0; step < steps; step += 1) {
          said.push(await takeStep(run));
          await checked();
        }
      } catch (error) {
        console.log(`${test.info().title}, ${CLICKER_SEED_KEY}=${runSeed}, failed after:\n${stepsSaid()}`);
        throw error;
      } finally {
        await test.info().attach("steps", { body: stepsSaid(), contentType: "text/plain" });
      }
    });
  }
});
