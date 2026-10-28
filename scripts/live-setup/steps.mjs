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
  RESEND_KEY_PREFIX,
  RESEND_REGION,
  RESEND_VERIFIED,
  SETTING,
  VERCEL_PRODUCTION,
  VERCEL_PROJECT,
  VERIFY_POLL_EVERY_MS,
  VERIFY_POLL_FOR_MS,
} from "./live.mjs";
import { secretKeeper, signInKeys } from "./secrets.mjs";

export const ALREADY_DONE = "already done";
export const DONE = "done";
/** What a step that is waiting on someone else (Resend's check of the DNS) reports. */
export const NOT_YET = "not yet";
export const FAILED = "failed";

/** A Resend DNS record's name relative to the domain, as Vercel's DNS names it. */
const relativeName = (name) => (name.endsWith(`.${LIVE_DOMAIN}`) ? name.slice(0, -LIVE_DOMAIN.length - 1) : name);

const sameRecord = (resend, vercel) =>
  vercel.type === resend.type &&
  relativeName(vercel.name).toLowerCase() === relativeName(resend.name).toLowerCase() &&
  vercel.value === resend.value;

/** A pasted key, kept as a secret, or a refusal that names what was wrong and never the key. */
async function pastedKey(run, question, prefix) {
  const key = run.secrets.keep((await run.tools.askHidden(question)).trim());
  if (!key.startsWith(prefix)) throw new Error(`that key doesn't start with "${prefix}", so it isn't the one asked for: nothing was saved`);
  return key;
}

/** Resend's API key: the one pasted this run, or the one already on the live deployment. */
async function resendKey(run) {
  run.resendKey ??= (await run.convexNames()).includes(SETTING.resendKey)
    ? run.secrets.keep(await run.tools.convex.getSetting(SETTING.resendKey))
    : await pastedKey(run, `Paste the Resend API key, full access (it won't show): `, RESEND_KEY_PREFIX);
  return run.resendKey;
}

async function resendDomain(run) {
  const key = await resendKey(run);
  const listed = (await run.tools.resend.domains(key)).find((domain) => domain.name === LIVE_DOMAIN);
  return listed && run.tools.resend.domain(key, listed.id);
}

/** A setting with a value anyone may see: set unless it already holds `value`. */
async function plainSetting(run, name, value) {
  if ((await run.tools.convex.getSetting(name)) === value) return ALREADY_DONE;
  await run.tools.convex.setSetting(name, value);
  return DONE;
}

/** The steps, in order. Each `run` returns ALREADY_DONE, DONE, or `{ outcome: NOT_YET, why }`, and
 *  throws when it can't be done. */
