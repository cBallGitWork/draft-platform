import { expect, test } from "vitest";
import { LIVE_DOMAIN } from "../../../scripts/live-setup/live.mjs";
import { ALREADY_DONE, DONE, FAILED } from "../../../scripts/live-setup/outcomes.mjs";
import { RESEND_STEPS } from "../../../scripts/live-setup/resendSteps.mjs";
import { setUpLive } from "../../../scripts/live-setup/steps.mjs";
import { setUpWorld } from "../../support/scripts/liveSetup.harness.mjs";

const DNS_STEP = RESEND_STEPS.find((step) => step.title.includes("DNS records")).title;
/** What the DNS step said on the last run. */
const dnsLine = (world) => world.printed.find((line) => line.startsWith(`${DNS_STEP}: `))?.slice(DNS_STEP.length + 2);

/** Resend's records for the live domain, with the return-path CNAME it added (30 Oct 2026), its
 *  SPF TXT in quotes as its API reference shows it, and a name given whole. */
const RESEND_LIVE_RECORDS = [
  { record: "SPF", name: "send", type: "MX", value: "feedback-smtp.eu-west-1.amazonses.com", priority: 10 },
  { record: "SPF", name: "send", type: "TXT", value: '"v=spf1 include:amazonses.com ~all"' },
  { record: "DKIM", name: `resend._domainkey.${LIVE_DOMAIN}`, type: "TXT", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNFAKE" },
  { record: "Tracking", name: "rsend", type: "CNAME", value: "send.forge.rmta.net" },
];
/** Those records as Vercel's records API answered for them (30 Oct 2026): host values with a
 *  closing dot, the MX priority apart as `mxPriority`, and one name in capitals. */
const VERCEL_LIVE_RECORDS = [
  { name: "rsend", type: "CNAME", value: "send.forge.rmta.net." },
  { name: "send", type: "TXT", value: "v=spf1 include:amazonses.com ~all" },
  { name: "send", type: "MX", value: "Feedback-SMTP.eu-west-1.amazonses.com.", mxPriority: 10 },
  { name: "Resend._domainkey", type: "TXT", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNFAKE" },
];

/** A set-up world whose Resend and Vercel hold the live shapes above. */
async function liveShapedWorld() {
  const world = await setUpWorld();
  world.resend.domains[0].records = RESEND_LIVE_RECORDS;
  world.vercel.dns = structuredClone(VERCEL_LIVE_RECORDS);
  return world;
}

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

test("records Vercel holds as DNS means Resend's, with closing dots, capitals, quotes and the MX priority apart, are already done", async () => {
  const world = await liveShapedWorld();
  expect(await setUpLive(world.tools)).toBe(true);
  expect(dnsLine(world)).toBe(ALREADY_DONE);
  expect(world.changes).toEqual([]);
});

test("an MX record Vercel holds at another priority is added at Resend's", async () => {
  const world = await liveShapedWorld();
  world.vercel.dns.find((record) => record.type === "MX").mxPriority = 20;
  expect(await setUpLive(world.tools)).toBe(true);
  expect(dnsLine(world)).toBe(DONE);
  expect(world.changes).toEqual(["vercel dns MX send"]);
  expect(world.vercel.dns.at(-1)).toEqual({ name: "send", type: "MX", value: "feedback-smtp.eu-west-1.amazonses.com.", mxPriority: 10 });
});

test("a CNAME Vercel holds pointing elsewhere is added, not taken as Resend's", async () => {
  const world = await liveShapedWorld();
  world.vercel.dns.find((record) => record.type === "CNAME").value = "elsewhere.example.com.";
  expect(await setUpLive(world.tools)).toBe(true);
  expect(world.changes).toEqual(["vercel dns CNAME rsend"]);
});

test("an add Vercel takes without then holding the record fails loudly, naming it, rather than saying done", async () => {
  const world = await liveShapedWorld();
  world.vercel.dns = world.vercel.dns.filter((record) => record.type !== "MX");
  world.tools.vercel.addDnsRecord = async () => {}; // Vercel answers, but never holds the record
  expect(await setUpLive(world.tools)).toBe(false);
  expect(world.printed.at(-1)).toBe(
    `${DNS_STEP}: ${FAILED}: Vercel took the add, but its DNS still hasn't MX send 10 feedback-smtp.eu-west-1.amazonses.com`,
  );
});
