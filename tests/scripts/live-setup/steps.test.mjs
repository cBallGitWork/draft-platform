import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { expect, test } from "vitest";
import {
  DEPLOY_KEY_SETTING,
  GITHUB_REPO,
  LIVE_DOMAIN,
  LIVE_SENDER,
  LIVE_SITE_URL,
  POSITIONS_SYNC_RUN,
  RELEASE_CHECK_SECRET,
  RESEND_REGION,
  RESEND_VERIFIED,
  SETTING,
  VERCEL_PRODUCTION,
  VERCEL_PROJECT,
} from "../../../scripts/live-setup/live.mjs";
import { HIDDEN, secretKeeper, signInKeys } from "../../../scripts/live-setup/secrets.mjs";
import { ALREADY_DONE, DONE, FAILED, NOT_YET } from "../../../scripts/live-setup/outcomes.mjs";
import { STEPS, setUpLive } from "../../../scripts/live-setup/steps.mjs";
import { ADMIN, CHECK_EMAIL, DEPLOY_KEY, NO_DEPLOYMENT, RESEND_KEY, RESEND_RECORDS, fakeWorld, setUpWorld } from "../../support/scripts/liveSetup.harness.mjs";

const OTHER_ADMIN = "someone@example.com";
const OTHER_VERCEL_PROJECT = "someone-elses-project";
const NOT_AN_EMAIL = "craig.example.com";
const SYNC_ERROR = "the FPL feed timed out";
/** The lines a run printed for its steps, each a step's title and what it said. */
const stepLines = (world) => world.printed.filter((line) => STEPS.some((step) => line.startsWith(`${step.title}: `)));
const outcomes = (world) => stepLines(world).map((line) => line.slice(line.lastIndexOf(": ") + 2));

/** Every secret the world holds once set up: the pasted keys and the keys the command made. */
function secretsIn(world) {
  const made = [world.convex.settings.get(SETTING.jwtPrivateKey), world.convex.settings.get(SETTING.jwks)];
  return [RESEND_KEY, DEPLOY_KEY, CHECK_EMAIL, ...made].filter(Boolean);
}

/** Each whitespace-separated piece of a secret long enough to identify it. */
const piecesOf = (secret) => secret.split(/\s+/).filter((piece) => piece.length >= 16);

function expectNoSecretPrinted(world) {
  const printed = world.printed.join("\n");
  for (const secret of secretsIn(world)) {
    expect(printed).not.toContain(secret);
    for (const piece of piecesOf(secret)) expect(printed).not.toContain(piece);
  }
}

test("a first run on nothing sets up every part of the live site (spec/20, Setting it up)", async () => {
  const world = fakeWorld();
  expect(await setUpLive(world.tools)).toBe(true);
  expect(world.printed[0]).toBe(`Convex couldn't reach a live deployment: ${NO_DEPLOYMENT}`);
  expect(stepLines(world)).toHaveLength(STEPS.length);
  expect(outcomes(world)).toEqual(STEPS.map(() => DONE));

  const { settings } = world.convex;
  expect(Object.values(SETTING).every((name) => settings.has(name))).toBe(true);
  expect(settings.get(SETTING.siteUrl)).toBe(LIVE_SITE_URL);
  expect(settings.get(SETTING.adminEmail)).toBe(ADMIN);
  expect(settings.get(SETTING.resendKey)).toBe(RESEND_KEY);
  expect(settings.get(SETTING.sender)).toBe(LIVE_SENDER);
  expect(world.vercel.env).toEqual([{ key: DEPLOY_KEY_SETTING, target: VERCEL_PRODUCTION, value: DEPLOY_KEY }]);
  expect(world.vercel.domains).toEqual([LIVE_DOMAIN]);
  expect(world.vercel.dns.map(({ type, name, value }) => ({ type, name, value }))).toEqual(
    RESEND_RECORDS.map(({ type, name, value }) => ({ type, name, value })),
  );
  expect(world.resend.domains).toMatchObject([{ name: LIVE_DOMAIN, region: RESEND_REGION, status: RESEND_VERIFIED }]);
  expect(world.convex.syncs).toHaveLength(1);
  expect(world.vercel.repo).toBe(GITHUB_REPO);
  expect(Object.fromEntries(world.github.secrets)).toEqual({ [RELEASE_CHECK_SECRET.email]: CHECK_EMAIL, [RELEASE_CHECK_SECRET.resendKey]: RESEND_KEY });
  expect(world.convex.allowed).toEqual([CHECK_EMAIL]);
});

