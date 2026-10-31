// What the recorder reads and saves: each read of a poll, failed or not, and the start's one read
// of the fixture for its kickoff time. Running it over a match is tested in record-match.test.mjs.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { plCommentaryUrl, plFixtureUrl } from "../../convex/football/football.ts";
import { poll, record, SAVED_TEXT_LIMIT } from "../../scripts/record-match.mjs";
import { fixtureStatus, summaryLine } from "../../scripts/record-match-summary.mjs";
import { IPSWICH_FOREST, KICKOFF } from "../support/scripts/recordMatch.harness.mjs";

// Pinned here, not imported, so a change to the recorder's timings fails a test.
const GIVE_UP = 4 * 60 * 60_000;
const NEVER_MADE = join(tmpdir(), "record-match-never-made");

test("a refused read is saved with why, and the poll goes on to the next", async () => {
  const fixture = { id: IPSWICH_FOREST, status: "U", teamLists: [null, null] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === plCommentaryUrl(IPSWICH_FOREST)) return new Response("Forbidden", { status: 403 });
      return Response.json(url === plFixtureUrl(IPSWICH_FOREST) ? fixture : { entity: { id: IPSWICH_FOREST } });
    }),
  );

  const saved = await poll(IPSWICH_FOREST, 0);

  expect(saved.reads.map((read) => read.kind)).toEqual(["commentary", "fixture", "teamStats"]);
  expect(saved.reads[0].error).toBe(`${plCommentaryUrl(IPSWICH_FOREST)} answered 403`);
  expect(saved.reads[1].body).toEqual(fixture);
  expect(fixtureStatus(saved)).toBe("U");
  expect(summaryLine(saved)).toContain(`commentary FAILED: ${plCommentaryUrl(IPSWICH_FOREST)} answered 403`);
  expect(saved.reads[0].answer).toEqual({ status: 403, contentType: "text/plain;charset=UTF-8", text: "Forbidden" });
  expect(saved.reads[1]).not.toHaveProperty("answer");
});

test(`a failed answer's text is kept up to ${SAVED_TEXT_LIMIT} characters`, async () => {
  const page = "x".repeat(SAVED_TEXT_LIMIT + 1);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(page, { status: 503, headers: { "content-type": "text/html" } })));

  const [commentary] = (await poll(IPSWICH_FOREST, 0)).reads;

  expect(commentary.answer).toEqual({
    status: 503,
    contentType: "text/html",
    text: page.slice(0, SAVED_TEXT_LIMIT),
    fullLength: SAVED_TEXT_LIMIT + 1,
  });
});

test("an OK answer that is not JSON is saved as a failed read, with what came back", async () => {
  const page = "<html>Access denied</html>";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(page, { status: 200, headers: { "content-type": "text/html" } })));

  const [commentary] = (await poll(IPSWICH_FOREST, 0)).reads;

  expect(commentary.error.startsWith(`${plCommentaryUrl(IPSWICH_FOREST)} answered with no JSON: `)).toBe(true);
  expect(commentary).not.toHaveProperty("body");
  expect(commentary.answer).toEqual({ status: 200, contentType: "text/html", text: page });
});

/** A fake feed whose fixture read answers `fixture`; counts its reads. */
function fixtureFeed(fixture) {
  const fetch = vi.fn(async () => Response.json(fixture));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("a fixture that answers with no kickoff time stops the recorder at once, saying so", async () => {
  const fetch = fixtureFeed({ id: IPSWICH_FOREST, status: "U" });

  await expect(record(IPSWICH_FOREST, NEVER_MADE)).rejects.toThrow(
    `${plFixtureUrl(IPSWICH_FOREST)} answered with no kickoff time`,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("started four hours or more after kickoff, the recorder stops at once: too long ago to record", async () => {
  vi.useFakeTimers({ now: KICKOFF + GIVE_UP });
  const fetch = fixtureFeed({ id: IPSWICH_FOREST, kickoff: { millis: KICKOFF } });

  await expect(record(IPSWICH_FOREST, NEVER_MADE)).rejects.toThrow(
    `fixture ${IPSWICH_FOREST} kicked off at ${new Date(KICKOFF).toString()}: too long ago to record`,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

/** What Node's fetch throws when the network fails: a bare "fetch failed", the reason on `cause`. */
const networkFailure = (code) => new TypeError("fetch failed", { cause: Object.assign(new Error(`connect ${code}`), { code }) });

test("a read that failed underneath is saved with its cause, and sums up with it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === plCommentaryUrl(IPSWICH_FOREST)) throw networkFailure("ENOTFOUND");
      return Response.json({ status: "U" });
    }),
  );

  const saved = await poll(IPSWICH_FOREST, 0);

  expect(saved.reads[0]).toMatchObject({ error: "fetch failed", cause: "ENOTFOUND" });
  expect(saved.reads[1]).not.toHaveProperty("cause");
  expect(summaryLine(saved)).toContain("commentary FAILED: fetch failed (ENOTFOUND)  |  status U");
});

test("when the start-up kickoff read fails, the recorder stops at once, naming the URL and the cause", async () => {
  const fetch = vi.fn(async () => {
    throw networkFailure("ECONNRESET");
  });
  vi.stubGlobal("fetch", fetch);

  await expect(record(IPSWICH_FOREST, NEVER_MADE)).rejects.toThrow(
    `${plFixtureUrl(IPSWICH_FOREST)}: fetch failed (ECONNRESET)`,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
