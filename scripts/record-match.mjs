// Records one match as the Premier League's API serves it, for #37: how often the commentary moves
// while the match is played, when the lineups first appear, and whether the team stats update
// live. Every 30 seconds, from 90 minutes before kickoff to 15 minutes after full time, it reads the
// commentary, the fixture (its team sheets) and the team stats, one after another, as Convex does
// (the same URLs and `getJson`, from convex/football/football.ts), and saves each poll with its time to
// .recordings/<fixture id>/ in this checkout, which git ignores. A failed read, or a body it can't
// sum up, is saved and shown, and polling goes on.
//
// Usage, with the Premier League's fixture id:
//   caffeinate -is node scripts/record-match.mjs <fixtureId>  records; start it any time before
//                                                             90 minutes before kickoff
//   node scripts/record-match.mjs <fixtureId> --summary       one line per poll saved so far
// `caffeinate -is` keeps the Mac awake while it is plugged in with the lid open (`-s` does nothing on
// battery, and a closed lid still sleeps it): a sleeping Mac leaves gaps that look like a stalled feed.
// Friday 23 Oct 2026, Ipswich v Nott'm Forest at 20:00 BST:
//   caffeinate -is node scripts/record-match.mjs 128999

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getJson, plCommentaryUrl, plFixtureUrl, plTeamStatsUrl } from "../convex/football/football.ts";
import { errorMessage } from "../convex/shared/errors.ts";
import { HOUR_MS, MINUTE_MS } from "../convex/shared/time.ts";

const POLL_MS = 30_000;
/** spec/10 wants the lineups "about an hour before kickoff"; when they first appear is one of #37's
 *  questions, so recording starts half an hour earlier than that, to see them arrive. */
const LEAD_MS = 90 * MINUTE_MS;
/** Kept on after full time, for late lines and corrected totals. */
const AFTER_FULL_TIME_MS = 15 * MINUTE_MS;
/** A match abandoned, or a status that never turns to full time, stops recording here. The same
 *  window as LIVE_WINDOW_MS in convex/stats/liveStats.ts, which plain node can't import: it imports its
 *  neighbours with no extension. tests/scripts/record-match.test.mjs holds the two equal. */
const GIVE_UP_MS = 4 * HOUR_MS;
/** Between one read and the next in a poll: politeness, not a rule of the feed. */
const PAUSE_MS = 1_000;
/** The fixture's `status` once the match is over ("U" before it, "C" after). A copy of
 *  PL_FULL_TIME in convex/football/premierLeague.ts, which plain node can't import: it imports "./football"
 *  with no extension. tests/scripts/record-match.test.mjs holds the two equal. */
const FULL_TIME = "C";
const RECORDINGS_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), ".recordings");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The three reads a poll makes, in order. */
export function pollReads(fixtureId) {
  return [
    { kind: "commentary", url: plCommentaryUrl(fixtureId) },
    { kind: "fixture", url: plFixtureUrl(fixtureId) },
    { kind: "teamStats", url: plTeamStatsUrl(fixtureId) },
  ];
}

/** What to do at `now`: "wait" until `LEAD_MS` before kickoff, "record", or "stop". */
export function phase(now, kickoffMs, fullTimeSeenAt) {
  if (now < kickoffMs - LEAD_MS) return "wait";
  if (fullTimeSeenAt !== null && now >= fullTimeSeenAt + AFTER_FULL_TIME_MS) return "stop";
  return now >= kickoffMs + GIVE_UP_MS ? "stop" : "record";
}

/** One poll: each read in turn, its body or why it failed, with the time it was asked. */
export async function poll(fixtureId, pauseMs = PAUSE_MS) {
  const polledAt = new Date().toISOString();
  const reads = [];
  for (const [index, { kind, url }] of pollReads(fixtureId).entries()) {
    if (index > 0) await sleep(pauseMs);
    const askedAt = new Date().toISOString();
    try {
      reads.push({ kind, url, askedAt, body: await getJson(url) });
    } catch (error) {
      const cause = causeOf(error);
      reads.push({ kind, url, askedAt, error: errorMessage(error), ...(cause === undefined ? {} : { cause }) });
    }
  }
  return { polledAt, reads };
}

/** Why a failed fetch failed underneath, when it says: Node's fetch throws a bare "fetch failed"
 *  and keeps the reason (ENOTFOUND, ECONNRESET, a timeout) on `cause`. */
function causeOf(error) {
  return error?.cause?.code ?? error?.cause?.message;
}

const bodyOf = (saved, kind) => saved.reads.find((read) => read.kind === kind)?.body;

/** The fixture's `status` in a saved poll, or null when that read failed. */
export function fixtureStatus(saved) {
  return bodyOf(saved, "fixture")?.status ?? null;
}

/** spec/10's five team stats, cards as yellows and reds, under Opta's names (docs/pl-commentary.md). */
const SHOWN_STATS = [
  ["shots", "total_scoring_att"],
  ["on target", "ontarget_scoring_att"],
  ["possession", "possession_percentage"],
  ["corners", "won_corners"],
  ["yellows", "total_yel_card"],
  ["reds", "total_red_card"],
];

/** One saved poll as a line: the time, and what each read held or why it failed. */
export function summaryLine(saved) {
  const parts = [`${saved.polledAt.slice(11, 19)} UTC`];
  for (const read of saved.reads) {
    if (read.error !== undefined) {
      parts.push(`${read.kind} FAILED: ${read.error}${read.cause === undefined ? "" : ` (${read.cause})`}`);
      continue;
    }
    try {
      if (read.kind === "commentary") parts.push(commentarySummary(read.body));
      else if (read.kind === "fixture") parts.push(fixtureSummary(read.body));
      else parts.push(teamStatsSummary(read.body, bodyOf(saved, "fixture")));
    } catch (error) {
      // A changed shape is what this recording is for: it is saved whole, and said here.
      parts.push(`${read.kind} UNREADABLE: ${errorMessage(error)}`);
    }
  }
  return parts.join("  |  ");
}

