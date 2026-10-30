// The setup command's Resend steps (steps.mjs runs them): the domain in Resend, its DNS records in
// Vercel's DNS, and Resend's check of them, so sign-in links can come from the live domain.

import { LIVE_DOMAIN, RESEND_REGION, RESEND_VERIFIED, VERIFY_POLL_EVERY_MS, VERIFY_POLL_FOR_MS } from "./live.mjs";
import { ALREADY_DONE, DONE, NOT_YET } from "./outcomes.mjs";
import { resendKey } from "./secrets.mjs";

/** A Resend DNS record's name relative to the domain, as Vercel's DNS names it. */
const relativeName = (name) => (name.endsWith(`.${LIVE_DOMAIN}`) ? name.slice(0, -LIVE_DOMAIN.length - 1) : name);

const MX = "MX";
const TXT = "TXT";
/** The record types whose value is a host name, which DNS reads without regard to case. */
const HOST_VALUE_TYPES = new Set(["CNAME", MX, "ALIAS", "NS"]);
/** A host name's closing dot only says it is absolute: Vercel writes it (send.forge.rmta.net.),
 *  Resend doesn't. */
const withoutRootDot = (host) => host.replace(/\.$/, "");
/** A TXT value in one pair of quotes, as a zone file writes it; the quotes aren't the value. */
const QUOTED = /^"(.*)"$/s;

/** A record as DNS means it: the name and a host value without case or closing dot, a TXT value
 *  without its quotes, and an MX record's priority beside its value. */
function dnsMeaning({ type, name, value, priority }) {
  const kind = type.toUpperCase();
  return {
    kind,
    name: relativeName(withoutRootDot(name).toLowerCase()),
    value: HOST_VALUE_TYPES.has(kind) ? withoutRootDot(value).toLowerCase() : kind === TXT ? value.replace(QUOTED, "$1") : value,
    priority: kind === MX ? Number(priority) : null,
  };
}

function sameRecord(resend, vercel) {
  const [wanted, held] = [dnsMeaning(resend), dnsMeaning(vercel)];
  return Object.keys(wanted).every((part) => wanted[part] === held[part]);
}

/** The records of `records` that `held` (Vercel's DNS) hasn't got. */
const missingFrom = (records, held) => records.filter((record) => !held.some((existing) => sameRecord(record, existing)));

/** A record as a line says it, e.g. "MX send 10 feedback-smtp.eu-west-1.amazonses.com". */
const described = ({ type, name, value, priority }) => [type, name, priority, value].filter((part) => part !== undefined).join(" ");

/** The live domain as Resend holds it, records and status, or undefined if Resend hasn't it. */
async function resendDomain(setup) {
  const key = await resendKey(setup);
  const listed = (await setup.tools.resend.domains(key)).find((domain) => domain.name === LIVE_DOMAIN);
  return listed && setup.tools.resend.domain(key, listed.id);
}

async function heldDomain(setup) {
  const domain = await resendDomain(setup);
  if (!domain) throw new Error(`Resend has no ${LIVE_DOMAIN}`);
  return domain;
}

export const RESEND_STEPS = [
  {
    title: `The domain in Resend (${LIVE_DOMAIN})`,
    async run(setup) {
      if (await resendDomain(setup)) return ALREADY_DONE;
      await setup.tools.resend.createDomain(await resendKey(setup), LIVE_DOMAIN, RESEND_REGION);
      return DONE;
    },
  },
  {
    title: "Resend's DNS records in Vercel's DNS",
    async run(setup) {
      const domain = await heldDomain(setup);
      const missing = missingFrom(domain.records, await setup.tools.vercel.dnsRecords(LIVE_DOMAIN));
      if (missing.length === 0) return ALREADY_DONE;
      for (const record of missing) {
        await setup.tools.vercel.addDnsRecord(LIVE_DOMAIN, { ...record, name: relativeName(record.name) });
      }
      // Vercel can take an add and still not hold the record as Resend gave it, so "done" waits
      // for a re-read that finds every one.
      const stillMissing = missingFrom(missing, await setup.tools.vercel.dnsRecords(LIVE_DOMAIN));
      if (stillMissing.length > 0) {
        throw new Error(`Vercel took the add, but its DNS still hasn't ${stillMissing.map(described).join("; ")}`);
      }
      return DONE;
    },
  },
  {
    title: `Resend's check of ${LIVE_DOMAIN}`,
    async run(setup) {
      const key = await resendKey(setup);
      let domain = await heldDomain(setup);
      if (domain.status === RESEND_VERIFIED) return ALREADY_DONE;
      await setup.tools.resend.verify(key, domain.id);
      for (let waited = 0; waited < VERIFY_POLL_FOR_MS; waited += VERIFY_POLL_EVERY_MS) {
        await setup.tools.sleep(VERIFY_POLL_EVERY_MS);
        domain = await setup.tools.resend.domain(key, domain.id);
        if (domain.status === RESEND_VERIFIED) return DONE;
      }
      return { outcome: NOT_YET, why: `Resend says "${domain.status}": new DNS records can take hours to be seen, so run this again later` };
    },
  },
];
