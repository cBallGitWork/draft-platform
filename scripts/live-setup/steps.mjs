// The setup command's steps (spec/20, Setting it up), each checking first and saying "already
// done" when there's nothing to do, so a second run changes nothing and says so. Every service is
// reached through `tools` (tools.mjs holds the real ones; the tests pass fakes), and every line
// printed goes through `hide`, so no secret is printed, whole or in part.

import {
  DEPLOYED_FUNCTION,
  DEPLOY_KEY_PREFIX,
  DEPLOY_KEY_SETTING,
  LIVE_DOMAIN,
  LIVE_SENDER,
  LIVE_SITE_URL,
  MANUAL_TRIGGER,
  POSITIONS_SYNC_LATEST,
  POSITIONS_SYNC_RUN,
  SETTING,
  VERCEL_PRODUCTION,
  VERCEL_PROJECT,
} from "./live.mjs";
import { ALREADY_DONE, DONE, FAILED } from "./outcomes.mjs";
import { RELEASE_STEPS } from "./releaseSteps.mjs";
import { RESEND_STEPS } from "./resendSteps.mjs";
import { pastedKey, resendKey, secretKeeper, signInKeys } from "./secrets.mjs";

/** A setting with a value anyone may see: set unless it already holds `value`. */
async function plainSetting(setup, name, value) {
  if ((await setup.tools.convex.getSetting(name)) === value) return ALREADY_DONE;
  await setup.tools.convex.setSetting(name, value);
  return DONE;
}

const CONVEX_STEPS = [
  {
    title: "The live database",
    async run(setup) {
      if (await setup.tools.convex.deploymentExists()) return ALREADY_DONE;
      await setup.tools.convex.createDeployment();
      return DONE;
    },
  },
  {
    title: `Sign-in keys (${SETTING.jwtPrivateKey}, ${SETTING.jwks})`,
    async run(setup) {
      const names = await setup.convexNames();
      if (names.includes(SETTING.jwtPrivateKey) && names.includes(SETTING.jwks)) return ALREADY_DONE;
      // The two are a pair, so one missing makes both again.
      for (const [name, value] of Object.entries(signInKeys())) await setup.tools.convex.setSetting(name, setup.secrets.keep(value));
      setup.forgetConvexNames();
      return DONE;
    },
  },
  {
    title: `Where links point (${SETTING.siteUrl})`,
    run: (setup) => plainSetting(setup, SETTING.siteUrl, LIVE_SITE_URL),
  },
  {
    title: `The admin (${SETTING.adminEmail})`,
    async run(setup) {
      const held = (await setup.convexNames()).includes(SETTING.adminEmail) ? await setup.tools.convex.getSetting(SETTING.adminEmail) : null;
      if (held && (!setup.options.adminEmail || setup.options.adminEmail === held)) return ALREADY_DONE;
      const email = setup.options.adminEmail || (await setup.tools.ask("The admin's email address: ")).trim();
      if (!email.includes("@")) throw new Error(`"${email}" isn't an email address: nothing was saved`);
      await setup.tools.convex.setSetting(SETTING.adminEmail, email);
      return DONE;
    },
  },
  {
    title: `Resend's key (${SETTING.resendKey})`,
    async run(setup) {
      if ((await setup.convexNames()).includes(SETTING.resendKey)) return ALREADY_DONE;
      await setup.tools.convex.setSetting(SETTING.resendKey, await resendKey(setup));
      setup.forgetConvexNames();
      return DONE;
    },
  },
  {
    title: `The sender (${SETTING.sender}, ${LIVE_SENDER})`,
    run: (setup) => plainSetting(setup, SETTING.sender, LIVE_SENDER),
  },
  {
    title: "The server code on the live database",
    async run(setup) {
      if (await setup.tools.convex.hasFunction(DEPLOYED_FUNCTION)) return ALREADY_DONE;
      await setup.tools.convex.deploy();
      return DONE;
    },
  },
];