export const STEPS = [
  {
    title: "The live database",
    async run(run) {
      if (await run.tools.convex.deploymentExists()) return ALREADY_DONE;
      await run.tools.convex.createDeployment();
      return DONE;
    },
  },
  {
    title: `Sign-in keys (${SETTING.jwtPrivateKey}, ${SETTING.jwks})`,
    async run(run) {
      const names = await run.convexNames();
      if (names.includes(SETTING.jwtPrivateKey) && names.includes(SETTING.jwks)) return ALREADY_DONE;
      // The two are a pair, so one missing makes both again.
      for (const [name, value] of Object.entries(signInKeys())) await run.tools.convex.setSetting(name, run.secrets.keep(value));
      run.forgetConvexNames();
      return DONE;
    },
  },
  {
    title: `Where links point (${SETTING.siteUrl})`,
    run: (run) => plainSetting(run, SETTING.siteUrl, LIVE_SITE_URL),
  },
  {
    title: `The admin (${SETTING.adminEmail})`,
    async run(run) {
      const held = (await run.convexNames()).includes(SETTING.adminEmail) ? await run.tools.convex.getSetting(SETTING.adminEmail) : null;
      if (held && (!run.options.adminEmail || run.options.adminEmail === held)) return ALREADY_DONE;
      const email = run.options.adminEmail || (await run.tools.ask("The admin's email address: ")).trim();
      if (!email.includes("@")) throw new Error(`"${email}" isn't an email address: nothing was saved`);
      await run.tools.convex.setSetting(SETTING.adminEmail, email);
      return DONE;
    },
  },
  {
    title: `Resend's key (${SETTING.resendKey})`,
    async run(run) {
      if ((await run.convexNames()).includes(SETTING.resendKey)) return ALREADY_DONE;
      await run.tools.convex.setSetting(SETTING.resendKey, await resendKey(run));
      run.forgetConvexNames();
      return DONE;
    },
  },
  {
    title: `The sender (${SETTING.sender}, ${LIVE_SENDER})`,
    run: (run) => plainSetting(run, SETTING.sender, LIVE_SENDER),
  },
  {
    title: "The server code on the live database",
    async run(run) {
      if (await run.tools.convex.hasFunction(DEPLOYED_FUNCTION)) return ALREADY_DONE;
      await run.tools.convex.deploy();
      return DONE;
    },
  },
  {
    title: `The Vercel project (${VERCEL_PROJECT})`,
    async run(run) {
      const linked = await run.tools.vercel.linkedProject();
      if (linked) {
        if (linked.projectName && linked.projectName !== VERCEL_PROJECT) {
          throw new Error(`this checkout is linked to the Vercel project "${linked.projectName}", not "${VERCEL_PROJECT}"`);
        }
        return ALREADY_DONE;
      }
      await run.tools.vercel.link(VERCEL_PROJECT);
      return DONE;
    },
  },
  {
    title: `The deploy key in Vercel (${DEPLOY_KEY_SETTING}, ${VERCEL_PRODUCTION})`,
    async run(run) {
      if ((await run.tools.vercel.envNames(VERCEL_PRODUCTION)).includes(DEPLOY_KEY_SETTING)) return ALREADY_DONE;
      const key = await pastedKey(run, "Paste the Convex production deploy key (it won't show): ", DEPLOY_KEY_PREFIX);
      await run.tools.vercel.addEnv(DEPLOY_KEY_SETTING, VERCEL_PRODUCTION, key);
      return DONE;
    },
  },
  {
    title: `The domain on the Vercel project (${LIVE_DOMAIN})`,
    async run(run) {
      if ((await run.tools.vercel.projectDomains()).includes(LIVE_DOMAIN)) return ALREADY_DONE;
      await run.tools.vercel.addDomain(LIVE_DOMAIN, VERCEL_PROJECT);
      return DONE;
    },
  },
  {
    title: `The domain in Resend (${LIVE_DOMAIN})`,
    async run(run) {
      if (await resendDomain(run)) return ALREADY_DONE;
      await run.tools.resend.createDomain(await resendKey(run), LIVE_DOMAIN, RESEND_REGION);
      return DONE;
    },
  },
  {
    title: "Resend's DNS records in Vercel's DNS",
    async run(run) {
      const domain = await resendDomain(run);
      if (!domain) throw new Error(`Resend has no ${LIVE_DOMAIN}`);
      const held = await run.tools.vercel.dnsRecords(LIVE_DOMAIN);
      const missing = domain.records.filter((record) => !held.some((existing) => sameRecord(record, existing)));
      if (missing.length === 0) return ALREADY_DONE;
      for (const record of missing) {
        await run.tools.vercel.addDnsRecord(LIVE_DOMAIN, { ...record, name: relativeName(record.name) });
      }
      return DONE;
    },
  },
  {
    title: `Resend's check of ${LIVE_DOMAIN}`,
    async run(run) {
      const key = await resendKey(run);
      let domain = await resendDomain(run);
      if (!domain) throw new Error(`Resend has no ${LIVE_DOMAIN}`);
      if (domain.status === RESEND_VERIFIED) return ALREADY_DONE;
      await run.tools.resend.verify(key, domain.id);
      for (let waited = 0; waited < VERIFY_POLL_FOR_MS; waited += VERIFY_POLL_EVERY_MS) {
        await run.tools.sleep(VERIFY_POLL_EVERY_MS);
        domain = await run.tools.resend.domain(key, domain.id);
        if (domain.status === RESEND_VERIFIED) return DONE;
      }
      return { outcome: NOT_YET, why: `Resend says "${domain.status}": new DNS records can take hours to be seen, so run this again later` };
    },
  },
  {
    title: "One player-positions sync",
    async run(run) {
      const ranWell = (rows) => rows.some((row) => row.outcome.ok);
      if (ranWell(await run.tools.convex.run(POSITIONS_SYNC_LATEST))) return ALREADY_DONE;
      await run.tools.convex.run(POSITIONS_SYNC_RUN, MANUAL_TRIGGER);
      const [newest] = await run.tools.convex.run(POSITIONS_SYNC_LATEST);
      if (!newest?.outcome.ok) throw new Error(`the sync ran but failed: ${newest?.outcome.error ?? "it left no row"}`);
      return DONE;
    },
  },
];

/** Runs every step, printing one line each, and stops at the first that fails: after a fix, a
 *  re-run picks up where it stopped. True when every step is done. */
export async function setUpLive(tools, options = {}, steps = STEPS) {
  const secrets = secretKeeper();
  let names;
  const run = {
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
      const result = await step.run(run);
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