function commentarySummary(body) {
  const [newest] = body.events.content;
  if (newest === undefined) return "commentary: none";
  return `commentary: ${body.events.content.length}, newest ${newest.time?.label ?? "-"}' ${newest.type} (${newest.id})`;
}

function fixtureSummary(body) {
  const named = (body.teamLists ?? []).map((list) => (list === null ? 0 : list.lineup.length + list.substitutes.length));
  const status = typeof body.status === "string" ? body.status : `UNREADABLE (${typeof body.status})`;
  return `status ${status}, clock ${body.clock?.label ?? "-"}, named ${named.join("+") || "-"}`;
}

/** Home then away when the fixture read says which is which; Opta leaves noughts out. */
function teamStatsSummary(body, fixture) {
  if (body.data === undefined) return "team stats: none";
  const teamIds = fixture?.teams?.map((side) => String(side.team.id)) ?? Object.keys(body.data);
  const sides = teamIds.map((id) => new Map((body.data[id]?.M ?? []).map((metric) => [metric.name, metric.value])));
  return SHOWN_STATS.map(([label, name]) => `${label} ${sides.map((side) => side.get(name) ?? 0).join("-")}`).join(", ");
}

/** A poll's file name: its time, sortable, with no colons. */
const fileName = (polledAt) => `${polledAt.replaceAll(":", "-")}.json`;

const localTime = (ms) => new Date(ms).toLocaleTimeString("en-GB");
const AFTER_FULL_TIME_MINUTES = AFTER_FULL_TIME_MS / MINUTE_MS;

/** The last line of a recording, saying why it stopped. */
export function doneLine(pollCount, dir, fullTimeSeenAt) {
  const why =
    fullTimeSeenAt === null
      ? `GAVE UP ${GIVE_UP_MS / HOUR_MS}h after kickoff, full time never seen`
      : `stopped ${AFTER_FULL_TIME_MINUTES} min after full time (seen ${localTime(fullTimeSeenAt)})`;
  return `Done: ${pollCount} polls in ${dir}/; ${why}`;
}

/** Waits until `LEAD_MS` before kickoff, then polls every `POLL_MS` into `dir` until `phase` says stop. */
export async function record(fixtureId, dir) {
  const url = plFixtureUrl(fixtureId);
  let kickoffMs;
  try {
    kickoffMs = (await getJson(url)).kickoff?.millis;
  } catch (error) {
    // Still fails fast, with no retry (#148), but says what failed underneath.
    throw new Error(`${url}: ${errorMessage(error)} (${causeOf(error) ?? "no cause"})`, { cause: error });
  }
  if (typeof kickoffMs !== "number") throw new Error(`${url} answered with no kickoff time`);
  if (phase(Date.now(), kickoffMs, null) === "stop") {
    throw new Error(`fixture ${fixtureId} kicked off at ${new Date(kickoffMs).toString()}: too long ago to record`);
  }
  mkdirSync(dir, { recursive: true });
  console.log(`Kickoff ${new Date(kickoffMs).toString()}; recording from ${new Date(kickoffMs - LEAD_MS).toString()} into ${dir}/`);
  let fullTimeSeenAt = null;
  for (;;) {
    const step = phase(Date.now(), kickoffMs, fullTimeSeenAt);
    if (step === "stop") break;
    if (step === "wait") {
      // In steps of a minute, so a Mac that slept still starts on time.
      await sleep(Math.min(MINUTE_MS, kickoffMs - LEAD_MS - Date.now()));
      continue;
    }
    const startedAt = Date.now();
    const saved = await poll(fixtureId);
    writeFileSync(join(dir, fileName(saved.polledAt)), JSON.stringify(saved));
    console.log(summaryLine(saved));
    if (fullTimeSeenAt === null && fixtureStatus(saved) === FULL_TIME) {
      fullTimeSeenAt = Date.now();
      console.log(`Full time seen at ${localTime(fullTimeSeenAt)}; stopping ${AFTER_FULL_TIME_MINUTES} min from now`);
    }
    await sleep(Math.max(0, POLL_MS - (Date.now() - startedAt)));
  }
  console.log(doneLine(readdirSync(dir).length, dir, fullTimeSeenAt));
}

/** One line per poll saved in `dir`, in time order; a file it can't read is named, and the rest go on. */
export function summarise(dir) {
  if (!existsSync(dir)) {
    console.error(`No polls saved in ${dir}/`);
    process.exit(1);
  }
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    try {
      console.log(summaryLine(JSON.parse(readFileSync(join(dir, file), "utf8"))));
    } catch (error) {
      console.log(`${file} UNREADABLE: ${errorMessage(error)}`);
    }
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [id, flag] = process.argv.slice(2);
  if (!/^\d+$/.test(id ?? "") || (flag !== undefined && flag !== "--summary")) {
    console.error("Usage: node scripts/record-match.mjs <fixtureId> [--summary]");
    process.exit(2);
  }
  const dir = join(RECORDINGS_DIR, id);
  if (flag === "--summary") summarise(dir);
  else {
    await record(Number(id), dir).catch((error) => {
      console.error(errorMessage(error));
      process.exit(1);
    });
  }
}
