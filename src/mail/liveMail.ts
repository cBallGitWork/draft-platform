import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { MailSeam } from "./seam";
import { changeFailedWords } from "../shared/words";
import { sendFailedWords } from "./words";

const useLetters: MailSeam["useLetters"] = (leagueId) => {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.mail.mail.letters, isAuthenticated ? (leagueId === null ? {} : { leagueId }) : "skip");
};

/** The Mail seam filled in by Convex, and the top bar's unread count from it, which Continue goes
 *  to Mail by first (frame/topBar/liveTopBar.tsx). A refusal comes back as the server's own words
 *  (convex/mail/mail.ts); any other failure is logged and said plainly. */
export function useLiveMail(): { mail: MailSeam; unreadMail: number } {
  const { isAuthenticated } = useConvexAuth();
  const unreadMail = useQuery(api.mail.mail.unreadCount, isAuthenticated ? {} : "skip") ?? 0;
  const open = useMutation(api.mail.mail.open);
  const write = useMutation(api.mail.mail.writeToLeague);
  const ask = useMutation(api.leagues.commissionerAsks.ask);

  const mail = useMemo<MailSeam>(
    () => ({
      useLetters,
      open: async (letterId) => {
        try {
          await open({ letterId });
        } catch (error) {
          console.error("Marking a letter read failed:", error);
        }
      },
      writeToLeague: (letter) => refusalOf(() => write(letter), "Sending a letter to the league", sendFailedWords),
      askToBeCommissioner: (leagueId) => refusalOf(() => ask({ leagueId }), "Asking to be commissioner", changeFailedWords),
    }),
    [open, write, ask],
  );
  return { mail, unreadMail };
}
