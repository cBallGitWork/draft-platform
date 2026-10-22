// The live app with Convex Auth's real provider and Convex's real client, only the socket faked,
// so a second redeem of a link's code by the provider itself would show (liveApp.tsx says why).

import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LiveApp, takeLinkCode } from "../../src/liveApp";

type Sent = { type: string; udfPath?: string; args?: unknown[] };

/** Long enough after the first redeem for a second one to have been sent. */
const SECOND_REDEEM_WAIT_MS = 100;

/** A socket to Convex that opens, keeps what the client sends and never answers. */
function fakeConvexSocket(): Sent[] {
  const sent: Sent[] = [];
  class FakeWebSocket {
    onopen: ((event: unknown) => void) | null = null;
    onmessage = null;
    onclose = null;
    onerror = null;
    constructor() {
      setTimeout(() => this.onopen?.({ type: "open" }));
    }
    send(data: string) {
      sent.push(JSON.parse(data));
    }
    close() {}
  }
  vi.stubGlobal("WebSocket", FakeWebSocket);
  return sent;
}

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_URL", "https://happy-otter-123.convex.cloud");
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

test("opened from a link, with Convex Auth's real provider, the code is redeemed once", async () => {
  const sent = fakeConvexSocket();
  window.history.replaceState(null, "", "/?code=link-code");

  render(
    <StrictMode>
      <LiveApp linkCode={takeLinkCode()} />
    </StrictMode>,
  );
  await vi.waitFor(() => expect(sent.some((message) => message.type === "Action")).toBe(true));
  await act(() => new Promise((resolve) => setTimeout(resolve, SECOND_REDEEM_WAIT_MS)));

  const redeems = sent.filter((message) => message.type === "Action" && message.udfPath === "auth:signIn");
  expect(redeems.map((message) => message.args)).toEqual([[{ params: { code: "link-code" } }]]);
});
