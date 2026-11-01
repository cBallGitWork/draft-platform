import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { MailSeam } from "./seam";
import { sendFailedWords } from "./words";

const useLetters: MailSeam["useLetters"] = () => {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.mail.mail.letters, isAuthenticated ? {} : "skip");
};

/** The Mail seam filled in by Convex, and the top bar's unread count from it, which Continue goes
 *  to Mail by first (frame/topBar/liveTopBar.tsx). A refusal comes back as the server's own words
 *  (convex/mail/mail.ts); any other failure is logged and said plainly. */
export function useLiveMail(): { mail: MailSeam; unreadMail: number } {
  const { isAuthenticated } = useConvexAuth();
  const unreadMail = useQuery(api.mail.mail.unreadCount, isAuthenticated ? {} : "skip") ?? 0;
  const open = useMutation(api.mail.mail.open);
  const write = useMutation(api.mail.mail.writeToLeague);

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
    }),
    [open, write],
  );
  return { mail, unreadMail };
}
