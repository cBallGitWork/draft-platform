// Mail in the preview (src/preview.ts): made-up letters, some unread, so the shot shows both.
// Opening one changes nothing, and writing to the league sends nothing and says so.

import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail";
import type { Mail } from "./actions";

const hour = 60 * 60 * 1000;
const filedAt = Date.parse("2026-10-20T14:02:00Z");

const letter = (number: number, hoursAgo: number, fields: Pick<LetterSummary, "subject" | "body" | "read"> & Partial<LetterSummary>) => ({
  letterId: `preview-letter-${number}` as Id<"letters">,
  leagueName: "Tim Hortons Pro League",
  at: filedAt - hoursAgo * hour,
  from: null,
  ...fields,
});

export const previewLetters: LetterSummary[] = [
  letter(1, 0, {
    subject: "Draft night is Friday at eight",
    body: "Draft night is Friday at eight. The room opens at half seven: set your queue before then.\n\nSee you there.",
    from: "commish@example.com",
    read: false,
  }),
  letter(2, 5, {
    subject: "bob@example.com joined as manager of Team 9",
    body: "commish@example.com added bob@example.com as the manager of Team 9.",
    read: false,
  }),
  letter(3, 26, {
    subject: "Team 4 is now Rovers XI",
    body: "ann@example.com renamed Team 4 to Rovers XI.",
    read: false,
  }),
  letter(4, 49, {
    subject: "The league now holds up to 12 teams",
    body: "commish@example.com changed the most teams the league holds from 10 to 12.",
    read: true,
  }),
  letter(5, 72, {
    subject: "manager@example.com joined as manager of Saka Potatoes",
    body: "commish@example.com added manager@example.com as the manager of Saka Potatoes.",
    read: true,
  }),
];

export const previewMail: Mail = {
  letters: previewLetters,
  open: async () => {},
  writeToLeague: async () => "This is a preview: no letter was sent.",
};
