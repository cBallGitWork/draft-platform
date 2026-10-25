import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { ConvexReactClient, useAction, useConvexAuth, useQuery } from "convex/react";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../convex/_generated/api";
import { useLiveAdmin } from "./admin/liveAdmin";
import { useLiveFeedback } from "./feedback/liveFeedback";
import { Loading } from "./frame/Panel";
import { ReadFailed } from "./frame/ReadFailed";
import { SignOut } from "./frame/SignOut";
import type { AuthActions, Session } from "./auth";
import { liveGameweeks } from "./gameweeks/liveGameweeks";
import { useLiveJoining } from "./joining/liveJoining";
import { joinTokenAt } from "./joining/paths";
import { useLiveLeagueActions } from "./leagues/liveLeagueActions";
import { useLiveMail } from "./mail/liveMail";
import { useLiveLeagueSettings } from "./leagueSettings/liveSettings";
import { useLiveScoring } from "./scoring/liveScoring";
import { useLiveSquads } from "./squads/liveSquads";
import { liveTable } from "./table/liveTable";
import { answerOf } from "./refusal";
import { ShellApp } from "./ShellApp";
import { SIGN_IN_PATH } from "./sign-in/paths";
import { askFailedWords, replyWords, waitingWords, type LinkProblem } from "./sign-in/words";
import { NO_CONVEX_URL } from "./words";

// The app signed in for real: Convex Auth's session (convex/auth.ts), the email links asked for
// through signIn/signInLinks:ask, and a link's code redeemed when the app is opened from one.

/** The search param a sign-in link carries its code in (Convex Auth's). */
const LINK_CODE_PARAM = "code";

/** The code a sign-in link opened the app with, taken out of the address so a reload or a
 *  bookmark can't carry it. */
export function takeLinkCode(): string | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(LINK_CODE_PARAM);
  if (code === null) return null;
  url.searchParams.delete(LINK_CODE_PARAM);
  window.history.replaceState(null, "", url);
  return code;
}

export function LiveApp({ linkCode }: { linkCode: string | null }) {
  const [client] = useState(() => {
    const url: string | undefined = import.meta.env.VITE_CONVEX_URL;
    return url ? new ConvexReactClient(url) : null;
  });
  if (!client) {
    return (
      <p role="alert" className="p-2 text-event">
        {NO_CONVEX_URL}
      </p>
    );
  }
  // The link's code is redeemed below, and was taken out of the address before this mounted.
  // Convex Auth's own reading of the address is off too: a code works once, so a second redeem
  // would turn a good link into "expired" (liveApp.provider.test.tsx).
  return (
    <ConvexAuthProvider client={client} shouldHandleCode={false}>
      <ShellFailed>
        <LiveShell linkCode={linkCode} />
      </ShellFailed>
    </ConvexAuthProvider>
  );
}

/** The thrown value is wrapped, as it can itself be null. */
type ShellFailedState = { failed: { error: unknown } | null };

/** What the app shows when something above the router threw, such as a query the top bar reads:
 *  the failed read, and Sign out, as the top bar's isn't there. */
class ShellFailed extends Component<{ children: ReactNode }, ShellFailedState> {
  state: ShellFailedState = { failed: null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: { error } };
  }

  render() {
    if (this.state.failed === null) return this.props.children;
    const drawAfresh = () => this.setState({ failed: null });
    return (
      <ReadFailed error={this.state.failed.error} onTryAgain={drawAfresh}>
        <SignOutAfresh onSignedOut={drawAfresh} />
      </ReadFailed>
    );
  }
}

/** The top bar's Sign out, for ShellFailed, which has no top bar: once signed out, it shows the
 *  app again, which is then the sign-in page. */
function SignOutAfresh({ onSignedOut }: { onSignedOut: () => void }) {
  const { signOut } = useAuthActions();
  return (
    <SignOut
      onSignOut={async () => {
        await signOut();
        onSignedOut();
      }}
    />
  );
}

function LiveShell({ linkCode }: { linkCode: string | null }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const ask = useAction(api.signIn.signInLinks.ask);
  const leagues = useLiveLeagueActions();
  const { mail, topBar } = useLiveMail();
  const joining = useLiveJoining();
  const admin = useLiveAdmin();
  const squads = useLiveSquads();
  const scoring = useLiveScoring();
  const leagueSettings = useLiveLeagueSettings();
  const feedback = useLiveFeedback();
  const account = useQuery(api.signIn.account.signedInAs, isAuthenticated ? {} : "skip");
  const [checkingLink, setCheckingLink] = useState(linkCode !== null);
  const redeemed = useRef(false);

  useEffect(() => {
    // Once, though React runs a first effect twice in development: a code works only once.
    if (linkCode === null || redeemed.current) return;
    redeemed.current = true;
    void redeemLink(signIn, linkCode).then((problem) => {
      if (problem) window.history.replaceState(null, "", signInAddressAfter(problem));
      setCheckingLink(false);
    });
  }, [linkCode, signIn]);

  const auth = useMemo<AuthActions>(
    () => ({
      requestSignInLink: (email) => answerOf(async () => replyWords[await ask({ email })], "Asking for a sign-in link", askFailedWords),
      signOut,
    }),
    [ask, signOut],
  );

  const session = useMemo<Session | null>(() => {
    if (isLoading || checkingLink || (isAuthenticated && account === undefined)) return null;
    return isAuthenticated && account ? { signedIn: true, ...account } : { signedIn: false };
  }, [isLoading, checkingLink, isAuthenticated, account]);

  if (!session) {
    return (
      <Loading className="p-2">{checkingLink ? waitingWords.checkingLink : waitingWords.connecting}</Loading>
    );
  }
  return <ShellApp session={session} auth={auth} leagues={leagues} mail={mail} joining={joining} topBar={topBar} gameweeks={liveGameweeks} squads={squads} scoring={scoring} leagueSettings={leagueSettings} table={liveTable} admin={admin} feedback={feedback} />;
}

/** The sign-in page saying what was wrong with a link, and, for one that led to a league's invite
 *  link, leading back to it (#73). */
function signInAddressAfter(problem: LinkProblem): string {
  const join = joinTokenAt(window.location.pathname);
  const search = new URLSearchParams({ link: problem, ...(join && { join }) });
  return `${SIGN_IN_PATH}?${search}`;
}

/** Redeems a link's code, and says what went wrong if it didn't sign in. Convex Auth answers a
 *  used or expired code with no sign-in when no provider is named (as its own reading of the
 *  address does); its type asks for one, which would turn that answer into a thrown error. */
async function redeemLink(
  signIn: ReturnType<typeof useAuthActions>["signIn"],
  code: string,
): Promise<LinkProblem | null> {
  const redeem = signIn as unknown as (provider: undefined, params: { code: string }) => ReturnType<typeof signIn>;
  try {
    const { signingIn } = await redeem(undefined, { code });
    return signingIn ? null : "expired";
  } catch (error) {
    console.error("Checking a sign-in link failed:", error);
    return "unchecked";
  }
}
