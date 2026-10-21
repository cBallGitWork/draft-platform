import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { linkOffWords } from "../../convex/joiningShared";
import { answerOf, refusalOf } from "../refusal";
import { askFailedWords, replyWords } from "../sign-in/words";
import type { JoiningSeam } from "./seam";
import { changeFailedWords } from "./words";

// The joining seam filled in by Convex. A refusal comes back as the server's own words; any other
// failure is logged and said plainly (src/refusal.ts).

const change = (doing: string, attempt: () => Promise<unknown>) => refusalOf(attempt, doing, changeFailedWords);

const useInvitesPage: JoiningSeam["useInvitesPage"] = (leagueId) => useQuery(api.invitesPage.page, { leagueId });
const useJoinPage: JoiningSeam["useJoinPage"] = (token) => useQuery(api.joinRequests.joinPage, { token });

export function useLiveJoining(): JoiningSeam {
  const send = useMutation(api.invites.send);
  const resend = useMutation(api.invites.resend);
  const cancel = useMutation(api.invites.cancel);
  const make = useMutation(api.inviteLink.make);
  const switchOff = useMutation(api.inviteLink.switchOff);
  const approve = useMutation(api.joinRequests.approve);
  const refuse = useMutation(api.joinRequests.refuseRequest);
  const ask = useMutation(api.joinRequests.ask);
  const signInToJoin = useAction(api.inviteLink.signInToJoin);
  return useMemo(
    () => ({
      useInvitesPage,
      useJoinPage,
      invite: (leagueId, email, teamId) => change("Sending an invite", () => send({ leagueId, email, teamId: teamId ?? undefined })),
      resendInvite: (inviteId) => change("Resending an invite", () => resend({ inviteId })),
      cancelInvite: (inviteId) => change("Cancelling an invite", () => cancel({ inviteId })),
      makeLink: (leagueId) => change("Making the invite link", () => make({ leagueId })),
      switchOffLink: (leagueId) => change("Switching off the invite link", () => switchOff({ leagueId })),
      approve: (requestId, teamId) => change("Approving a join request", () => approve({ requestId, teamId: teamId ?? undefined })),
      refuse: (requestId) => change("Refusing a join request", () => refuse({ requestId })),
      askToJoin: (token) => change("Asking to join", () => ask({ token })),
      signInToJoin: (token, email) =>
        answerOf(
          async () => {
            const reply = await signInToJoin({ token, email });
            return reply === "linkOff" ? linkOffWords : replyWords[reply];
          },
          "Asking for a sign-in link to join",
          askFailedWords,
        ),
    }),
    [send, resend, cancel, make, switchOff, approve, refuse, ask, signInToJoin],
  );
}
