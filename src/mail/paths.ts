// Where a letter is: Mail, the letter to open in the address's search, so a screen's Mail widget
// can open one there (My team's Squad tab; docs/design/approved/team-squad).

import type { Id } from "../../convex/_generated/dataModel";
import { MAIL_PATH } from "../frame/menu";

/** The address's search: the letter to open, or none. */
export type MailSearch = { letter?: Id<"letters"> };

/** A link's `to` and `search` for a letter opened in Mail. */
export const letterLink = (letter: Id<"letters">) => ({ to: MAIL_PATH, search: { letter } satisfies MailSearch });

/** The search as the address holds it, anything else dropped. */
export function mailSearchOf(search: Record<string, unknown>): MailSearch {
  const { letter } = search;
  return { letter: typeof letter === "string" && letter !== "" ? (letter as Id<"letters">) : undefined };
}
