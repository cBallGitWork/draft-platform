import { vi } from "vitest";
import { ANTHROPIC_MESSAGES_URL } from "../../../convex/outbound/claude";

// A fake of Anthropic's Messages API for scouts' reports (#375, convex/outbound/claude.ts): each
// request it is sent, and the report it writes, or a refusal while `failing` is set.

export interface FakeClaude {
  /** Each request's body, as sent. */
  asked: { model: string; system: string; messages: { role: string; content: string }[] }[];
  /** While true, the API refuses with a 529, as when it is overloaded. */
  failing: boolean;
}

/** The report the fake writes for a prompt: its first line, so a test can tell whose it is. */
export const fakeReport = (prompt: string) => `Report from: ${prompt.split("\n")[0]}`;

/** Stubs fetch for Anthropic's URL, handing any other to the fetch stubbed before it (fakeResend's,
 *  for sign-in links). */
export function fakeClaude(): FakeClaude {
  const fake: FakeClaude = { asked: [], failing: false };
  const before = globalThis.fetch;
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url !== ANTHROPIC_MESSAGES_URL) return before(url, init);
      const body = JSON.parse(String(init.body));
      fake.asked.push(body);
      if (fake.failing) return new Response("overloaded", { status: 529 });
      return Response.json({ content: [{ type: "text", text: fakeReport(body.messages[0].content) }] });
    }),
  );
  return fake;
}
