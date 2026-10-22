// What the top bar tells a signed-in manager: Mail's unread count, and where Continue goes.
// Mail (#26) feeds it live (src/mail/liveMail.ts); the other things Continue looks for (spec/12)
// aren't built yet.

export type NextStep = { path: string; reason: string };
export type TopBarState = { unreadMail: number; next: NextStep | null };