test("when Convex can't reach a live deployment, none is made unless Craig says yes", async () => {
  const world = fakeWorld();
  world.tools.ask = async () => "no";
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed).toEqual([
    `Convex couldn't reach a live deployment: ${NO_DEPLOYMENT}`,
    `${STEPS[0].title}: ${FAILED}: no live deployment was made: sign in, or check Convex, and run again`,
  ]);
  expect(world.changes).toEqual([]);
});

test("a deploy key Vercel holds for previews too is refused: a preview could deploy to the live database", async () => {
  const world = fakeWorld();
  world.vercel.env.push({ key: DEPLOY_KEY_SETTING, target: "preview", value: DEPLOY_KEY });
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toContain(
    `${FAILED}: Vercel holds ${DEPLOY_KEY_SETTING} for preview too: remove it there, in the project's settings`,
  );
  expect(world.changes).not.toContain(`vercel env ${DEPLOY_KEY_SETTING}`);
});

test("a checkout linked to another Vercel project is refused, and nothing is changed", async () => {
  const world = await setUpWorld();
  world.vercel.linked.projectName = OTHER_VERCEL_PROJECT;
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toContain(
    `${FAILED}: this checkout is linked to the Vercel project "${OTHER_VERCEL_PROJECT}", not "${VERCEL_PROJECT}"`,
  );
  expect(world.changes).toEqual([]);
  expect(world.vercel.linked.projectName).toBe(OTHER_VERCEL_PROJECT);
});

test("an admin address that isn't an email is refused, and the admin held stays", async () => {
  const world = await setUpWorld();
  expect(await setUpLive(world.tools, { adminEmail: NOT_AN_EMAIL })).toBe(false);
  expect(world.printed.at(-1)).toContain(`${SETTING.adminEmail}): ${FAILED}: "${NOT_AN_EMAIL}" isn't an email address: nothing was saved`);
  expect(world.changes).toEqual([]);
  expect(world.convex.settings.get(SETTING.adminEmail)).toBe(ADMIN);
});

test("a positions sync that runs but fails is a failure, saying why, and the run stops there", async () => {
  const world = await setUpWorld();
  world.convex.syncs.length = 0;
  const { run } = world.tools.convex;
  world.tools.convex.run = async (fn, args) => {
    if (fn !== POSITIONS_SYNC_RUN) return run(fn, args);
    world.convex.syncs.push({ outcome: { ok: false, error: SYNC_ERROR } });
    return null;
  };
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toContain(`${FAILED}: the sync ran but failed: ${SYNC_ERROR}`);
  const ranAfter = STEPS.slice(STEPS.findIndex((step) => world.printed.at(-1).startsWith(`${step.title}: `)) + 1);
  expect(ranAfter.length).toBeGreaterThan(0);
  expect(world.printed.filter((line) => ranAfter.some((step) => line.startsWith(`${step.title}: `)))).toEqual([]);
});

test("an address that isn't Resend's receiving one is refused for the release check, and nothing is saved", async () => {
  const world = fakeWorld();
  const { askHidden } = world.tools;
  world.tools.askHidden = async (question) => (question.includes("receiving address") ? ADMIN : askHidden(question));
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toContain(`${FAILED}: that isn't a Resend receiving address`);
  expect(world.github.secrets.size).toBe(0);
  expect(world.convex.allowed).toEqual([]);
});

test("a second run changes nothing, asks nothing, and says every step is already done", async () => {
  const world = fakeWorld();
  await setUpLive(world.tools);
  world.printed.length = world.asked.length = world.changes.length = 0;

  expect(await setUpLive(world.tools)).toBe(true);
  expect(outcomes(world)).toEqual(STEPS.map(() => ALREADY_DONE));
  expect(world.changes).toEqual([]);
  expect(world.asked).toEqual([]);
});

test("no secret is printed, whole or in part, on a first run or a second (spec/20)", async () => {
  const world = fakeWorld();
  await setUpLive(world.tools);
  await setUpLive(world.tools);
  expect(secretsIn(world)).toHaveLength(5);
  expectNoSecretPrinted(world);
});

