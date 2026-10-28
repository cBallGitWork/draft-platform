// The live app's wiring to Convex Auth, with Convex's React hooks faked by name: opening the app
// from a link, who it then thinks is signed in, and the reply to asking for a link.

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../support/console.setup";
import { signInToJoinWords } from "../../src/joining/words";
import { ERROR_PAGE_TITLE, readFailedWords, signOutWords, tryAgainWords } from "../../src/frame/words";
import { READ_FAILED_LOG } from "../../src/frame/ReadFailed";
import { LEAGUES_PATH } from "../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../src/leagues/words";
import { LiveApp, takeLinkCode } from "../../src/liveApp";
import { NO_CONVEX_URL } from "../../src/words";
import { SIGN_IN_PATH } from "../../src/sign-in/paths";
import { askFailedWords, linkProblemWords, replyWords, signInWords, waitingWords } from "../../src/sign-in/words";

const convex = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false },
  account: undefined as
    | { email: string; isAdmin: boolean; inLeague: boolean; leagues: []; switchableLeagueIds: []; currentLeagueId: null }
    | null
    | undefined,
  signIn: vi.fn(),
  signOut: vi.fn(async () => {}),
  ask: vi.fn(),
  recordZone: vi.fn(async () => null),
  unreadFails: null as Error | null,
}));

vi.mock("convex/react", async () => {
  /** A query's fake that gives what `answer` reads, or nothing while it is skipped. */
  const unlessSkipped = (answer: () => unknown) => (args: unknown) => (args === "skip" ? undefined : answer());
  return {
    ...(await import("../support/src/convexReact.harness")).fakeConvexReact({
      queries: {
        "signIn/account:signedInAs": unlessSkipped(() => convex.account),
        "mail/mail:unreadCount": unlessSkipped(() => {
          if (convex.unreadFails) throw convex.unreadFails;
          return 0;
        }),
        // What the leagues page and the patch banner read: no ended invite, no patch waiting.
        "joining/endedInvite:mine": unlessSkipped(() => null),
        "scoring/patchNotes:banner": unlessSkipped(() => null),
      },
      mutations: {
        "signIn/timeZone:recordZone": convex.recordZone,
        // The rest the seams take hold of as the app opens, seam by seam; these tests call none of them.
        ...Object.fromEntries(
          [
            ["leagues/leagues:create", "leagues/leagueDeletion:deleteLeague", "leagues/leagueDeletion:undo", "leagues/lastLeague:switchTo", "leagues/teams:leave"],
            ["mail/mail:open", "mail/mail:writeToLeague"],
            ["joining/invites:send", "joining/invites:resend", "joining/invites:cancel", "leagues/teams:removeManager", "joining/inviteLink:make"],
            ["joining/inviteLink:switchOff", "joining/joinRequests:approve", "joining/joinRequests:refuseRequest", "joining/joinRequests:ask"],
            ["positions/playerPositions:approvePlayer", "positions/playerPositions:approveClub", "positions/playerPositions:setPosition"],
            ["positions/playerPositions:removePosition", "positions/positionSettings:setApproveMode", "positions/positionSettings:setChangeThresholds"],
            ["squads/squads:assign", "squads/squads:move", "squads/squads:release"],
            ["scoring/siteScoring:fix"],
            ["rules/leagueSettings:changeSettings"],
            ["feedback/feedback:send"],
            ["scoring/patchNotes:dismissBanner"],
          ]
            .flat()
            .map((name) => [name, vi.fn()]),
        ),
      },
      actions: { "signIn/signInLinks:ask": convex.ask, "joining/inviteLink:signInToJoin": vi.fn() },
    }),
    ConvexReactClient: class {},
    useConvexAuth: () => convex.auth,
  };
});
vi.mock("@convex-dev/auth/react", () => ({
  ConvexAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthActions: () => ({ signIn: convex.signIn, signOut: convex.signOut }),
}));

