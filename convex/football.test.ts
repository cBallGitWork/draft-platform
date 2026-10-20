import { expect, test, vi } from "vitest";
import { getJson, squadNumbers } from "./football";

const URL = "https://example.test/feed";

/** A fetch answering `{}`, kept to see what each read sent. */
function answeringEmpty() {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({}));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("a read sends a browser's User-Agent, since the feeds only answered Convex with one", async () => {
  const fetch = answeringEmpty();

  await getJson(URL);

  const [, init] = fetch.mock.calls[0];
  expect(new Headers(init?.headers).get("User-Agent")).toMatch(/^Mozilla\/5\.0 .+ Chrome\/[\d.]+ Safari\/[\d.]+$/);
});

test("a read gives up after 15 seconds, so a feed that never answers can't hold the action", async () => {
  const fetch = answeringEmpty();
  const timeout = vi.spyOn(AbortSignal, "timeout");

  await getJson(URL);

  expect(timeout).toHaveBeenCalledWith(15_000);
  const [, init] = fetch.mock.calls[0];
  expect(init?.signal).toBe(timeout.mock.results[0].value);
});

test("a registered player with no squad number is left out", () => {
  const numbers = squadNumbers({ players: [{ id: 10, info: { shirtNum: 4 } }, { id: 11, info: {} }, { id: 12 }] });
  expect([...numbers]).toEqual([[10, 4]]);
});
