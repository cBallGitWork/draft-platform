import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { expect, test } from "vitest";
import {
  DEPLOY_KEY_SETTING,
  LIVE_DOMAIN,
  LIVE_SENDER,
  LIVE_SITE_URL,
  RESEND_REGION,
  RESEND_VERIFIED,
  SETTING,
  VERCEL_PRODUCTION,
} from "../../../scripts/live-setup/live.mjs";
import { HIDDEN, secretKeeper, signInKeys } from "../../../scripts/live-setup/secrets.mjs";
import { ALREADY_DONE, DONE, FAILED, NOT_YET, STEPS, setUpLive } from "../../../scripts/live-setup/steps.mjs";
import { ADMIN, DEPLOY_KEY, RESEND_KEY, RESEND_RECORDS, fakeWorld } from "../../support/scripts/liveSetup.harness.mjs";

const OTHER_ADMIN = "someone@example.com";
/** The lines a run printed, each step's title and what it said. */
const outcomes = (world) => world.printed.map((line) => line.slice(line.lastIndexOf(": ") + 2));

/** Every secret the world holds once set up: the pasted keys and the keys the command made. */
function secretsIn(world) {
  return [RESEND_KEY, DEPLOY_KEY, world.convex.settings.get(SETTING.jwtPrivateKey), world.convex.settings.get(SETTING.jwks)].filter(Boolean);
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
  expect(world.printed).toHaveLength(STEPS.length);
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
  expect(secretsIn(world)).toHaveLength(4);
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
  const stoppedAt = world.printed.length - 1;
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
  expect(outcomes(world).at(-1)).toBe(DONE);
  expect(world.printed.at(-2)).toContain(`${NOT_YET}: Resend says "pending"`);

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
