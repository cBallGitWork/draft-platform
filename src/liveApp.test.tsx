// The live app's wiring to Convex Auth, with Convex's React hooks faked: opening the app from a
// link, who it then thinks is signed in, and the reply to asking for a link.

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LEAGUES_PATH } from "./leagues/paths";
import { LiveApp, NO_CONVEX_URL, takeLinkCode } from "./liveApp";
import { SIGN_IN_PATH } from "./router";
import { linkProblemWords, replyWords, unreachableWords } from "./sign-in/words";

const convex = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false },
  account: undefined as { email: string; isAdmin: boolean; inLeague: boolean } | null | undefined,
  signIn: vi.fn(),
  signOut: vi.fn(async () => {}),
  ask: vi.fn(),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: class {},
  useConvexAuth: () => convex.auth,
  useQuery: (_query: unknown, args: unknown) => (args === "skip" ? undefined : convex.account),
  useAction: () => convex.ask,
}));
vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthActions: () => ({ signIn: convex.signIn, signOut: convex.signOut }),
}));

window.scrollTo = () => {};

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_URL", "https://deployment.example.com");
  convex.auth = { isLoading: false, isAuthenticated: false };
  convex.account = undefined;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  convex.signIn.mockReset();
  convex.ask.mockReset();
  window.history.replaceState(null, "", "/");
});

/** Opens the app at `address`, as main.tsx does, in React's development checks. */
function openAt(address: string) {
  window.history.replaceState(null, "", address);
  render(
    <StrictMode>
      <LiveApp linkCode={takeLinkCode()} />
    </StrictMode>,
  );
}

test("a link's code is taken out of the address, leaving the rest of it", () => {
  window.history.replaceState(null, "", "/team?code=link-code&sort=form");

  expect(takeLinkCode()).toBe("link-code");

  expect(`${window.location.pathname}${window.location.search}`).toBe("/team?sort=form");
});

test("opened from a link, the app redeems its code once, though React runs a first effect twice", async () => {
  convex.signIn.mockResolvedValue({ signingIn: true });

  await act(async () => openAt("/?code=link-code"));

  expect(convex.signIn).toHaveBeenCalledOnce();
  expect(convex.signIn).toHaveBeenCalledWith(undefined, { code: "link-code" });
});

test("opened from a used or expired link, the app shows the sign-in page saying it has expired", async () => {
  convex.signIn.mockResolvedValue({ signingIn: false });

  openAt("/?code=used-code");

  expect((await screen.findByRole("alert")).textContent).toBe(linkProblemWords.expired);
  expect(window.location.pathname).toBe(SIGN_IN_PATH);
});

test("a link that can't be checked says so, and the error is logged", async () => {
  convex.signIn.mockRejectedValue(new Error("network down"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  openAt("/?code=some-code");

  expect((await screen.findByRole("alert")).textContent).toBe(linkProblemWords.unchecked);
  expect(logged).toHaveBeenCalledWith("Checking a sign-in link failed:", expect.any(Error));
});

test("signed in, in no league, the app opens on the leagues page", async () => {
  convex.auth = { isLoading: false, isAuthenticated: true };
  convex.account = { email: "manager@example.com", isAdmin: false, inLeague: false };

  openAt("/");

  expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
  expect(window.location.pathname).toBe(LEAGUES_PATH);
});

test("without VITE_CONVEX_URL, the app says so on the page rather than showing nothing", () => {
  vi.stubEnv("VITE_CONVEX_URL", "");

  openAt("/");

  expect(screen.getByRole("alert").textContent).toBe(NO_CONVEX_URL);
});

test("while Convex Auth is still finding the session, the app says it is connecting", () => {
  convex.auth = { isLoading: true, isAuthenticated: false };

  openAt("/");

  expect(screen.getByRole("status").textContent).toBe("Connecting…");
});

test.each([
  ["Convex's reply", async () => "tryLater", replyWords.tryLater],
  ["that it couldn't reach Convex", async () => Promise.reject(new Error("offline")), unreachableWords],
])("asking for a link shows %s in words", async (_, answer, words) => {
  convex.ask.mockImplementation(answer);
  vi.spyOn(console, "error").mockImplementation(() => {});
  openAt(SIGN_IN_PATH);

  await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "craig@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Send the link" }));

  expect((await screen.findByRole("status")).textContent).toBe(words);
  expect(convex.ask).toHaveBeenCalledWith({ email: "craig@example.com" });
});
