// Records one match as the Premier League's API serves it, for #37: how often the commentary moves
// while the match is played, when the lineups first appear, and whether the team stats update
// live. Every 30 seconds, from 90 minutes before kickoff to 15 minutes after full time, it reads the
// commentary, the fixture (its team sheets) and the team stats, one after another, as Convex does
// (the same URLs, User-Agent and timeout, from convex/football/football.ts), and saves each poll with its time to
// .recordings/<fixture id>/ in this checkout, which git ignores. A failed read is saved with what
// came back (its status, content type and text, cut at SAVED_TEXT_LIMIT characters), a body it
// can't sum up is saved whole, both are shown, and polling goes on. Each line says how the
// commentary changed since the last read of it: "+N -M ~K", lines added, gone and reworded.
//
// Usage, with the Premier League's fixture id:
//   caffeinate -is node scripts/record-match.mjs <fixtureId>  records; start it any time before
//                                                             90 minutes before kickoff
//   node scripts/record-match.mjs <fixtureId> --summary       one line per poll saved so far
// `caffeinate -is` keeps the Mac awake while it is plugged in with the lid open (`-s` does nothing on
// battery, and a closed lid still sleeps it): a sleeping Mac leaves gaps that look like a stalled feed.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getJson, plCommentaryUrl, plFixtureUrl, plTeamStatsUrl, TIMEOUT_MS, USER_AGENT } from "../convex/football/football.ts";
import { errorMessage } from "../convex/shared/errors.ts";
import { LOCALE } from "../convex/shared/moments.ts";
import { HOUR_MS, MINUTE_MS, SECOND_MS } from "../convex/shared/time.ts";
import { fixtureStatus, lastCommentary, summaryLine } from "./record-match-summary.mjs";

const POLL_MS = 30 * SECOND_MS;
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
const PAUSE_MS = SECOND_MS;
/** The fixture's `status` once the match is over ("U" before it, "C" after). A copy of
 *  PL_FULL_TIME in convex/football/premierLeague/premierLeague.ts, which plain node can't import: it imports "../football"
 *  with no extension. tests/scripts/record-match.test.mjs holds the two equal. */
const FULL_TIME = "C";
const RECORDINGS_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), ".recordings");
/** The most of a failed answer's text a poll keeps: enough for an error page, not a whole feed. */
export const SAVED_TEXT_LIMIT = 20_000;
const POLL_FILE_SUFFIX = ".json";

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
      reads.push({ kind, url, askedAt, ...(await readAnswer(url)) });
    } catch (error) {
      const cause = causeOf(error);
      reads.push({ kind, url, askedAt, error: errorMessage(error), ...(cause === undefined ? {} : { cause }) });
    }
  }
  return { polledAt, reads };
}

/** One read, asked as `getJson` asks: `{ body }`, or, for an answer that is not OK or not JSON, the
 *  error `getJson` would give with the answer's status, content type and text (cut at
 *  SAVED_TEXT_LIMIT, with `fullLength` then saying how long it was), which `getJson` throws away.
 *  A fetch that fails outright throws. */
async function readAnswer(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  const answer = {
    status: res.status,
    contentType: res.headers.get("content-type"),
    text: text.slice(0, SAVED_TEXT_LIMIT),
    ...(text.length > SAVED_TEXT_LIMIT ? { fullLength: text.length } : {}),
  };
  if (!res.ok) return { error: `${url} answered ${res.status}`, answer };
  try {
    return { body: JSON.parse(text) };
  } catch (error) {
    return { error: `${url} answered with no JSON: ${errorMessage(error)}`, answer };
  }
}

/** Why a failed fetch failed underneath, when it says: Node's fetch throws a bare "fetch failed"
 *  and keeps the reason (ENOTFOUND, ECONNRESET, a timeout) on `cause`. */
function causeOf(error) {
  return error?.cause?.code ?? error?.cause?.message;
}

/** A poll's file name: its time, sortable, with no colons. */
const fileName = (polledAt) => `${polledAt.replaceAll(":", "-")}${POLL_FILE_SUFFIX}`;
/** The polls saved in `dir`, in time order. */
const pollFiles = (dir) => readdirSync(dir).filter((name) => name.endsWith(POLL_FILE_SUFFIX)).sort();

const localTime = (ms) => new Date(ms).toLocaleTimeString(LOCALE);
const AFTER_FULL_TIME_MINUTES = AFTER_FULL_TIME_MS / MINUTE_MS;

/** The last line of a recording: this run's polls, and why it stopped. */
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
  console.log(
    `Kickoff ${new Date(kickoffMs).toString()}; recording from ${new Date(kickoffMs - LEAD_MS).toString()} into ${dir}/, ` +
      `which holds ${pollFiles(dir).length} polls already`,
  );
  let prevCommentary;
  let pollCount = 0;
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
    pollCount += 1;
    console.log(summaryLine(saved, prevCommentary));
    prevCommentary = lastCommentary(saved, prevCommentary);
    if (fullTimeSeenAt === null && fixtureStatus(saved) === FULL_TIME) {
      fullTimeSeenAt = Date.now();
      console.log(`Full time seen at ${localTime(fullTimeSeenAt)}; stopping ${AFTER_FULL_TIME_MINUTES} min from now`);
    }
    await sleep(Math.max(0, POLL_MS - (Date.now() - startedAt)));
  }
  console.log(doneLine(pollCount, dir, fullTimeSeenAt));
}

/** One line per poll saved in `dir`, in time order; a file it can't read is named, and the rest go on. */
export function summarise(dir) {
  if (!existsSync(dir)) {
    console.error(`No polls saved in ${dir}/`);
    process.exit(1);
  }
  let prevCommentary;
  for (const file of pollFiles(dir)) {
    try {
      const saved = JSON.parse(readFileSync(join(dir, file), "utf8"));
      console.log(summaryLine(saved, prevCommentary));
      prevCommentary = lastCommentary(saved, prevCommentary);
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
