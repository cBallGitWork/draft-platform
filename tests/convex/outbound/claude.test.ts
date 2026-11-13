// writeWithClaude against a faked Messages API: what it sends, and that each way of getting no
// report throws saying why, so a scout's failed report is logged, never silent (spec/19).
import { afterEach, expect, test, vi } from "vitest";
import { ANTHROPIC_MESSAGES_URL, WRITING_MODEL, writeWithClaude } from "../../../convex/outbound/claude";
import { ANTHROPIC_KEY_SETTING } from "../../../convex/outbound/deploymentSettings";

const ASK = { system: "Be a scout.", prompt: "Player: Scorer.", maxTokens: 400 };

/** Fakes the API with `reply`, under a key, and gives back the fake to read what was sent. */
function fakeApi(reply: Response) {
  vi.stubEnv(ANTHROPIC_KEY_SETTING, "sk-test");
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => reply);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("sends the model, system and prompt with the key, and gives back the reply's text trimmed", async () => {
  const fetchMock = fakeApi(Response.json({ content: [{ type: "text", text: "  A fine fit.  " }] }));
  await expect(writeWithClaude(ASK)).resolves.toBe("A fine fit.");
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe(ANTHROPIC_MESSAGES_URL);
  expect(new Headers(init.headers).get("x-api-key")).toBe("sk-test");
  expect(JSON.parse(init.body as string)).toEqual({
    model: WRITING_MODEL,
    max_tokens: 400,
    system: "Be a scout.",
    messages: [{ role: "user", content: "Player: Scorer." }],
  });
});

test("throws without a key on the deployment, and never calls the API", async () => {
  vi.stubEnv(ANTHROPIC_KEY_SETTING, "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(writeWithClaude(ASK)).rejects.toThrow(`${ANTHROPIC_KEY_SETTING} isn't set`);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("throws with the status and body when the API refuses", async () => {
  fakeApi(new Response("overloaded", { status: 529 }));
  await expect(writeWithClaude(ASK)).rejects.toThrow("refused the request (529): overloaded");
});

test("throws when the reply was cut off at its token limit: half a report is a failed write (#1437, S19.4)", async () => {
  fakeApi(Response.json({ content: [{ type: "text", text: "Arsenal's defence was" }], stop_reason: "max_tokens" }));
  await expect(writeWithClaude(ASK)).rejects.toThrow("cut the reply off at 400 tokens");
});

test("gives up on an API that doesn't answer in time", async () => {
  const fetchMock = fakeApi(Response.json({ content: [{ type: "text", text: "A fine fit." }] }));
  await writeWithClaude(ASK);
  expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
});

test("throws when the reply holds no text", async () => {
  fakeApi(Response.json({ content: [{ type: "tool_use" }, { type: "text", text: "   " }] }));
  await expect(writeWithClaude(ASK)).rejects.toThrow("replied with no text");
});
