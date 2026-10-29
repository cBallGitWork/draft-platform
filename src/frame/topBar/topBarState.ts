// What the top bar tells a signed-in manager: Mail's unread count, and where Continue goes.
// Mail (#26) feeds it live (src/mail/liveMail.ts). Of the other things Continue looks for
// (spec/12), a lineup before the deadline has what it needs built but isn't wired in yet (#526),
// and trades aren't built.

export type NextStep = { path: string; reason: string };
export type TopBarState = { unreadMail: number; next: NextStep | null };
