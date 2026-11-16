// Mail in the preview (src/app/preview.ts): made-up letters in its league, some unread, so the shot
// shows both, and the top bar's count and Continue from them. Opening one changes nothing, and
// writing to the league sends nothing and says so.

import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail/mail";
import { LATEST_LETTERS } from "../../convex/mail/mailLimits";
import { HOUR_MS } from "../../convex/shared/time";
import { nextStep, type TopBarState } from "../frame/topBar/topBarState";
import { manager, previewChristmasBreak, previewSays, previewTeamNames, proLeague } from "../shared/preview";
import type { MailSeam } from "./seam";

/** The newest letter came an hour ago, so the unread ones are this week's whenever the preview opens (#2450). */
const NEWEST = Date.now() - HOUR_MS;
const { commissionerEmail: commissioner } = proLeague;

type Made = Pick<LetterSummary, "subject" | "body" | "read"> & Partial<Pick<LetterSummary, "from" | "kind">>;
const letter = (number: number, hoursAgo: number, { from = null, kind = "commissioner", ...made }: Made): LetterSummary => ({
  letterId: `preview-letter-${number}` as Id<"letters">,
  leagueName: proLeague.name,
  at: NEWEST - hoursAgo * HOUR_MS,
  kind,
  from,
  ...made,
});

const previewLetters: LetterSummary[] = [
  letter(1, 0, {
    subject: `No league games in gameweeks ${previewChristmasBreak[0]} to ${previewChristmasBreak.at(-1)}`,
    body: `We're off over Christmas: gameweeks ${previewChristmasBreak[0]} to ${previewChristmasBreak.at(-1)} don't count.`,
    from: commissioner,
    read: false,
  }),
  letter(2, 5, {
    subject: `bob@example.com joined as manager of ${previewTeamNames[8]}`,
    body: `${commissioner} added bob@example.com as the manager of ${previewTeamNames[8]}.`,
    read: false,
  }),
  letter(3, 26, { subject: `Team 4 is now ${previewTeamNames[3]}`, body: `ann@example.com renamed Team 4 to ${previewTeamNames[3]}.`, kind: "league", read: false }),
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
  useLetters: () => previewLetters,
  open: async () => {},
  writeToLeague: previewSays("no letter was sent"),
};

const unreadMail = previewLetters.filter((each) => !each.read).length;
// The preview's lineup locks more than a day off (myTeam/tactics/preview.ts), so it isn't due yet,
// and no offer waits for him.
export const previewTopBar: TopBarState = { unreadMail, next: nextStep({ unreadMail, lineupDue: false, offersWaiting: 0 }) };

/** The newest letters a screen's Mail panel shows (My team's Squad tab, League home), and how many
 *  are unread. */
export const previewLatestMail = { letters: previewLetters.slice(0, LATEST_LETTERS), unread: unreadMail };
