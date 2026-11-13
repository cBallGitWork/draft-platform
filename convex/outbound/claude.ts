import { DAY_MS, MINUTE_MS } from "../shared/time";
import { ANTHROPIC_KEY_SETTING } from "./deploymentSettings";
import { WRITING_TIMEOUT_MS } from "./timeouts";

// What the app has AI write goes through Anthropic's Messages API, with one `fetch` and no SDK
// (ARCHITECTURE.md, Services: AI is Claude Haiku 5.5). A scout's report is the first (spec/19).

/** Where the Messages API takes a request. */
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/** The API's version header, which fixes its request and reply shapes. */
const ANTHROPIC_VERSION = "2023-06-01";

/** The model ARCHITECTURE.md names for the app's AI. */
export const WRITING_MODEL = "claude-haiku-5-5";

/** How long after a failed write Claude is asked again, for a scout's report and a recap alike:
 *  each caller logs every failure and keeps it on its row, so a lasting one (no API key, say) shows. */
export const CLAUDE_RETRY_MS = 30 * MINUTE_MS;

/** The most tries at one write, a day's worth at CLAUDE_RETRY_MS apart: after them a scout comes
 *  back with no report and a recap stops being tried (Craig, 12 Nov 2026, on #1437: "Retry a day,
 *  then tell him"). */
export const CLAUDE_TRIES_MOST = Math.ceil(DAY_MS / CLAUDE_RETRY_MS);

/** Claude's written reply to `prompt` under `system`, trimmed, or throws saying why there is none:
 *  no key on the deployment, the API refused or didn't answer in time, it wrote nothing, or it was
 *  cut off at `maxTokens` (a cut-off reply is a failed write, #1437). */
export async function writeWithClaude({ system, prompt, maxTokens }: { system: string; prompt: string; maxTokens: number }): Promise<string> {
  const apiKey = process.env[ANTHROPIC_KEY_SETTING];
  if (!apiKey) throw new Error(`${ANTHROPIC_KEY_SETTING} isn't set on this deployment, so Claude can't be asked to write`);
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
    body: JSON.stringify({ model: WRITING_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(WRITING_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Anthropic's API refused the request (${response.status}): ${await response.text()}`);
  const reply = (await response.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  if (reply.stop_reason === "max_tokens") throw new Error(`Anthropic's API cut the reply off at ${maxTokens} tokens`);
  const text = (reply.content ?? [])
    .flatMap((block) => (block.type === "text" && block.text ? [block.text] : []))
    .join("")
    .trim();
  if (text === "") throw new Error("Anthropic's API replied with no text");
  return text;
}
