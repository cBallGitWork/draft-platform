import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { MAIL_PATH } from "../frame/menu";
import type { TopBarState } from "../frame/topBarState";
import type { Mail } from "./actions";
import { sendFailedWords, unreadCount } from "./words";

/** The Mail seam filled in by Convex, and the top bar's count from it: Continue goes to Mail while
 *  a letter is unread, as nothing else it looks for (spec/12) is built yet. A refusal comes back as
 *  the server's own words (convex/mail.ts); any other failure is logged and said plainly. */
export function useLiveMail(): { mail: Mail; topBar: TopBarState } {
  const { isAuthenticated } = useConvexAuth();
  const letters = useQuery(api.mail.letters, isAuthenticated ? {} : "skip");
  const unread = useQuery(api.mail.unreadCount, isAuthenticated ? {} : "skip") ?? 0;
  const open = useMutation(api.mail.open);
  const write = useMutation(api.mail.writeToLeague);

  const mail = useMemo<Mail>(
    () => ({
      letters: letters ?? null,
      open: async (letterId) => {
        try {
          await open({ letterId });
        } catch (error) {
          console.error("Marking a letter read failed:", error);
        }
      },
      writeToLeague: async (letter) => {
        try {
          await write(letter);
          return null;
        } catch (error) {
          if (error instanceof ConvexError && typeof error.data === "string") return error.data;
          console.error("Sending a letter to the league failed:", error);
          return sendFailedWords;
        }
      },
    }),
    [letters, open, write],
  );
  const topBar = useMemo<TopBarState>(
    () => ({ unreadMail: unread, next: unread > 0 ? { path: MAIL_PATH, reason: unreadCount(unread) } : null }),
    [unread],
  );
  return { mail, topBar };
}