const VERCEL_STEPS = [
  {
    title: `The Vercel project (${VERCEL_PROJECT})`,
    async run(setup) {
      const linked = await setup.tools.vercel.linkedProject();
      if (linked) {
        if (linked.projectName && linked.projectName !== VERCEL_PROJECT) {
          throw new Error(`this checkout is linked to the Vercel project "${linked.projectName}", not "${VERCEL_PROJECT}"`);
        }
        return ALREADY_DONE;
      }
      await setup.tools.vercel.link(VERCEL_PROJECT);
      return DONE;
    },
  },
  {
    title: `The deploy key in Vercel (${DEPLOY_KEY_SETTING}, ${VERCEL_PRODUCTION} only)`,
    async run(setup) {
      const targets = await setup.tools.vercel.envTargets(DEPLOY_KEY_SETTING);
      // Anywhere else, a preview's build could deploy to the live database.
      const elsewhere = targets.filter((target) => target !== VERCEL_PRODUCTION);
      if (elsewhere.length > 0) {
        throw new Error(`Vercel holds ${DEPLOY_KEY_SETTING} for ${elsewhere.join(", ")} too: remove it there, in the project's settings`);
      }
      if (targets.includes(VERCEL_PRODUCTION)) return ALREADY_DONE;
      const key = await pastedKey(setup, "Paste the Convex production deploy key (it won't show): ", DEPLOY_KEY_PREFIX);
      await setup.tools.vercel.addEnv(DEPLOY_KEY_SETTING, VERCEL_PRODUCTION, key);
      return DONE;
    },
  },
  {
    title: `The domain on the Vercel project (${LIVE_DOMAIN})`,
    async run(setup) {
      if ((await setup.tools.vercel.projectDomains()).includes(LIVE_DOMAIN)) return ALREADY_DONE;
      await setup.tools.vercel.addDomain(LIVE_DOMAIN, VERCEL_PROJECT);
      return DONE;
    },
  },
];

const POSITIONS_STEP = {
  title: "One player-positions sync",
  async run(setup) {
    const ranWell = (rows) => rows.some((row) => row.outcome.ok);
    if (ranWell(await setup.tools.convex.run(POSITIONS_SYNC_LATEST))) return ALREADY_DONE;
    await setup.tools.convex.run(POSITIONS_SYNC_RUN, MANUAL_TRIGGER);
    const [newest] = await setup.tools.convex.run(POSITIONS_SYNC_LATEST);
    if (!newest?.outcome.ok) throw new Error(`the sync ran but failed: ${newest?.outcome.error ?? "it left no row"}`);
    return DONE;
  },
};

/** The steps, in order. Each `run` returns ALREADY_DONE, DONE, or `{ outcome: NOT_YET, why }`, and
 *  throws when it can't be done. */
export const STEPS = [...CONVEX_STEPS, ...VERCEL_STEPS, ...RESEND_STEPS, POSITIONS_STEP, ...RELEASE_STEPS];

/** Runs every step, printing one line each, and stops at the first that fails: after a fix, a
 *  re-run picks up where it stopped. True when every step is done. */
export async function setUpLive(tools, options = {}, steps = STEPS) {
  const secrets = secretKeeper();
  let names;
  const setup = {
    tools,
    options,
    secrets,
    // The live deployment's setting names, read once and again after a step adds one.
    convexNames: async () => (names ??= await tools.convex.settingNames()),
    forgetConvexNames: () => (names = undefined),
  };
  const say = (line) => tools.print(secrets.hide(line));
  let allDone = true;
  for (const step of steps) {
    try {
      const result = await step.run(setup);
      if (typeof result === "string") {
        say(`${step.title}: ${result}`);
      } else {
        allDone = false;
        say(`${step.title}: ${result.outcome}: ${result.why}`);
      }
    } catch (error) {
      say(`${step.title}: ${FAILED}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  return allDone;
}
