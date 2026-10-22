// Mail in the preview (src/preview.ts): made-up letters in its league, some unread, so the shot
// shows both, and the top bar's count and Continue from them. Opening one changes nothing, and
// writing to the league sends nothing and says so.

import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail/mail";
import { HOUR_MS } from "../../convex/shared/time";
import { MAIL_PATH } from "../frame/menu";
import type { TopBarState } from "../frame/topBarState";
import { manager, previewSays, proLeague } from "../preview";
import type { MailSeam } from "./seam";
import { unreadCount } from "./words";

const NEWEST = Date.parse("2026-10-20T14:02:00Z");
const { commissionerEmail: commissioner } = proLeague;

type Made = Pick<LetterSummary, "subject" | "body" | "read"> & Partial<Pick<LetterSummary, "from">>;
const letter = (number: number, hoursAgo: number, { from = null, ...made }: Made): LetterSummary => ({
  letterId: `preview-letter-${number}` as Id<"letters">,
  leagueName: proLeague.name,
  at: NEWEST - hoursAgo * HOUR_MS,
  from,
  ...made,
});

const previewLetters: LetterSummary[] = [
  letter(1, 0, {
    subject: "Draft night is Friday at eight",
    body: "Draft night is Friday at eight. The room opens at half seven: set your queue before then.\n\nSee you there.",
    from: commissioner,
    read: false,
  }),
  letter(2, 5, {
    subject: "bob@example.com joined as manager of Team 9",
    body: `${commissioner} added bob@example.com as the manager of Team 9.`,
    read: false,
  }),
  letter(3, 26, { subject: "Team 4 is now Rovers XI", body: "ann@example.com renamed Team 4 to Rovers XI.", read: false }),
  letter(4, 49, {
    subject: "The league now holds up to 12 teams",
    body: `${commissioner} changed the most teams the league holds from 10 to 12.`,
    read: true,
  }),
  letter(5, 72, {
    subject: `${manager.email} joined as manager of ${proLeague.teamName}`,
    body: `${commissioner} added ${manager.email} as the manager of ${proLeague.teamName}.`,
    read: true,
  }),
];

export const previewMail: MailSeam = {
  letters: previewLetters,
  open: async () => {},
  writeToLeague: previewSays("no letter was sent"),
};

const unreadMail = previewLetters.filter((each) => !each.read).length;
export const previewTopBar: TopBarState = { unreadMail, next: { path: MAIL_PATH, reason: unreadCount(unreadMail) } };