/** A signed-in manager's account before joining any league. */
const inNoLeague: NonNullable<typeof convex.account> = {
  email: "manager@example.com",
  isAdmin: false,
  inLeague: false,
  leagues: [],
  switchableLeagueIds: [],
  currentLeagueId: null,
};

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_URL", "https://deployment.example.com");
  convex.auth = { isLoading: false, isAuthenticated: false };
  convex.account = undefined;
  convex.unreadFails = null;
});
afterEach(() => {
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

test("an expired link that led to a league's invite link keeps the way back to it (#73)", async () => {
  convex.signIn.mockResolvedValue({ signingIn: false });

  openAt("/join/the-token?code=used-code");

  expect((await screen.findByRole("alert")).textContent).toBe(linkProblemWords.expired);
  expect(window.location.pathname).toBe(SIGN_IN_PATH);
  expect(new URLSearchParams(window.location.search).get("join")).toBe("the-token");
  expect(screen.getByText(signInToJoinWords)).toBeTruthy();
});

test("a link that can't be checked says so, and the error is logged", async () => {
  convex.signIn.mockRejectedValue(new Error("network down"));
  const logged = silenceConsoleError();

  openAt("/?code=some-code");

  expect((await screen.findByRole("alert")).textContent).toBe(linkProblemWords.unchecked);
  expect(logged).toHaveBeenCalledWith("Checking a sign-in link failed:", expect.any(Error));
});

test("signed in, in no league, the app opens on the leagues page", async () => {
  convex.auth = { isLoading: false, isAuthenticated: true };
  convex.account = inNoLeague;

  openAt("/");

  expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
  expect(window.location.pathname).toBe(LEAGUES_PATH);
  // The browser's zone is kept each time the app opens signed in (#442); the tests run in London's.
  expect(convex.recordZone).toHaveBeenCalledWith({ zone: "Europe/London" });
});

const notInLeague = "You're not in this league.";
const serverDown = new Error("server down");

// Never the server's words, even for a refusal (spec/12, The frame).
test.each([
  ["a failure", serverDown],
  ["a refusal", new ConvexError(notInLeague)],
])("a query failing above the pages, for %s, says so in plain words, logs it, and offers Try again", async (_, error) => {
  convex.auth = { isLoading: false, isAuthenticated: true };
  convex.account = inNoLeague;
  convex.unreadFails = error;
  const logged = silenceConsoleError();

  openAt("/");

  expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
  expect(screen.getByRole("button", { name: tryAgainWords })).toBeTruthy();
  expect(logged).toHaveBeenCalledWith(READ_FAILED_LOG, error);
});

test("Try again above the pages reads again, and shows the app once the read succeeds", async () => {
  convex.auth = { isLoading: false, isAuthenticated: true };
  convex.account = inNoLeague;
  convex.unreadFails = serverDown;
  silenceConsoleError();

  openAt("/");
  const tryAgain = await screen.findByRole("button", { name: tryAgainWords });
  convex.unreadFails = null;
  await userEvent.click(tryAgain);

  expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
});

test("a query failing above the pages offers Sign out, which leaves for the sign-in page", async () => {
  convex.auth = { isLoading: false, isAuthenticated: true };
  convex.account = inNoLeague;
  convex.unreadFails = serverDown;
  convex.signOut.mockImplementationOnce(async () => {
    convex.auth = { isLoading: false, isAuthenticated: false };
  });
  silenceConsoleError();

  openAt("/");
  await userEvent.click(await screen.findByRole("button", { name: signOutWords }));

  expect(convex.signOut).toHaveBeenCalledOnce();
  expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
  expect(window.location.pathname).toBe(SIGN_IN_PATH);
});

test("without VITE_CONVEX_URL, the app says so on the page rather than showing nothing", () => {
  vi.stubEnv("VITE_CONVEX_URL", "");

  openAt("/");

  expect(screen.getByRole("alert").textContent).toBe(NO_CONVEX_URL);
});

test("while Convex Auth is still finding the session, the app says it is connecting", () => {
  convex.auth = { isLoading: true, isAuthenticated: false };

  openAt("/");

  expect(screen.getByRole("status").textContent).toBe(waitingWords.connecting);
});

test.each([
  ["Convex's reply", async () => "tryLater", replyWords.tryLater],
  ["that it failed, when Convex couldn't answer", async () => Promise.reject(new Error("offline")), askFailedWords],
])("asking for a link shows %s in words", async (_, answer, words) => {
  convex.ask.mockImplementation(answer);
  silenceConsoleError();
  openAt(SIGN_IN_PATH);

  await userEvent.type(await screen.findByRole("textbox", { name: signInWords.emailLabel }), "craig@example.com");
  await userEvent.click(screen.getByRole("button", { name: signInWords.send }));

  expect((await screen.findByRole("status")).textContent).toBe(words);
  expect(convex.ask).toHaveBeenCalledWith({ email: "craig@example.com" });
});
