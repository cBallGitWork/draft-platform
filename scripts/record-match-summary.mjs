// How scripts/record-match.mjs sums up one saved poll as a line: the newest commentary line and
// how the commentary changed, the fixture's status and sheets, and the team stats, home first.

import { errorMessage } from "../convex/shared/errors.ts";

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

/** Where an ISO time's "HH:MM:SS" sits in it: "2026-10-23T19:02:30.000Z". */
const ISO_TIME_OF_DAY = { start: 11, end: 19 };

/** The commentary's lines by id, each as its whole JSON; null for a body with no lines to read. */
function linesById(body) {
  const lines = body?.events?.content;
  return Array.isArray(lines) ? new Map(lines.map((line) => [line?.id, JSON.stringify(line)])) : null;
}

/** How the commentary moved from `prev` to `body`: "+N -M ~K", lines added, gone and changed, a
 *  line changed when its whole JSON differs. Null when either can't be read as lines. */
export function commentaryChanges(prev, body) {
  const before = linesById(prev);
  const after = linesById(body);
  if (before === null || after === null) return null;
  const count = (from, keep) => [...from.keys()].filter(keep).length;
  const added = count(after, (id) => !before.has(id));
  const gone = count(before, (id) => !after.has(id));
  const changed = count(after, (id) => before.has(id) && before.get(id) !== after.get(id));
  return `+${added} -${gone} ~${changed}`;
}

/** One saved poll as a line: the time, and what each read held or why it failed. Given the last
 *  commentary read before it, the line also says how the commentary changed since. */
export function summaryLine(saved, prevCommentary) {
  const parts = [`${saved.polledAt.slice(ISO_TIME_OF_DAY.start, ISO_TIME_OF_DAY.end)} UTC`];
  for (const read of saved.reads) {
    if (read.error !== undefined) {
      parts.push(`${read.kind} FAILED: ${read.error}${read.cause === undefined ? "" : ` (${read.cause})`}`);
      continue;
    }
    try {
      if (read.kind === "commentary") parts.push(commentarySummary(read.body, prevCommentary));
      else if (read.kind === "fixture") parts.push(fixtureSummary(read.body));
      else parts.push(teamStatsSummary(read.body, bodyOf(saved, "fixture")));
    } catch (error) {
      // A changed shape is what this recording is for: it is saved whole, and said here.
      parts.push(`${read.kind} UNREADABLE: ${errorMessage(error)}`);
    }
  }
  return parts.join("  |  ");
}

function commentarySummary(body, prev) {
  const changes = prev === undefined ? null : commentaryChanges(prev, body);
  const since = changes === null ? "" : `, ${changes}`;
  const [newest] = body.events.content;
  if (newest === undefined) return `commentary: none${since}`;
  return `commentary: ${body.events.content.length}, newest ${newest.time?.label ?? "-"}' ${newest.type} (${newest.id})${since}`;
}

/** The commentary a saved poll read, or, when its read failed, the last one before it. */
export const lastCommentary = (saved, prev) => bodyOf(saved, "commentary") ?? prev;

function fixtureSummary(body) {
  const named = (body.teamLists ?? []).map((list) => (list === null ? 0 : list.lineup.length + list.substitutes.length));
  const status = typeof body.status === "string" ? body.status : `UNREADABLE (${typeof body.status})`;
  return `status ${status}, clock ${body.clock?.label ?? "-"}, named ${named.join("+") || "-"}`;
}

/** Home then away when the fixture read says which is which, or "order unknown" and the feed's
 *  own order when it doesn't; a side with no stats at all is named. Opta leaves noughts out. */
function teamStatsSummary(body, fixture) {
  if (body.data === undefined) return "team stats: none";
  const homeAway = fixture?.teams?.map((side) => String(side.team.id));
  const teamIds = homeAway ?? Object.keys(body.data);
  const notes = [
    ...(homeAway === undefined ? [`order unknown: ids ${teamIds.join("-")}`] : []),
    ...teamIds.filter((id) => body.data[id] === undefined).map((id) => `no data for ${id}`),
  ];
  const sides = teamIds.map((id) => new Map((body.data[id]?.M ?? []).map((metric) => [metric.name, metric.value])));
  const stats = SHOWN_STATS.map(([label, name]) => `${label} ${sides.map((side) => side.get(name) ?? 0).join("-")}`);
  return [...notes, ...stats].join(", ");
}
