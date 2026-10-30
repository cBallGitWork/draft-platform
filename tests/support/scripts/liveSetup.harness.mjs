// The live-setup command's tests' world: a faked Convex, Vercel and Resend that keep what they're
// told, answer as the real ones do (scripts/live-setup/tools.mjs), and note every change, so a
// test can run the command twice and see the second run change nothing.

import {
  ALLOW_EMAIL,
  DEPLOYED_FUNCTION,
  POSITIONS_SYNC_LATEST,
  POSITIONS_SYNC_RUN,
  RESEND_VERIFIED,
} from "../../../scripts/live-setup/live.mjs";
import { setUpLive } from "../../../scripts/live-setup/steps.mjs";

export const RESEND_KEY = "re_FakeResendKey_0123456789abcdef";
export const CHECK_EMAIL = "release-check@abc123def.resend.app";
/** What the faked Convex says of a live deployment it hasn't got. */
export const NO_DEPLOYMENT = "no production deployment";
export const DEPLOY_KEY = "prod:fake-deployment-123|eyFakeDeployKey0123456789abcdef";
export const ADMIN = "craig@example.com";

/** The records Resend asks a new domain to publish (its API reference's example, for eu-west-1). */
export const RESEND_RECORDS = [
  { record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNFAKE", ttl: "Auto", status: "not_started" },
  { record: "SPF", name: "send", type: "MX", value: "feedback-smtp.eu-west-1.amazonses.com", priority: 10, ttl: "Auto", status: "not_started" },
  { record: "SPF", name: "send", type: "TXT", value: "v=spf1 include:amazonses.com ~all", ttl: "Auto", status: "not_started" },
];

/** A world with nothing set up, the tools the command reaches it with, and what it printed,
 *  asked and changed. `checksBeforeVerified` is how many of Resend's polls answer before the DNS
 *  is seen (Infinity: never). */
export function fakeWorld({ checksBeforeVerified = 0 } = {}) {
  const world = {
    convex: { exists: false, settings: new Map(), deployed: false, syncs: [], allowed: [] },
    // The git settings the live project had (30 Oct 2026): no dispatch events.
    vercel: {
      linked: null,
      env: [],
      domains: [],
      dns: [],
      repo: null,
      gitProviderOptions: { createDeployments: "disabled", disableRepositoryDispatchEvents: true },
    },
    github: { secrets: new Map() },
    resend: { domains: [] },
    printed: [],
    asked: [],
    changes: [],
  };
  const change = (what) => world.changes.push(what);
  const needsDeployment = () => {
    if (!world.convex.exists) throw new Error(NO_DEPLOYMENT);
  };
  const resendDomain = (id) => world.resend.domains.find((domain) => domain.id === id);
  let polls = 0;

  world.tools = {
    print: (line) => world.printed.push(line),
    sleep: async () => {},
    ask: async (question) => {
      world.asked.push(question);
      return question.startsWith("Make a live deployment") ? "yes" : ADMIN;
    },
    askHidden: async (question) => {
      world.asked.push(question);
      if (question.includes("receiving address")) return CHECK_EMAIL;
      return question.includes("Resend") ? RESEND_KEY : DEPLOY_KEY;
    },
    convex: {
      deploymentProblem: async () => (world.convex.exists ? null : NO_DEPLOYMENT),
      createDeployment: async () => {
        change("convex deployment");
        world.convex.exists = true;
      },
      settingNames: async () => {
        needsDeployment();
        return [...world.convex.settings.keys()];
      },
      getSetting: async (name) => {
        needsDeployment();
        return world.convex.settings.get(name) ?? "";
      },
      setSetting: async (name, value) => {
        needsDeployment();
        change(`convex setting ${name}`);
        world.convex.settings.set(name, value);
      },
      hasFunction: async (identifier) => world.convex.deployed && identifier === DEPLOYED_FUNCTION,
      deploy: async () => {
        needsDeployment();
        change("convex deploy");
        world.convex.deployed = true;
      },
      allowedEmails: async () => {
        needsDeployment();
        return [...world.convex.allowed];
      },
      run: async (fn, args) => {
        if (!world.convex.deployed) throw new Error(`no function ${fn}`);
        if (fn === POSITIONS_SYNC_LATEST) return [...world.convex.syncs].reverse();
        if (fn === ALLOW_EMAIL) {
          if (world.convex.allowed.includes(args.email)) return "already on the list";
          change("convex allowed email");
          world.convex.allowed.push(args.email);
          return "added";
        }
        if (fn !== POSITIONS_SYNC_RUN) throw new Error(`no fake for ${fn}`);
        change("positions sync");
        world.convex.syncs.push({ outcome: { ok: true } });
        return null;
      },
    },
    vercel: {
      linkedProject: async () => world.vercel.linked,
      link: async (projectName) => {
        change("vercel link");
        world.vercel.linked = { projectId: "prj_fake", orgId: "team_fake", projectName };
      },
      envTargets: async (key) => world.vercel.env.filter((env) => env.key === key).map((env) => env.target),
      addEnv: async (key, target, value) => {
        change(`vercel env ${key}`);
        world.vercel.env.push({ key, target, value });
      },
      projectDomains: async () => [...world.vercel.domains],
      addDomain: async (domain) => {
        change(`vercel domain ${domain}`);
        world.vercel.domains.push(domain);
      },
      dnsRecords: async () => world.vercel.dns.map(({ name, type, value }) => ({ name, type, value })),
      addDnsRecord: async (_domain, record) => {
        change(`vercel dns ${record.type} ${record.name}`);
        world.vercel.dns.push(record);
      },
      connectedRepo: async () => world.vercel.repo,
      connectRepo: async (url) => {
        change("vercel git connect");
        world.vercel.repo = new URL(url).pathname.slice(1);
      },
      gitProviderOptions: async () => ({ ...world.vercel.gitProviderOptions }),
      setGitProviderOptions: async (options) => {
        change("vercel git options");
        world.vercel.gitProviderOptions = { ...options };
      },
    },
    github: {
      secretNames: async () => [...world.github.secrets.keys()],
      setSecret: async (name, value) => {
        change(`github secret ${name}`);
        world.github.secrets.set(name, value);
      },
    },
    resend: {
      domains: async (key) => {
        if (key !== RESEND_KEY) throw new Error("Resend refused the key");
        return world.resend.domains.map(({ id, name, status }) => ({ id, name, status }));
      },
      domain: async (_key, id) => {
        const domain = resendDomain(id);
        if (domain.checking && ++polls > checksBeforeVerified) domain.status = RESEND_VERIFIED;
        return structuredClone(domain);
      },
      createDomain: async (_key, name, region) => {
        change(`resend domain ${name}`);
        world.resend.domains.push({ id: "resend-domain-1", name, region, status: "not_started", records: RESEND_RECORDS });
      },
      verify: async (_key, id) => {
        change("resend verify");
        Object.assign(resendDomain(id), { status: "pending", checking: true });
      },
    },
  };
  return world;
}

/** A world the command has set up in full, with what that run printed, asked and changed
 *  cleared, so a test can break one part and see what a re-run does to it alone. */
export async function setUpWorld() {
  const world = fakeWorld();
  if (!(await setUpLive(world.tools))) throw new Error(`the setup didn't finish: ${world.printed.at(-1)}`);
  world.printed.length = world.asked.length = world.changes.length = 0;
  return world;
}
