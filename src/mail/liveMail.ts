import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { MAIL_PATH } from "../frame/menu";
import type { TopBarState } from "../frame/topBarState";
import { refusalOf } from "../shared/refusal";
import type { MailSeam } from "./seam";
import { sendFailedWords, unreadCount } from "./words";

const useLetters: MailSeam["useLetters"] = () => {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.mail.mail.letters, isAuthenticated ? {} : "skip");
};

/** The Mail seam filled in by Convex, and the top bar's count from it: Continue goes to Mail while
 *  a letter is unread, as nothing else it looks for (spec/12) is wired in yet: the lineup before
 *  the deadline waits on #526, and trades aren't built. A refusal comes back as
 *  the server's own words (convex/mail/mail.ts); any other failure is logged and said plainly. */
export function useLiveMail(): { mail: MailSeam; topBar: TopBarState } {
  const { isAuthenticated } = useConvexAuth();
  const unread = useQuery(api.mail.mail.unreadCount, isAuthenticated ? {} : "skip") ?? 0;
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
  const topBar = useMemo<TopBarState>(
    () => ({ unreadMail: unread, next: unread > 0 ? { path: MAIL_PATH, reason: unreadCount(unread) } : null }),
    [unread],
  );
  return { mail, topBar };
}