test("a tool that fails saying a secret has it hidden, and the run stops there", async () => {
  const world = fakeWorld();
  const { addEnv } = world.tools.vercel;
  world.tools.vercel.addEnv = async (_key, _target, value) => {
    throw new Error(`Vercel refused ${value}, first line ${value.slice(0, 20)}`);
  };
  expect(await setUpLive(world.tools)).toBe(false);

  const failed = world.printed.at(-1);
  expect(failed).toContain(`${FAILED}: Vercel refused ${HIDDEN}`);
  expect(failed).not.toContain(DEPLOY_KEY);
  expect(world.changes).not.toContain(`vercel domain ${LIVE_DOMAIN}`);

  // Fixed, a re-run picks up at the step that failed.
  world.tools.vercel.addEnv = addEnv;
  const stoppedAt = stepLines(world).length - 1;
  world.printed.length = 0;
  expect(await setUpLive(world.tools)).toBe(true);
  expect(outcomes(world).slice(0, stoppedAt)).toEqual(STEPS.slice(0, stoppedAt).map(() => ALREADY_DONE));
  expect(outcomes(world).slice(stoppedAt)).toEqual(STEPS.slice(stoppedAt).map(() => DONE));
});

test("a part of a secret a tool prints is hidden too: one line of the private key", () => {
  const secrets = secretKeeper();
  const key = secrets.keep(signInKeys()[SETTING.jwtPrivateKey]);
  const oneLine = key.split(" ")[4];
  expect(secrets.hide(`the key began ${oneLine}`)).toBe(`the key began ${HIDDEN}`);
});

test("a key pasted into the wrong prompt is refused, unsaved and unprinted", async () => {
  const world = fakeWorld();
  world.tools.askHidden = async () => DEPLOY_KEY; // the deploy key, where Resend's was asked for
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toMatch(`${SETTING.resendKey}): ${FAILED}: that key doesn't start with`);
  expect(world.convex.settings.has(SETTING.resendKey)).toBe(false);
  expect(world.printed.join("\n")).not.toContain(DEPLOY_KEY);
});

test("Resend not seeing the DNS in time is 'not yet', and the rest still runs", async () => {
  const world = fakeWorld({ checksBeforeVerified: Infinity });
  expect(await setUpLive(world.tools)).toBe(false);
  expect(stepLines(world)).toHaveLength(STEPS.length);
  const waiting = world.printed.filter((line) => line.includes(`: ${NOT_YET}: `));
  expect(waiting).toHaveLength(1);
  expect(waiting[0]).toContain(`Resend's check of ${LIVE_DOMAIN}: ${NOT_YET}: Resend says "pending"`);
  expect(outcomes(world).filter((said) => said === DONE)).toHaveLength(STEPS.length - 1);

  // Once the DNS is seen, a re-run finishes it.
  world.resend.domains[0].status = RESEND_VERIFIED;
  world.printed.length = 0;
  expect(await setUpLive(world.tools)).toBe(true);
  expect(outcomes(world)).toEqual(STEPS.map(() => ALREADY_DONE));
});

test("an admin named on the command line replaces the one held; with none named, the held one stays", async () => {
  const world = fakeWorld();
  await setUpLive(world.tools);
  await setUpLive(world.tools, { adminEmail: OTHER_ADMIN });
  expect(world.convex.settings.get(SETTING.adminEmail)).toBe(OTHER_ADMIN);
  await setUpLive(world.tools);
  expect(world.convex.settings.get(SETTING.adminEmail)).toBe(OTHER_ADMIN);
});

test("one of the two sign-in keys missing makes both again, as they're a pair", async () => {
  const world = fakeWorld();
  await setUpLive(world.tools);
  const jwks = world.convex.settings.get(SETTING.jwks);
  world.convex.settings.delete(SETTING.jwtPrivateKey);
  await setUpLive(world.tools);
  expect(world.convex.settings.has(SETTING.jwtPrivateKey)).toBe(true);
  expect(world.convex.settings.get(SETTING.jwks)).not.toBe(jwks);
});

test("the keys made sign and verify as a pair, in the shape Convex Auth reads", () => {
  const keys = signInKeys();
  const pem = keys[SETTING.jwtPrivateKey];
  expect(pem).not.toContain("\n");
  const body = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const privateKey = createPrivateKey({ key: Buffer.from(body, "base64"), format: "der", type: "pkcs8" });
  const [jwk] = JSON.parse(keys[SETTING.jwks]).keys;
  expect(jwk).toMatchObject({ use: "sig", kty: "RSA" });

  const signed = sign("sha256", Buffer.from("a token"), privateKey);
  expect(verify("sha256", Buffer.from("a token"), createPublicKey({ key: jwk, format: "jwk" }), signed)).toBe(true);
});
